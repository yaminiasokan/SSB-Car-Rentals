/**
 * Seeds PostgreSQL with the SSB CAR RENTALS inventory, demo accounts and sample activity.
 *   npm run seed            (wipes ALL tables first)
 *
 * Inventory is the exact Coimbatore (7 cars) + Tirupattur (8 cars) fleet specified by SSB, including
 * both Ertiga variants kept as two separate listings. Tata Altroz and Renault Duster were removed from
 * the fleet and are never created. Car photos are real Wikimedia Commons images of the matching model
 * (hot-linked via Special:FilePath, so no binary assets ship in this repo) — swap `images` if you'd
 * rather host your own. Mileage/registration years are placeholders — edit in /admin/vehicles.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const env = require('../config/env');
const { COMPANY } = require('../config/constants');
const { pool } = require('../db/pool');
const { applySchema } = require('../db/migrate');

const User = require('../models/User');
const Vehicle = require('../models/Vehicle');
const Booking = require('../models/Booking');
const Payment = require('../models/Payment');
const Inspection = require('../models/Inspection');
const DamageReport = require('../models/DamageReport');
const Review = require('../models/Review');
const Wishlist = require('../models/Wishlist');
const Reward = require('../models/Reward');
const Notification = require('../models/Notification');
const SupportTicket = require('../models/SupportTicket');
const RentalAgreement = require('../models/RentalAgreement');

const { computePrice } = require('../services/pricingService');
const { ensureAgreement } = require('../services/agreementService');
const { refreshVehicleRating } = require('../controllers/reviewsController');
const { newBookingId, newReceiptNo, newTicketNo, newDamageId } = require('./sequence');
const { writeSlotImage } = require('./placeholderImages');
const { pointsFor } = require('../services/rewardsService');
const { INSPECTION_SLOTS } = require('../config/constants');
const checklist = require('../config/checklist');

const pw = {
  admin: process.env.SEED_ADMIN_PASSWORD || 'Admin@123',
  staff: process.env.SEED_STAFF_PASSWORD || 'Staff@123',
  customer: process.env.SEED_CUSTOMER_PASSWORD || 'Customer@123',
};

// deterministic pseudo-random so every seed run produces the same demo history
let s = 20260926;
const rand = () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
const rint = (a, b) => a + Math.floor(rand() * (b - a + 1));
const choice = (arr) => arr[Math.floor(rand() * arr.length)];

const DAY = 864e5;
const at = (daysFromNow, hour = 10) => { const d = new Date(); d.setDate(d.getDate() + daysFromNow); d.setHours(hour, 0, 0, 0); return d; };

// Real photos of the matching model, hot-linked from Wikimedia Commons via the stable Special:FilePath redirect.
const wiki = (file) => `https://commons.wikimedia.org/wiki/Special:FilePath/${file}`;
const IMG = {
  innova: wiki('Toyota_Innova_2.5_E_2011.jpg'),
  swift: wiki('Maruti_Suzuki_Swift_LXi.jpg'),
  kiaCarens: wiki('2022_Kia_Carens_1.4_Luxury_Plus_(India)_front_view_02.jpg'),
  baleno: wiki('2022_Maruti_Suzuki_Baleno_Alpha_(India)_front_view_02.jpg'),
  // 2025 Maruti Suzuki Ertiga (facelift) — used for every Ertiga listing, in both cities.
  ertiga: 'https://www.rushlane.com/wp-content/uploads/2025/08/2025-Maruti-Ertiga-8-1200x675.jpeg',
  innovaCrysta: wiki('Toyota_Innova_Crysta.jpg'),
  xl6: wiki('Maruti_Suzuki_XL6_(front).jpg'),
  swiftDzire: wiki('Maruti_Suzuki_Swift_Dzire.jpg'),
  glanza: wiki('Toyota_Glanza_2022_Facelift.jpg'),
  tiago: wiki('2022_Tata_Tiago_XZA%2B_front_20230512.jpg'),
  xcent: wiki('Hyundai_xcent_2014.jpg'),
  triber: wiki('Renault_Triber_(front_view).png'),
};

// Coimbatore — 7 cars, and Tirupattur — 8 cars, exactly as specified. Names are kept as given.
const VEHICLES = [
  // ---- Coimbatore ----
  { name: 'Innova Diesel', brand: 'Toyota', model: 'Innova', variant: '2.5 GX', bodyType: 'MPV', fuel: 'Diesel', seats: 7, pricePerDay: 3000, securityDeposit: 0, registrationYear: 2021, mileage: '≈ 13 km/l', location: 'Coimbatore', images: [IMG.innova],
    features: ['7 seats', 'Air conditioning', 'Power steering', 'Dual airbags', 'ABS with EBD', 'Music system', 'Large luggage space'], description: 'The dependable, spacious Innova — ideal for family trips and long highway drives.' },
  { name: 'Swift Diesel', brand: 'Maruti Suzuki', model: 'Swift', variant: 'VDi', bodyType: 'Hatchback', fuel: 'Diesel', seats: 5, pricePerDay: 2500, securityDeposit: 0, registrationYear: 2022, mileage: '≈ 25 km/l', location: 'Coimbatore', images: [IMG.swift],
    features: ['Air conditioning', 'Power steering', 'Dual airbags', 'ABS with EBD', 'Bluetooth music system', 'USB charging'], description: 'A fun, fuel-efficient hatchback that is easy to park and drive around the city.' },
  { name: 'Kia Petrol (7 Seater)', brand: 'Kia', model: 'Carens', variant: 'Premium Plus (7-Seater)', bodyType: 'MPV', fuel: 'Petrol', seats: 7, pricePerDay: 3000, securityDeposit: 0, registrationYear: 2023, mileage: '≈ 16 km/l', location: 'Coimbatore', images: [IMG.kiaCarens],
    features: ['7 seats', 'Touchscreen infotainment', 'Rear AC vents', 'Dual airbags', 'ABS with EBD', 'Cruise control', 'Reverse camera'], description: 'A modern 7-seater with a premium cabin — comfortable for groups and family outings.' },
  { name: 'Baleno Petrol', brand: 'Maruti Suzuki', model: 'Baleno', variant: 'Zeta', bodyType: 'Hatchback', fuel: 'Petrol', seats: 5, pricePerDay: 2500, securityDeposit: 0, registrationYear: 2023, mileage: '≈ 22 km/l', location: 'Coimbatore', images: [IMG.baleno],
    features: ['Air conditioning', 'Touchscreen infotainment', 'Dual airbags', 'ABS with EBD', 'Rear parking sensors', 'Keyless entry'], description: 'A roomy, premium hatchback with a smooth ride for city and highway alike.' },
  { name: 'Ertiga Petrol', brand: 'Maruti Suzuki', model: 'Ertiga', variant: 'VXi (Petrol)', bodyType: 'MPV', fuel: 'Petrol', seats: 7, pricePerDay: 3000, securityDeposit: 0, registrationYear: 2022, mileage: '≈ 20 km/l', location: 'Coimbatore', images: [IMG.ertiga], slug: 'ertiga-petrol-coimbatore',
    features: ['7 seats', 'Rear AC vents', 'Touchscreen infotainment', 'Dual airbags', 'ABS with EBD', 'Third-row seating'], description: 'Seven seats for family trips and group outings — comfortable over long distances.' },
  { name: 'Innova Crysta Diesel', brand: 'Toyota', model: 'Innova Crysta', variant: 'GX', bodyType: 'MPV', fuel: 'Diesel', seats: 7, pricePerDay: 4500, securityDeposit: 0, registrationYear: 2022, mileage: '≈ 15 km/l', location: 'Coimbatore', images: [IMG.innovaCrysta],
    features: ['7 seats with captain seats', 'Rear AC vents', 'Touchscreen infotainment', '3 airbags', 'ABS with EBD', 'Cruise-friendly diesel engine', 'Large luggage space'], description: 'The benchmark for premium family and business travel — powerful, quiet and built for long highways.' },
  { name: 'Maruti Suzuki XL6 Petrol', brand: 'Maruti Suzuki', model: 'XL6', variant: 'Zeta', bodyType: 'MPV', fuel: 'Petrol', seats: 6, pricePerDay: 3000, securityDeposit: 0, registrationYear: 2023, mileage: '≈ 19 km/l', location: 'Coimbatore', images: [IMG.xl6],
    features: ['6 seats with captain seats', 'Touchscreen infotainment', 'Rear AC vents', 'Dual airbags', 'ABS with EBD', 'Cruise control'], description: 'A premium 6-seat crossover-MPV with captain seats — a comfortable step up for smaller groups.' },

  // ---- Tirupattur ----
  { name: 'Swift Dzire', brand: 'Maruti Suzuki', model: 'Swift Dzire', variant: 'VXi', bodyType: 'Sedan', fuel: 'Petrol', seats: 5, pricePerDay: 2000, securityDeposit: 0, registrationYear: 2023, mileage: '≈ 22 km/l', location: 'Tirupattur', images: [IMG.swiftDzire],
    features: ['Air conditioning', 'Bluetooth music system', 'Dual airbags', 'ABS with EBD', 'Power windows', 'Large boot space'], description: 'A comfortable, efficient sedan for city drives and airport runs, with a generous boot.' },
  { name: 'Baleno', brand: 'Maruti Suzuki', model: 'Baleno', variant: 'Delta', bodyType: 'Hatchback', fuel: 'Petrol', seats: 5, pricePerDay: 2000, securityDeposit: 0, registrationYear: 2022, mileage: '≈ 22 km/l', location: 'Tirupattur', images: [IMG.baleno],
    features: ['Air conditioning', 'Touchscreen infotainment', 'Dual airbags', 'ABS with EBD', 'USB charging', 'Keyless entry'], description: 'A roomy, easy-to-drive premium hatchback — our most affordable way to get moving.' },
  { name: 'Glanza', brand: 'Toyota', model: 'Glanza', variant: 'G', bodyType: 'Hatchback', fuel: 'Petrol', seats: 5, pricePerDay: 2000, securityDeposit: 0, registrationYear: 2023, mileage: '≈ 22 km/l', location: 'Tirupattur', images: [IMG.glanza],
    features: ['Air conditioning', 'Touchscreen infotainment', 'Dual airbags', 'ABS with EBD', 'Rear parking sensors', 'Bluetooth & USB'], description: 'Toyota reliability in a nimble hatchback — light on fuel and easy to park.' },
  { name: 'Tata Tiago', brand: 'Tata', model: 'Tiago', variant: 'XZ+', bodyType: 'Hatchback', fuel: 'Petrol', seats: 5, pricePerDay: 2000, securityDeposit: 0, registrationYear: 2022, mileage: '≈ 20 km/l', location: 'Tirupattur', images: [IMG.tiago],
    features: ['Air conditioning', 'Touchscreen infotainment', 'Dual airbags', 'ABS with EBD', '5-star Global NCAP safety'], description: 'A sturdy, safety-focused hatchback that is a favourite for short city hops.' },
  { name: 'Hyundai Xcent', brand: 'Hyundai', model: 'Xcent', variant: 'S', bodyType: 'Sedan', fuel: 'Petrol', seats: 5, pricePerDay: 2000, securityDeposit: 0, registrationYear: 2021, mileage: '≈ 20 km/l', location: 'Tirupattur', images: [IMG.xcent],
    features: ['Air conditioning', 'Power steering', 'Dual airbags', 'ABS with EBD', 'Music system', 'Large boot space'], description: 'A compact sedan with a big boot — comfortable, practical and economical.' },
  { name: 'Renault Triber', brand: 'Renault', model: 'Triber', variant: 'RXZ', bodyType: 'MPV', fuel: 'Petrol', seats: 7, pricePerDay: 2500, securityDeposit: 0, registrationYear: 2022, mileage: '≈ 18 km/l', location: 'Tirupattur', images: [IMG.triber],
    features: ['7 seats (modular)', 'Touchscreen infotainment', 'Dual airbags', 'ABS with EBD', 'Rear parking camera'], description: 'A clever 7-seat compact MPV — flexible seating in a car that still fits tight city streets.' },
  { name: 'Ertiga Petrol', brand: 'Maruti Suzuki', model: 'Ertiga', variant: 'VXi (Petrol)', bodyType: 'MPV', fuel: 'Petrol', seats: 7, pricePerDay: 2500, securityDeposit: 0, registrationYear: 2022, mileage: '≈ 20 km/l', location: 'Tirupattur', images: [IMG.ertiga], slug: 'ertiga-petrol-tirupattur',
    features: ['7 seats', 'Rear AC vents', 'Touchscreen infotainment', 'Dual airbags', 'ABS with EBD', 'Third-row seating'], description: 'Seven seats for family trips, temple runs and group outings — comfortable over long distances.' },
  { name: 'Ertiga Petrol + CNG', brand: 'Maruti Suzuki', model: 'Ertiga', variant: 'VXi (Petrol + CNG)', bodyType: 'MPV', fuel: 'Petrol + CNG', seats: 7, pricePerDay: 3000, securityDeposit: 0, registrationYear: 2022, mileage: '≈ 20 km/l petrol · 26 km/kg CNG', location: 'Tirupattur', images: [IMG.ertiga],
    features: ['7 seats', 'Rear AC vents', 'Factory-fitted CNG kit', 'Touchscreen infotainment', 'Dual airbags', 'ABS with EBD'], description: 'The same spacious Ertiga with a factory CNG kit — ideal for long family journeys on a budget.' },
];

const DEMO_NAMES = [
  ['Arun Kumar', 'arun.kumar@ssbcarrentals.demo', '9876501101', 'TN37 20190012345', '12, Race Course Road, Coimbatore 641018'],
  ['Priya Nair', 'priya.nair@ssbcarrentals.demo', '9876501102', 'TN37 20180098765', '45, Avinashi Road, Coimbatore 641014'],
  ['Meena Selvam', 'meena.selvam@ssbcarrentals.demo', '9876501103', 'TN83 20200045678', '8, Bazaar Street, Tirupattur 635601'],
  ['Vignesh S', 'vignesh.s@ssbcarrentals.demo', '9876501104', 'TN83 20170076543', '21, Salem Main Road, Tirupattur 635601'],
];
const COMMENTS = ['Car was clean and pickup was quick. Would rent again.', 'Smooth drive, AC worked great. Staff were very helpful.', 'Good value for the price. Returned without any hassle.', 'Excellent for our family trip. Very comfortable seats.', 'Pickup took a little longer than expected but the car was in great condition.', 'Highly recommended. 24x7 support answered my call at night.'];

const busy = new Map(); // vehicleId -> [[from,to]]
const isFree = (vid, a, b) => !(busy.get(String(vid)) || []).some(([x, y]) => a < y && b > x);
const reserve = (vid, a, b) => busy.set(String(vid), [...(busy.get(String(vid)) || []), [a, b]]);

let vehicles; let admin; let staff; let demo; let customers;
const rewardTotals = new Map();

async function makeBooking({ user, vehicle, pickupAt, returnAt, services = [], deliveryKm, status, method = 'UPI', promo = null, cash = false, reviewed = false }) {
  const pricing = computePrice({ vehicle, pickupAt, returnAt, services, deliveryKm, promo });
  const created = new Date(Math.min(pickupAt.getTime() - 2 * DAY, Date.now() - 3600e3));
  const history = [{ status: 'Pending', by: 'customer', at: created.toISOString(), note: 'Booking created' }, ...(status !== 'Cancelled' ? [{ status: 'Confirmed', by: 'system', at: created.toISOString() }] : [])];
  if (status === 'Active') history.push({ status: 'Active', by: 'admin', at: pickupAt.toISOString() });
  if (status === 'Completed') history.push({ status: 'Active', by: 'admin', at: pickupAt.toISOString() }, { status: 'Completed', by: 'admin', at: returnAt.toISOString() });
  if (status === 'Cancelled') history.push({ status: 'Cancelled', by: 'customer', at: new Date(created.getTime() + 3600e3).toISOString(), note: 'Change of plans' });

  let booking = await Booking.insert({
    bookingId: await newBookingId(created), user: user._id, vehicle: vehicle._id,
    pickupLocation: vehicle.location, returnLocation: vehicle.location, pickupAt, returnAt, services,
    pricing: { lines: pricing.lines, serviceLines: pricing.serviceLines, baseAmount: pricing.baseAmount, servicesAmount: pricing.servicesAmount, discount: pricing.discount, promoCode: pricing.promoCode, promoLabel: pricing.promoLabel, taxRate: pricing.taxRate, taxAmount: pricing.taxAmount, deposit: pricing.deposit, rentalTotal: pricing.rentalTotal, total: pricing.total, billingDays: pricing.billingDays, maxKm: pricing.maxKm },
    customer: { name: user.name, phone: user.phone, email: user.email, licenseNumber: user.license.number, address: user.address },
    status, paymentStatus: cash ? 'Pay on Pickup' : 'Paid', reviewed,
    statusHistory: history,
    createdAt: created, updatedAt: created,
  });
  if (status !== 'Cancelled') { reserve(vehicle._id, pickupAt, returnAt); await Vehicle.adjustBookingCount(vehicle._id, 1); }

  const m = cash ? 'Cash on Pickup' : method;
  const payment = await Payment.insert({
    receiptNo: await newReceiptNo(created), booking: booking._id, user: user._id, kind: 'booking', amount: pricing.total, depositAmount: pricing.deposit,
    method: m, status: cash ? 'Pending' : status === 'Cancelled' ? 'Refunded' : 'Success', transactionId: `SIM${created.getTime().toString(36).toUpperCase()}`,
    revenueAmount: cash || status === 'Cancelled' ? 0 : pricing.rentalTotal, refundAmount: status === 'Cancelled' ? pricing.total : 0,
    details: m === 'UPI' ? { upiId: 'ku***@okbank' } : m.includes('Card') ? { last4: '4242', brand: 'Visa' } : {},
    screenshotUrl: cash || status === 'Cancelled' ? null : writeSlotImage(`receipt-${booking.bookingId}`, { slot: 'front', tag: 'PAID' }),
    verificationStatus: cash ? 'Not Required' : status === 'Cancelled' ? 'Not Required' : 'Verified',
    verifiedBy: cash || status === 'Cancelled' ? null : staff._id, verifiedAt: cash || status === 'Cancelled' ? null : created,
    paidAt: cash ? undefined : created, createdAt: created, updatedAt: created,
  });
  if (status === 'Cancelled') {
    booking = await Booking.update(booking._id, {
      paymentStatus: 'Refunded',
      cancellation: { reason: 'Change of plans', cancelledAt: history.at(-1).at, cancelledBy: 'customer', refundPercent: 100, refundAmount: pricing.total },
    });
  }
  if (status !== 'Cancelled') {
    const agr = await ensureAgreement(booking);
    if (!agr.acknowledgedAt && (status !== 'Confirmed' || !cash)) await RentalAgreement.update(agr._id, { acknowledgedAt: created, acknowledgedBy: user.name });
  }
  if (!cash && status !== 'Cancelled') {
    const pts = pointsFor(pricing.rentalTotal);
    await Reward.insert({ user: user._id, type: 'earn', points: pts, booking: booking._id, description: `Booking ${booking.bookingId}`, createdAt: created, updatedAt: created });
    rewardTotals.set(String(user._id), (rewardTotals.get(String(user._id)) || 0) + pts);
  }
  return { booking, payment };
}

async function inspectionSet(booking, afterDamage) {
  const beforeImages = INSPECTION_SLOTS.map((slot) => ({ slot, url: writeSlotImage(`before-${slot}`, { slot, tag: 'BEFORE' }), note: slot === 'rear' ? 'Existing minor scuff on rear bumper.' : '' }));
  const items = [...checklist.EXTERIOR.map((item) => ({ group: 'Exterior', item })), ...checklist.INTERIOR.map((item) => ({ group: 'Interior', item }))].map((i) => ({ ...i, status: i.item === 'Rear bumper' ? 'Minor issue' : 'OK', note: i.item === 'Rear bumper' ? 'Existing minor scuff' : '' }));
  const before = await Inspection.insert({ booking: booking._id, vehicle: booking.vehicle, type: 'before', performedBy: staff._id, performerRole: 'staff', images: beforeImages, checklist: items, notes: 'Vehicle handed over clean, full tank.' });
  const afterImages = INSPECTION_SLOTS.map((slot) => {
    const d = afterDamage.find((x) => x.slot === slot);
    return { slot, url: d ? writeSlotImage(`after-${booking.bookingId}-${slot}`, { slot, tag: 'AFTER', damage: d }) : beforeImages.find((b) => b.slot === slot).url, note: '' };
  });
  const after = await Inspection.insert({ booking: booking._id, vehicle: booking.vehicle, type: 'after', performedBy: staff._id, performerRole: 'staff', images: afterImages, checklist: items.map((i) => ({ ...i })), notes: 'Vehicle returned on time.' });
  await Booking.update(booking._id, { inspection: { before: true, after: true } });
  return { before, after };
}

async function damageReport({ booking, user, vehicle, damages, status, finalAmount = 0, comments = '', dispute, resolution, payment }) {
  const { before, after } = await inspectionSet(booking, damages);
  return DamageReport.insert({
    reportId: await newDamageId(), booking: booking._id, vehicle: vehicle._id, customer: user._id, beforeInspection: before._id, afterInspection: after._id,
    damageDetected: true, damages,
    engine: { name: 'SSB Demo Analyzer', version: '0.1.0-mock', mock: true, note: 'Seeded sample data — not produced by a trained model.' },
    status, finalAmount,
    ...(status === 'Pending Review' ? {} : { adminReview: { reviewedBy: admin._id, reviewedAt: new Date(), comments } }),
    ...(['Confirmed', 'Customer Disputed', 'Resolved'].includes(status) ? { customerNotifiedAt: new Date() } : {}),
    ...(dispute ? { dispute } : {}), ...(resolution ? { resolution } : {}), ...(payment ? { payment } : {}),
  });
}

async function run() {
  if (env.isProd && !process.argv.includes('--force')) { console.error('Refusing to wipe a production database. Re-run with --force if you really mean it.'); process.exit(1); }
  await applySchema(pool);
  console.log('Schema ready. Clearing existing data…');
  await pool.query(`TRUNCATE users, vehicles, bookings, payments, inspections, damage_reports, reviews, wishlist_items,
    rewards, notifications, support_tickets, rental_agreements, counters RESTART IDENTITY CASCADE`);

  // ---- users ----
  admin = await User.create({ name: COMPANY.ceo, email: 'admin@ssbcarrentals.demo', phone: COMPANY.phone, password: pw.admin, role: 'admin', address: 'SSB Car Rentals, Coimbatore' });
  staff = await User.create({ name: 'Ravi (Pickup Desk)', email: 'staff@ssbcarrentals.demo', phone: '9876500000', password: pw.staff, role: 'staff', address: 'SSB Car Rentals, Coimbatore' });
  demo = await User.create({ name: 'Karthik Raja', email: 'customer@ssbcarrentals.demo', phone: '9876543210', password: pw.customer, address: '18, Gandhipuram, Coimbatore 641012', license: { number: 'TN37 20190054321', expiry: new Date('2036-03-31'), verified: true } });
  customers = [];
  for (const [name, email, phone, lic, address] of DEMO_NAMES) customers.push(await User.create({ name, email, phone, password: pw.customer, address, license: { number: lic, expiry: new Date('2037-01-01'), verified: true } }));

  // ---- vehicles: exact Coimbatore (7) + Tirupattur (8) fleet; Altroz / Duster are intentionally absent ----
  vehicles = [];
  for (const v of VEHICLES) vehicles.push(await Vehicle.create({ ...v, rating: 0 }));
  const byCity = (city, name) => vehicles.find((v) => v.location === city && v.name === name);
  const innova = byCity('Coimbatore', 'Innova Diesel');
  const swiftD = byCity('Coimbatore', 'Swift Diesel');
  const kia = byCity('Coimbatore', 'Kia Petrol (7 Seater)');
  const balenoC = byCity('Coimbatore', 'Baleno Petrol');
  const ertigaCbe = byCity('Coimbatore', 'Ertiga Petrol');
  const innovaCrysta = byCity('Coimbatore', 'Innova Crysta Diesel');
  const xl6 = byCity('Coimbatore', 'Maruti Suzuki XL6 Petrol');
  const dzire = byCity('Tirupattur', 'Swift Dzire');
  const balenoT = byCity('Tirupattur', 'Baleno');
  const glanza = byCity('Tirupattur', 'Glanza');
  const tiago = byCity('Tirupattur', 'Tata Tiago');
  const xcent = byCity('Tirupattur', 'Hyundai Xcent');
  const triber = byCity('Tirupattur', 'Renault Triber');
  const ertigaTpt = byCity('Tirupattur', 'Ertiga Petrol');
  const ertigaCNG = byCity('Tirupattur', 'Ertiga Petrol + CNG');

  const dmg = (o) => ({ decision: 'pending', note: '', ...o });

  // ---- bookings for the demo customer ----
  const b1 = (await makeBooking({ user: demo, vehicle: innovaCrysta, pickupAt: at(-14, 9), returnAt: at(-11, 9), services: ['insurance', 'childSeat'], status: 'Completed', promo: { code: 'SSB10', label: '10% off', kind: 'percent', value: 10, cap: 1000 } })).booking;
  await damageReport({ booking: b1, user: demo, vehicle: innovaCrysta, status: 'Pending Review', damages: [dmg({ type: 'Scratch', location: 'Front bumper', slot: 'front', severity: 'Moderate', confidence: 0.91, estimatedRepairCost: { min: 2000, max: 4000 }, region: { x: 15, y: 68, w: 70, h: 16 } })] });
  const b2 = (await makeBooking({ user: demo, vehicle: glanza, pickupAt: at(-38, 10), returnAt: at(-36, 10), status: 'Completed', method: 'Debit Card' })).booking;
  await damageReport({
    booking: b2, user: demo, vehicle: glanza, status: 'Confirmed', finalAmount: 3000, comments: 'Confirmed from the after-rental photos. Scuff on the left door was already noted at pickup, so it is excluded.',
    damages: [dmg({ type: 'Dent', location: 'Rear bumper', slot: 'rear', severity: 'Moderate', confidence: 0.87, estimatedRepairCost: { min: 2500, max: 4000 }, region: { x: 30, y: 68, w: 40, h: 16 }, decision: 'confirmed', note: 'Estimate lowered after workshop quote.' }),
      dmg({ type: 'Scratch', location: 'Left doors', slot: 'left', severity: 'Minor', confidence: 0.74, estimatedRepairCost: { min: 500, max: 1500 }, region: { x: 34, y: 42, w: 32, h: 16 }, decision: 'rejected', note: 'Pre-existing — visible in before photo.' })],
  });
  const b3 = (await makeBooking({ user: demo, vehicle: balenoT, pickupAt: at(-75, 9), returnAt: at(-74, 9), status: 'Completed', reviewed: true })).booking;
  await Review.insert({ booking: b3._id, vehicle: balenoT._id, user: demo._id, ratings: { overall: 5, vehicleCondition: 5, cleanliness: 4, pickupExperience: 5 }, comment: 'Spotless car and a very quick handover in Tirupattur. Great value.' });
  await makeBooking({ user: demo, vehicle: dzire, pickupAt: at(-100, 9), returnAt: at(-98, 9), status: 'Cancelled' });
  let active = (await makeBooking({ user: demo, vehicle: ertigaCbe, pickupAt: at(-1, 10), returnAt: at(1, 18), services: ['childSeat', 'doorstepDelivery'], deliveryKm: 14, status: 'Active' })).booking;
  await Inspection.insert({ booking: active._id, vehicle: ertigaCbe._id, type: 'before', performedBy: staff._id, performerRole: 'staff', images: INSPECTION_SLOTS.map((slot) => ({ slot, url: writeSlotImage(`before-${slot}`, { slot, tag: 'BEFORE' }) })), notes: 'Handed over clean.' });
  active = await Booking.update(active._id, { inspection: { before: true } });
  await makeBooking({ user: demo, vehicle: swiftD, pickupAt: at(6, 9), returnAt: at(8, 9), services: ['additionalDriver'], status: 'Confirmed', cash: true });

  // ---- reports on other customers' rentals (so every status shows in the admin table) ----
  const [arun, priya, meena] = customers;
  const b4 = (await makeBooking({ user: priya, vehicle: ertigaTpt, pickupAt: at(-30, 9), returnAt: at(-28, 9), status: 'Completed', method: 'Credit Card' })).booking;
  await damageReport({
    booking: b4, user: priya, vehicle: ertigaTpt, status: 'Customer Disputed', finalAmount: 12000, comments: 'Headlight assembly is cracked; replacement quote ₹12,000.',
    dispute: { message: 'The headlight was already cracked when I collected the car — please check the before photos.', at: new Date() },
    damages: [dmg({ type: 'Broken headlight', location: 'Left headlight', slot: 'front', severity: 'Severe', confidence: 0.83, estimatedRepairCost: { min: 12000, max: 25000 }, region: { x: 21, y: 50, w: 14, h: 10 }, decision: 'confirmed' })],
  });
  const b5 = (await makeBooking({ user: arun, vehicle: kia, pickupAt: at(-52, 9), returnAt: at(-50, 9), status: 'Completed' })).booking;
  const paidDamage = await Payment.insert({ receiptNo: await newReceiptNo(), booking: b5._id, user: arun._id, kind: 'damage', amount: 2500, revenueAmount: 2500, method: 'UPI', status: 'Success', transactionId: 'SIMDAMAGE01', paidAt: at(-45), details: { upiId: 'ar***@okbank' }, verificationStatus: 'Verified', verifiedBy: staff._id, verifiedAt: at(-45) });
  await damageReport({
    booking: b5, user: arun, vehicle: kia, status: 'Resolved', finalAmount: 2500, comments: 'Paint scratch on the hood confirmed.', payment: paidDamage._id, resolution: { at: at(-45), outcome: 'paid', note: 'Paid via UPI' },
    damages: [dmg({ type: 'Paint damage', location: 'Hood', slot: 'front', severity: 'Minor', confidence: 0.69, estimatedRepairCost: { min: 1500, max: 3500 }, region: { x: 25, y: 34, w: 50, h: 14 }, decision: 'confirmed' })],
  });
  const b6 = (await makeBooking({ user: meena, vehicle: xcent, pickupAt: at(-21, 9), returnAt: at(-20, 9), status: 'Completed' })).booking;
  await damageReport({
    booking: b6, user: meena, vehicle: xcent, status: 'Rejected', comments: 'The dent is visible in the before photo — not new damage.',
    damages: [dmg({ type: 'Dent', location: 'Right doors', slot: 'right', severity: 'Minor', confidence: 0.66, estimatedRepairCost: { min: 1500, max: 3000 }, region: { x: 44, y: 45, w: 16, h: 12 }, decision: 'rejected' })],
  });
  // A booking whose payment is still awaiting screenshot verification — shows the "Pending Review" state in /admin/payments.
  const b7 = (await makeBooking({ user: customers[3], vehicle: triber, pickupAt: at(-9, 9), returnAt: at(-7, 9), status: 'Completed', method: 'UPI' })).booking;
  const p7 = await Payment.findOne({ booking: b7._id, kind: 'booking' });
  if (p7) await Payment.update(p7._id, { verificationStatus: 'Pending Review', screenshotUrl: writeSlotImage(`receipt-${b7.bookingId}`, { slot: 'front', tag: 'PENDING' }) });

  // ---- 5 months of history for analytics ----
  const pool2 = [...customers, demo];
  let made = 0; let tries = 0;
  const weighted = [...vehicles, dzire, balenoC, balenoT, glanza, ertigaCbe, ertigaTpt, innovaCrysta, kia, xl6, tiago, xcent, triber];
  while (made < 40 && tries < 500) {
    tries += 1;
    const vehicle = choice(weighted);
    const days = rint(1, 4);
    const start = at(-rint(8, 150), rint(8, 18));
    const end = new Date(start.getTime() + days * DAY);
    if (end > new Date() || !isFree(vehicle._id, start, end)) continue;
    const user = choice(pool2);
    const wantsDelivery = rand() > 0.75;
    const services = wantsDelivery ? ['doorstepDelivery'] : rand() > 0.55 ? [choice(['childSeat', 'insurance', 'additionalDriver'])] : [];
    const { booking } = await makeBooking({ user, vehicle, pickupAt: start, returnAt: end, services, deliveryKm: wantsDelivery ? rint(4, 25) : undefined, status: 'Completed', method: choice(['UPI', 'UPI', 'Credit Card', 'Debit Card', 'Net Banking']) });
    if (rand() > 0.4) {
      const r = () => rint(3, 5);
      await Review.insert({ booking: booking._id, vehicle: vehicle._id, user: user._id, ratings: { overall: r(), vehicleCondition: r(), cleanliness: r(), pickupExperience: r() }, comment: choice(COMMENTS) });
      await Booking.update(booking._id, { reviewed: true });
    }
    made += 1;
  }

  // ---- ratings, rewards, wishlist, notifications, support ----
  for (const v of vehicles) await refreshVehicleRating(v._id);
  const redeemed = await Reward.insert({ user: demo._id, type: 'redeem', points: -150, rewardKey: 'free_delivery', couponCode: 'SSBR-DEMO01', description: 'Free delivery & pickup' });
  rewardTotals.set(String(demo._id), (rewardTotals.get(String(demo._id)) || 0) + redeemed.points);
  for (const [uid, pts] of rewardTotals) await pool.query('UPDATE users SET reward_points = $2 WHERE id = $1', [uid, Math.max(0, pts)]);

  await Wishlist.add(demo._id, innovaCrysta._id);
  await Wishlist.add(demo._id, ertigaCNG._id);

  const disputedReport = await DamageReport.findOne({ booking: b2._id });
  const n = (type, title, message, link, read, hoursAgo) => ({ user: demo._id, type, title, message, link, read, createdAt: new Date(Date.now() - hoursAgo * 3600e3) });
  const notifications = [
    n('return_reminder', 'Return reminder', `Return your ${ertigaCbe.name} to Coimbatore by ${at(1, 18).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}.`, '/track-rental', false, 1),
    n('damage_report', 'Damage report generated', 'A damage report was verified for your Glanza rental. Review the photos and pay or dispute it.', `/damage-reports/${disputedReport._id}`, false, 20),
    n('inspection_completed', 'Vehicle inspection completed', `The after-rental inspection for ${b1.bookingId} has been recorded.`, `/auto-inspect/${b1._id}`, false, 240),
    n('pickup_reminder', 'Pickup reminder', 'Your Swift Diesel pickup is coming up in Coimbatore. Carry your driving licence.', '/dashboard', true, 300),
    n('payment_success', 'Payment successful', `We received your payment for booking ${active.bookingId}.`, '/dashboard', true, 26),
    n('booking_confirmed', 'Booking confirmed', `Your booking ${active.bookingId} is confirmed.`, '/dashboard', true, 27),
    n('admin_message', 'Message from SSB Car Rentals', 'Thanks for renting with us! Use SSB10 for 10% off your next booking.', '/cars', true, 500),
  ];
  for (const item of notifications) {
    await Notification.insert({ user: item.user, type: item.type, title: item.title, message: item.message, link: item.link, read: item.read, createdAt: item.createdAt, updatedAt: item.createdAt });
  }

  await SupportTicket.insert({ ticketNo: await newTicketNo(), user: demo._id, subject: 'Need a GST invoice for my Innova Crysta rental', category: 'Payment', priority: 'High', message: 'Could you please email a GST invoice for the Innova Crysta booking last week?', status: 'In Progress', replies: [{ by: admin._id, role: 'admin', name: admin.name, message: 'Sure — we will share the invoice on your registered email today.' }] });
  await SupportTicket.insert({ ticketNo: await newTicketNo(), user: arun._id, subject: 'Flat tyre near Avinashi', category: 'Emergency', priority: 'Urgent', emergencyType: 'Roadside assistance', message: 'Roadside assistance requested.', status: 'Resolved', booking: b5._id });

  // ---- summary ----
  const counts = { users: await User.count({}), vehicles: await Vehicle.count({}), bookings: await Booking.count({}), payments: await Payment.count({}), damageReports: await DamageReport.count({}), reviews: await Review.count({}), agreements: await RentalAgreement.count({}) };
  console.log('\nSeeded:', counts);
  console.log('\nCoimbatore fleet:'); vehicles.filter((v) => v.location === 'Coimbatore').forEach((v) => console.log(`  • ${v.name} — ${v.fuelDisplay} — ₹${v.pricePerDay}/day`));
  console.log('\nTirupattur fleet:'); vehicles.filter((v) => v.location === 'Tirupattur').forEach((v) => console.log(`  • ${v.name} — ${v.fuelDisplay} — ₹${v.pricePerDay}/day`));
  console.log('\nDemo logins:');
  console.log(`  Admin     admin@ssbcarrentals.demo     / ${pw.admin}`);
  console.log(`  Staff     staff@ssbcarrentals.demo     / ${pw.staff}`);
  console.log(`  Customer  customer@ssbcarrentals.demo  / ${pw.customer}`);
  console.log('\nDemo promo codes: SSB10, WELCOME500, LONGTRIP · reward coupon for demo customer: SSBR-DEMO01 (free delivery & pickup)\n');
  await pool.end();
}

run().catch((e) => { console.error(e); process.exit(1); });
