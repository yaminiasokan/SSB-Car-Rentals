const router = require('express').Router();
const { body, param } = require('express-validator');
const validate = require('../middleware/validate');
const { protect, restrictTo } = require('../middleware/auth');
const c = require('../controllers/damageReportsController');

const id = [param('id').isUUID().withMessage('Invalid report')];
router.use(protect);
router.get('/', c.list);
router.get('/:id', id, validate, c.get);

router.patch('/:id/review', restrictTo('admin'), id, [
  body('decision').isIn(['confirm', 'reject']).withMessage('Choose confirm or reject'),
  body('damages').optional().isArray({ max: 30 }),
  body('finalAmount').optional({ values: 'null' }).isFloat({ min: 0 }).withMessage('Enter a valid amount').toFloat(),
  body('comments').optional().isString().isLength({ max: 1000 }),
], validate, c.review);

router.patch('/:id/resolve', restrictTo('admin'), id, [
  body('outcome').isIn(['upheld', 'adjusted', 'waived', 'settled']).withMessage('Choose an outcome'),
  body('finalAmount').if(body('outcome').equals('adjusted')).isFloat({ min: 0 }).withMessage('Enter the adjusted amount').toFloat(),
  body('note').optional().isString().isLength({ max: 1000 }),
], validate, c.resolve);

router.post('/:id/dispute', id, [body('message').trim().isLength({ min: 10, max: 1000 }).withMessage('Tell us why you disagree (at least 10 characters)')], validate, c.dispute);
router.post('/:id/pay', id, [body('method').isIn(['UPI', 'Credit Card', 'Debit Card', 'Net Banking']).withMessage('Choose a payment method')], validate, c.pay);

module.exports = router;
