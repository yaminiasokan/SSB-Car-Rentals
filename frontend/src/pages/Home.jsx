import { Link, useNavigate } from 'react-router-dom';
import { MapPin, Phone, Clock, ShieldCheck, Wallet, Sparkles, ScanSearch, Camera, UserCheck, ArrowRight, Leaf, LifeBuoy, CalendarCheck, CarFront } from 'lucide-react';
import SearchForm, { paramsToQuery } from '../components/SearchForm';
import CarCard from '../components/CarCard';
import CarArt from '../components/CarArt';
import { Plate, Skeleton, ErrorState } from '../components/ui';
import useAsync from '../hooks/useAsync';
import { carApi } from '../services/api';
import { COMPANY } from '../utils/constants';

const heroImage = Object.values(import.meta.glob('../assets/hero.{jpg,jpeg,png,webp}', { eager: true, query: '?url', import: 'default' }))[0];

const WHY = [
  [Clock, '24x7 availability', 'Pick up or return any time of day. Our team answers the phone around the clock.'],
  [Wallet, 'Transparent pricing', 'Every charge — rental, services, GST and discount — shown before you pay. No security deposit.'],
  [ShieldCheck, 'Insured & inspected', 'Every car is photo-inspected before and after your trip so there are no surprises.'],
  [CalendarCheck, 'Flexible rentals', 'Hourly or daily. Pick up in Coimbatore, return in Tirupattur — or the other way round.'],
  [Leaf, 'Petrol, CNG & diesel', 'Choose the fuel that fits your budget, with an eco score on every car.'],
  [LifeBuoy, 'Roadside support', 'One tap for roadside help, towing or accident assistance during your rental.'],
];

export default function Home() {
  const navigate = useNavigate();
  const { data, loading, error, reload } = useAsync(() => carApi.list({ sort: 'popular' }), []);

  return (
    <>
      <section className="hero" style={heroImage ? { '--hero-img': `url(${heroImage})` } : undefined}>
        <div className="hero-bg" aria-hidden="true" />
        <div className="container hero-inner">
          <div className="hero-copy">
            <span className="eyebrow fade-up">SSB CAR RENTALS · Coimbatore &amp; Tirupattur</span>
            <h1 className="fade-up d1">Your journey,<br /><span className="gold-text">our wheels.</span></h1>
            <p className="hero-sub fade-up d2">Reliable cars. Flexible rentals. 24x7 availability.</p>
            <div className="row-wrap fade-up d3">
              <Link to="/book" className="btn btn-gold">Book a car</Link>
              <Link to="/cars" className="btn btn-outline">Explore cars</Link>
            </div>
            <div className="hero-meta fade-up d4">
              <span><MapPin size={17} className="gold" /> Coimbatore</span>
              <span><MapPin size={17} className="gold" /> Tirupattur</span>
              <a href={`tel:${COMPANY.phone}`} aria-label={`Call ${COMPANY.phone}`}><Plate><Phone size={14} /> {COMPANY.phone}</Plate></a>
            </div>
          </div>
          <div className="hero-art" aria-hidden="true">
            <CarArt type="MPV" className="hero-car" />
            <div className="road" />
          </div>
        </div>
      </section>

      <section className="container quick-search-wrap">
        <div className="card card-gold quick-search">
          <div className="row between mb-2" style={{ flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0, textTransform: 'uppercase' }}>Find your car</h3>
            <span className="badge b-gold"><Clock size={13} /> Open 24x7</span>
          </div>
          <SearchForm onSubmit={(params) => navigate(`/cars?${paramsToQuery(params)}`)} submitLabel="Search available cars" />
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-head"><span className="eyebrow">SSB CAR RENTALS</span><h2>Available cars &amp; daily rental rates</h2><p className="muted">Fifteen well-maintained cars across Coimbatore and Tirupattur — from a budget-friendly hatchback to the premium Innova Crysta. Maximum 300 kms per day on every rental.</p></div>
          {error && <ErrorState message={error} onRetry={reload} />}
          <div className="grid grid-auto">
            {loading ? Array.from({ length: 6 }, (_, i) => <Skeleton key={i} h={400} />) : data?.vehicles.map((c) => <CarCard key={c._id} car={c} />)}
          </div>
          <div className="center mt-3"><Link to="/cars" className="btn btn-outline">View all cars <ArrowRight size={17} /></Link></div>
        </div>
      </section>

      <section className="section how">
        <div className="container">
          <div className="section-head center"><span className="eyebrow">How it works</span><h2>On the road in minutes</h2></div>
          <div className="grid grid-3">
            {[[CarFront, '1. Choose', 'Search by city, dates and type. See real availability instantly.'], [CalendarCheck, '2. Book & pay', 'Add optional extras, see the full price, and pay securely — or on pickup.'], [Sparkles, '3. Drive', 'Collect your car, enjoy the trip, and return it. We handle the paperwork digitally.']].map(([Icon, t, d], i) => (
              <div className="card how-step" key={t}><span className="how-num">0{i + 1}</span><Icon size={30} className="gold" /><h3>{t}</h3><p className="muted">{d}</p></div>
            ))}
          </div>
        </div>
      </section>

      <section className="section autoinspect">
        <div className="container ai-grid">
          <div>
            <span className="eyebrow">AI AutoInspect</span>
            <h2>Fair, photo-backed<br />damage checks</h2>
            <p className="muted">We photograph every car before and after your rental and use AI-assisted comparison to flag possible new damage — then a real person reviews it. <strong style={{ color: '#fff' }}>You are never charged automatically.</strong></p>
            <ul className="ticks">
              <li><Camera size={18} /> 7-angle photo baseline before you drive away</li>
              <li><ScanSearch size={18} /> Before-vs-after comparison with a highlighted damage overlay</li>
              <li><UserCheck size={18} /> Human verification, customer notification, and a right to dispute</li>
            </ul>
            <Link to="/support" className="btn btn-outline mt-2">How it works</Link>
          </div>
          <div className="ai-visual" aria-hidden="true">
            <div className="ai-pane"><small>BEFORE</small><CarArt type="Sedan" glow={false} /></div>
            <div className="ai-pane"><small>AFTER</small><CarArt type="Sedan" glow={false} /><i className="ai-heat" /><em>Scratch · Moderate</em></div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-head center"><span className="eyebrow">Why SSB</span><h2>Built for a smooth journey</h2></div>
          <div className="grid grid-3">
            {WHY.map(([Icon, t, d]) => <div className="card card-hover" key={t}><Icon size={28} className="gold" /><h3 style={{ marginTop: 12 }}>{t}</h3><p className="muted" style={{ margin: 0 }}>{d}</p></div>)}
          </div>
        </div>
      </section>

      <section className="section cta-band">
        <div className="container center">
          <h2>Ready when you are — <span className="gold-text">24x7</span></h2>
          <p className="muted">Call {COMPANY.phone} or book online in under two minutes.</p>
          <div className="row-wrap" style={{ justifyContent: 'center' }}>
            <Link to="/book" className="btn btn-gold">Book a car</Link>
            <a href={`tel:${COMPANY.phone}`} className="btn btn-outline"><Phone size={17} /> Call now</a>
          </div>
        </div>
      </section>
    </>
  );
}
