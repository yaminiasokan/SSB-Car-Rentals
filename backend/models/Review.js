const { defineModel } = require('../db/model');

const M = defineModel({
  table: 'reviews',
  fields: [
    ['booking', 'booking_id'], ['vehicle', 'vehicle_id'], ['user', 'user_id'],
    ['ratings.overall', 'rating_overall'], ['ratings.vehicleCondition', 'rating_vehicle_condition'],
    ['ratings.cleanliness', 'rating_cleanliness'], ['ratings.pickupExperience', 'rating_pickup_experience'],
    ['comment', 'comment'], ['verified', 'verified'],
  ],
});

/** Average overall rating (1 decimal) and review count for a vehicle. */
async function summaryForVehicle(vehicleId, db = require('../db/pool').pool) {
  const { rows } = await db.query('SELECT AVG(rating_overall)::float8 AS avg, COUNT(*)::int AS n FROM reviews WHERE vehicle_id = $1', [vehicleId]);
  const { avg, n } = rows[0];
  return { rating: n ? Math.round(avg * 10) / 10 : 0, reviewCount: n };
}

module.exports = { ...M, summaryForVehicle };
