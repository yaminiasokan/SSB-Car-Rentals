const Notification = require('../models/Notification');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { notify } = require('../services/notificationService');

exports.list = asyncHandler(async (req, res) => {
  const [notifications, unread] = await Promise.all([
    Notification.find({ user: req.user._id }, { sort: [['createdAt', 'desc']], limit: 60 }),
    Notification.count({ user: req.user._id, read: false }),
  ]);
  res.json({ success: true, notifications, unread });
});

exports.markRead = asyncHandler(async (req, res) => {
  await Notification.markRead(req.params.id, req.user._id);
  res.json({ success: true });
});

exports.markAllRead = asyncHandler(async (req, res) => {
  await Notification.markAllRead(req.user._id);
  res.json({ success: true });
});

exports.remove = asyncHandler(async (req, res) => {
  await Notification.removeForUser(req.params.id, req.user._id);
  res.json({ success: true });
});

// admin: send a message to one customer
exports.adminMessage = asyncHandler(async (req, res) => {
  const user = await User.findById(req.body.userId);
  if (!user) throw new AppError('Customer not found.', 404);
  await notify(user._id, 'admin_message', req.body.title || 'Message from SSB Car Rentals', req.body.message, req.body.link);
  res.status(201).json({ success: true, message: `Message sent to ${user.name}.` });
});
