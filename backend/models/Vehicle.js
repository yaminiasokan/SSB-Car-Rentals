const { defineModel, isUuid } = require('../db/model');
const { FUEL_TYPES, BODY_TYPES, TRANSMISSIONS, LOCATIONS, VEHICLE_STATUS, REMOVED_MODELS, ECO_SCORES } = require('../config/constants');
const AppError = require('../utils/AppError');
const { invalid, toNumber, toBool } = require('../utils/modelValidation');
const { escapeLike } = require('../utils/helpers');

const M = defineModel({
  table: 'vehicles',
  fields: [
    ['name', 'name'], ['slug', 'slug'], ['brand', 'brand'], ['model', 'model'], ['variant', 'variant'],
    ['bodyType', 'body_type'], ['fuel', 'fuel'], ['fuelDisplay', 'fuel_display'], ['transmission', 'transmission'],
    ['seats', 'seats'], ['pricePerDay', 'price_per_day'], ['pricePerHour', 'price_per_hour'], ['securityDeposit', 'security_deposit'],
    ['registrationYear', 'registration_year'], ['mileage', 'mileage'], ['images', 'images'], ['features', 'features'],
    ['description', 'description'], ['location', 'location'], ['availability', 'availability'], ['status', 'status'],
    ['rating', 'rating'], ['reviewCount', 'review_count'], ['bookingCount', 'booking_count'], ['ecoScore', 'eco_score'],
  ],
});

const NUMERIC = ['seats', 'pricePerDay', 'pricePerHour', 'securityDeposit', 'registrationYear', 'ecoScore', 'rating', 'reviewCount', 'bookingCount'];
const TRIMMED = ['name', 'brand', 'model', 'variant', 'fuelDisplay'];

/** Cast + trim incoming values (form data may send numbers as strings). Empty registrationYear/ecoScore become NULL. */
function coerce(data) {
  const d = { ...data };
  NUMERIC.forEach((k) => { if (d[k] !== undefined) d[k] = toNumber(d[k]); });
  ['registrationYear', 'ecoScore'].forEach((k) => { if (d[k] === '' || Number.isNaN(d[k])) d[k] = null; });
  TRIMMED.forEach((k) => { if (typeof d[k] === 'string') d[k] = d[k].trim(); });
  if (d.availability !== undefined) d.availability = toBool(d.availability);
  if (Array.isArray(d.features)) d.features = d.features.map((f) => String(f).trim()).filter(Boolean);
  return d;
}

/** Values the model fills in when they are missing (slug, display fuel, eco score, hourly rate). */
function derived(v) {
  const out = {};
  if (!v.slug) out.slug = `${v.name}-${v.fuel}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  if (!v.fuelDisplay) out.fuelDisplay = v.fuel;
  if (v.ecoScore == null) out.ecoScore = ECO_SCORES[v.fuel] ?? 60;
  if (!v.pricePerHour && v.pricePerDay) out.pricePerHour = Math.round(v.pricePerDay / 10 / 10) * 10;
  return out;
}

function validate(v) {
  const label = `${v.name} ${v.brand} ${v.model}`;
  if (REMOVED_MODELS.some((re) => re.test(label))) {
    throw new AppError('This vehicle was removed from the SSB Car Rentals inventory and cannot be added.', 422);
  }
  const f = {};
  if (!v.name) f.name = 'Vehicle name is required';
  if (!v.brand) f.brand = 'Brand is required';
  if (!v.model) f.model = 'Model is required';
  if (!FUEL_TYPES.includes(v.fuel)) f.fuel = 'Choose a fuel type';
  if (!BODY_TYPES.includes(v.bodyType)) f.bodyType = 'Choose a body type';
  if (!TRANSMISSIONS.includes(v.transmission)) f.transmission = 'Choose a transmission';
  if (!LOCATIONS.includes(v.location)) f.location = 'Choose a location';
  if (!VEHICLE_STATUS.includes(v.status)) f.status = 'Choose a status';
  if (!Number.isInteger(v.seats) || v.seats < 2 || v.seats > 12) f.seats = 'Seats must be between 2 and 12';
  if (!Number.isFinite(v.pricePerDay) || v.pricePerDay < 0) f.pricePerDay = 'Price per day is required';
  if (!Number.isFinite(v.pricePerHour) || v.pricePerHour < 0) f.pricePerHour = 'Enter a valid price per hour';
  if (!Number.isFinite(v.securityDeposit) || v.securityDeposit < 0) f.securityDeposit = 'Enter a valid deposit';
  if (v.registrationYear != null && (!Number.isInteger(v.registrationYear) || v.registrationYear < 2000 || v.registrationYear > new Date().getFullYear() + 1)) {
    f.registrationYear = 'Enter a valid year';
  }
  if (v.ecoScore != null && (!Number.isFinite(v.ecoScore) || v.ecoScore < 0 || v.ecoScore > 100)) f.ecoScore = 'Eco score must be between 0 and 100';
  if (Object.keys(f).length) throw invalid(f);
}

// securityDeposit always defaults to 0: SSB CAR RENTALS charges no security deposit, on any vehicle.
// It is no longer admin-editable (see carsController.EDITABLE) and pricingService.computePrice() ignores
// whatever value is here regardless, so this column is inert — kept only for schema/history stability.
const DEFAULTS = { variant: '', bodyType: 'Hatchback', transmission: 'Manual', securityDeposit: 0, mileage: '', description: '', availability: true, status: 'Active', images: [], features: [] };

async function create(data, db) {
  const d = coerce({ ...DEFAULTS, ...data });
  Object.assign(d, derived(d));
  validate(d);
  return M.insert(d, db);
}

async function update(id, patch, db) {
  const current = await M.findById(id, db);
  if (!current) return null;
  const p = coerce(patch);
  const merged = { ...current, ...p };
  const extra = derived(merged);
  validate({ ...merged, ...extra });
  return M.update(id, { ...p, ...extra }, db);
}

const findBySlug = (slug, db) => M.findOne({ slug }, {}, db);
/** The car pages use either the UUID or the slug in the URL. */
const findByIdOrSlug = (idOrSlug, db) => (isUuid(idOrSlug) ? M.findById(idOrSlug, db) : findBySlug(String(idOrSlug), db));

const SORTS = {
  'price-asc': 'price_per_day ASC',
  'price-desc': 'price_per_day DESC',
  popular: 'booking_count DESC, rating DESC',
  rating: 'rating DESC, review_count DESC',
};

/**
 * Public catalogue query. Filters (all optional, comma-separated lists): fuel, seats, transmission, type,
 * location, search, price ("0-2499,2500-3500,5001-"); `sort`: price-asc | price-desc | popular | rating.
 * Retired vehicles are always excluded.
 */
async function search(q = {}, db) {
  const params = [];
  const add = (v) => { params.push(v); return `$${params.length}`; };
  const list = (v) => (typeof v === 'string' && v ? v.split(',').map((s) => s.trim()).filter(Boolean) : null);
  const clauses = ["status <> 'Retired'"];

  const fuel = list(q.fuel); if (fuel) clauses.push(`fuel = ANY(${add(fuel)}::text[])`);
  const seats = list(q.seats); if (seats) clauses.push(`seats = ANY(${add(seats.map(Number).filter(Number.isFinite))}::int[])`);
  const trans = list(q.transmission); if (trans) clauses.push(`transmission = ANY(${add(trans)}::text[])`);
  const type = list(q.type); if (type) clauses.push(`body_type = ANY(${add(type)}::text[])`);
  const loc = list(q.location); if (loc) clauses.push(`location = ANY(${add(loc)}::text[])`);
  if (typeof q.search === 'string' && q.search) {
    const p = add(`%${escapeLike(q.search)}%`);
    clauses.push(`(name ILIKE ${p} OR brand ILIKE ${p} OR model ILIKE ${p})`);
  }
  const prices = list(q.price);
  if (prices) {
    // e.g. 0-2499,2500-3500,5001-   (empty max = no upper limit)
    const ors = prices.map((r) => {
      const [min, max] = r.split('-');
      let c = `price_per_day >= ${add(Number(min) || 0)}`;
      if (max && Number.isFinite(Number(max))) c += ` AND price_per_day <= ${add(Number(max))}`;
      return `(${c})`;
    });
    clauses.push(`(${ors.join(' OR ')})`);
  }
  const order = SORTS[q.sort] || SORTS['price-asc'];
  const { rows } = await (db || require('../db/pool').pool).query(
    `SELECT * FROM vehicles WHERE ${clauses.join(' AND ')} ORDER BY ${order}, created_at ASC`, params,
  );
  return rows.map((r) => M.toDoc(r));
}

const q1 = (db) => db || require('../db/pool').pool;

/** +1 when a booking is confirmed, -1 when a confirmed booking is cancelled (never below zero). */
async function adjustBookingCount(id, delta, db) {
  await q1(db).query('UPDATE vehicles SET booking_count = GREATEST(booking_count + $2, 0), updated_at = now() WHERE id = $1', [id, delta]);
}

const setRating = (id, rating, reviewCount, db) => M.update(id, { rating, reviewCount }, db);

async function addImages(id, urls, db) {
  const { rows } = await q1(db).query('UPDATE vehicles SET images = images || $2::text[], updated_at = now() WHERE id = $1 RETURNING *', [id, urls]);
  return M.toDoc(rows[0]);
}

async function removeImage(id, url, db) {
  const { rows } = await q1(db).query('UPDATE vehicles SET images = array_remove(images, $2), updated_at = now() WHERE id = $1 RETURNING *', [id, url]);
  return M.toDoc(rows[0]);
}

module.exports = { ...M, create, update, findBySlug, findByIdOrSlug, search, adjustBookingCount, setRating, addImages, removeImage, coerce, derived };
