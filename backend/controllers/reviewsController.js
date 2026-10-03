const { tx } = require('../db/pool');
const { populate } = require('../db/model');
const Review = require('../models/Review');
const Booking = require('../models/Booking');
const Vehicle = require('../models/Vehicle');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { str } = require('../utils/helpers');

const refreshVehicleRating = async (vehicleId, db) => {
  const { rating, reviewCount } = await Review.summaryForVehicle(vehicleId, db);
  await Vehicle.setRating(vehicleId, rating, reviewCount, db);
};
exports.refreshVehicleRating = refreshVehicleRating;

const pickRatings = (r) => ({ overall: r.overall, vehicleCondition: r.vehicleCondition, cleanliness: r.cleanliness, pickupExperience: r.pickupExperience });

exports.create = asyncHandler(async (req, res) => {
  const { bookingId, ratings, comment } = req.body;
  const booking = await Booking.findById(bookingId);
  if (!booking || String(booking.user) !== String(req.user._id)) throw new AppError('That booking could not be found.', 404);
  if (booking.status !== 'Completed') throw new AppError('You can review a vehicle once your rental is completed.', 403);
  if (await Review.exists({ booking: booking._id })) throw new AppError('You have already reviewed this rental.', 409);

  // The review, the "reviewed" flag and the vehicle's average rating change together or not at all.
  const review = await tx(async (db) => {
    const created = await Review.insert({ booking: booking._id, vehicle: booking.vehicle, user: req.user._id, ratings: pickRatings(ratings), comment: comment || '', verified: true }, db);
    await Booking.update(booking._id, { reviewed: true }, db);
    await refreshVehicleRating(booking.vehicle, db);
    return created;
  });
  res.status(201).json({ success: true, review });
});

const mask = (name = '') => { const [f, ...rest] = name.trim().split(/\s+/); return rest.length ? `${f} ${rest[rest.length - 1][0]}.` : f; };

exports.list = asyncHandler(async (req, res) => {
  const reviews = await Review.find({ vehicle: str(req.query.vehicle) }, { sort: [['createdAt', 'desc']], limit: 50 });
  await populate(reviews, [{ path: 'user', model: User, select: 'name' }, { path: 'vehicle', model: Vehicle, select: 'name' }]);
  res.json({
    success: true,
    reviews: reviews.map((r) => ({ ...r, user: { name: mask(r.user?.name) } })),
  });
});

exports.mine = asyncHandler(async (req, res) => {
  const reviews = await Review.find({ user: req.user._id }, { sort: [['createdAt', 'desc']] });
  await populate(reviews, { path: 'vehicle', model: Vehicle, select: 'name' });
  res.json({ success: true, reviews });
});
