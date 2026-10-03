import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Navigation, Siren, Gauge, Compass, Clock, MapPin, Timer, Route } from 'lucide-react';
import MapView from '../components/MapView';
import EmergencyModal from '../components/EmergencyModal';
import { Empty, ErrorState, Loader, Notice, PageHeader, StatusBadge, Plate, Field } from '../components/ui';
import useAsync from '../hooks/useAsync';
import useCountdown from '../hooks/useCountdown';
import { bookingApi, errMsg } from '../services/api';
import { fmtDateTime, fmtTime } from '../utils/format';

function Remaining({ booking }) {
  const target = booking.status === 'Active' ? booking.returnAt : booking.pickupAt;
  const c = useCountdown(target);
  return (
    <div className="card">
      <small className="muted">{booking.status === 'Active' ? 'Remaining rental time' : 'Rental starts in'}</small>
      <div className="big-clock">{c.days}<small>d</small> {String(c.hours).padStart(2, '0')}<small>h</small> {String(c.minutes).padStart(2, '0')}<small>m</small> {String(c.seconds).padStart(2, '0')}<small>s</small></div>
      {c.done && booking.status === 'Active' && <span className="err">Return time reached</span>}
    </div>
  );
}

export default function TrackRental() {
  const list = useAsync(() => bookingApi.mine(), []);
  const [sel, setSel] = useState('');
  const [live, setLive] = useState(null);
  const [liveError, setLiveError] = useState('');
  const [sos, setSos] = useState(false);

  const trackable = (list.data?.bookings || []).filter((b) => ['Active', 'Confirmed'].includes(b.status)).sort((a, b) => (a.status === 'Active' ? -1 : 1) - (b.status === 'Active' ? -1 : 1) || new Date(a.pickupAt) - new Date(b.pickupAt));
  const selected = sel || trackable[0]?._id || '';

  useEffect(() => {
    if (!selected) return undefined;
    let alive = true;
    const load = () => bookingApi.track(selected).then((r) => { if (alive) { setLive(r); setLiveError(''); } }).catch((e) => alive && setLiveError(errMsg(e)));
    load();
    const t = setInterval(load, 8000);
    return () => { alive = false; clearInterval(t); };
  }, [selected]);

  useEffect(() => { document.title = 'Track rental — SSB CAR RENTALS'; }, []);

  if (list.loading) return <Loader />;
  if (list.error) return <div className="container section"><ErrorState message={list.error} onRetry={list.reload} /></div>;

  const b = live?.booking; const p = live?.position;
  return (
    <>
      <PageHeader eyebrow="Live tracking" title="Track rental">See where your vehicle is and how much rental time is left.</PageHeader>
      <div className="container section-tight">
        {trackable.length === 0 ? (
          <Empty icon={Navigation} title="No active or upcoming rental to track" action={<Link to="/cars" className="btn btn-gold btn-sm">Book a car</Link>}>Tracking is available once a booking is confirmed.</Empty>
        ) : (
          <>
            {trackable.length > 1 && <Field label="Rental" className="mb-2"><select className="input" value={selected} onChange={(e) => { setSel(e.target.value); setLive(null); }}>{trackable.map((t) => <option key={t._id} value={t._id}>{t.bookingId} — {t.vehicle.name} ({t.status})</option>)}</select></Field>}
            {liveError && <ErrorState message={liveError} onRetry={() => setSel(selected)} />}
            {!b && !liveError && <Loader label="Locating vehicle…" />}
            {b && p && (
              <div className="track-grid">
                <div className="stack">
                  <MapView position={p} />
                  <Notice kind="info" icon={Route}>Location is <strong>simulated for this demo</strong>. The tracking service and map component are structured so a real GPS/telematics feed and map API (Google Maps, Mapbox, Leaflet) can be plugged in later.</Notice>
                  <div className="grid grid-3 stat-tiles">
                    <div className="card"><Gauge size={18} className="gold" /><b>{p.speedKmph}<small> km/h</small></b><small>Speed</small></div>
                    <div className="card"><Compass size={18} className="gold" /><b>{p.heading}°</b><small>Heading</small></div>
                    <div className="card"><Clock size={18} className="gold" /><b style={{ fontSize: '1.2rem' }}>{fmtTime(p.lastUpdated)}</b><small>Last update</small></div>
                  </div>
                </div>
                <div className="stack">
                  <div className="card card-gold">
                    <div className="row-wrap between"><Plate>{b.bookingId}</Plate><StatusBadge status={b.status} /></div>
                    <h3 className="mt-2">{b.vehicle.name}</h3>
                    <dl className="kv" style={{ gridTemplateColumns: '110px 1fr' }}>
                      <dt><MapPin size={14} /> Pickup</dt><dd>{b.pickupLocation}<br /><span className="muted">{fmtDateTime(b.pickupAt)}</span></dd>
                      <dt><MapPin size={14} /> Return</dt><dd>{b.returnLocation}<br /><span className="muted">{fmtDateTime(b.returnAt)}</span></dd>
                      <dt><Navigation size={14} /> Position</dt><dd>{p.lat}, {p.lng}</dd>
                    </dl>
                    <div className="progress mt-2" title={`${Math.round(p.progress * 100)}% of rental elapsed`}><i style={{ width: `${p.progress * 100}%` }} /></div>
                    <small className="hint">{Math.round(p.progress * 100)}% of rental period elapsed</small>
                  </div>
                  <Remaining booking={b} />
                  {b.status === 'Active' ? <button className="btn btn-danger btn-block" onClick={() => setSos(true)}><Siren size={18} /> Emergency assistance</button>
                    : <Notice kind="info" icon={Timer}>Emergency assistance unlocks when your rental becomes active.</Notice>}
                  <Link to={`/booking/confirmation/${b._id}`} className="btn btn-ghost btn-block">Booking details</Link>
                </div>
              </div>
            )}
          </>
        )}
      </div>
      {sos && b && <EmergencyModal booking={b} onClose={() => setSos(false)} />}
    </>
  );
}
