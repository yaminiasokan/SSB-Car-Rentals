const { tx } = require('../db/pool');
const Booking = require('../models/Booking');
const Payment = require('../models/Payment');
const Reward = require('../models/Reward');
const Vehicle = require('../models/Vehicle');
const AppError = require('../utils/AppError');
const { CANCELLATION_TIERS } = require('../config/constants');
const { notify, notifyAdmins } = require('./notificationService');
const { reverseForBooking } = require('./rewardsService');
const { ensureAgreement } = require('./agreementService');
const { inr, idOf } = require('../utils/helpers');

const TRANSITIONS = { Pending: ['Confirmed', 'Cancelled'], Confirmed: ['Active', 'Cancelled'], Active: ['Completed'], Completed: [], Cancelled: [] };

const refundTier = (pickupAt, now = new Date()) => {
  const hours = (new Date(pickupAt) - now) / 36e5;
  return CANCELLATION_TIERS.find((t) => hours >= t.minHoursBeforePickup) || CANCELLATION_TIERS[CANCELLATION_TIERS.length - 1];
};

/** One row of booking.statusHistory (stored as JSONB; `at` is an ISO string). */
const historyEntry = (status, by, note) => ({ status, by, note, at: new Date().toISOString() });
const withHistory = (booking, status, by, note) => [...(booking.statusHistory || []), historyEntry(status, by, note)];

/** The updated booking keeps whatever the caller had populated (vehicle / user objects) so API responses look the same. */
const keepRelations = (before, after) => {
  if (after) { after.vehicle = before.vehicle; after.user = before.user; }
  return after;
};

const staleError = () => new AppError('This booking was just changed by someone else. Please refresh and try again.', 409);

/**
 * The database writes for "booking confirmed". Runs on a transaction client so the caller can
 * combine it with other writes (e.g. the payment that confirmed it). Notifications are sent by the caller
 * AFTER the transaction commits. `extra` lets the caller set more booking fields in the same UPDATE.
 */
async function confirmInTx(db, booking, by = 'system', note = '', extra = {}) {
  const updated = await Booking.update(booking._id, {
    ...extra, status: 'Confirmed', holdExpiresAt: null, statusHistory: withHistory(booking, 'Confirmed', by, note),
  }, db);
  await Vehicle.adjustBookingCount(idOf(booking.vehicle), 1, db);
  await ensureAgreement(updated, db);
  return updated;
}

const notifyConfirmed = (b) => notify(idOf(b.user), 'booking_confirmed', 'Booking confirmed', `Your booking ${b.bookingId} is confirmed.`, `/booking/confirmation/${b._id}`);

async function markConfirmed(booking, by = 'system', note = '') {
  if (booking.status === 'Confirmed') return booking;
  const updated = await tx(async (db) => {
    const fresh = await Booking.lockById(booking._id, db);
    if (!fresh || fresh.status !== booking.status) throw staleError();
    return confirmInTx(db, fresh, by, note);
  });
  await notifyConfirmed(updated);
  return keepRelations(booking, updated);
}

async function cancelBooking(booking, { by = 'customer', reason = '' } = {}) {
  const { updated, refundAmount, wasPending } = await tx(async (db) => {
    const fresh = await Booking.lockById(booking._id, db);
    if (!fresh || !['Pending', 'Confirmed'].includes(fresh.status)) throw new AppError('This booking can no longer be cancelled.', 409);

    const payment = await Payment.latestForBooking(fresh._id, 'booking', db);
    let percent = 0;
    let refund = 0;
    let paymentStatus;
    if (payment && payment.status === 'Success') {
      percent = by === 'admin' ? 100 : refundTier(fresh.pickupAt).refundPercent;
      const rentalRefund = Math.round((fresh.pricing.rentalTotal * percent) / 100);
      refund = rentalRefund + fresh.pricing.deposit; // deposit is always returned
      paymentStatus = percent === 100 ? 'Refunded' : 'Partially Refunded';
      await Payment.update(payment._id, { status: paymentStatus, refundAmount: refund, revenueAmount: fresh.pricing.rentalTotal - rentalRefund }, db);
    } else if (payment && payment.status === 'Pending') {
      await Payment.update(payment._id, { status: 'Failed', failureReason: 'Booking cancelled before pickup' }, db);
    }

    const wasConfirmed = fresh.status === 'Confirmed';
    const abandoned = fresh.status === 'Pending' && !payment; // unpaid: no need to notify anyone
    const row = await Booking.update(fresh._id, {
      status: 'Cancelled', holdExpiresAt: null,
      ...(paymentStatus ? { paymentStatus } : {}),
      cancellation: { reason, cancelledAt: new Date(), cancelledBy: by, refundPercent: percent, refundAmount: refund },
      statusHistory: withHistory(fresh, 'Cancelled', by, reason),
    }, db);

    if (wasConfirmed) await Vehicle.adjustBookingCount(idOf(fresh.vehicle), -1, db);
    if (fresh.pricing.promoCode?.startsWith('SSBR-')) await Reward.releaseCoupon(fresh.pricing.promoCode, fresh._id, db);
    await reverseForBooking(fresh, db);
    return { updated: row, refundAmount: refund, wasPending: abandoned };
  });

  if (wasPending) return keepRelations(booking, updated);
  const refundText = refundAmount ? ` A refund of ${inr(refundAmount)} will be returned to your original payment method.` : '';
  await notify(idOf(updated.user), 'booking_cancelled', 'Booking cancelled', `Booking ${updated.bookingId} was cancelled.${refundText}`, '/dashboard');
  if (by !== 'admin') await notifyAdmins('booking_cancelled', 'Booking cancelled by customer', `${updated.bookingId} was cancelled by ${updated.customer.name}.`, '/admin/bookings');
  return keepRelations(booking, updated);
}

async function changeStatus(booking, status, { by = 'admin', note = '' } = {}) {
  if (status === 'Cancelled') return cancelBooking(booking, { by, reason: note || 'Cancelled by SSB staff' });
  if (!TRANSITIONS[booking.status]?.includes(status)) {
    throw new AppError(`A ${booking.status.toLowerCase()} booking cannot be changed to ${status.toLowerCase()}.`, 409);
  }
  if (status === 'Confirmed') return markConfirmed(booking, by, note);

  const updated = await tx(async (db) => {
    const fresh = await Booking.lockById(booking._id, db);
    if (!fresh || !TRANSITIONS[fresh.status]?.includes(status)) throw staleError();
    return Booking.update(fresh._id, { status, statusHistory: withHistory(fresh, status, by, note) }, db);
  });
  if (status === 'Active') {
    await notify(idOf(updated.user), 'general', 'Your rental has started', 'Enjoy your journey! You can track your rental and reach emergency assistance any time.', '/track-rental');
  } else if (status === 'Completed') {
    await notify(idOf(updated.user), 'general', 'Rental completed', `Thanks for riding with SSB. Tell us how ${updated.bookingId} went.`, `/review/${updated._id}`);
  }
  return keepRelations(booking, updated);
}

module.exports = { TRANSITIONS, refundTier, historyEntry, withHistory, confirmInTx, notifyConfirmed, markConfirmed, cancelBooking, changeStatus };
