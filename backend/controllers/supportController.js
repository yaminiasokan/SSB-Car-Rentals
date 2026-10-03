const { populate } = require('../db/model');
const SupportTicket = require('../models/SupportTicket');
const Booking = require('../models/Booking');
const Vehicle = require('../models/Vehicle');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { newTicketNo } = require('../utils/sequence');
const { notify, notifyAdmins } = require('../services/notificationService');
const { idOf, str } = require('../utils/helpers');

const isStaff = (u) => ['admin', 'staff'].includes(u.role);

exports.create = asyncHandler(async (req, res) => {
  const { subject, category = 'General', message, bookingId } = req.body;
  let booking;
  if (bookingId) {
    booking = await Booking.findOne({ _id: bookingId, user: req.user._id });
    if (!booking) throw new AppError('That booking could not be found.', 404);
  }
  const ticket = await SupportTicket.insert({
    ticketNo: await newTicketNo(), user: req.user._id, booking: booking?._id, subject, category, message,
    priority: category === 'Damage' || category === 'Payment' ? 'High' : 'Normal',
  });
  await notifyAdmins('support', 'New support ticket', `${ticket.ticketNo}: ${subject}`, '/admin/support');
  res.status(201).json({ success: true, ticket });
});

/** Emergency assistance during an active rental */
exports.emergency = asyncHandler(async (req, res) => {
  const { bookingId, emergencyType, location, message = '' } = req.body;
  const booking = await Booking.findOne({ _id: bookingId, user: req.user._id });
  if (!booking) throw new AppError('That booking could not be found.', 404);
  await populate(booking, { path: 'vehicle', model: Vehicle, select: 'name' });
  if (booking.status !== 'Active') throw new AppError('Emergency assistance is available during an active rental. For anything urgent, call 7305786562.', 409);
  const ticket = await SupportTicket.insert({
    ticketNo: await newTicketNo(), user: req.user._id, booking: booking._id, category: 'Emergency', priority: 'Urgent', emergencyType, location,
    subject: `Emergency: ${emergencyType} — ${booking.vehicle.name}`,
    message: message || `${emergencyType} requested for booking ${booking.bookingId}.`,
  });
  await notifyAdmins('support', `URGENT: ${emergencyType}`, `${req.user.name} needs help with ${booking.vehicle.name} (${booking.bookingId}). Call ${req.user.phone}.`, '/admin/support');
  await notify(req.user._id, 'support', 'Help is on the way', `Emergency ticket ${ticket.ticketNo} was created. Our 24x7 team will call you shortly.`, '/support');
  res.status(201).json({ success: true, ticket });
});

exports.mine = asyncHandler(async (req, res) => {
  res.json({ success: true, tickets: await SupportTicket.find({ user: req.user._id }, { sort: [['createdAt', 'desc']] }) });
});

exports.get = asyncHandler(async (req, res) => {
  const t = await SupportTicket.findById(req.params.id);
  if (!t || (String(t.user) !== String(req.user._id) && !isStaff(req.user))) throw new AppError('That ticket could not be found.', 404);
  await populate(t, [{ path: 'user', model: User, select: 'name phone email' }, { path: 'booking', model: Booking, select: 'bookingId' }]);
  res.json({ success: true, ticket: t });
});

exports.reply = asyncHandler(async (req, res) => {
  const t = await SupportTicket.findById(req.params.id);
  if (!t || (String(t.user) !== String(req.user._id) && !isStaff(req.user))) throw new AppError('That ticket could not be found.', 404);
  if (t.status === 'Closed') throw new AppError('This ticket is closed. Please open a new one.', 409);
  const updated = await SupportTicket.addReply(
    t._id,
    { by: req.user._id, role: req.user.role, name: req.user.name, message: req.body.message },
    isStaff(req.user) && t.status === 'Open' ? 'In Progress' : undefined,
  );
  if (isStaff(req.user)) await notify(idOf(updated.user), 'support', `Reply on ${updated.ticketNo}`, req.body.message.slice(0, 140), '/support');
  res.json({ success: true, ticket: updated });
});

// admin
exports.adminList = asyncHandler(async (req, res) => {
  const tickets = await SupportTicket.find({ status: str(req.query.status) }, { sort: [['createdAt', 'desc']], limit: 200 });
  await populate(tickets, { path: 'user', model: User, select: 'name phone email' });
  const order = { Urgent: 0, High: 1, Normal: 2, Low: 3 };
  tickets.sort((a, b) => (['Resolved', 'Closed'].includes(a.status)) - (['Resolved', 'Closed'].includes(b.status))
    || order[a.priority] - order[b.priority] || new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ success: true, tickets });
});

exports.adminUpdate = asyncHandler(async (req, res) => {
  const t = await SupportTicket.findById(req.params.id);
  if (!t) throw new AppError('That ticket could not be found.', 404);
  const patch = {};
  if (req.body.status) patch.status = req.body.status;
  if (req.body.priority) patch.priority = req.body.priority;
  const updated = await SupportTicket.update(t._id, patch);
  if (req.body.status && ['Resolved', 'Closed'].includes(req.body.status)) {
    await notify(idOf(updated.user), 'support', `Ticket ${updated.ticketNo} ${req.body.status.toLowerCase()}`, `Your support ticket "${updated.subject}" is now ${req.body.status.toLowerCase()}.`, '/support');
  }
  res.json({ success: true, ticket: updated });
});
