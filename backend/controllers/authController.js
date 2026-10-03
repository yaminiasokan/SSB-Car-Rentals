const crypto = require('crypto');
const User = require('../models/User');
const env = require('../config/env');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { signToken } = require('../middleware/auth');

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const send = (res, status, user) => res.status(status).json({ success: true, token: signToken(user), user: User.publicUser(user) });

exports.register = asyncHandler(async (req, res) => {
  const { name, email, phone, password } = req.body;
  const user = await User.create({ name, email, phone, password, role: 'customer' }); // role can never be set by the client
  send(res, 201, user);
});

exports.login = asyncHandler(async (req, res) => {
  const user = await User.findByEmail(req.body.email, { withPassword: true });
  // Same message for unknown email and wrong password — don't reveal which accounts exist.
  if (!user || !(await User.comparePassword(user, req.body.password))) throw new AppError('Incorrect email or password.', 401);
  if (!user.isActive) throw new AppError('This account has been deactivated. Please contact SSB support.', 403);
  send(res, 200, user);
});

exports.me = asyncHandler(async (req, res) => res.json({ success: true, user: req.user }));

exports.logout = (req, res) => res.json({ success: true, message: 'Signed out.' }); // JWTs are stateless; the client discards the token

exports.forgotPassword = asyncHandler(async (req, res) => {
  const user = await User.findByEmail(req.body.email);
  const out = { success: true, message: 'If that email is registered, a password reset link has been sent.' };
  if (user) {
    const token = crypto.randomBytes(32).toString('hex');
    await User.update(user._id, { resetPasswordToken: sha(token), resetPasswordExpires: new Date(Date.now() + 30 * 60 * 1000) });
    const url = `${env.clientUrl}/reset-password/${token}`;
    // No email provider is configured: log the link (and expose it in dev) so the flow can be tested.
    // TODO(production): send `url` with nodemailer / SES / SendGrid and remove `demoResetUrl`.
    console.log(`[password reset] ${user.email}: ${url}`);
    if (!env.isProd) out.demoResetUrl = url;
  }
  res.json(out);
});

exports.resetPassword = asyncHandler(async (req, res) => {
  const found = await User.findByResetToken(sha(req.params.token));
  if (!found) throw new AppError('This reset link is invalid or has expired. Request a new one.', 400);
  const user = await User.setPassword(found._id, req.body.password); // also clears the reset token
  send(res, 200, user);
});
