const Vehicle = require('../models/Vehicle');
const Booking = require('../models/Booking');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { pick } = require('../utils/helpers');
const { bookedVehicleIds, decorateVehicles, conflictingBookings } = require('../services/availabilityService');
const { collect } = require('../middleware/upload');
const fs = require('fs');
const path = require('path');

// securityDeposit is intentionally excluded: SSB CAR RENTALS charges no security deposit on any vehicle,
// and pricingService.computePrice() always prices the deposit at ₹0 regardless of what a vehicle record holds.
const EDITABLE = ['name', 'brand', 'model', 'variant', 'bodyType', 'fuel', 'fuelDisplay', 'transmission', 'seats', 'pricePerDay', 'pricePerHour',
  'registrationYear', 'mileage', 'features', 'description', 'location', 'availability', 'status', 'ecoScore'];

exports.list = asyncHandler(async (req, res) => {
  const q = req.query;
  // filtering + sorting happens in SQL (models/Vehicle.js → search)
  let vehicles = await decorateVehicles(await Vehicle.search(q));

  if (typeof q.pickupAt === 'string' && typeof q.returnAt === 'string') {
    const from = new Date(q.pickupAt);
    const to = new Date(q.returnAt);
    if (Number.isNaN(from) || Number.isNaN(to) || to <= from) throw new AppError('Return date and time must be after pickup.', 422);
    const booked = await bookedVehicleIds(from, to);
    vehicles = vehicles.map((v) => ({ ...v, availableForDates: v.availability && v.status === 'Active' && !booked.has(String(v._id)) }));
    if (q.onlyAvailable === 'true') vehicles = vehicles.filter((v) => v.availableForDates);
  }
  if (q.availability === 'available') vehicles = vehicles.filter((v) => v.availabilityLabel === 'Available');
  if (q.availability === 'booked') vehicles = vehicles.filter((v) => v.availabilityLabel === 'Booked');

  res.json({ success: true, count: vehicles.length, vehicles });
});

exports.get = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const vehicle = await Vehicle.findByIdOrSlug(id); // the URL carries either the UUID or the slug
  if (!vehicle || vehicle.status === 'Retired') throw new AppError('That vehicle could not be found.', 404);
  const [v] = await decorateVehicles([vehicle]);
  res.json({ success: true, vehicle: v });
});

exports.bookedSlots = asyncHandler(async (req, res) => {
  const slots = await conflictingBookings(req.params.id, new Date(), new Date(Date.now() + 120 * 864e5));
  res.json({ success: true, slots: slots.map((s) => ({ from: s.pickupAt, to: s.returnAt })) });
});

const normalise = (body) => {
  const data = pick(body, EDITABLE);
  if (typeof data.features === 'string') data.features = data.features.split(',').map((f) => f.trim()).filter(Boolean);
  if (data.pricePerDay !== undefined && data.pricePerHour === undefined) data.pricePerHour = Math.round(Number(data.pricePerDay) / 100) * 10;
  return data;
};

exports.create = asyncHandler(async (req, res) => {
  const vehicle = await Vehicle.create(normalise(req.body));
  res.status(201).json({ success: true, vehicle });
});

exports.update = asyncHandler(async (req, res) => {
  const vehicle = await Vehicle.update(req.params.id, normalise(req.body));
  if (!vehicle) throw new AppError('That vehicle could not be found.', 404);
  res.json({ success: true, vehicle });
});

exports.remove = asyncHandler(async (req, res) => {
  const vehicle = await Vehicle.findById(req.params.id);
  if (!vehicle) throw new AppError('That vehicle could not be found.', 404);
  const open = await Booking.countOpenForVehicle(vehicle._id);
  if (open) throw new AppError('This vehicle has upcoming or active bookings. Cancel or complete them first.', 409);
  const history = await Booking.count({ vehicle: vehicle._id });
  if (history) {
    await Vehicle.update(vehicle._id, { status: 'Retired', availability: false });
    return res.json({ success: true, retired: true, message: 'Vehicle retired. It has booking history, so it was hidden instead of erased.' });
  }
  await Vehicle.remove(vehicle._id); // wishlist rows go with it (ON DELETE CASCADE)
  res.json({ success: true, deleted: true, message: 'Vehicle deleted.' });
});

exports.addImages = asyncHandler(async (req, res) => {
  const files = collect(req);
  const vehicle = await Vehicle.findById(req.params.id);
  if (!vehicle) { files.forEach((f) => fs.unlink(f.path, () => {})); throw new AppError('That vehicle could not be found.', 404); }
  if (!files.length) throw new AppError('Choose at least one image to upload.', 422);
  const updated = await Vehicle.addImages(vehicle._id, files.map((f) => `/uploads/vehicles/${f.filename}`));
  res.json({ success: true, vehicle: updated });
});

exports.removeImage = asyncHandler(async (req, res) => {
  const vehicle = await Vehicle.findById(req.params.id);
  if (!vehicle) throw new AppError('That vehicle could not be found.', 404);
  const { url } = req.body;
  if (!vehicle.images.includes(url)) throw new AppError('That image is not on this vehicle.', 404);
  const updated = await Vehicle.removeImage(vehicle._id, url);
  if (url.startsWith('/uploads/vehicles/')) fs.unlink(path.join(__dirname, '..', url), () => {});
  res.json({ success: true, vehicle: updated });
});
