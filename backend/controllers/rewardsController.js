const asyncHandler = require('../utils/asyncHandler');
const rewards = require('../services/rewardsService');

exports.summary = asyncHandler(async (req, res) => res.json({ success: true, ...(await rewards.summary(req.user._id)) }));

exports.redeem = asyncHandler(async (req, res) => {
  const { entry, balance, item } = await rewards.redeem(req.user._id, req.body.rewardKey);
  res.status(201).json({ success: true, couponCode: entry.couponCode, balance, reward: item });
});
