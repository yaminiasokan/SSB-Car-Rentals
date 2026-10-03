const router = require('express').Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const c = require('../controllers/reviewsController');

const star = (f) => body(`ratings.${f}`).isInt({ min: 1, max: 5 }).withMessage('Choose a rating from 1 to 5').toInt();

router.get('/', c.list);
router.get('/mine', protect, c.mine);
router.post('/', protect, [
  body('bookingId').isUUID().withMessage('Invalid booking'),
  star('overall'), star('vehicleCondition'), star('cleanliness'), star('pickupExperience'),
  body('comment').optional().trim().isLength({ max: 1000 }).withMessage('Comment is too long'),
], validate, c.create);

module.exports = router;
