const router = require('express').Router();
const { body, param } = require('express-validator');
const validate = require('../middleware/validate');
const { protect, optionalAuth } = require('../middleware/auth');
const { LOCATIONS, SERVICES } = require('../config/constants');
const c = require('../controllers/bookingsController');

const dateRules = [
  body('pickupAt').isISO8601().withMessage('Enter a valid pickup date and time'),
  body('returnAt').isISO8601().withMessage('Enter a valid return date and time')
    .custom((v, { req }) => new Date(v) > new Date(req.body.pickupAt)).withMessage('Return must be after pickup'),
  body('services').optional().isArray({ max: 10 }).withMessage('Services must be a list'),
  body('services.*').optional().isIn(Object.keys(SERVICES)).withMessage('Unknown service'),
  body('services').custom((services, { req }) => !(services || []).includes('doorstepDelivery') || Number(req.body.deliveryKm) > 0)
    .withMessage('Enter the delivery distance in km to add Delivery & Pickup'),
  body('deliveryKm').optional({ values: 'falsy' }).isFloat({ min: 1, max: 2000 }).withMessage('Enter a valid delivery distance in km'),
  body('promoCode').optional({ values: 'falsy' }).isString().isLength({ max: 30 }),
];

router.get('/config', c.config);
router.post('/quote', optionalAuth, [body('vehicleId').isUUID().withMessage('Choose a vehicle'), ...dateRules], validate, c.quote);

router.use(protect);
router.post('/', [
  body('vehicleId').isUUID().withMessage('Choose a vehicle'),
  body('pickupLocation').isIn(LOCATIONS).withMessage('Choose a pickup location'),
  body('returnLocation').isIn(LOCATIONS).withMessage('Choose a return location'),
  ...dateRules,
  body('customer.name').trim().isLength({ min: 2, max: 80 }).withMessage('Enter your full name'),
  body('customer.phone').trim().matches(/^[6-9]\d{9}$/).withMessage('Enter a valid 10-digit mobile number'),
  body('customer.email').trim().isEmail().withMessage('Enter a valid email address'),
  body('customer.licenseNumber').trim().matches(/^[A-Za-z0-9][A-Za-z0-9\s\-/]{6,19}$/).withMessage('Enter a valid driving licence number'),
  body('customer.address').trim().isLength({ min: 10, max: 300 }).withMessage('Enter your full address (at least 10 characters)'),
], validate, c.create);

router.get('/mine', c.mine);
const id = [param('id').isUUID().withMessage('Invalid booking')];
router.get('/:id', id, validate, c.getOne);
router.patch('/:id/cancel', id, [body('reason').optional().isString().isLength({ max: 300 })], validate, c.cancel);
router.get('/:id/track', id, validate, c.track);
router.get('/:id/agreement', id, validate, c.getAgreement);
router.post('/:id/agreement/acknowledge', id, validate, c.acknowledgeAgreement);
router.get('/:id/agreement/download', id, validate, c.downloadAgreement);

module.exports = router;
