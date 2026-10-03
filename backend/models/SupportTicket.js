const { defineModel } = require('../db/model');

const M = defineModel({
  table: 'support_tickets',
  fields: [
    ['ticketNo', 'ticket_no'], ['user', 'user_id'], ['booking', 'booking_id'],
    ['subject', 'subject'], ['category', 'category'], ['priority', 'priority'], ['message', 'message'],
    ['emergencyType', 'emergency_type'], ['location', 'location'], ['status', 'status'],
    ['replies', 'replies', 'json'], // [{ by, role, name, message, at }]
  ],
});

/** Appends one reply atomically (no read-modify-write) and optionally changes the status. */
async function addReply(id, reply, status, db = require('../db/pool').pool) {
  const entry = { ...reply, at: new Date().toISOString() };
  const params = [id, JSON.stringify([entry])];
  let sql = 'UPDATE support_tickets SET replies = replies || $2::jsonb, updated_at = now()';
  if (status) { params.push(status); sql += `, status = $${params.length}`; }
  const { rows } = await db.query(`${sql} WHERE id = $1 RETURNING *`, params);
  return M.toDoc(rows[0]);
}

module.exports = { ...M, addReply };
