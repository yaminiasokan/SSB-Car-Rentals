/**
 * Schematic map for the simulated GPS position.
 *
 * INTEGRATION POINT: to use a real map, replace this component with a Google Maps / Mapbox / Leaflet
 * view that consumes the same `position` object ({lat, lng, heading, route, pickup, drop}) returned by
 * GET /api/bookings/:id/track. The backend service `trackingService.getVehiclePosition()` is the
 * matching place to plug in a real GPS/telematics feed.
 */
const W = 720; const H = 400; const PAD = 60;

export default function MapView({ position }) {
  const pts = [...position.route, position.pickup, position.drop, { lat: position.lat, lng: position.lng }];
  const lats = pts.map((p) => p.lat); const lngs = pts.map((p) => p.lng);
  const minLat = Math.min(...lats); const maxLat = Math.max(...lats); const minLng = Math.min(...lngs); const maxLng = Math.max(...lngs);
  const k = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
  const spanX = Math.max((maxLng - minLng) * k, 0.02); const spanY = Math.max(maxLat - minLat, 0.02);
  const scale = Math.min((W - PAD * 2) / spanX, (H - PAD * 2) / spanY);
  const offX = (W - spanX * scale) / 2; const offY = (H - spanY * scale) / 2;
  const P = (p) => ({ x: offX + (p.lng - minLng) * k * scale, y: H - offY - (p.lat - minLat) * scale });

  const route = position.route.map(P);
  const segs = route.length - 1;
  const scaled = Math.min(Math.max(position.progress, 0), 1) * segs;
  const idx = Math.min(Math.floor(scaled), segs - 1);
  const done = [...route.slice(0, idx + 1), P({ lat: position.lat, lng: position.lng })];
  const car = P({ lat: position.lat, lng: position.lng });
  const line = (a) => a.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const pickup = P(position.pickup); const drop = P(position.drop); const exc = position.excursion ? P(position.excursion) : null;

  return (
    <div className="mapview">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Simulated vehicle location near ${position.lat}, ${position.lng}`}>
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="#d4af37" strokeOpacity=".07" /></pattern>
          <radialGradient id="pulse"><stop offset="0" stopColor="#d4af37" stopOpacity=".5" /><stop offset="1" stopColor="#d4af37" stopOpacity="0" /></radialGradient>
        </defs>
        <rect width={W} height={H} fill="#080808" /><rect width={W} height={H} fill="url(#grid)" />
        <polyline points={line(route)} fill="none" stroke="#d4af37" strokeOpacity=".35" strokeWidth="3" strokeDasharray="8 8" strokeLinecap="round" strokeLinejoin="round" />
        <polyline points={line(done)} fill="none" stroke="#d4af37" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        {[[pickup, position.pickup.name, 'Pickup'], [drop, position.drop.name, 'Return']].map(([p, name, tag], i) => (
          <g key={tag} transform={`translate(${p.x},${p.y + (i && pickup.x === drop.x && pickup.y === drop.y ? 0 : 0)})`}>
            <circle r="9" fill="#000" stroke="#fff" strokeWidth="2.5" />
            <text y={i ? 26 : -16} x={i ? 14 : -14} textAnchor={i ? 'start' : 'end'} fill="#fff" fontFamily="Barlow, sans-serif" fontSize="13" fontWeight="600">{tag}: {name}</text>
          </g>
        ))}
        {exc && <g transform={`translate(${exc.x},${exc.y})`}><circle r="5" fill="#d4af37" opacity=".6" /><text y="-12" textAnchor="middle" fill="#a9a398" fontSize="12" fontFamily="Barlow, sans-serif">{position.excursion.name}</text></g>}
        <g transform={`translate(${car.x},${car.y})`}>
          <circle r="30" fill="url(#pulse)"><animate attributeName="r" values="18;34;18" dur="2.4s" repeatCount="indefinite" /></circle>
          <g transform={`rotate(${position.heading})`}><path d="M0 -14 L9 10 L0 5 L-9 10 Z" fill="#f3d97a" stroke="#000" strokeWidth="1.5" /></g>
        </g>
      </svg>
      <span className="map-tag">Simulated GPS · demo data</span>
    </div>
  );
}
