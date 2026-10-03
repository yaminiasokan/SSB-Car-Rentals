const AppError = require('./AppError');

/** Same response shape the old schema validation produced: 422 + details.fields → the frontend highlights the inputs. */
const invalid = (fields) => new AppError('Please check the highlighted fields and try again.', 422, { fields });

const toNumber = (v) => (v === '' || v === null || v === undefined ? v : Number(v));
const toBool = (v) => (typeof v === 'string' ? ['true', '1', 'yes', 'on'].includes(v.toLowerCase()) : Boolean(v));

module.exports = { invalid, toNumber, toBool };
