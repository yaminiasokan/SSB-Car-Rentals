const jwt = require('jsonwebtoken');
const env = require('../config/env');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

const getToken = (req) => {
  const h = req.headers.authorization;
  return h && h.startsWith('Bearer ') ? h.slice(7) : null;
};

const signToken = (user) => jwt.sign({ id: user._id, role: user.role }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });

const loadUser = async (token) => {
  const decoded = jwt.verify(token, env.jwtSecret);
  const user = await User.findById(decoded.id); // null for an unknown / malformed id (e.g. a token issued before the PostgreSQL migration)
  if (!user || !user.isActive) throw new AppError('This account is no longer available.', 401);
  return user;
};

const protect = asyncHandler(async (req, res, next) => {
  const token = getToken(req);
  if (!token) throw new AppError('Please sign in to continue.', 401);
  try {
    req.user = await loadUser(token);
  } catch (e) {
    if (e instanceof AppError) throw e;
    throw new AppError('Your session has expired. Please sign in again.', 401);
  }
  next();
});

/** Attaches req.user when a valid token is present, but never blocks the request. */
const optionalAuth = asyncHandler(async (req, res, next) => {
  const token = getToken(req);
  if (token) {
    try { req.user = await loadUser(token); } catch (_) { /* ignore */ }
  }
  next();
});

const restrictTo = (...roles) => (req, res, next) =>
  roles.includes(req.user?.role) ? next() : next(new AppError('You do not have permission to do that.', 403));

module.exports = { protect, optionalAuth, restrictTo, signToken };
