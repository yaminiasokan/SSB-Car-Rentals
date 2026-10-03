const env = require('../config/env');
const AppError = require('../utils/AppError');

const camel = (s) => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
// connection refused / reset, server shutting down, too many connections, connection exceptions
const DB_DOWN = ['ECONNREFUSED', 'ECONNRESET', 'ENOTFOUND', 'ETIMEDOUT', '57P01', '57P02', '57P03', '53300', '08000', '08001', '08003', '08004', '08006'];

const notFound = (req, res, next) => next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404));

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  let status = err.statusCode || 500;
  let message = err.message || 'Something went wrong on our side.';
  let details = err.details || null;

  if (err.code === '23505') { // unique_violation, e.g. "Key (email)=(a@b.c) already exists."
    status = 409;
    const m = /\(([^)]+)\)=/.exec(err.detail || '');
    const field = m ? camel(m[1].split(',')[0].trim()) : 'value';
    message = `That ${field} is already in use.`;
    details = { fields: { [field]: message } };
  } else if (err.code === '23503') { // foreign_key_violation
    status = 409;
    message = 'That action refers to a record that does not exist, or one that is still in use.';
  } else if (['22P02', '22007', '22008'].includes(err.code)) { // malformed uuid / number / date
    status = 400;
    message = 'That request contained an invalid identifier or value.';
  } else if (['23514', '23502', '22003', '22001'].includes(err.code)) { // check / not-null / out-of-range / too long
    status = 422;
    message = 'One of the values is missing or outside the allowed range.';
  } else if (DB_DOWN.includes(err.code)) {
    status = 503;
    message = 'The database is temporarily unavailable. Please try again in a moment.';
  } else if (err.code === 'LIMIT_FILE_SIZE') {
    status = 413;
    message = `Image is too large. Maximum size is ${env.uploadMaxMb} MB per photo.`;
  } else if (err.name === 'MulterError') {
    status = 400;
    message = 'Image upload failed. Please check the files and try again.';
  } else if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    status = 401;
    message = 'Your session has expired. Please sign in again.';
  }

  if (status >= 500) {
    console.error(err);
    if (env.isProd) message = 'Something went wrong on our side. Please try again in a moment.';
  }

  res.status(status).json({ success: false, message, details, ...(!env.isProd && status >= 500 ? { stack: err.stack } : {}) });
};

module.exports = { notFound, errorHandler };
