const { defineModel } = require('../db/model');

const M = defineModel({
  table: 'payments',
  fields: [
    ['receiptNo', 'receipt_no'], ['booking', 'booking_id'], ['user', 'user_id'], ['kind', 'kind'],
    ['amount', 'amount'], ['depositAmount', 'deposit_amount'], ['revenueAmount', 'revenue_amount'],
    ['method', 'method'], ['status', 'status'], ['transactionId', 'transaction_ref'], ['failureReason', 'failure_reason'],
    ['details', 'details', 'json'],   // only masked details are ever stored — never a full card number or CVV
    ['refundAmount', 'refund_amount'], ['simulated', 'simulated'], ['paidAt', 'paid_at'],
    ['screenshotUrl', 'screenshot_url'], ['verificationStatus', 'verification_status'],
    ['verifiedBy', 'verified_by_id'], ['verifiedAt', 'verified_at'],
  ],
});

const pool = (db) => db || require('../db/pool').pool;

/** Total recognised revenue across successful (and later refunded) payments. */
async function totalRevenue(db) {
  const { rows } = await pool(db).query(
    "SELECT COALESCE(SUM(revenue_amount), 0)::float8 AS total FROM payments WHERE status IN ('Success', 'Partially Refunded', 'Refunded')",
  );
  return rows[0].total;
}

/** Payments that count towards revenue, paid on/after `since` (analytics). */
const revenueSince = (since, db) => M.where(
  "status IN ('Success', 'Partially Refunded', 'Refunded') AND paid_at >= $1", [since], {}, db,
);

/** Most recent booking payment for a booking (used when cancelling). */
const latestForBooking = (bookingId, kind, db) => M.findOne({ booking: bookingId, kind }, { sort: [['createdAt', 'desc']] }, db);

module.exports = { ...M, totalRevenue, revenueSince, latestForBooking };
