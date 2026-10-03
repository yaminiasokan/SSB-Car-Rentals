const router = require('express').Router();
const { param } = require('express-validator');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const c = require('../controllers/wishlistController');

router.use(protect);
router.get('/', c.get);
router.post('/:vehicleId', [param('vehicleId').isUUID()], validate, c.add);
router.delete('/:vehicleId', [param('vehicleId').isUUID()], validate, c.remove);

module.exports = router;
