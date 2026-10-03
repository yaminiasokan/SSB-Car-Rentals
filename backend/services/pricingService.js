const { SERVICES, PROMOS, TAX_RATE, MIN_RENTAL_HOURS, MAX_KM_PER_DAY, REWARD_CATALOG } = require('../config/constants');
const AppError = require('../utils/AppError');
const { inr } = require('../utils/helpers');

/**
 * Pure price calculation — no database access, so it is easy to unit test.
 *
 * Total = base rental + optional services + tax − discount
 * (tax is charged on rental + services − discount). SSB CAR RENTALS charges no security deposit:
 * `deposit` is always 0 here regardless of any legacy value on the vehicle record, so nothing can
 * ever add a deposit back into a booking total. It is kept as a field (rather than removed outright)
 * only so already-created bookings/agreements that predate this change keep displaying correctly.
 */
function computePrice({ vehicle, pickupAt, returnAt, services = [], promo = null, deliveryKm = null }) {
  const from = new Date(pickupAt);
  const to = new Date(returnAt);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) throw new AppError('Enter a valid pickup and return date and time.', 422);
  const hours = (to - from) / 36e5;
  if (hours <= 0) throw new AppError('Return date and time must be after pickup.', 422);
  if (hours < MIN_RENTAL_HOURS - 1e-9) throw new AppError(`The minimum rental period is ${MIN_RENTAL_HOURS} hours.`, 422);

  const fullDays = Math.floor(hours / 24 + 1e-9);
  const remHours = Math.max(0, Math.ceil(hours - fullDays * 24 - 1e-9));
  const billingDays = fullDays + (remHours > 0 ? 1 : 0);
  const maxKm = billingDays * MAX_KM_PER_DAY; // fair-usage limit for this booking (300 km/day)

  const perDay = vehicle.pricePerDay;
  const perHour = vehicle.pricePerHour || Math.round(perDay / 100) * 10;

  const lines = [];
  if (fullDays > 0) {
    lines.push({ key: 'rental', label: 'Vehicle rental', detail: `${inr(perDay)} × ${fullDays} day${fullDays > 1 ? 's' : ''}`, amount: perDay * fullDays });
  }
  if (remHours > 0) {
    const raw = remHours * perHour;
    const amount = Math.min(raw, perDay);
    lines.push({
      key: 'rental-hours', label: fullDays > 0 ? 'Extra hours' : 'Vehicle rental',
      detail: `${remHours} hr × ${inr(perHour)}${raw > perDay ? ' (capped at one day rate)' : ''}`, amount,
    });
  }
  const baseAmount = lines.reduce((s, l) => s + l.amount, 0);

  const keys = [...new Set(services)];
  const serviceLines = keys.map((key) => {
    const svc = SERVICES[key];
    if (!svc) throw new AppError(`Unknown service: ${key}`, 422);
    if (svc.kind === 'delivery') {
      const km = Number(deliveryKm);
      if (!Number.isFinite(km) || km <= 0) throw new AppError('Enter the delivery distance in km to add Delivery & Pickup.', 422);
      const extraKm = Math.max(0, Math.ceil(km - svc.includedKm - 1e-9));
      const amount = svc.baseAmount + extraKm * svc.perExtraKm;
      return {
        key, label: svc.label,
        detail: extraKm > 0 ? `${inr(svc.baseAmount)} for ${svc.includedKm} km + ${inr(svc.perExtraKm)} × ${extraKm} extra km (${km} km total)` : `${inr(svc.baseAmount)} flat (${km} km, within ${svc.includedKm} km)`,
        amount,
      };
    }
    const perUnit = svc.unit === 'day';
    return {
      key, label: svc.label,
      detail: svc.displayPrice || (perUnit ? `${inr(svc.price)} × ${billingDays} day${billingDays > 1 ? 's' : ''}` : `${inr(svc.price)} flat`),
      amount: perUnit ? svc.price * billingDays : svc.price,
    };
  });
  const servicesAmount = serviceLines.reduce((s, l) => s + l.amount, 0);

  let discount = 0;
  let promoMessage = null;
  if (promo) {
    if (promo.kind === 'percent') {
      if (promo.minDays && billingDays < promo.minDays) promoMessage = `${promo.code} needs a rental of ${promo.minDays} days or more.`;
      else discount = Math.min(Math.round((baseAmount * promo.value) / 100), promo.cap ?? Infinity);
    } else if (promo.kind === 'flat') {
      if (promo.minBase && baseAmount < promo.minBase) promoMessage = `${promo.code} needs a rental of ${inr(promo.minBase)} or more.`;
      else discount = Math.min(promo.value, baseAmount);
    } else if (promo.kind === 'free_service') {
      const line = serviceLines.find((l) => l.key === promo.service);
      if (line) discount = line.amount;
      else promoMessage = `Add ${SERVICES[promo.service].label} in the previous step to use this reward.`;
    } else if (promo.kind === 'upgrade') {
      promoMessage = 'Our team will arrange your upgrade at pickup, subject to availability.';
    }
  }

  const taxable = baseAmount + servicesAmount - discount;
  const taxAmount = Math.round(taxable * TAX_RATE);
  const deposit = 0; // no security deposit is charged, on any vehicle, ever
  const rentalTotal = taxable + taxAmount;

  return {
    lines, serviceLines, baseAmount, servicesAmount, discount,
    promoCode: promo && (discount > 0 || promo.kind === 'upgrade') ? promo.code : null,
    promoLabel: promo ? promo.label : null,
    promoMessage,
    taxRate: TAX_RATE, taxAmount, deposit, rentalTotal, total: rentalTotal + deposit,
    billingDays, hours: Math.round(hours * 10) / 10, maxKm,
  };
}

/** Looks up a public promo code or one of the user's own reward coupons. */
async function resolvePromo(code, userId) {
  if (!code || !String(code).trim()) return null;
  const c = String(code).trim().toUpperCase();
  if (PROMOS[c]) return PROMOS[c];
  if (c.startsWith('SSBR-')) {
    if (!userId) throw new AppError('Sign in to use a reward coupon.', 401);
    const Reward = require('../models/Reward'); // lazy: keeps computePrice usable without a database
    const entry = await Reward.findOne({ couponCode: c, user: userId, couponUsed: false });
    const item = entry && REWARD_CATALOG.find((r) => r.key === entry.rewardKey);
    if (!item) throw new AppError('That reward coupon is invalid or has already been used.', 422);
    return { ...item, code: c, label: item.label, reward: true };
  }
  throw new AppError('That promo code is not valid.', 422);
}

async function priceBooking({ vehicle, pickupAt, returnAt, services, promoCode, userId, deliveryKm }) {
  const promo = await resolvePromo(promoCode, userId);
  return computePrice({ vehicle, pickupAt, returnAt, services, promo, deliveryKm });
}

module.exports = { computePrice, resolvePromo, priceBooking };
