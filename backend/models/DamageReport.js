const { randomUUID } = require('crypto');
const { defineModel } = require('../db/model');

const M = defineModel({
  table: 'damage_reports',
  fields: [
    ['reportId', 'report_ref'], ['booking', 'booking_id'], ['vehicle', 'vehicle_id'], ['customer', 'customer_id'],
    ['beforeInspection', 'before_inspection_id'], ['afterInspection', 'after_inspection_id'],
    ['damageDetected', 'damage_detected'],
    ['damages', 'damages', 'json'],     // [{ _id, type, location, slot, severity, confidence, estimatedRepairCost, region, decision, note }]
    ['engine', 'engine', 'json'],
    ['status', 'status'],
    ['adminReview.reviewedBy', 'admin_review_reviewed_by_id'], ['adminReview.reviewedAt', 'admin_review_reviewed_at'], ['adminReview.comments', 'admin_review_comments'],
    ['finalAmount', 'final_amount'], ['customerNotifiedAt', 'customer_notified_at'],
    ['dispute.message', 'dispute_message'], ['dispute.at', 'dispute_at'], ['dispute.adminResponse', 'dispute_admin_response'],
    ['resolution.by', 'resolution_by_id'], ['resolution.at', 'resolution_at'], ['resolution.note', 'resolution_note'], ['resolution.outcome', 'resolution_outcome'],
    ['payment', 'payment_id'],
  ],
});

/** Every finding needs a stable _id (the review screen edits findings by id) plus the default decision/note. */
const withIds = (damages) => (Array.isArray(damages)
  ? damages.map((d) => ({ decision: 'pending', note: '', ...d, _id: d._id || randomUUID() }))
  : damages);

const prep = (data) => (data && data.damages !== undefined ? { ...data, damages: withIds(data.damages) } : data);

module.exports = {
  ...M,
  insert: (data, db, opts) => M.insert(prep(data), db, opts),
  update: (id, patch, db) => M.update(id, prep(patch), db),
  withIds,
};
