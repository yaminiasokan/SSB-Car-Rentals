const { tx } = require('../db/pool');
const { populate } = require('../db/model');
const DamageReport = require('../models/DamageReport');
const Payment = require('../models/Payment');
const Booking = require('../models/Booking');
const Vehicle = require('../models/Vehicle');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { simulateGateway } = require('../services/paymentGateway');
const { notify, notifyAdmins } = require('../services/notificationService');
const { newReceiptNo } = require('../utils/sequence');
const { inr, idOf, str } = require('../utils/helpers');
const { AI_DISCLAIMER } = require('../config/constants');
const crypto = require('crypto');

const isStaff = (u) => ['admin', 'staff'].includes(u.role);
const CUSTOMER_VISIBLE = ['Confirmed', 'Customer Disputed', 'Resolved'];
const RELATIONS = [
  { path: 'booking', model: Booking, select: 'bookingId pickupAt returnAt pickupLocation returnLocation status' },
  { path: 'vehicle', model: Vehicle, select: 'name fuelDisplay' },
  { path: 'customer', model: User, select: 'name email phone' },
];

async function loadReport(req) {
  const report = await DamageReport.findById(req.params.id);
  if (!report) throw new AppError('That damage report could not be found.', 404);
  if (!isStaff(req.user)) {
    if (String(report.customer) !== String(req.user._id) || !CUSTOMER_VISIBLE.includes(report.status)) throw new AppError('That damage report could not be found.', 404);
  }
  await populate(report, RELATIONS);
  return report;
}

exports.list = asyncHandler(async (req, res) => {
  const staff = isStaff(req.user);
  const params = [];
  const clauses = [];
  if (!staff) {
    params.push(req.user._id, CUSTOMER_VISIBLE);
    clauses.push(`customer_id = $${params.length - 1}`, `status = ANY($${params.length}::text[])`);
  } else if (str(req.query.status)) {
    params.push(req.query.status);
    clauses.push(`status = $${params.length}`);
  }
  const reports = await DamageReport.where(clauses.join(' AND '), params, { sort: [['createdAt', 'desc']], limit: 200 });
  await populate(reports, [{ path: 'booking', model: Booking, select: 'bookingId' }, { path: 'vehicle', model: Vehicle, select: 'name' }, { path: 'customer', model: User, select: 'name' }]);
  res.json({ success: true, reports });
});

exports.get = asyncHandler(async (req, res) => {
  const report = await loadReport(req);
  res.json({ success: true, report, disclaimer: AI_DISCLAIMER });
});

/** Admin verification step. AI results never reach the customer or become a charge before this. */
exports.review = asyncHandler(async (req, res) => {
  const report = await loadReport(req);
  if (report.status !== 'Pending Review') throw new AppError('This report has already been reviewed.', 409);
  const { decision, damages: edits = [], comments = '' } = req.body;

  const damages = report.damages.map((d) => {
    const edit = edits.find((e) => e.id === d._id);
    if (!edit) return d;
    const next = { ...d };
    if (['Minor', 'Moderate', 'Severe'].includes(edit.severity)) next.severity = edit.severity;
    if (Number.isFinite(edit.min) && Number.isFinite(edit.max) && edit.min >= 0 && edit.max >= edit.min) next.estimatedRepairCost = { min: edit.min, max: edit.max };
    if (['confirmed', 'rejected'].includes(edit.decision)) next.decision = edit.decision;
    if (typeof edit.note === 'string') next.note = edit.note.slice(0, 300);
    return next;
  });

  const patch = { damages, adminReview: { reviewedBy: req.user._id, reviewedAt: new Date(), comments: String(comments).slice(0, 1000) } };

  if (decision === 'reject') {
    patch.damages = damages.map((d) => ({ ...d, decision: 'rejected' }));
    patch.status = 'Rejected';
    patch.finalAmount = 0;
    const updated = await DamageReport.update(report._id, patch);
    return res.json({ success: true, report: await populate(updated, RELATIONS) });
  }

  patch.damages = damages.map((d) => (d.decision === 'pending' ? { ...d, decision: 'confirmed' } : d));
  const confirmed = patch.damages.filter((d) => d.decision === 'confirmed');
  if (!confirmed.length) throw new AppError('Confirm at least one finding, or reject the whole report.', 422);
  const suggested = confirmed.reduce((s, d) => s + Math.round((d.estimatedRepairCost.min + d.estimatedRepairCost.max) / 2 / 100) * 100, 0);
  const final = req.body.finalAmount;
  patch.finalAmount = Number.isFinite(final) && final >= 0 ? final : suggested;
  patch.status = 'Confirmed';
  patch.customerNotifiedAt = new Date();

  const updated = await populate(await DamageReport.update(report._id, patch), RELATIONS);
  await notify(updated.customer._id, 'damage_report', 'Damage report generated',
    `A damage report (${updated.reportId}) was verified by SSB staff for ${updated.vehicle.name}. Proposed charge: ${inr(updated.finalAmount)}. You can review the photos and pay or dispute it.`, `/damage-reports/${updated._id}`);
  res.json({ success: true, report: updated });
});

exports.dispute = asyncHandler(async (req, res) => {
  const report = await loadReport(req);
  if (String(report.customer._id) !== String(req.user._id)) throw new AppError('Only the customer can dispute this report.', 403);
  if (report.status !== 'Confirmed') throw new AppError('This report cannot be disputed in its current state.', 409);
  if (report.dispute?.at) throw new AppError('You have already disputed this report. SSB will contact you.', 409);
  const updated = await populate(await DamageReport.update(report._id, {
    dispute: { message: req.body.message, at: new Date() }, status: 'Customer Disputed',
  }), RELATIONS);
  await notifyAdmins('damage_report', 'Damage report disputed', `${updated.reportId} was disputed by ${updated.customer.name}.`, `/admin/damage-reports/${updated._id}`);
  res.json({ success: true, report: updated });
});

/** Final decision after a dispute (or an offline settlement). outcome: upheld | adjusted | waived | settled */
exports.resolve = asyncHandler(async (req, res) => {
  const report = await loadReport(req);
  if (!['Confirmed', 'Customer Disputed'].includes(report.status)) throw new AppError('Only confirmed or disputed reports can be resolved.', 409);
  const { outcome, finalAmount, note = '' } = req.body;

  const patch = { resolution: { by: req.user._id, at: new Date(), note: String(note).slice(0, 1000), outcome } };
  if (report.dispute?.at) patch.dispute = { ...report.dispute, adminResponse: String(note).slice(0, 1000) };

  if (outcome === 'waived') { patch.finalAmount = 0; patch.status = 'Resolved'; }
  else if (outcome === 'settled') { patch.status = 'Resolved'; }
  else {
    if (outcome === 'adjusted') patch.finalAmount = finalAmount;
    patch.status = 'Confirmed'; // customer still needs to pay the (upheld/adjusted) amount
  }
  const updated = await populate(await DamageReport.update(report._id, patch), RELATIONS);

  const msg = { waived: 'The proposed charge was waived.', settled: 'This report was marked as settled.', upheld: `The charge of ${inr(updated.finalAmount)} was upheld after review.`, adjusted: `The charge was adjusted to ${inr(updated.finalAmount)}.` }[outcome];
  await notify(updated.customer._id, 'damage_report', 'Damage report update', `${updated.reportId}: ${msg}`, `/damage-reports/${updated._id}`);
  res.json({ success: true, report: updated });
});

/** Customer pays a confirmed damage charge (simulated payment). */
exports.pay = asyncHandler(async (req, res) => {
  const report = await loadReport(req);
  if (String(report.customer._id) !== String(req.user._id)) throw new AppError('Only the customer can pay this charge.', 403);
  if (report.status !== 'Confirmed' || report.finalAmount <= 0) throw new AppError('There is no payable charge on this report.', 409);
  const { method, details = {} } = req.body;
  if (method === 'Cash on Pickup') throw new AppError('Choose UPI, card or net banking to pay a damage charge online.', 422);

  const outcome = simulateGateway(method, details);
  const base = {
    booking: idOf(report.booking), user: req.user._id, kind: 'damage', amount: report.finalAmount, revenueAmount: 0, method,
    details: outcome.details, transactionId: `SIM${Date.now().toString(36).toUpperCase()}${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
  };
  if (!outcome.ok) {
    await Payment.insert({ ...base, status: 'Failed', failureReason: outcome.reason });
    throw new AppError(outcome.reason, 402);
  }

  const { payment, report: updated } = await tx(async (db) => {
    const p = await Payment.insert({ ...base, status: 'Success', paidAt: new Date(), revenueAmount: report.finalAmount, receiptNo: await newReceiptNo(new Date(), db) }, db);
    const r = await DamageReport.update(report._id, {
      payment: p._id, status: 'Resolved', resolution: { at: new Date(), outcome: 'paid', note: `Paid via ${method}` },
    }, db);
    return { payment: p, report: r };
  });
  await notifyAdmins('damage_report', 'Damage charge paid', `${updated.reportId}: ${inr(updated.finalAmount)} received.`, `/admin/damage-reports/${updated._id}`);
  res.json({ success: true, report: updated, payment });
});
