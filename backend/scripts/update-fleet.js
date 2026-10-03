/**
 * One-off, non-destructive updates to an ALREADY-RUNNING database — unlike `npm run seed`, this never
 * wipes bookings, payments or any other data. Safe to run as many times as you like (idempotent).
 *
 *   node scripts/update-fleet.js
 *
 * What it does:
 *   1. Points every "Ertiga" vehicle (any city, any variant) at the 2025 Maruti Suzuki Ertiga photo.
 *   2. Zeroes out security_deposit on every vehicle — SSB CAR RENTALS no longer charges a deposit.
 *      (New/updated bookings already price the deposit at ₹0 regardless of this column — see
 *      services/pricingService.js — so this step only cleans up what vehicle records display/store.)
 *
 * If you'd rather start from a clean slate (demo data, fresh fleet), use `npm run seed` instead — that
 * wipes everything and reloads it, including this same image and ₹0 deposits, from scratch.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { pool } = require('../db/pool');

const ERTIGA_IMAGE = 'https://www.rushlane.com/wp-content/uploads/2025/08/2025-Maruti-Ertiga-8-1200x675.jpeg';

async function run() {
  const ertiga = await pool.query(
    "UPDATE vehicles SET images = ARRAY[$1]::text[], updated_at = now() WHERE model = 'Ertiga' RETURNING id, name, location",
    [ERTIGA_IMAGE],
  );
  console.log(`Ertiga image updated on ${ertiga.rowCount} vehicle(s):`);
  ertiga.rows.forEach((v) => console.log(`  • ${v.name} (${v.location})`));

  const deposit = await pool.query("UPDATE vehicles SET security_deposit = 0, updated_at = now() WHERE security_deposit <> 0");
  console.log(`Security deposit zeroed on ${deposit.rowCount} vehicle(s) that still had a nonzero value.`);

  console.log('\nDone. Existing bookings/payments/agreements were not touched — only vehicle records.');
  await pool.end();
}

run().catch((e) => { console.error('Update failed:', e.message || e); process.exitCode = 1; });
