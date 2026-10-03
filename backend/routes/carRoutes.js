const router = require('express').Router();
const { body, param } = require('express-validator');
const validate = require('../middleware/validate');
const { protect, restrictTo } = require('../middleware/auth');
const { makeUploader, verifyImages } = require('../middleware/upload');
const { FUEL_TYPES, BODY_TYPES, TRANSMISSIONS, LOCATIONS, VEHICLE_STATUS } = require('../config/constants');
const c = require('../controllers/carsController');

const upload = makeUploader('vehicles');

const vehicleRules = (creating) => {
  const req = (chain) => (creating ? chain : chain.optional());
  return [
    req(body('name').trim().notEmpty().withMessage('Enter the vehicle name')),
    req(body('brand').trim().notEmpty().withMessage('Enter the brand')),
    req(body('model').trim().notEmpty().withMessage('Enter the model')),
    req(body('fuel').isIn(FUEL_TYPES).withMessage('Choose a fuel type')),
    req(body('seats').isInt({ min: 2, max: 12 }).withMessage('Seats must be between 2 and 12')),
    req(body('pricePerDay').isFloat({ min: 0 }).withMessage('Enter a valid price per day')),
    req(body('location').isIn(LOCATIONS).withMessage('Choose a location')),
    body('pricePerHour').optional({ values: 'falsy' }).isFloat({ min: 0 }).withMessage('Enter a valid price per hour'),
    body('transmission').optional().isIn(TRANSMISSIONS).withMessage('Choose a transmission'),
    body('bodyType').optional().isIn(BODY_TYPES).withMessage('Choose a body type'),
    body('status').optional().isIn(VEHICLE_STATUS).withMessage('Choose a status'),
    body('availability').optional().isBoolean().withMessage('Availability must be true or false'),
    body('registrationYear').optional({ values: 'falsy' }).isInt({ min: 2000, max: new Date().getFullYear() + 1 }).withMessage('Enter a valid year'),
  ];
};

router.get('/', c.list);
router.get('/:id', c.get);
router.get('/:id/booked-slots', [param('id').isUUID()], validate, c.bookedSlots);

router.post('/', protect, restrictTo('admin'), vehicleRules(true), validate, c.create);
router.put('/:id', protect, restrictTo('admin'), [param('id').isUUID(), ...vehicleRules(false)], validate, c.update);
router.delete('/:id', protect, restrictTo('admin'), [param('id').isUUID()], validate, c.remove);
router.post('/:id/images', protect, restrictTo('admin'), upload.array('images', 8), verifyImages, c.addImages);
router.delete('/:id/images', protect, restrictTo('admin'), [param('id').isUUID(), body('url').isString()], validate, c.removeImage);

module.exports = router;
