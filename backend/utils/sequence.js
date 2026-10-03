/**
 * Human-readable IDs (SSB-2026-000123, RCP-2026-00001, …) backed by the `counters` table.
 * A single INSERT … ON CONFLICT DO UPDATE is atomic, so two simultaneous requests can never get the same number.
 * Pass a transaction client as `db` to make the number part of that transaction.
 */
const defaultDb = () => require('../db/pool').pool;

/** Returns `startAt` the first time a counter is used, then startAt+1, +2, … */
async function nextSequence(name, startAt = 1, db = defaultDb()) {
  const { rows } = await db.query(
    `INSERT INTO counters (name, seq) VALUES ($1, $2)
     ON CONFLICT (name) DO UPDATE SET seq = counters.seq + 1
     RETURNING seq`,
    [name, startAt],
  );
  return rows[0].seq;
}

const pad = (n, len = 6) => String(n).padStart(len, '0');

module.exports = {
  nextSequence,
  newBookingId: async (date = new Date(), db) => `SSB-${date.getFullYear()}-${pad(await nextSequence('booking', 123, db))}`,
  newReceiptNo: async (date = new Date(), db) => `RCP-${date.getFullYear()}-${pad(await nextSequence('receipt', 1, db), 5)}`,
  newTicketNo: async (date = new Date(), db) => `TKT-${date.getFullYear()}-${pad(await nextSequence('ticket', 1, db), 5)}`,
  newDamageId: async (date = new Date(), db) => `DMG-${date.getFullYear()}-${pad(await nextSequence('damage', 1, db), 5)}`,
  newAgreementNo: async (date = new Date(), db) => `AGR-${date.getFullYear()}-${pad(await nextSequence('agreement', 1, db), 5)}`,
};
