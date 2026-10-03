const router = require('express').Router();
const { body, param } = require('express-validator');
const validate = require('../middleware/validate');
const { protect, restrictTo } = require('../middleware/auth');
const c = require('../controllers/usersController');

router.use(protect);

router.put('/profile', [
  body('name').optional().trim().isLength({ min: 2, max: 80 }).withMessage('Enter your full name'),
  body('phone').optional().trim().matches(/^[6-9]\d{9}$/).withMessage('Enter a valid 10-digit mobile number'),
  body('address').optional().trim().isLength({ max: 300 }).withMessage('Address is too long'),
  body('licenseNumber').optional({ values: 'falsy' }).trim().matches(/^[A-Za-z0-9][A-Za-z0-9\s\-/]{6,19}$/).withMessage('Enter a valid driving licence number'),
  body('licenseExpiry').optional({ values: 'falsy' }).isISO8601().withMessage('Enter a valid expiry date'),
], validate, c.updateProfile);

router.put('/password', [
  body('currentPassword').notEmpty().withMessage('Enter your current password'),
  body('newPassword').isLength({ min: 8, max: 72 }).withMessage('Use at least 8 characters').matches(/[A-Za-z]/).withMessage('Include a letter').matches(/\d/).withMessage('Include a number'),
], validate, c.changePassword);

// admin
router.get('/', restrictTo('admin'), c.list);
router.get('/:id', restrictTo('admin'), [param('id').isUUID()], validate, c.get);
router.patch('/:id/active', restrictTo('admin'), [param('id').isUUID(), body('isActive').isBoolean()], validate, c.setActive);
router.patch('/:id/license', restrictTo('admin'), [param('id').isUUID(), body('verified').isBoolean()], validate, c.setLicenseVerified);

module.exports = router;
