const Booking = require('../models/Booking');
const Vehicle = require('../models/Vehicle');
const { populate } = require('../db/model');
const { notify } = require('./notificationService');

const fmt = (d) => new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' });
const vehicleName = { path: 'vehicle', model: Vehicle, select: 'name' };

async function runReminders(now = new Date()) {
  const in24h = new Date(now.getTime() + 24 * 3600e3);
  const in6h = new Date(now.getTime() + 6 * 3600e3);

  const pickups = await populate(await Booking.dueForPickupReminder(now, in24h), vehicleName);
  for (const b of pickups) {
    await notify(b.user, 'pickup_reminder', 'Pickup reminder', `Pick up your ${b.vehicle?.name || 'vehicle'} in ${b.pickupLocation} on ${fmt(b.pickupAt)}. Carry your driving licence.`, `/booking/confirmation/${b._id}`);
    await Booking.update(b._id, { reminders: { pickupSent: true } });
  }
  const returns = await populate(await Booking.dueForReturnReminder(now, in6h), vehicleName);
  for (const b of returns) {
    await notify(b.user, 'return_reminder', 'Return reminder', `Return your ${b.vehicle?.name || 'vehicle'} to ${b.returnLocation} by ${fmt(b.returnAt)}.`, '/track-rental');
    await Booking.update(b._id, { reminders: { returnSent: true } });
  }
  return { pickups: pickups.length, returns: returns.length };
}

function startReminderJob(everyMs = 15 * 60 * 1000) {
  const tick = () => runReminders().catch((e) => console.error('Reminder job failed:', e.message));
  tick();
  return setInterval(tick, everyMs);
}

module.exports = { runReminders, startReminderJob };
