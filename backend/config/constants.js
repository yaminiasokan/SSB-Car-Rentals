/**
 * Business constants for SSB CAR RENTALS.
 * Prices for services, tax rate, promo codes and reward values are DEMO DEFAULTS —
 * edit them here to match the real business policy.
 */
const COMPANY = {
  name: 'SSB CAR RENTALS',
  tagline: 'YOUR JOURNEY, OUR WHEELS.',
  ceo: 'Balaji Shanmugam',
  phone: '7305786562',
  email: 'balajikps11@gmail.com',
  upiId: '7305786562@ptaxis',
  locations: ['Coimbatore', 'Tirupattur'],
  availability: '24x7',
};

const LOCATIONS = ['Coimbatore', 'Tirupattur'];
const FUEL_TYPES = ['Petrol', 'Diesel', 'CNG', 'Petrol + CNG'];
const BODY_TYPES = ['Hatchback', 'Sedan', 'MPV'];
const TRANSMISSIONS = ['Manual', 'Automatic'];
const VEHICLE_STATUS = ['Active', 'Maintenance', 'Retired'];

// Vehicles removed from the SSB inventory. They can never be created or seeded.
const REMOVED_MODELS = [/altroz/i, /duster/i];

const ECO_SCORES = { Petrol: 65, Diesel: 55, CNG: 80, 'Petrol + CNG': 75 };

const TAX_RATE = 0.12; // GST — demo default
const MIN_RENTAL_HOURS = 4;
const HOLD_MINUTES = 30; // how long an unpaid (pending) booking blocks a vehicle
const MAX_KM_PER_DAY = 300; // fair-usage limit; scales with the number of rental days

/**
 * `doorstepDelivery` is priced by distance, not a flat/per-day rate (see pricingService.computePrice):
 * ₹500 for 10 km or below, +₹50 for every additional km beyond that.
 * `additionalDriver` is a flat trip charge — the exact fare depends on the trip, so `displayPrice`
 * is shown to the customer instead of the numeric price wherever it is set.
 */
const SERVICES = {
  additionalDriver: {
    label: 'Driver', price: 800, unit: 'trip',
    displayPrice: 'Based on the trip (Minimum starting from ₹800)',
    description: 'A verified driver for your trip.',
  },
  childSeat: { label: 'Child Seat', price: 150, unit: 'day', description: 'Certified child safety seat.' },
  insurance: { label: 'Premium Insurance', price: 400, unit: 'day', description: 'Reduces your liability for accidental damage.' },
  doorstepDelivery: {
    label: 'Delivery & Pickup', kind: 'delivery', baseAmount: 500, includedKm: 10, perExtraKm: 50,
    description: 'Minimum ₹500 for 10 kms or below. If it is above 10kms add +₹50 per km.',
  },
};

const PROMOS = {
  SSB10: { code: 'SSB10', label: '10% off rental (up to ₹1,000)', kind: 'percent', value: 10, cap: 1000 },
  WELCOME500: { code: 'WELCOME500', label: '₹500 off (rental of ₹2,500 or more)', kind: 'flat', value: 500, minBase: 2500 },
  LONGTRIP: { code: 'LONGTRIP', label: '15% off rentals of 3+ days (up to ₹2,000)', kind: 'percent', value: 15, cap: 2000, minDays: 3 },
};

const POINTS_PER_100 = 5;
const REWARD_CATALOG = [
  { key: 'discount200', label: '₹200 rental discount', points: 400, kind: 'flat', value: 200 },
  { key: 'discount500', label: '₹500 rental discount', points: 900, kind: 'flat', value: 500 },
  { key: 'free_delivery', label: 'Free delivery & pickup', points: 150, kind: 'free_service', service: 'doorstepDelivery' },
  { key: 'free_driver', label: 'Free additional driver', points: 250, kind: 'free_service', service: 'additionalDriver' },
  { key: 'upgrade', label: 'Vehicle upgrade (subject to availability)', points: 600, kind: 'upgrade' },
];

// Refund tiers, measured in hours before pickup. Deposit is always refunded in full.
const CANCELLATION_TIERS = [
  { minHoursBeforePickup: 24, refundPercent: 100, label: 'More than 24 hours before pickup: 100% refund' },
  { minHoursBeforePickup: 6, refundPercent: 50, label: '6 to 24 hours before pickup: 50% refund' },
  { minHoursBeforePickup: 0, refundPercent: 0, label: 'Less than 6 hours before pickup: no refund of rental charges' },
];

const BOOKING_STATUSES = ['Pending', 'Confirmed', 'Active', 'Completed', 'Cancelled'];
const DAMAGE_STATUSES = ['Pending Review', 'Confirmed', 'Rejected', 'Customer Disputed', 'Resolved'];
const INSPECTION_SLOTS = ['front', 'rear', 'left', 'right', 'interior', 'dashboard', 'wheels'];

const AI_DISCLAIMER = 'AI-assisted detection — requires human verification.';

module.exports = {
  COMPANY, LOCATIONS, FUEL_TYPES, BODY_TYPES, TRANSMISSIONS, VEHICLE_STATUS, REMOVED_MODELS, ECO_SCORES,
  TAX_RATE, MIN_RENTAL_HOURS, HOLD_MINUTES, MAX_KM_PER_DAY, SERVICES, PROMOS, POINTS_PER_100, REWARD_CATALOG,
  CANCELLATION_TIERS, BOOKING_STATUSES, DAMAGE_STATUSES, INSPECTION_SLOTS, AI_DISCLAIMER,
};
