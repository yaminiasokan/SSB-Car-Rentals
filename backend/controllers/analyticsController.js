const { populate } = require('../db/model');
const Booking = require('../models/Booking');
const Payment = require('../models/Payment');
const Vehicle = require('../models/Vehicle');
const asyncHandler = require('../utils/asyncHandler');

const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const monthLabel = (d) => d.toLocaleString('en-IN', { month: 'short', year: '2-digit' });

const lastMonths = (n) => {
  const out = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) out.push(new Date(now.getFullYear(), now.getMonth() - i, 1));
  return out;
};

exports.overview = asyncHandler(async (req, res) => {
  const months = lastMonths(Number(req.query.months) || 6);
  const since = months[0];

  const [payments, bookings, vehicles] = await Promise.all([
    Payment.revenueSince(since),
    Booking.where("status <> 'Cancelled' AND pickup_at >= $1", [since]),
    Vehicle.where("status <> 'Retired'"),
  ]);
  await populate(bookings, { path: 'vehicle', model: Vehicle, select: 'name fuel' });

  const rev = Object.fromEntries(months.map((m) => [monthKey(m), 0]));
  payments.forEach((p) => { const k = monthKey(new Date(p.paidAt)); if (k in rev) rev[k] += p.revenueAmount; });
  const monthlyRevenue = months.map((m) => ({ month: monthLabel(m), revenue: rev[monthKey(m)] }));

  const cnt = Object.fromEntries(months.map((m) => [monthKey(m), 0]));
  bookings.forEach((b) => { const k = monthKey(new Date(b.pickupAt)); if (k in cnt) cnt[k] += 1; });
  const monthlyBookings = months.map((m) => ({ month: monthLabel(m), bookings: cnt[monthKey(m)] }));

  // Utilisation: share of the last 30 days each vehicle was out on rental
  const windowEnd = new Date();
  const windowStart = new Date(windowEnd.getTime() - 30 * 864e5);
  const recent = await Booking.where(
    "status <> 'Cancelled' AND status = ANY($1::text[]) AND pickup_at < $2 AND return_at > $3",
    [['Confirmed', 'Active', 'Completed'], windowEnd, windowStart],
  );
  const used = {};
  recent.forEach((b) => {
    const from = Math.max(new Date(b.pickupAt).getTime(), windowStart.getTime());
    const to = Math.min(new Date(b.returnAt).getTime(), windowEnd.getTime());
    used[b.vehicle] = (used[b.vehicle] || 0) + Math.max(0, to - from);
  });
  // Vehicles that share a name (e.g. the two Ertiga variants) are told apart by fuel.
  const nameCount = {};
  vehicles.forEach((v) => { nameCount[v.name] = (nameCount[v.name] || 0) + 1; });
  const label = (v) => (nameCount[v.name] > 1 ? `${v.name} (${v.fuel})` : v.name);
  const utilization = vehicles.map((v) => ({ vehicle: label(v), utilization: Math.min(100, Math.round(((used[v._id] || 0) / (windowEnd - windowStart)) * 100)) }));

  const byVehicle = {};
  const byLocation = {};
  const byFuel = {};
  bookings.forEach((b) => {
    const vLabel = b.vehicle ? label(b.vehicle) : 'Unknown';
    byVehicle[vLabel] = (byVehicle[vLabel] || 0) + 1;
    byLocation[b.pickupLocation] = (byLocation[b.pickupLocation] || 0) + 1;
    if (b.vehicle) byFuel[b.vehicle.fuel] = (byFuel[b.vehicle.fuel] || 0) + 1;
  });
  const toList = (obj, key) => Object.entries(obj).map(([name, value]) => ({ name, [key]: value })).sort((a, b) => b[key] - a[key]);

  res.json({
    success: true, months: months.length,
    monthlyRevenue, monthlyBookings, utilization,
    popularVehicles: toList(byVehicle, 'bookings'),
    popularLocations: toList(byLocation, 'bookings'),
    fuelDistribution: toList(byFuel, 'bookings'),
  });
});
