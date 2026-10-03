const { tx } = require('../db/pool');
const { populate } = require('../db/model');
const Booking = require('../models/Booking');
const Vehicle = require('../models/Vehicle');
const User = require('../models/User');
const Payment = require('../models/Payment');
const Inspection = require('../models/Inspection');
const DamageReport = require('../models/DamageReport');
const RentalAgreement = require('../models/RentalAgreement');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { newBookingId } = require('../utils/sequence');
const { SERVICES, PROMOS, TAX_RATE, HOLD_MINUTES, MIN_RENTAL_HOURS, MAX_KM_PER_DAY, CANCELLATION_TIERS, LOCATIONS } = require('../config/constants');
const { priceBooking } = require('../services/pricingService');
const { conflictingBookings } = require('../services/availabilityService');
const { cancelBooking, refundTier } = require('../services/bookingService');
const { getVehiclePosition } = require('../services/trackingService');
const { ensureAgreement, streamAgreementPdf } = require('../services/agreementService');

const isStaff = (u) => ['admin', 'staff'].includes(u.role);

/** Loads a booking and makes sure the current user may see it. `relations` are populated (default: the full vehicle). */
async function loadOwned(req, relations = [{ path: 'vehicle', model: Vehicle }]) {
  const booking = await Booking.findById(req.params.id);
  if (!booking) throw new AppError('That booking could not be found.', 404);
  const ownerId = String(booking.user);
  if (ownerId !== String(req.user._id) && !isStaff(req.user)) throw new AppError('That booking could not be found.', 404);
  await populate(booking, relations);
  return booking;
}
exports.loadOwned = loadOwned;

exports.config = (req, res) => res.json({
  success: true,
  services: SERVICES, promos: Object.values(PROMOS).map((p) => ({ code: p.code, label: p.label })),
  taxRate: TAX_RATE, holdMinutes: HOLD_MINUTES, minRentalHours: MIN_RENTAL_HOURS, maxKmPerDay: MAX_KM_PER_DAY, locations: LOCATIONS,
  cancellation: CANCELLATION_TIERS,
});

exports.quote = asyncHandler(async (req, res) => {
  const { vehicleId, pickupAt, returnAt, services, promoCode, deliveryKm } = req.body;
  const vehicle = await Vehicle.findById(vehicleId);
  if (!vehicle || vehicle.status === 'Retired') throw new AppError('That vehicle could not be found.', 404);
  const pricing = await priceBooking({ vehicle, pickupAt, returnAt, services: services || [], promoCode, deliveryKm, userId: req.user?._id });
  res.json({ success: true, pricing });
});

exports.create = asyncHandler(async (req, res) => {
  const { vehicleId, pickupLocation, returnLocation, pickupAt, returnAt, services = [], deliveryKm, promoCode, customer } = req.body;

  const vehicle = await Vehicle.findById(vehicleId);
  if (!vehicle || vehicle.status === 'Retired') throw new AppError('That vehicle could not be found.', 404);
  if (!vehicle.availability || vehicle.status !== 'Active') throw new AppError('This vehicle is not available for booking right now.', 409);
  if (pickupLocation !== vehicle.location) throw new AppError(`This vehicle is based in ${vehicle.location}. Choose ${vehicle.location} as the pickup location.`, 422);
  if (new Date(pickupAt) < new Date(Date.now() - 5 * 60 * 1000)) throw new AppError('Pickup time must be in the future.', 422);

  const conflicts = await conflictingBookings(vehicle._id, pickupAt, returnAt);
  if (conflicts.length) throw new AppError('Sorry, this vehicle is already booked for part of that period. Try different dates or pick another vehicle.', 409);

  const pricing = await priceBooking({ vehicle, pickupAt, returnAt, services, deliveryKm, promoCode, userId: req.user._id });
  if (promoCode && !pricing.promoCode) throw new AppError(pricing.promoMessage || 'That promo code cannot be applied to this booking.', 422, { fields: { promoCode: pricing.promoMessage } });

  // Lock the vehicle row, re-check for overlaps and insert in one transaction, so two people
  // booking the same car at the same moment can never both succeed.
  const booking = await tx(async (db) => {
    await db.query('SELECT id FROM vehicles WHERE id = $1 FOR UPDATE', [vehicle._id]);
    const clash = await conflictingBookings(vehicle._id, pickupAt, returnAt, null, db);
    if (clash.length) throw new AppError('Sorry, this vehicle is already booked for part of that period. Try different dates or pick another vehicle.', 409);
    return Booking.insert({
      bookingId: await newBookingId(new Date(), db),
      user: req.user._id, vehicle: vehicle._id,
      pickupLocation, returnLocation, pickupAt: new Date(pickupAt), returnAt: new Date(returnAt), services,
      pricing: {
        lines: pricing.lines, serviceLines: pricing.serviceLines, baseAmount: pricing.baseAmount, servicesAmount: pricing.servicesAmount,
        discount: pricing.discount, promoCode: pricing.promoCode, promoLabel: pricing.promoLabel, taxRate: pricing.taxRate, taxAmount: pricing.taxAmount,
        deposit: pricing.deposit, rentalTotal: pricing.rentalTotal, total: pricing.total, billingDays: pricing.billingDays, maxKm: pricing.maxKm,
      },
      customer: { name: customer.name, phone: customer.phone, email: customer.email, licenseNumber: customer.licenseNumber, address: customer.address },
      status: 'Pending',
      holdExpiresAt: new Date(Date.now() + HOLD_MINUTES * 60 * 1000),
      statusHistory: [{ status: 'Pending', by: 'customer', at: new Date().toISOString(), note: 'Booking created' }],
    }, db);
  });

  // Remember licence / address on the profile so the next booking is faster.
  const profile = {};
  if (!req.user.license?.number) profile.license = { number: customer.licenseNumber };
  if (!req.user.address) profile.address = customer.address;
  if (Object.keys(profile).length) await User.update(req.user._id, profile);

  await populate(booking, { path: 'vehicle', model: Vehicle, select: 'name images fuelDisplay location bodyType' });
  res.status(201).json({ success: true, booking });
});

exports.mine = asyncHandler(async (req, res) => {
  const bookings = await Booking.find({ user: req.user._id }, { sort: [['pickupAt', 'desc']] });
  await populate(bookings, { path: 'vehicle', model: Vehicle, select: 'name images fuelDisplay location bodyType seats transmission' });
  res.json({ success: true, bookings });
});

exports.getOne = asyncHandler(async (req, res) => {
  const booking = await loadOwned(req, [{ path: 'vehicle', model: Vehicle }, { path: 'user', model: User, select: 'name email phone' }]);
  const [payments, allInspections, damageReport, agreement] = await Promise.all([
    Payment.find({ booking: booking._id }, { sort: [['createdAt', 'desc']] }),
    Inspection.find({ booking: booking._id }),
    DamageReport.findOne({ booking: booking._id }),
    RentalAgreement.findOne({ booking: booking._id }),
  ]);
  // The customer only needs to know which inspections exist and which photo angles were taken.
  const inspections = allInspections.map((i) => ({ _id: i._id, type: i.type, createdAt: i.createdAt, images: (i.images || []).map((img) => ({ slot: img.slot })) }));
  const showReport = damageReport && (isStaff(req.user) || ['Confirmed', 'Customer Disputed', 'Resolved'].includes(damageReport.status));
  const tier = ['Pending', 'Confirmed'].includes(booking.status) ? refundTier(booking.pickupAt) : null;
  res.json({
    success: true, booking, payments, inspections,
    damageReport: showReport ? { _id: damageReport._id, reportId: damageReport.reportId, status: damageReport.status } : null,
    agreement: agreement ? { _id: agreement._id, agreementNo: agreement.agreementNo, acknowledgedAt: agreement.acknowledgedAt } : null,
    refundPreview: tier,
  });
});

exports.cancel = asyncHandler(async (req, res) => {
  const booking = await loadOwned(req);
  const by = isStaff(req.user) ? 'admin' : 'customer';
  const updated = await cancelBooking(booking, { by, reason: req.body.reason || (by === 'admin' ? 'Cancelled by SSB staff' : 'Cancelled by customer') });
  res.json({ success: true, booking: updated });
});

exports.track = asyncHandler(async (req, res) => {
  const booking = await loadOwned(req);
  if (!['Confirmed', 'Active', 'Completed'].includes(booking.status)) throw new AppError('Tracking is available once a booking is confirmed.', 409);
  res.json({
    success: true,
    booking: { _id: booking._id, bookingId: booking.bookingId, status: booking.status, pickupAt: booking.pickupAt, returnAt: booking.returnAt, pickupLocation: booking.pickupLocation, returnLocation: booking.returnLocation, vehicle: booking.vehicle },
    position: getVehiclePosition(booking),
  });
});

// ---- rental agreement ----
exports.getAgreement = asyncHandler(async (req, res) => {
  const booking = await loadOwned(req);
  if (booking.status === 'Pending' || booking.status === 'Cancelled') throw new AppError('The agreement is created once your booking is confirmed.', 409);
  res.json({ success: true, agreement: await ensureAgreement(booking) });
});

exports.acknowledgeAgreement = asyncHandler(async (req, res) => {
  const booking = await loadOwned(req);
  if (String(booking.user) !== String(req.user._id)) throw new AppError('Only the customer can accept the agreement.', 403);
  let agreement = await ensureAgreement(booking);
  if (!agreement.acknowledgedAt) {
    agreement = await RentalAgreement.update(agreement._id, { acknowledgedAt: new Date(), acknowledgedBy: req.user.name });
  }
  res.json({ success: true, agreement });
});

exports.downloadAgreement = asyncHandler(async (req, res) => {
  const booking = await loadOwned(req);
  if (booking.status === 'Pending' || booking.status === 'Cancelled') throw new AppError('The agreement is created once your booking is confirmed.', 409);
  streamAgreementPdf(res, await ensureAgreement(booking));
});
