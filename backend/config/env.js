const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const nodeEnv = process.env.NODE_ENV || 'development';
const jwtSecret = process.env.JWT_SECRET || 'dev-only-insecure-secret-change-me';

if (nodeEnv === 'production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET.startsWith('change-me'))) {
  throw new Error('JWT_SECRET must be set to a strong random value in production.');
}
if (nodeEnv === 'production' && !process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL must be set in production (postgresql://user:password@host:5432/database).');
}

const flag = (v, fallback) => (v === undefined || v === '' ? fallback : ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase()));

module.exports = {
  nodeEnv,
  isProd: nodeEnv === 'production',
  port: Number(process.env.PORT) || 5000,
  // ---- PostgreSQL ----
  databaseUrl: process.env.DATABASE_URL || 'postgresql://ssb:ssb_password@127.0.0.1:5432/ssb_car_rentals',
  dbSsl: flag(process.env.DATABASE_SSL, false),            // set true for most managed hosts (Render, Neon, Supabase, RDS…)
  dbPoolMax: Number(process.env.DATABASE_POOL_MAX) || 10,
  dbAutoMigrate: flag(process.env.DB_AUTO_MIGRATE, nodeEnv !== 'production'), // create/upgrade tables on start-up (dev default)
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  uploadMaxMb: Number(process.env.UPLOAD_MAX_MB) || 5,
};
