const { defineModel } = require('../db/model');
const { escapeLike } = require('../utils/helpers');

const M = defineModel({
  table: 'bookings',
  fields: [
    ['bookingId', 'booking_ref'],
    ['user', 'user_id'], ['vehicle', 'vehicle_id'],
    ['pickupLocation', 'pickup_location'], ['returnLocation', 'return_location'],
    ['pickupAt', 'pickup_at'], ['returnAt', 'return_at'],
    ['services', 'services'],
    ['pricing.lines', 'pricing_lines', 'json'], ['pricing.serviceLines', 'pricing_service_lines', 'json'],
    ['pricing.baseAmount', 'pricing_base_amount'], ['pricing.servicesAmount', 'pricing_services_amount'],
    ['pricing.discount', 'pricing_discount'], ['pricing.promoCode', 'pricing_promo_code'], ['pricing.promoLabel', 'pricing_promo_label'],
    ['pricing.taxRate', 'pricing_tax_rate'], ['pricing.taxAmount', 'pricing_tax_amount'], ['pricing.deposit', 'pricing_deposit'],
    ['pricing.rentalTotal', 'pricing_rental_total'], ['pricing.total', 'pricing_total'], ['pricing.billingDays', 'pricing_billing_days'],
    ['pricing.maxKm', 'pricing_max_km'],
    ['customer.name', 'customer_name'], ['customer.phone', 'customer_phone'], ['customer.email', 'customer_email'],
    ['customer.licenseNumber', 'customer_license_number'], ['customer.address', 'customer_address'],
    ['status', 'status'], ['paymentStatus', 'payment_status'], ['holdExpiresAt', 'hold_expires_at'],
    ['cancellation.reason', 'cancellation_reason'], ['cancellation.cancelledAt', 'cancellation_cancelled_at'],
    ['cancellation.cancelledBy', 'cancellation_cancelled_by'], ['cancellation.refundPercent', 'cancellation_refund_percent'],
    ['cancellation.refundAmount', 'cancellation_refund_amount'],
    ['statusHistory', 'status_history', 'json'],
    ['inspection.before', 'inspection_before'], ['inspection.after', 'inspection_after'],
    ['reminders.pickupSent', 'reminder_pickup_sent'], ['reminders.returnSent', 'reminder_return_sent'],
    ['reviewed', 'reviewed'],
  ],
});

const pool = (db) => db || require('../db/pool').pool;

/**
 * A booking blocks a vehicle when it is Confirmed/Active, or Pending with an unexpired payment hold.
 * `$n` is the "now" parameter position.
 */
const blocking = (nowParam) => `(status IN ('Confirmed', 'Active') OR (status = 'Pending' AND hold_expires_at > ${nowParam}))`;

/** Bookings that overlap [from, to) for one vehicle and currently block it. */
async function findConflicts(vehicleId, from, to, { excludeId = null, db } = {}) {
  const params = [vehicleId, new Date(to), new Date(from), new Date()];
  let sql = `SELECT id, booking_ref, pickup_at, return_at, status FROM bookings
             WHERE vehicle_id = $1 AND pickup_at < $2 AND return_at > $3 AND ${blocking('$4')}`;
  if (excludeId) { params.push(excludeId); sql += ` AND id <> $${params.length}`; }
  const { rows } = await pool(db).query(sql, params);
  return rows.map((r) => M.toDoc(r));
}

/** Set of vehicle ids that have a blocking booking overlapping [from, to). */
async function bookedVehicleIds(from, to, db) {
  const { rows } = await pool(db).query(
    `SELECT DISTINCT vehicle_id FROM bookings WHERE pickup_at < $1 AND return_at > $2 AND ${blocking('$3')}`,
    [new Date(to), new Date(from), new Date()],
  );
  return new Set(rows.map((r) => r.vehicle_id));
}

/** Map userId -> number of bookings. */
async function countsByUser(db) {
  const { rows } = await pool(db).query('SELECT user_id, COUNT(*)::int AS n FROM bookings GROUP BY user_id');
  return new Map(rows.map((r) => [r.user_id, r.n]));
}

/** Upcoming / active bookings that would be broken by deleting or retiring a vehicle. */
const countOpenForVehicle = (vehicleId, now = new Date(), db) => M.countWhere(
  "vehicle_id = $1 AND status IN ('Pending', 'Confirmed', 'Active') AND return_at > $2", [vehicleId, now], db,
);

/** Admin list: optional status + free-text search over booking ref / customer name / phone. */
async function adminSearch({ status, search } = {}, db) {
  const params = [];
  const clauses = [];
  if (status) { params.push(status); clauses.push(`status = $${params.length}`); }
  if (search) {
    params.push(`%${escapeLike(search)}%`);
    const n = params.length;
    clauses.push(`(booking_ref ILIKE $${n} OR customer_name ILIKE $${n} OR customer_phone ILIKE $${n})`);
  }
  return M.where(clauses.join(' AND '), params, { sort: [['createdAt', 'desc']], limit: 300 }, db);
}

/** Reminder job: confirmed bookings whose pickup is within 24h, or active rentals due back within 6h, and not yet reminded. */
const dueForPickupReminder = (now, until, db) => M.where(
  "status = 'Confirmed' AND reminder_pickup_sent = FALSE AND pickup_at > $1 AND pickup_at <= $2", [now, until], {}, db,
);
const dueForReturnReminder = (now, until, db) => M.where(
  "status = 'Active' AND reminder_return_sent = FALSE AND return_at > $1 AND return_at <= $2", [now, until], {}, db,
);

module.exports = { ...M, findConflicts, bookedVehicleIds, countsByUser, countOpenForVehicle, adminSearch, dueForPickupReminder, dueForReturnReminder };
