const { defineModel } = require('../db/model');

const M = defineModel({
  table: 'notifications',
  fields: [['user', 'user_id'], ['type', 'type'], ['title', 'title'], ['message', 'message'], ['link', 'link'], ['read', 'is_read']],
});

const pool = (db) => db || require('../db/pool').pool;

const markRead = (id, userId, db) => pool(db).query('UPDATE notifications SET is_read = TRUE, updated_at = now() WHERE id = $1 AND user_id = $2', [id, userId]);
const markAllRead = (userId, db) => pool(db).query('UPDATE notifications SET is_read = TRUE, updated_at = now() WHERE user_id = $1 AND is_read = FALSE', [userId]);
const removeForUser = (id, userId, db) => pool(db).query('DELETE FROM notifications WHERE id = $1 AND user_id = $2', [id, userId]);

module.exports = { ...M, markRead, markAllRead, removeForUser };
