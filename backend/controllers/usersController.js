const User = require('../models/User');
const Vehicle = require('../models/Vehicle');
const Booking = require('../models/Booking');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { populate } = require('../db/model');
const { str } = require('../utils/helpers');

exports.updateProfile = asyncHandler(async (req, res) => {
  const { name, phone, address, licenseNumber, licenseExpiry } = req.body;
  const patch = {};
  if (name !== undefined) patch.name = name;
  if (phone !== undefined) patch.phone = phone;
  if (address !== undefined) patch.address = address;
  const license = {};
  if (licenseNumber !== undefined) { license.number = licenseNumber; license.verified = false; } // a changed number must be re-verified
  if (licenseExpiry !== undefined) license.expiry = licenseExpiry || null;
  if (Object.keys(license).length) patch.license = license;
  const user = await User.update(req.user._id, patch);
  res.json({ success: true, user });
});

exports.changePassword = asyncHandler(async (req, res) => {
  const user = await User.findByEmail(req.user.email, { withPassword: true });
  if (!user || !(await User.comparePassword(user, req.body.currentPassword))) {
    throw new AppError('Your current password is incorrect.', 422, { fields: { currentPassword: 'Incorrect password' } });
  }
  await User.setPassword(user._id, req.body.newPassword);
  res.json({ success: true, message: 'Password updated.' });
});

// ---- admin ----
exports.list = asyncHandler(async (req, res) => {
  const [users, counts] = await Promise.all([
    User.list({ role: str(req.query.role), search: str(req.query.search) }),
    Booking.countsByUser(),
  ]);
  res.json({ success: true, users: users.map((u) => ({ ...u, bookingCount: counts.get(u._id) || 0 })) });
});

exports.get = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new AppError('Customer not found.', 404);
  const bookings = await Booking.find({ user: user._id }, { sort: [['createdAt', 'desc']], limit: 20 });
  await populate(bookings, { path: 'vehicle', model: Vehicle, select: 'name' });
  res.json({ success: true, user, bookings });
});

exports.setActive = asyncHandler(async (req, res) => {
  if (String(req.params.id) === String(req.user._id)) throw new AppError('You cannot deactivate your own account.', 409);
  if (!(await User.findById(req.params.id))) throw new AppError('Customer not found.', 404);
  const user = await User.update(req.params.id, { isActive: !!req.body.isActive });
  res.json({ success: true, user });
});

exports.setLicenseVerified = asyncHandler(async (req, res) => {
  if (!(await User.findById(req.params.id))) throw new AppError('Customer not found.', 404);
  const user = await User.update(req.params.id, { license: { verified: !!req.body.verified } });
  res.json({ success: true, user });
});
