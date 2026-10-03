const Notification = require('../models/Notification');
const User = require('../models/User');

async function notify(userId, type, title, message, link) {
  try {
    return await Notification.insert({ user: userId, type, title, message, link });
  } catch (e) {
    console.error('Notification failed:', e.message); // never break the main flow
    return null;
  }
}

async function notifyAdmins(type, title, message, link) {
  const admins = await User.find({ role: 'admin', isActive: true });
  return Promise.all(admins.map((a) => notify(a._id, type, title, message, link)));
}

module.exports = { notify, notifyAdmins };
