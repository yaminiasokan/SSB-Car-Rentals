'use strict';
/**
 * Creates / upgrades the database tables from db/schema.sql (idempotent).
 *   npm run db:init
 * The API also runs this on start-up when DB_AUTO_MIGRATE is on (default in development).
 */
const fs = require('fs');
const path = require('path');

const SCHEMA_FILE = path.join(__dirname, 'schema.sql');

async function applySchema(db = require('./pool').pool) {
  // No parameters => PostgreSQL's simple-query protocol, which accepts many statements in one call.
  await db.query(fs.readFileSync(SCHEMA_FILE, 'utf8'));
}

module.exports = { applySchema, SCHEMA_FILE };

if (require.main === module) {
  const { pool } = require('./pool');
  applySchema(pool)
    .then(() => console.log('✓ Database schema is up to date.'))
    .catch((err) => { console.error('Schema setup failed:', err.message || err.code || err); process.exitCode = 1; })
    .finally(() => pool.end());
}
