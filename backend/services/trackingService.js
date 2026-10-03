/**
 * Rental tracking — SIMULATED GPS.
 *
 * `getVehiclePosition(booking)` is the single integration point. To go live, replace its body
 * with a call to a real telematics / GPS-tracker API (or a map SDK such as Google Maps or Mapbox)
 * and keep the returned shape the same; the frontend needs no other change.
 */
const CITIES = {
  Coimbatore: { lat: 11.0168, lng: 76.9558, excursion: { name: 'Ooty', lat: 11.4102, lng: 76.695 } },
  Tirupattur: { lat: 12.4949, lng: 78.573, excursion: { name: 'Yelagiri Hills', lat: 12.5833, lng: 78.6333 } },
};

const lerp = (a, b, t) => a + (b - a) * t;
const point = (a, b, t) => ({ lat: lerp(a.lat, b.lat, t), lng: lerp(a.lng, b.lng, t) });

function buildRoute(booking) {
  const start = CITIES[booking.pickupLocation];
  const end = CITIES[booking.returnLocation];
  if (booking.pickupLocation === booking.returnLocation) {
    // Out-and-back excursion from the base city
    return [start, start.excursion, end].map((p) => ({ lat: p.lat, lng: p.lng }));
  }
  return [start, end].map((p) => ({ lat: p.lat, lng: p.lng }));
}

function positionOnRoute(route, t) {
  const segs = route.length - 1;
  const scaled = Math.min(Math.max(t, 0), 1) * segs;
  const i = Math.min(Math.floor(scaled), segs - 1);
  return { ...point(route[i], route[i + 1], scaled - i), heading: Math.round((Math.atan2(route[i + 1].lng - route[i].lng, route[i + 1].lat - route[i].lat) * 180) / Math.PI + 360) % 360 };
}

function getVehiclePosition(booking, now = new Date()) {
  const start = new Date(booking.pickupAt).getTime();
  const end = new Date(booking.returnAt).getTime();
  const t = (now.getTime() - start) / (end - start);
  const route = buildRoute(booking);
  const moving = booking.status === 'Active' && t >= 0 && t <= 1;
  const pos = positionOnRoute(route, moving ? t : t < 0 ? 0 : 1);
  return {
    simulated: true,
    provider: 'simulated',
    lat: Number(pos.lat.toFixed(5)),
    lng: Number(pos.lng.toFixed(5)),
    heading: pos.heading,
    speedKmph: moving ? 38 + Math.round(20 * Math.abs(Math.sin(now.getTime() / 60000))) : 0,
    progress: Math.min(Math.max(t, 0), 1),
    remainingMs: Math.max(0, end - now.getTime()),
    lastUpdated: now.toISOString(),
    route,
    pickup: { name: booking.pickupLocation, ...CITIES[booking.pickupLocation] },
    drop: { name: booking.returnLocation, ...CITIES[booking.returnLocation] },
    excursion: booking.pickupLocation === booking.returnLocation ? CITIES[booking.pickupLocation].excursion : null,
  };
}

module.exports = { getVehiclePosition, CITIES };
