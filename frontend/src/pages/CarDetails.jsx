import { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { Heart, Fuel, Cog, Users, Gauge, MapPin, CalendarDays, Check, ShieldCheck, Wallet, FileText, ArrowLeft, Phone } from 'lucide-react';
import CarArt from '../components/CarArt';
import { EcoBadge, ErrorState, Loader, StarRating, StatusBadge, Notice } from '../components/ui';
import useAsync from '../hooks/useAsync';
import { useWishlist } from '../context/WishlistContext';
import { bookingApi, carApi, reviewApi, assetUrl } from '../services/api';
import { COMPANY, RENTAL_RULES, MAX_KM_PER_DAY } from '../utils/constants';
import { fmtDate, inr } from '../utils/format';

export default function CarDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const wl = useWishlist();
  const [img, setImg] = useState(0);
  const { data, loading, error, reload } = useAsync(() => carApi.get(id), [id]);
  const reviews = useAsync(() => reviewApi.list({ vehicle: id }), [id]);
  const cfg = useAsync(() => bookingApi.config(), []);

  if (loading) return <Loader label="Loading vehicle…" />;
  if (error) return <div className="container section"><ErrorState message={error} onRetry={reload} /><Link to="/cars" className="btn btn-outline mt-2"><ArrowLeft size={16} /> Back to cars</Link></div>;
  const car = data.vehicle;
  const liked = wl.has(car._id);
  const bookable = car.availabilityLabel === 'Available';
  const list = reviews.data?.reviews || [];
  const avg = (k) => (list.length ? list.reduce((s, r) => s + r.ratings[k], 0) / list.length : 0);
  const specs = [[Fuel, 'Fuel', car.fuelDisplay || car.fuel], [Cog, 'Transmission', car.transmission], [Users, 'Seats', `${car.seats} seater`], [Gauge, 'Mileage', car.mileage || '—'],
    [CalendarDays, 'Registration', car.registrationYear || '—'], [MapPin, 'Pickup location', car.location], [Gauge, 'Max usage', `${MAX_KM_PER_DAY} km/day`]];

  return (
    <div className="container section-tight details">
      <Link to="/cars" className="muted back-link"><ArrowLeft size={16} /> All cars</Link>
      <div className="details-grid">
        <div>
          <div className="gallery card">
            <div className="gallery-main">
              {car.images?.length ? <img src={assetUrl(car.images[img])} alt={`${car.name} photo ${img + 1}`} /> : <CarArt type={car.bodyType} />}
            </div>
            {car.images?.length > 1 && <div className="gallery-thumbs">{car.images.map((u, i) => <button key={u} className={i === img ? 'on' : ''} onClick={() => setImg(i)} aria-label={`Show photo ${i + 1}`}><img src={assetUrl(u)} alt="" /></button>)}</div>}
            {!car.images?.length && <p className="hint center" style={{ margin: '8px 0 0' }}>Illustration shown — real photos can be added by the SSB team.</p>}
          </div>

          <div className="row-wrap mt-3" style={{ justifyContent: 'space-between' }}>
            <div>
              <div className="row-wrap"><span className="badge b-gold">{car.brand}</span><span className="badge">{car.bodyType}</span><StatusBadge status={car.availabilityLabel} /></div>
              <h1 style={{ fontSize: 'clamp(2rem,5vw,3.2rem)', marginTop: 12 }}>{car.name}</h1>
              <div className="muted">{car.variant}</div>
            </div>
            <div className="right-align"><StarRating value={car.rating} /><div className="muted" style={{ fontSize: '.9rem' }}>{car.rating ? `${car.rating.toFixed(1)} · ${car.reviewCount} review${car.reviewCount === 1 ? '' : 's'}` : 'No reviews yet'}</div></div>
          </div>
          {car.description && <p className="muted mt-2">{car.description}</p>}

          <div className="spec-grid mt-2">
            {specs.map(([Icon, k, v]) => <div className="spec" key={k}><Icon size={20} className="gold" /><div><small>{k}</small><b>{v}</b></div></div>)}
          </div>

          <div className="card mt-3"><h3>Features</h3>
            <ul className="feature-list">{car.features?.map((x) => <li key={x}><Check size={16} className="gold" /> {x}</li>)}</ul>
          </div>

          <div className="card mt-2"><EcoBadge score={car.ecoScore} /><p className="hint" style={{ margin: '10px 0 0' }}>Petrol ≈ 65 · CNG ≈ 80 · Diesel ≈ 55 · Petrol + CNG ≈ 75. An estimate to help you compare — not a certified rating.</p></div>

          <div className="card mt-2">
            <h3>Customer reviews</h3>
            {reviews.loading ? <Loader label="Loading reviews…" /> : list.length === 0 ? <p className="muted">No reviews yet. Only customers who completed a rental can review this car.</p> : (
              <>
                <div className="grid grid-4 mb-2">
                  {[['overall', 'Overall'], ['vehicleCondition', 'Vehicle condition'], ['cleanliness', 'Cleanliness'], ['pickupExperience', 'Pickup experience']].map(([k, l]) => (
                    <div key={k}><small className="muted">{l}</small><div className="row"><b style={{ fontSize: '1.4rem' }}>{avg(k).toFixed(1)}</b><StarRating value={avg(k)} size={14} /></div></div>
                  ))}
                </div>
                <div className="stack">
                  {list.slice(0, 6).map((r) => (
                    <div className="review" key={r._id}>
                      <div className="row between"><strong>{r.user.name}</strong><span className="muted" style={{ fontSize: '.85rem' }}>{fmtDate(r.createdAt)}</span></div>
                      <div className="row"><StarRating value={r.ratings.overall} size={14} />{r.verified && <span className="badge b-ok">Verified rental</span>}</div>
                      {r.comment && <p style={{ margin: '6px 0 0' }}>{r.comment}</p>}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="grid grid-2 mt-2">
            <div className="card"><h3><FileText size={18} className="gold" /> Rental rules</h3><ul className="plain-list">{RENTAL_RULES.map((r) => <li key={r}>{r}</li>)}</ul></div>
            <div className="card">
              <h3><Wallet size={18} className="gold" /> Cancellation policy</h3>
              <ul className="plain-list">{(cfg.data?.cancellation || []).map((t) => <li key={t.label}>{t.label}</li>)}<li>No security deposit is charged on any booking.</li></ul>
              <h3 style={{ marginTop: 18 }}><ShieldCheck size={18} className="gold" /> Insurance</h3>
              <p className="muted" style={{ margin: 0 }}>Every SSB vehicle is covered by comprehensive motor insurance. Optional <strong>Premium Insurance</strong> ({inr(cfg.data?.services?.insurance?.price ?? 400)}/day) reduces your liability for accidental damage. Terms apply.</p>
            </div>
          </div>
        </div>

        <aside className="book-panel">
          <div className="card card-gold sticky">
            <div className="price-big"><span className="gold-text">{inr(car.pricePerDay)}</span><span className="muted"> / day</span></div>
            <div className="muted">{inr(car.pricePerHour)} / hour for short trips</div>
            <hr className="divider" />
            <dl className="kv" style={{ gridTemplateColumns: '120px 1fr' }}>
              <dt>Security deposit</dt><dd>No security deposit</dd>
              <dt>Pickup</dt><dd>{car.location}</dd>
              <dt>Status</dt><dd><StatusBadge status={car.availabilityLabel} /></dd>
            </dl>
            {!bookable && <Notice kind="info">Currently booked or unavailable — you can still reserve future dates.</Notice>}
            <div className="stack mt-2">
              <button className="btn btn-gold btn-block" onClick={() => navigate(`/book?vehicle=${car._id}`)} disabled={car.status !== 'Active' || !car.availability}>Book now</button>
              <button className="btn btn-outline btn-block" onClick={() => wl.toggle(car._id)} aria-pressed={liked}><Heart size={17} fill={liked ? 'currentColor' : 'none'} /> {liked ? 'In your wishlist' : 'Add to wishlist'}</button>
              <a className="btn btn-ghost btn-block" href={`tel:${COMPANY.phone}`}><Phone size={16} /> Call {COMPANY.phone}</a>
            </div>
            <p className="hint center mt-2">24x7 support · Taxes shown at checkout</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
