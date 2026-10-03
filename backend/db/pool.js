'use strict';
const { Pool, types } = require('pg');
const env = require('../config/env');

// node-postgres returns COUNT()/BIGINT and NUMERIC as strings by default. Money columns are NUMERIC(12,2)
// and counters are small, so hand both back as plain JS numbers.
types.setTypeParser(20, (v) => parseInt(v, 10));   // int8
types.setTypeParser(1700, (v) => parseFloat(v));   // numeric

const pool = new Pool({
  connectionString: env.databaseUrl,
  max: env.dbPoolMax,
  ssl: env.dbSsl ? { rejectUnauthorized: false } : undefined,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// An idle client can error (e.g. the server restarts). Log it instead of crashing the process.
pool.on('error', (err) => console.error('Unexpected PostgreSQL pool error:', err.message));

/**
 * Runs `fn(db)` inside a transaction. `db` has the same `.query(text, params)` interface as the pool,
 * so every model function accepts it as its last argument. Throwing rolls everything back.
 * Keep notifications / e-mails OUTSIDE the callback — a failed statement aborts the whole transaction.
 */
async function tx(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) { /* connection already gone */ }
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, tx, query: (text, params) => pool.query(text, params), close: () => pool.end() };
