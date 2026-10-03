const router = require('express').Router();
const { body, param } = require('express-validator');
const validate = require('../middleware/validate');
const { protect, restrictTo } = require('../middleware/auth');
const { BOOKING_STATUSES } = require('../config/constants');
const c = require('../controllers/adminController');

router.use(protect, restrictTo('admin'));
const id = [param('id').isUUID()];

router.get('/stats', c.stats);
router.get('/bookings', c.bookings);
router.get('/bookings/:id', id, validate, c.bookingDetail);
router.patch('/bookings/:id/status', id, [body('status').isIn(BOOKING_STATUSES).withMessage('Choose a valid status'), body('note').optional().isString().isLength({ max: 300 })], validate, c.setStatus);
router.post('/bookings/:id/approve', id, validate, c.approve);
router.post('/bookings/:id/cancel', id, [body('reason').optional().isString().isLength({ max: 300 })], validate, c.cancel);
router.post('/run-reminders', c.runReminders);

module.exports = router;
