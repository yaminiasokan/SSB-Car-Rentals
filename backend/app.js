const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const env = require('./config/env');
const sanitize = require('./middleware/sanitize');
const { notFound, errorHandler } = require('./middleware/error');
const { UPLOAD_ROOT } = require('./middleware/upload');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' }, contentSecurityPolicy: false }));
app.use(cors({ origin: env.clientUrl.split(',').map((s) => s.trim()) }));
app.use(express.json({ limit: '200kb' }));
app.use(sanitize);
if (!env.isProd) app.use(morgan('dev'));

const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: env.isProd ? 400 : 5000, standardHeaders: true, legacyHeaders: false, message: { success: false, message: 'Too many requests. Please slow down and try again shortly.' } });
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: env.isProd ? 30 : 500, standardHeaders: true, legacyHeaders: false, message: { success: false, message: 'Too many sign-in attempts. Please wait a few minutes and try again.' } });

app.use('/uploads', express.static(UPLOAD_ROOT, { maxAge: '7d', setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff') }));

app.get('/api/health', (req, res) => res.json({ success: true, service: 'ssb-car-rentals-api', time: new Date().toISOString() }));

app.use('/api', apiLimiter);
app.use('/api/auth', authLimiter, require('./routes/authRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/cars', require('./routes/carRoutes'));
app.use('/api/bookings', require('./routes/bookingRoutes'));
app.use('/api/payments', require('./routes/paymentRoutes'));
app.use('/api/inspections', require('./routes/inspectionRoutes'));
app.use('/api/damage-detection', require('./routes/damageDetectionRoutes'));
app.use('/api/damage-reports', require('./routes/damageReportRoutes'));
app.use('/api/reviews', require('./routes/reviewRoutes'));
app.use('/api/wishlist', require('./routes/wishlistRoutes'));
app.use('/api/rewards', require('./routes/rewardRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/support', require('./routes/supportRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/analytics', require('./routes/analyticsRoutes'));

// Optional: serve the built React app from the same server (npm run build in /frontend)
const dist = path.join(__dirname, '..', 'frontend', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^\/(?!api|uploads).*/, (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use(notFound);
app.use(errorHandler);

module.exports = app;
