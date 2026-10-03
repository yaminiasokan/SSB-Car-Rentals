const env = require('./env');
const { pool } = require('../db/pool');
const { applySchema } = require('../db/migrate');

const describe = (url) => {
  try {
    const u = new URL(url);
    return `${u.hostname}:${u.port || 5432}${u.pathname}`;
  } catch (_) {
    return 'database';
  }
};

module.exports = async function connectDB() {
  await pool.query('SELECT 1');            // fail fast if the server / credentials are wrong
  if (env.dbAutoMigrate) await applySchema();
  console.log(`PostgreSQL connected: ${describe(env.databaseUrl)}${env.dbAutoMigrate ? ' (schema checked)' : ''}`);
};
