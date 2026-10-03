// All SQL is parameterised, so there is no query-operator injection to strip (that was a MongoDB concern).
// What remains worth blocking is prototype pollution through JSON keys such as "__proto__".
const BLOCKED = new Set(['__proto__', 'constructor', 'prototype']);

const clean = (obj, depth = 0) => {
  if (!obj || typeof obj !== 'object' || depth > 12) return obj;
  for (const key of Object.keys(obj)) {
    if (BLOCKED.has(key)) delete obj[key];
    else clean(obj[key], depth + 1);
  }
  return obj;
};

module.exports = (req, res, next) => {
  clean(req.body);
  clean(req.params);
  if (req.query) clean(req.query);
  next();
};
