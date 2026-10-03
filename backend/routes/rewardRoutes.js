const router = require('express').Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const c = require('../controllers/rewardsController');

router.use(protect);
router.get('/', c.summary);
router.post('/redeem', [body('rewardKey').isString().notEmpty()], validate, c.redeem);

module.exports = router;
