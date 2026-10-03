const router = require('express').Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const c = require('../controllers/authController');

const password = (field = 'password') => body(field).isString().isLength({ min: 8, max: 72 }).withMessage('Use at least 8 characters')
  .matches(/[A-Za-z]/).withMessage('Include at least one letter').matches(/\d/).withMessage('Include at least one number');

router.post('/register', [
  body('name').trim().isLength({ min: 2, max: 80 }).withMessage('Enter your full name'),
  body('email').trim().isEmail().withMessage('Enter a valid email address').normalizeEmail({ gmail_remove_dots: false }),
  body('phone').trim().matches(/^[6-9]\d{9}$/).withMessage('Enter a valid 10-digit mobile number'),
  password(),
], validate, c.register);

router.post('/login', [
  body('email').trim().isEmail().withMessage('Enter a valid email address').normalizeEmail({ gmail_remove_dots: false }),
  body('password').notEmpty().withMessage('Enter your password'),
], validate, c.login);

router.get('/me', protect, c.me);
router.post('/logout', c.logout);
router.post('/forgot-password', [body('email').trim().isEmail().withMessage('Enter a valid email address').normalizeEmail({ gmail_remove_dots: false })], validate, c.forgotPassword);
router.post('/reset-password/:token', [password()], validate, c.resetPassword);

module.exports = router;
