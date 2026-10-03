const { validationResult } = require('express-validator');
const AppError = require('../utils/AppError');

module.exports = (req, res, next) => {
  const result = validationResult(req);
  if (result.isEmpty()) return next();
  const fields = {};
  result.array().forEach((e) => { if (!fields[e.path]) fields[e.path] = e.msg; });
  next(new AppError('Please check the highlighted fields and try again.', 422, { fields }));
};
