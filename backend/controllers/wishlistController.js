const Wishlist = require('../models/Wishlist');
const Vehicle = require('../models/Vehicle');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { decorateVehicles } = require('../services/availabilityService');

exports.get = asyncHandler(async (req, res) => {
  const vehicles = await decorateVehicles(await Wishlist.vehiclesFor(req.user._id));
  res.json({ success: true, vehicles, ids: vehicles.map((v) => String(v._id)) });
});

exports.add = asyncHandler(async (req, res) => {
  if (!(await Vehicle.exists({ _id: req.params.vehicleId }))) throw new AppError('That vehicle could not be found.', 404);
  await Wishlist.add(req.user._id, req.params.vehicleId);
  res.status(201).json({ success: true, message: 'Saved to your wishlist.' });
});

exports.remove = asyncHandler(async (req, res) => {
  await Wishlist.remove(req.user._id, req.params.vehicleId);
  res.json({ success: true, message: 'Removed from your wishlist.' });
});
