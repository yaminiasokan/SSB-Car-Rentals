const router = require('express').Router();
const { body, param } = require('express-validator');
const validate = require('../middleware/validate');
const { protect, restrictTo } = require('../middleware/auth');
const c = require('../controllers/notificationsController');

router.use(protect);
router.get('/', c.list);
router.patch('/read-all', c.markAllRead);
router.patch('/:id/read', [param('id').isUUID()], validate, c.markRead);
router.delete('/:id', [param('id').isUUID()], validate, c.remove);
router.post('/admin-message', restrictTo('admin'), [
  body('userId').isUUID().withMessage('Choose a customer'),
  body('title').optional().isString().isLength({ max: 100 }),
  body('message').trim().isLength({ min: 3, max: 500 }).withMessage('Write a message (3–500 characters)'),
], validate, c.adminMessage);

module.exports = router;
