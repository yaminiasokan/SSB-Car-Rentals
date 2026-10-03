/** Escapes % _ and \ so user text can be used inside an ILIKE '%…%' pattern literally. */
const escapeLike = (s = '') => String(s).replace(/[\\%_]/g, '\\$&');
const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const pick = (obj, keys) => keys.reduce((acc, k) => (obj[k] !== undefined ? { ...acc, [k]: obj[k] } : acc), {});
/** Query-string values can arrive as arrays/objects (?a[]=1). Only accept plain strings. */
const str = (v) => (typeof v === 'string' ? v : undefined);
module.exports = { escapeLike, inr, pick, str };

/** A related record can be an id string or a populated object — this always returns the id. */
module.exports.idOf = (v) => (v && typeof v === 'object' ? v._id : v);
