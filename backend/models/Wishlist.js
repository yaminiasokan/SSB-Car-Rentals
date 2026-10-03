const Vehicle = require('./Vehicle');

// A wishlist is just a (user, vehicle) pair — many-to-many, so there is no separate document per user.
const pool = (db) => db || require('../db/pool').pool;

/** The user's saved vehicles (oldest first), leaving out retired ones. */
async function vehiclesFor(userId, db) {
  const { rows } = await pool(db).query(
    `SELECT v.* FROM wishlist_items w JOIN vehicles v ON v.id = w.vehicle_id
     WHERE w.user_id = $1 AND v.status <> 'Retired' ORDER BY w.created_at ASC`,
    [userId],
  );
  return rows.map((r) => Vehicle.toDoc(r));
}

const add = (userId, vehicleId, db) => pool(db).query(
  'INSERT INTO wishlist_items (user_id, vehicle_id) VALUES ($1, $2) ON CONFLICT (user_id, vehicle_id) DO NOTHING', [userId, vehicleId],
);
const remove = (userId, vehicleId, db) => pool(db).query('DELETE FROM wishlist_items WHERE user_id = $1 AND vehicle_id = $2', [userId, vehicleId]);

module.exports = { vehiclesFor, add, remove };
