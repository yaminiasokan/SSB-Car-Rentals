const router = require('express').Router();
const { protect, restrictTo } = require('../middleware/auth');
const c = require('../controllers/analyticsController');

router.get('/', protect, restrictTo('admin'), c.overview);
module.exports = router;
