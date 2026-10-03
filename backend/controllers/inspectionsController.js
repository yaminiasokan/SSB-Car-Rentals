const fs = require('fs');
const path = require('path');
const { populate } = require('../db/model');
const Booking = require('../models/Booking');
const Vehicle = require('../models/Vehicle');
const User = require('../models/User');
const Inspection = require('../models/Inspection');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { INSPECTION_SLOTS } = require('../config/constants');
const checklist = require('../config/checklist');
const { collect, removeFiles } = require('../middleware/upload');
const { notify } = require('../services/notificationService');

const isStaff = (u) => ['admin', 'staff'].includes(u.role);
const parseJson = (v, fallback) => { try { return v ? JSON.parse(v) : fallback; } catch (_) { throw new AppError('Inspection details were malformed. Please try again.', 422); } };
const dropFile = (url) => { if (url && url.startsWith('/uploads/inspections/')) fs.unlink(path.join(__dirname, '..', url), () => {}); };

exports.config = (req, res) => res.json({ success: true, slots: INSPECTION_SLOTS, checklist });

exports.submit = asyncHandler(async (req, res) => {
  const files = collect(req);
  try {
    const { bookingId, type } = req.body;
    if (!['before', 'after'].includes(type)) throw new AppError('Choose whether this is a before-rental or after-rental inspection.', 422);
    const booking = await Booking.findById(bookingId);
    if (!booking) throw new AppError('That booking could not be found.', 404);

    const owner = String(booking.user) === String(req.user._id);
    if (!isStaff(req.user)) {
      if (!owner) throw new AppError('That booking could not be found.', 404);
      if (type !== 'before') throw new AppError('After-rental inspections are done by SSB staff when the vehicle is returned.', 403);
    }
    const allowed = type === 'before' ? ['Confirmed', 'Active'] : ['Active', 'Completed'];
    if (!allowed.includes(booking.status)) {
      throw new AppError(type === 'before' ? 'Before-rental photos can be added for confirmed or active bookings.' : 'After-rental photos can be added once the rental is active or completed.', 409);
    }

    const slotNotes = parseJson(req.body.slotNotes, {});
    const items = parseJson(req.body.checklist, []);
    if (!Array.isArray(items)) throw new AppError('Checklist was malformed.', 422);
    const validItems = items
      .filter((i) => i && [...checklist.EXTERIOR, ...checklist.INTERIOR].includes(i.item) && checklist.CONDITIONS.includes(i.status))
      .map((i) => ({ group: checklist.EXTERIOR.includes(i.item) ? 'Exterior' : 'Interior', item: i.item, status: i.status, note: String(i.note || '').slice(0, 300) }));

    const existing = await Inspection.findOne({ booking: booking._id, type });
    const images = (existing?.images || []).map((i) => ({ ...i }));

    for (const [field, list] of Object.entries(req.files || {})) {
      for (const f of list) {
        const url = `/uploads/inspections/${f.filename}`;
        if (field === 'extra') {
          images.push({ slot: 'extra', url, note: String(slotNotes.extra || '').slice(0, 300), uploadedAt: new Date().toISOString() });
        } else {
          const prev = images.find((i) => i.slot === field);
          if (prev) { dropFile(prev.url); prev.url = url; prev.uploadedAt = new Date().toISOString(); }
          else images.push({ slot: field, url, note: '', uploadedAt: new Date().toISOString() });
        }
      }
    }
    // Notes for slots (e.g. "Existing minor scratch on rear bumper.")
    images.forEach((img) => { if (typeof slotNotes[img.slot] === 'string' && img.slot !== 'extra') img.note = slotNotes[img.slot].slice(0, 300); });

    if (!images.length) throw new AppError('Add at least one photo to save the inspection.', 422);
    const data = { images, performedBy: req.user._id, performerRole: req.user.role };
    if (validItems.length) data.checklist = validItems;
    if (req.body.notes !== undefined) data.notes = String(req.body.notes).slice(0, 1000);
    const insp = existing
      ? await Inspection.update(existing._id, data)
      : await Inspection.insert({ booking: booking._id, vehicle: booking.vehicle, type, ...data });

    await Booking.update(booking._id, { inspection: { [type]: true } });
    if (type === 'after' || (type === 'before' && isStaff(req.user))) {
      await notify(booking.user, 'inspection_completed', 'Vehicle inspection completed', `The ${type}-rental inspection for ${booking.bookingId} has been recorded.`, `/auto-inspect/${booking._id}`);
    }
    res.status(201).json({ success: true, inspection: insp });
  } catch (err) {
    removeFiles(files);
    throw err;
  }
});

exports.listForBooking = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.bookingId);
  if (!booking || (String(booking.user) !== String(req.user._id) && !isStaff(req.user))) throw new AppError('That booking could not be found.', 404);
  const inspections = await Inspection.find({ booking: booking._id });
  res.json({ success: true, inspections });
});

exports.get = asyncHandler(async (req, res) => {
  const insp = await Inspection.findById(req.params.id);
  if (!insp) throw new AppError('Inspection not found.', 404);
  const booking = await Booking.findById(insp.booking);
  if (String(booking.user) !== String(req.user._id) && !isStaff(req.user)) throw new AppError('Inspection not found.', 404);
  res.json({ success: true, inspection: insp });
});

exports.adminList = asyncHandler(async (req, res) => {
  const inspections = await Inspection.find({}, { sort: [['createdAt', 'desc']], limit: 100 });
  await populate(inspections, [{ path: 'booking', model: Booking, select: 'bookingId' }, { path: 'vehicle', model: Vehicle, select: 'name' }]);
  res.json({ success: true, inspections });
});

/** Bookings staff can inspect (confirmed / active / completed), newest first */
exports.eligibleBookings = asyncHandler(async (req, res) => {
  const bookings = await Booking.where("status IN ('Confirmed', 'Active', 'Completed')", [], { sort: [['pickupAt', 'desc']], limit: 60 });
  await populate(bookings, [{ path: 'vehicle', model: Vehicle, select: 'name fuelDisplay' }, { path: 'user', model: User, select: 'name phone' }]);
  const keep = ['bookingId', 'status', 'pickupAt', 'returnAt', 'vehicle', 'user', 'inspection', 'pickupLocation'];
  res.json({ success: true, bookings: bookings.map((b) => Object.fromEntries([['_id', b._id], ...keep.filter((k) => b[k] !== undefined).map((k) => [k, b[k]])])) });
});
