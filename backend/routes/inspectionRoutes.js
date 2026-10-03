const router = require('express').Router();
const { param } = require('express-validator');
const validate = require('../middleware/validate');
const { protect, restrictTo } = require('../middleware/auth');
const { makeUploader, verifyImages } = require('../middleware/upload');
const { INSPECTION_SLOTS } = require('../config/constants');
const c = require('../controllers/inspectionsController');

const upload = makeUploader('inspections');
const fields = [...INSPECTION_SLOTS.map((name) => ({ name, maxCount: 1 })), { name: 'extra', maxCount: 6 }];

router.get('/config', c.config);
router.use(protect);
router.post('/', upload.fields(fields), verifyImages, c.submit);
router.get('/', restrictTo('admin', 'staff'), c.adminList);
router.get('/bookings', restrictTo('admin', 'staff'), c.eligibleBookings);
router.get('/booking/:bookingId', [param('bookingId').isUUID()], validate, c.listForBooking);
router.get('/:id', [param('id').isUUID()], validate, c.get);

module.exports = router;
