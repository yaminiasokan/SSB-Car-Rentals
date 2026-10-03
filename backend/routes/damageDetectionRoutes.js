const router = require('express').Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { protect, restrictTo } = require('../middleware/auth');
const c = require('../controllers/damageDetectionController');

router.get('/engine', c.engine);
router.post('/analyze', protect, restrictTo('admin', 'staff'), [body('bookingId').isUUID().withMessage('Choose a booking')], validate, c.analyze);

module.exports = router;
