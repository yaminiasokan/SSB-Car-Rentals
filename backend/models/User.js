const bcrypt = require('bcryptjs');
const { defineModel } = require('../db/model');
const { invalid } = require('../utils/modelValidation');
const { escapeLike } = require('../utils/helpers');

const M = defineModel({
  table: 'users',
  fields: [
    ['name', 'name'], ['email', 'email'], ['phone', 'phone'],
    ['passwordHash', 'password_hash', 'hidden'],
    ['role', 'role'], ['address', 'address'],
    ['license.number', 'license_number'], ['license.expiry', 'license_expiry'], ['license.verified', 'license_verified'],
    ['rewardPoints', 'reward_points'], ['isActive', 'is_active'],
    ['resetPasswordToken', 'reset_password_token', 'hidden'], ['resetPasswordExpires', 'reset_password_expires', 'hidden'],
  ],
});

const ROLES = ['customer', 'staff', 'admin'];
const PHONE_RE = /^[6-9]\d{9}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** trim / lower-case / upper-case exactly as the old schema setters did */
function normalise(data) {
  const d = { ...data };
  ['name', 'phone', 'address'].forEach((k) => { if (typeof d[k] === 'string') d[k] = d[k].trim(); });
  if (typeof d.email === 'string') d.email = d.email.trim().toLowerCase();
  if (d.license && typeof d.license.number === 'string') d.license = { ...d.license, number: d.license.number.trim().toUpperCase() };
  return d;
}

function validate(d, creating) {
  const f = {};
  const check = (k) => creating || d[k] !== undefined;
  if (check('name')) {
    if (!d.name) f.name = 'Name is required';
    else if (d.name.length < 2 || d.name.length > 80) f.name = 'Name must be between 2 and 80 characters';
  }
  if (check('email')) {
    if (!d.email) f.email = 'Email is required';
    else if (!EMAIL_RE.test(d.email)) f.email = 'Enter a valid email address';
  }
  if (check('phone')) {
    if (!d.phone) f.phone = 'Phone is required';
    else if (!PHONE_RE.test(d.phone)) f.phone = 'Enter a valid 10-digit Indian mobile number';
  }
  if (d.role !== undefined && !ROLES.includes(d.role)) f.role = 'Invalid role';
  if (typeof d.address === 'string' && d.address.length > 300) f.address = 'Address is too long';
  if (Object.keys(f).length) throw invalid(f);
}

const checkPasswordRule = (password) => {
  if (typeof password !== 'string' || password.length < 8) throw invalid({ password: 'Password must be at least 8 characters' });
};

/** create({ name, email, phone, password, role?, address?, license? }) — hashes the password (bcrypt, 12 rounds). */
async function create(data, db) {
  const { password, ...rest } = normalise(data);
  validate(rest, true);
  checkPasswordRule(password);
  return M.insert({ ...rest, passwordHash: await bcrypt.hash(password, 12) }, db);
}

/** update(id, { name, phone, address, license: { number, expiry, verified }, isActive, role, … }) */
async function update(id, patch, db) {
  const d = normalise(patch);
  validate(d, false);
  return M.update(id, d, db);
}

async function setPassword(id, password, db) {
  checkPasswordRule(password);
  // A new password also invalidates any outstanding reset link.
  return M.update(id, { passwordHash: await bcrypt.hash(password, 12), resetPasswordToken: null, resetPasswordExpires: null }, db);
}

/** Login helper: resolves the user *with* passwordHash, or null. */
async function findByEmail(email, { withPassword = false } = {}, db = require('../db/pool').pool) {
  const { rows } = await db.query('SELECT * FROM users WHERE email = $1 LIMIT 1', [String(email || '').trim().toLowerCase()]);
  return M.toDoc(rows[0], { hidden: withPassword });
}

async function findByResetToken(tokenHash, now = new Date(), db = require('../db/pool').pool) {
  const { rows } = await db.query('SELECT * FROM users WHERE reset_password_token = $1 AND reset_password_expires > $2 LIMIT 1', [tokenHash, now]);
  return M.toDoc(rows[0]);
}

const comparePassword = (userWithHash, candidate) => (userWithHash && userWithHash.passwordHash
  ? bcrypt.compare(String(candidate || ''), userWithHash.passwordHash)
  : Promise.resolve(false));

/** Removes secrets before a user object is sent to a client. */
const publicUser = (u) => {
  if (!u) return u;
  const { passwordHash, resetPasswordToken, resetPasswordExpires, ...safe } = u; // eslint-disable-line no-unused-vars
  return safe;
};

/** Admin list: filter by role, search name / email / phone, newest first, max 200. */
async function list({ role, search } = {}, db) {
  const params = [];
  const clauses = [];
  if (role) { params.push(role); clauses.push(`role = $${params.length}`); }
  if (search) {
    params.push(`%${escapeLike(search)}%`);
    const n = params.length;
    clauses.push(`(name ILIKE $${n} OR email ILIKE $${n} OR phone ILIKE $${n})`);
  }
  return M.where(clauses.join(' AND '), params, { sort: [['createdAt', 'desc']], limit: 200 }, db);
}

/** Adds points (or subtracts, when negative). The CHECK constraint keeps the balance from going below zero. */
async function addRewardPoints(id, delta, db = require('../db/pool').pool) {
  const { rows } = await db.query('UPDATE users SET reward_points = reward_points + $2, updated_at = now() WHERE id = $1 RETURNING *', [id, delta]);
  return M.toDoc(rows[0]);
}

/** Atomic "spend if enough": returns the updated user, or null when the balance is too low. */
async function spendRewardPoints(id, points, db = require('../db/pool').pool) {
  const { rows } = await db.query(
    'UPDATE users SET reward_points = reward_points - $2, updated_at = now() WHERE id = $1 AND reward_points >= $2 RETURNING *',
    [id, points],
  );
  return M.toDoc(rows[0]);
}

module.exports = { ...M, create, update, setPassword, findByEmail, findByResetToken, comparePassword, publicUser, list, addRewardPoints, spendRewardPoints, normalise };
