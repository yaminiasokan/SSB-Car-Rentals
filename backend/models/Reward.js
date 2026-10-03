const { defineModel } = require('../db/model');

const M = defineModel({
  table: 'rewards',
  // Points ledger: positive = earned, negative = redeemed / reversed.
  fields: [
    ['user', 'user_id'], ['type', 'type'], ['points', 'points'], ['description', 'description'],
    ['booking', 'booking_id'], ['rewardKey', 'reward_key'],
    ['couponCode', 'coupon_code'], ['couponUsed', 'coupon_used'], ['couponUsedOn', 'coupon_used_on_id'],
  ],
});

const pool = (db) => db || require('../db/pool').pool;

/** Marks a reward coupon as used on a booking. */
const markCouponUsed = (code, bookingId, db) => pool(db).query(
  'UPDATE rewards SET coupon_used = TRUE, coupon_used_on_id = $2, updated_at = now() WHERE coupon_code = $1', [code, bookingId],
);

/** Gives the coupon back (booking cancelled) — only if it was used on that same booking. */
const releaseCoupon = (code, bookingId, db) => pool(db).query(
  'UPDATE rewards SET coupon_used = FALSE, coupon_used_on_id = NULL, updated_at = now() WHERE coupon_code = $1 AND coupon_used_on_id = $2', [code, bookingId],
);

module.exports = { ...M, markCouponUsed, releaseCoupon };
