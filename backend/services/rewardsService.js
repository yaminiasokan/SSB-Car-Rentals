const crypto = require('crypto');
const { tx } = require('../db/pool');
const Reward = require('../models/Reward');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const { idOf } = require('../utils/helpers');
const { POINTS_PER_100, REWARD_CATALOG } = require('../config/constants');
const { notify } = require('./notificationService');

/** Every ₹100 of rental spend (deposit excluded) earns POINTS_PER_100 points. */
const pointsFor = (amount) => Math.floor(Number(amount || 0) / 100) * POINTS_PER_100;

async function awardForBooking(booking, amount) {
  const points = pointsFor(amount);
  if (points <= 0) return 0;
  const userId = idOf(booking.user);
  const awarded = await tx(async (db) => {
    if (await Reward.findOne({ booking: booking._id, type: 'earn' }, {}, db)) return 0; // already awarded
    await Reward.insert({ user: userId, type: 'earn', points, booking: booking._id, description: `Booking ${booking.bookingId}` }, db);
    await User.addRewardPoints(userId, points, db);
    return points;
  });
  if (awarded) await notify(userId, 'reward', 'SSB Rewards points earned', `You earned ${awarded} points on booking ${booking.bookingId}.`, '/rewards');
  return awarded;
}

/** Takes back the points earned on a cancelled booking. Runs on the caller's transaction client. */
async function reverseForBooking(booking, db) {
  const earned = await Reward.findOne({ booking: booking._id, type: 'earn' }, {}, db);
  if (!earned) return 0;
  if (await Reward.findOne({ booking: booking._id, type: 'reversal' }, {}, db)) return 0;
  const userId = idOf(booking.user);
  const user = await User.findById(userId, db);
  const points = Math.min(earned.points, user.rewardPoints);
  await Reward.insert({ user: userId, type: 'reversal', points: -points, booking: booking._id, description: `Booking ${booking.bookingId} cancelled` }, db);
  await User.addRewardPoints(userId, -points, db);
  return points;
}

async function redeem(userId, rewardKey) {
  const item = REWARD_CATALOG.find((r) => r.key === rewardKey);
  if (!item) throw new AppError('That reward does not exist.', 404);
  const couponCode = `SSBR-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  // Balance check + deduction is a single conditional UPDATE, so two parallel requests can't overspend;
  // the ledger row is written in the same transaction so points are never spent without a coupon.
  const { entry, balance } = await tx(async (db) => {
    const user = await User.spendRewardPoints(userId, item.points, db);
    if (!user) throw new AppError(`You need ${item.points} points to redeem this reward.`, 409);
    const row = await Reward.insert({ user: userId, type: 'redeem', points: -item.points, rewardKey, couponCode, description: item.label }, db);
    return { entry: row, balance: user.rewardPoints };
  });
  await notify(userId, 'reward', 'Reward redeemed', `${item.label} — use coupon ${couponCode} when you book.`, '/rewards');
  return { entry, balance, item };
}

async function summary(userId) {
  const ledger = await Reward.find({ user: userId }, { sort: [['createdAt', 'desc']] });
  const user = await User.findById(userId);
  const earned = ledger.filter((l) => l.type === 'earn').reduce((s, l) => s + l.points, 0);
  const redeemed = ledger.filter((l) => l.type === 'redeem').reduce((s, l) => s - l.points, 0);
  return {
    balance: user.rewardPoints, earned, redeemed, ledger,
    coupons: ledger.filter((l) => l.type === 'redeem' && l.couponCode),
    catalog: REWARD_CATALOG, pointsPer100: POINTS_PER_100,
  };
}

module.exports = { pointsFor, awardForBooking, reverseForBooking, redeem, summary };
