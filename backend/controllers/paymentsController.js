const { tx } = require('../db/pool');
const { populate } = require('../db/model');
const Booking = require('../models/Booking');
const Vehicle = require('../models/Vehicle');
const User = require('../models/User');
const Payment = require('../models/Payment');
const Reward = require('../models/Reward');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { simulateGateway } = require('../services/paymentGateway');
const { confirmInTx, notifyConfirmed } = require('../services/bookingService');
const { awardForBooking } = require('../services/rewardsService');
const { conflictingBookings } = require('../services/availabilityService');
const { notify, notifyAdmins } = require('../services/notificationService');
const { newReceiptNo } = require('../utils/sequence');
const { inr, str } = require('../utils/helpers');
const { collect, removeFiles } = require('../middleware/upload');
const crypto = require('crypto');

const txnId = () => `SIM${Date.now().toString(36).toUpperCase()}${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

exports.pay = asyncHandler(async (req, res) => {
  const { bookingId, method, details = {} } = req.body;
  const booking = await Booking.findById(bookingId);
  if (!booking || String(booking.user) !== String(req.user._id)) throw new AppError('That booking could not be found.', 404);
  if (booking.status === 'Cancelled') throw new AppError('This booking was cancelled.', 409);
  if (booking.status !== 'Pending') throw new AppError('This booking has already been paid or confirmed.', 409);

  // The 30-minute hold may have lapsed — make sure nobody else took the car in the meantime.
  const conflicts = await conflictingBookings(booking.vehicle, booking.pickupAt, booking.returnAt, booking._id);
  if (conflicts.length) throw new AppError('Your payment hold expired and the vehicle has since been booked. Please choose different dates or another vehicle.', 409);

  const isCoupon = booking.pricing.promoCode?.startsWith('SSBR-');
  if (isCoupon) {
    const coupon = await Reward.findOne({ couponCode: booking.pricing.promoCode, user: req.user._id });
    if (!coupon || (coupon.couponUsed && String(coupon.couponUsedOn) !== String(booking._id))) throw new AppError('The reward coupon on this booking has already been used.', 409);
  }

  const outcome = simulateGateway(method, details); // throws 422 for badly-formed input

  const base = {
    booking: booking._id, user: req.user._id, kind: 'booking', amount: booking.pricing.total, depositAmount: booking.pricing.deposit,
    method, details: outcome.details, simulated: true, transactionId: txnId(),
  };

  if (!outcome.ok) {
    // A declined payment is recorded (outside any transaction, so it is kept) and reported to the customer.
    const failed = await Payment.insert({ ...base, status: 'Failed', failureReason: outcome.reason });
    throw new AppError(outcome.reason, 402, { paymentId: failed._id });
  }

  // Payment record + booking confirmation + coupon use are one unit: money is never taken without a confirmed booking.
  const { payment, confirmed } = await tx(async (db) => {
    const fresh = await Booking.lockById(booking._id, db);
    if (!fresh || fresh.status !== 'Pending') throw new AppError('This booking has already been paid or confirmed.', 409); // double-click / parallel request

    const pending = !!outcome.pending; // cash on pickup: confirmed now, money collected by staff at handover
    const row = await Payment.insert({
      ...base, receiptNo: await newReceiptNo(new Date(), db),
      status: pending ? 'Pending' : 'Success',
      ...(pending ? {} : { paidAt: new Date(), revenueAmount: booking.pricing.rentalTotal }),
    }, db);
    const updated = await confirmInTx(db, fresh, 'system', pending ? 'Confirmed — cash on pickup' : 'Payment received', {
      paymentStatus: pending ? 'Pay on Pickup' : 'Paid',
    });
    if (isCoupon) await Reward.markCouponUsed(fresh.pricing.promoCode, fresh._id, db);
    return { payment: row, confirmed: updated };
  });

  // Side effects after the commit: a notification problem can no longer undo a successful payment.
  await notifyConfirmed(confirmed);
  if (!outcome.pending) {
    await awardForBooking(confirmed, confirmed.pricing.rentalTotal);
    await notify(req.user._id, 'payment_success', 'Payment successful', `We received ${inr(payment.amount)} for booking ${confirmed.bookingId}.`, `/booking/confirmation/${confirmed._id}`);
  }
  await notifyAdmins('general', outcome.pending ? 'Cash booking confirmed' : 'Payment received', `${confirmed.bookingId} — ${inr(payment.amount)} via ${method}.`, '/admin/bookings');
  res.status(201).json({ success: true, payment, booking: confirmed });
});

exports.mine = asyncHandler(async (req, res) => {
  const payments = await Payment.find({ user: req.user._id }, { sort: [['createdAt', 'desc']] });
  await populate(payments, { path: 'booking', model: Booking, select: 'bookingId' });
  res.json({ success: true, payments });
});

exports.getOne = asyncHandler(async (req, res) => {
  const payment = await Payment.findById(req.params.id);
  if (!payment) throw new AppError('That payment could not be found.', 404);
  if (String(payment.user) !== String(req.user._id) && !['admin', 'staff'].includes(req.user.role)) throw new AppError('That payment could not be found.', 404);
  await populate(payment, [
    { path: 'booking', model: Booking, populate: { path: 'vehicle', model: Vehicle, select: 'name' } },
    { path: 'user', model: User, select: 'name email phone' },
  ]);
  res.json({ success: true, payment });
});

/** Customer uploads a screenshot of their UPI/bank-app payment as proof. Never auto-verified — an
 * uploaded screenshot only moves the record to "Pending Review"; only staff can mark it Verified. */
exports.uploadScreenshot = asyncHandler(async (req, res) => {
  const files = collect(req);
  const payment = await Payment.findById(req.params.id);
  if (!payment || String(payment.user) !== String(req.user._id)) {
    removeFiles(files);
    throw new AppError('That payment could not be found.', 404);
  }
  if (payment.method === 'Cash on Pickup') {
    removeFiles(files);
    throw new AppError('A payment screenshot is not needed for Cash on Pickup.', 422);
  }
  if (!files.length) throw new AppError('Choose a payment screenshot (JPG, JPEG or PNG) to upload.', 422);
  const updated = await Payment.update(payment._id, {
    screenshotUrl: `/uploads/payments/${files[0].filename}`,
    verificationStatus: 'Pending Review',
  });
  res.status(201).json({ success: true, message: 'Payment screenshot uploaded successfully', payment: updated });
});

// ---- admin ----
exports.verifyScreenshot = asyncHandler(async (req, res) => {
  const payment = await Payment.findById(req.params.id);
  if (!payment) throw new AppError('That payment could not be found.', 404);
  if (!payment.screenshotUrl) throw new AppError('No payment screenshot has been uploaded for this payment yet.', 409);
  const status = req.body.status === 'Rejected' ? 'Rejected' : 'Verified';
  const updated = await Payment.update(payment._id, { verificationStatus: status, verifiedBy: req.user._id, verifiedAt: new Date() });
  res.json({ success: true, payment: updated });
});

// ---- admin ----
exports.adminList = asyncHandler(async (req, res) => {
  const payments = await Payment.find({ status: str(req.query.status) }, { sort: [['createdAt', 'desc']], limit: 200 });
  await populate(payments, [{ path: 'booking', model: Booking, select: 'bookingId' }, { path: 'user', model: User, select: 'name' }]);
  res.json({ success: true, payments });
});

exports.collectCash = asyncHandler(async (req, res) => {
  const existing = await Payment.findById(req.params.id);
  if (!existing || existing.method !== 'Cash on Pickup') throw new AppError('That is not a cash-on-pickup payment.', 404);

  const { payment, booking } = await tx(async (db) => {
    const current = await Payment.lockById(existing._id, db);
    if (current.status !== 'Pending') throw new AppError('This payment has already been settled.', 409);
    const b = await Booking.findById(current.booking, db);
    const settled = await Payment.update(current._id, { status: 'Success', paidAt: new Date(), revenueAmount: b.pricing.rentalTotal }, db);
    const updatedBooking = await Booking.update(b._id, { paymentStatus: 'Paid' }, db);
    return { payment: settled, booking: updatedBooking };
  });
  await awardForBooking(booking, booking.pricing.rentalTotal);
  await notify(booking.user, 'payment_success', 'Payment received', `We received your cash payment of ${inr(payment.amount)} for ${booking.bookingId}.`, `/booking/confirmation/${booking._id}`);
  res.json({ success: true, payment });
});
