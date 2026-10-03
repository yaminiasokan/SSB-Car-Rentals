const Booking = require('../models/Booking');

/**
 * A booking blocks a vehicle when confirmed/active, or pending with an unexpired payment hold
 * (the SQL lives in models/Booking.js → findConflicts / bookedVehicleIds).
 * Pass a transaction client as `db` to run the check inside that transaction.
 */
const conflictingBookings = (vehicleId, from, to, excludeId = null, db) => Booking.findConflicts(vehicleId, from, to, { excludeId, db });

/** Set of vehicle ids (strings) that are blocked at any moment of [from, to). */
const bookedVehicleIds = (from, to, db) => Booking.bookedVehicleIds(from, to, db);

/** Adds currentlyBooked + availabilityLabel to vehicles (plain objects returned). */
async function decorateVehicles(vehicles) {
  const now = new Date();
  const booked = await bookedVehicleIds(now, new Date(now.getTime() + 1));
  return vehicles.map((v) => {
    const o = { ...v };
    o.currentlyBooked = booked.has(String(o._id));
    o.availabilityLabel = o.availability && o.status === 'Active' && !o.currentlyBooked ? 'Available' : 'Booked';
    return o;
  });
}

module.exports = { conflictingBookings, bookedVehicleIds, decorateVehicles };
