const { populate } = require('../db/model');
const Booking = require('../models/Booking');
const Vehicle = require('../models/Vehicle');
const Inspection = require('../models/Inspection');
const DamageReport = require('../models/DamageReport');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { analyzeInspection, ENGINE } = require('../services/damageDetectionService');
const { AI_DISCLAIMER } = require('../config/constants');
const { newDamageId } = require('../utils/sequence');
const { notifyAdmins } = require('../services/notificationService');

exports.engine = (req, res) => res.json({ success: true, engine: ENGINE, disclaimer: AI_DISCLAIMER });

/** POST /api/damage-detection/analyze  { bookingId } — staff/admin only */
exports.analyze = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.body.bookingId);
  if (!booking) throw new AppError('That booking could not be found.', 404);
  await populate(booking, { path: 'vehicle', model: Vehicle, select: 'name' });

  const [before, after] = await Promise.all([
    Inspection.findOne({ booking: booking._id, type: 'before' }),
    Inspection.findOne({ booking: booking._id, type: 'after' }),
  ]);
  if (!before) throw new AppError('Add the before-rental inspection first — it is the baseline for comparison.', 409);
  if (!after) throw new AppError('Add the after-rental photos first.', 409);

  const existing = await DamageReport.findOne({ booking: booking._id });
  if (existing && existing.status !== 'Pending Review') throw new AppError('This report has already been reviewed and cannot be re-analysed.', 409);

  const result = await analyzeInspection(before, after); // throws 502 AppError if nothing could be read

  const data = {
    vehicle: booking.vehicle._id, customer: booking.user, beforeInspection: before._id, afterInspection: after._id,
    damageDetected: result.damageDetected, damages: result.damages, engine: result.engine, status: 'Pending Review',
  };
  const report = existing
    ? await DamageReport.update(existing._id, data)
    : await DamageReport.insert({ ...data, booking: booking._id, reportId: await newDamageId() });

  await notifyAdmins('damage_report', 'AI damage report needs review', `${report.reportId} for ${booking.vehicle.name} (${booking.bookingId}) — ${result.damageDetected ? `${result.damages.length} possible damage(s)` : 'no damage detected'}.`, `/admin/damage-reports/${report._id}`);
  res.status(201).json({ success: true, report, analysis: { analysedSlots: result.analysedSlots, failedSlots: result.failedSlots }, disclaimer: AI_DISCLAIMER });
});
