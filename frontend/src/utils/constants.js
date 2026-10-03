export const COMPANY = {
  name: 'SSB CAR RENTALS',
  tagline: 'YOUR JOURNEY, OUR WHEELS.',
  ceo: 'Balaji Shanmugam',
  phone: '7305786562',
  email: 'balajikps11@gmail.com',
  locations: ['Coimbatore', 'Tirupattur'],
};

export const COMPANY_UPI_ID = '7305786562@ptaxis';
export const MAX_KM_PER_DAY = 300;

export const LOCATIONS = ['Coimbatore', 'Tirupattur'];
export const VEHICLE_TYPES = ['Hatchback', 'Sedan', 'MPV'];
export const FUELS = ['Petrol', 'Diesel', 'CNG', 'Petrol + CNG'];
export const SEATS = [4, 5, 7];
export const TRANSMISSIONS = ['Manual', 'Automatic'];
export const PRICE_RANGES = [
  { key: '0-2499', label: 'Under ₹2,500' },
  { key: '2500-3500', label: '₹2,500 – ₹3,500' },
  { key: '3501-5000', label: '₹3,500 – ₹5,000' },
  { key: '5001-', label: '₹5,000+' },
];
export const SORTS = [
  { key: 'price-asc', label: 'Price: low to high' },
  { key: 'price-desc', label: 'Price: high to low' },
  { key: 'popular', label: 'Most popular' },
  { key: 'rating', label: 'Highest rated' },
];

export const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2); const m = i % 2 ? '30' : '00';
  const value = `${String(h).padStart(2, '0')}:${m}`;
  const hh = h % 12 === 0 ? 12 : h % 12;
  return { value, label: `${hh}:${m} ${h < 12 ? 'AM' : 'PM'}` };
});

export const SLOTS = [
  { key: 'front', label: 'Front' }, { key: 'rear', label: 'Rear' }, { key: 'left', label: 'Left side' }, { key: 'right', label: 'Right side' },
  { key: 'interior', label: 'Interior' }, { key: 'dashboard', label: 'Dashboard' }, { key: 'wheels', label: 'Wheels' },
];
export const slotLabel = (k) => SLOTS.find((s) => s.key === k)?.label || (k === 'extra' ? 'Additional' : k);

export const AI_DISCLAIMER = 'AI-assisted detection — requires human verification.';

export const SERVICE_ICONS = { additionalDriver: 'UserPlus', childSeat: 'Baby', insurance: 'ShieldCheck', doorstepDelivery: 'Truck' };

export const RENTAL_RULES = [
  'Renter must be 21+ with a valid Indian driving licence (original, shown at pickup).',
  'Carry a government photo ID. The licence number on your booking must match your licence.',
  'Return the vehicle with the same fuel level. Late returns are charged at the hourly rate.',
  'Fines, tolls and challans during the rental are the renter\'s responsibility.',
  'No smoking, no illegal goods, and never exceed the seating capacity.',
  'In an accident or breakdown call 7305786562 immediately — we are available 24x7.',
];

export const FAQ = [
  ['What documents do I need to rent a car?', 'A valid Indian driving licence and a government photo ID (Aadhaar, passport or voter ID). Keep the originals ready at pickup.'],
  ['Is there a security deposit?', 'No. SSB CAR RENTALS does not charge a security deposit on any vehicle — your price breakdown shows only the rental, add-ons and GST.'],
  ['Can I pick up in one city and return in another?', 'Yes — choose different pickup and return locations (Coimbatore and Tirupattur) when you search.'],
  ['How does the AI AutoInspect damage check work?', 'Photos are taken before and after your rental. An AI-assisted comparison flags possible new damage. It never charges you automatically — an SSB team member reviews every finding, you are notified, and you can dispute it before anything is final.'],
  ['What is your cancellation policy?', 'Free (100% refund) more than 24 hours before pickup, 50% between 6 and 24 hours, and no refund of rental charges within 6 hours.'],
  ['Are you available at night?', 'Yes. SSB CAR RENTALS is available 24x7 — call 7305786562 any time for pickups, returns or emergencies.'],
  ['Which payment methods do you accept?', 'UPI, credit card, debit card, net banking, or cash on pickup. (This demo site simulates payments — no real money is charged.)'],
];

export const STATUS_CLASS = {
  Pending: 'b-warn', Confirmed: 'b-info', Active: 'b-ok', Completed: 'b-gold', Cancelled: 'b-bad',
  Paid: 'b-ok', Unpaid: 'b-warn', 'Pay on Pickup': 'b-info', Refunded: 'b-bad', 'Partially Refunded': 'b-warn', Success: 'b-ok', Failed: 'b-bad',
  'Pending Review': 'b-warn', Rejected: 'b-info', 'Customer Disputed': 'b-warn', Resolved: 'b-ok', Verified: 'b-ok',
  Open: 'b-warn', 'In Progress': 'b-info', Closed: '',
  Available: 'b-ok', Booked: 'b-bad', Maintenance: 'b-warn', Retired: 'b-bad', Active_vehicle: 'b-ok',
  Minor: 'b-info', Moderate: 'b-warn', Severe: 'b-bad',
  Low: '', Normal: 'b-info', High: 'b-warn', Urgent: 'b-bad',
};
