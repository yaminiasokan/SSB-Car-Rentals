const router = require('express').Router();
const { body, param } = require('express-validator');
const validate = require('../middleware/validate');
const { protect, restrictTo } = require('../middleware/auth');
const { makeUploader, verifyImages } = require('../middleware/upload');
const c = require('../controllers/paymentsController');

const METHODS = ['UPI', 'Credit Card', 'Debit Card', 'Net Banking', 'Cash on Pickup'];
const upload = makeUploader('payments');

router.use(protect);
router.post('/pay', [
  body('bookingId').isUUID().withMessage('Invalid booking'),
  body('method').isIn(METHODS).withMessage('Choose a payment method'),
  body('details').optional().isObject(),
], validate, c.pay);
router.get('/mine', c.mine);
router.get('/admin/all', restrictTo('admin'), c.adminList);
router.patch('/:id/collect', restrictTo('admin', 'staff'), [param('id').isUUID()], validate, c.collectCash);
router.post('/:id/screenshot', [param('id').isUUID()], validate, upload.single('screenshot'), verifyImages, c.uploadScreenshot);
router.patch('/:id/verify', restrictTo('admin', 'staff'), [param('id').isUUID(), body('status').isIn(['Verified', 'Rejected'])], validate, c.verifyScreenshot);
router.get('/:id', [param('id').isUUID()], validate, c.getOne);

module.exports = router;
