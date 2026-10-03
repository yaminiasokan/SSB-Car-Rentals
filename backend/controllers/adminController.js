const { populate } = require('../db/model');
const Vehicle = require('../models/Vehicle');
const Booking = require('../models/Booking');
const User = require('../models/User');
const Payment = require('../models/Payment');
const Inspection = require('../models/Inspection');
const DamageReport = require('../models/DamageReport');
const SupportTicket = require('../models/SupportTicket');
const RentalAgreement = require('../models/RentalAgreement');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { str } = require('../utils/helpers');
const { decorateVehicles } = require('../services/availabilityService');
const { changeStatus, cancelBooking } = require('../services/bookingService');
const { runReminders } = require('../services/reminderService');

exports.stats = asyncHandler(async (req, res) => {
  const vehicles = await decorateVehicles(await Vehicle.where("status <> 'Retired'"));
  const recentBookings = await Booking.find({}, { sort: [['createdAt', 'desc']], limit: 6 });
  await populate(recentBookings, [{ path: 'vehicle', model: Vehicle, select: 'name' }, { path: 'user', model: User, select: 'name' }]);
  const recentDamage = await DamageReport.where("status = ANY($1::text[])", [['Pending Review', 'Customer Disputed']], { sort: [['createdAt', 'desc']], limit: 5 });
  await populate(recentDamage, [{ path: 'vehicle', model: Vehicle, select: 'name' }, { path: 'booking', model: Booking, select: 'bookingId' }]);

  const [activeRentals, totalCustomers, totalBookings, pendingBookings, totalRevenue, pendingDamage, openTickets] = await Promise.all([
    Booking.count({ status: 'Active' }),
    User.count({ role: 'customer' }),
    Booking.count({}),
    Booking.count({ status: 'Pending' }),
    Payment.totalRevenue(),
    DamageReport.count({ status: 'Pending Review' }),
    SupportTicket.countWhere("status = ANY($1::text[])", [['Open', 'In Progress']]),
  ]);
  res.json({
    success: true,
    stats: {
      totalVehicles: vehicles.length,
      availableVehicles: vehicles.filter((v) => v.availabilityLabel === 'Available').length,
      activeRentals, totalCustomers, totalBookings, pendingBookings,
      totalRevenue,
      pendingDamageReports: pendingDamage,
      supportTickets: openTickets,
    },
    recentBookings, recentDamage,
  });
});

exports.bookings = asyncHandler(async (req, res) => {
  const bookings = await Booking.adminSearch({ status: str(req.query.status), search: str(req.query.search) });
  await populate(bookings, [{ path: 'vehicle', model: Vehicle, select: 'name images fuelDisplay' }, { path: 'user', model: User, select: 'name email phone' }]);
  res.json({ success: true, bookings });
});

exports.bookingDetail = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id);
  if (!booking) throw new AppError('That booking could not be found.', 404);
  await populate(booking, [{ path: 'vehicle', model: Vehicle }, { path: 'user', model: User, select: 'name email phone license address' }]);
  const [payments, inspections, damageReport, agreement] = await Promise.all([
    Payment.find({ booking: booking._id }, { sort: [['createdAt', 'desc']] }),
    Inspection.find({ booking: booking._id }),
    DamageReport.findOne({ booking: booking._id }),
    RentalAgreement.findOne({ booking: booking._id }),
  ]);
  res.json({ success: true, booking, payments, inspections, damageReport, agreement });
});

exports.setStatus = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id);
  if (!booking) throw new AppError('That booking could not be found.', 404);
  const updated = await changeStatus(booking, req.body.status, { by: 'admin', note: req.body.note });
  res.json({ success: true, booking: updated });
});

exports.approve = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id);
  if (!booking) throw new AppError('That booking could not be found.', 404);
  const updated = await changeStatus(booking, 'Confirmed', { by: 'admin', note: 'Approved by SSB staff' });
  res.json({ success: true, booking: updated });
});

exports.cancel = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id);
  if (!booking) throw new AppError('That booking could not be found.', 404);
  const updated = await cancelBooking(booking, { by: 'admin', reason: req.body.reason || 'Cancelled by SSB staff' });
  res.json({ success: true, booking: updated });
});

exports.runReminders = asyncHandler(async (req, res) => res.json({ success: true, sent: await runReminders() }));
