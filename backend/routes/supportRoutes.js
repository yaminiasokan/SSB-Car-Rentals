const router = require('express').Router();
const { body, param } = require('express-validator');
const validate = require('../middleware/validate');
const { protect, restrictTo } = require('../middleware/auth');
const c = require('../controllers/supportController');

const id = [param('id').isUUID()];
router.use(protect);
router.post('/', [
  body('subject').trim().isLength({ min: 4, max: 140 }).withMessage('Enter a subject (at least 4 characters)'),
  body('message').trim().isLength({ min: 10, max: 2000 }).withMessage('Describe the issue (at least 10 characters)'),
  body('category').optional().isIn(['General', 'Booking', 'Payment', 'Vehicle', 'Damage']).withMessage('Choose a category'),
  body('bookingId').optional({ values: 'falsy' }).isUUID(),
], validate, c.create);
router.post('/emergency', [
  body('bookingId').isUUID().withMessage('Choose your active rental'),
  body('emergencyType').isIn(['Roadside assistance', 'Accident assistance', 'Towing', 'Customer support']).withMessage('Choose the type of help you need'),
  body('location').optional().isString().isLength({ max: 200 }),
  body('message').optional().isString().isLength({ max: 500 }),
], validate, c.emergency);
router.get('/mine', c.mine);
router.get('/admin/all', restrictTo('admin', 'staff'), c.adminList);
router.patch('/:id', restrictTo('admin', 'staff'), id, [
  body('status').optional().isIn(['Open', 'In Progress', 'Resolved', 'Closed']),
  body('priority').optional().isIn(['Low', 'Normal', 'High', 'Urgent']),
], validate, c.adminUpdate);
router.get('/:id', id, validate, c.get);
router.post('/:id/replies', id, [body('message').trim().isLength({ min: 2, max: 1000 }).withMessage('Write a reply')], validate, c.reply);

module.exports = router;
