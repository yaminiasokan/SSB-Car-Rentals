const env = require('./config/env');
const connectDB = require('./config/db');
const app = require('./app');
const { startReminderJob } = require('./services/reminderService');

(async () => {
  try {
    await connectDB();
    app.listen(env.port, () => console.log(`SSB Car Rentals API running on http://localhost:${env.port} (${env.nodeEnv})`));
    startReminderJob();
  } catch (err) {
    // AggregateError (IPv4 + IPv6 both refused) has an empty message, so fall back to the error code.
    console.error('Failed to start server:', err.message || err.code || err);
    console.error('Check DATABASE_URL in backend/.env and that PostgreSQL is running (see README → Quick start).');
    process.exit(1);
  }
})();

process.on('unhandledRejection', (err) => console.error('Unhandled rejection:', err));
