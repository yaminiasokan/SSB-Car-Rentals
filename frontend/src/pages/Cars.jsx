import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { SlidersHorizontal, X, SearchX, CalendarClock } from 'lucide-react';
import CarCard from '../components/CarCard';
import { Empty, ErrorState, PageHeader, Skeleton, Btn } from '../components/ui';
import { paramsToQuery } from '../components/SearchForm';
import useAsync from '../hooks/useAsync';
import useDebounce from '../hooks/useDebounce';
import { carApi } from '../services/api';
import { FUELS, LOCATIONS, PRICE_RANGES, SEATS, SORTS, TRANSMISSIONS, VEHICLE_TYPES } from '../utils/constants';
import { fmtDateTime } from '../utils/format';

const EMPTY = { price: [], fuel: [], seats: [], transmission: [], location: [], type: [], availability: '', sort: 'price-asc', search: '' };

function Group({ title, children }) { return <fieldset className="filter-group"><legend>{title}</legend>{children}</fieldset>; }

export default function Cars() {
  const [sp, setSp] = useSearchParams();
  const trip = useMemo(() => {
    const t = ['pickupLocation', 'returnLocation', 'pickupAt', 'returnAt'].reduce((a, k) => (sp.get(k) ? { ...a, [k]: sp.get(k) } : a), {});
    return t.pickupAt && t.returnAt && t.pickupLocation ? t : null;
  }, [sp]);

  const [f, setF] = useState(() => ({ ...EMPTY, location: trip ? [trip.pickupLocation] : [], type: VEHICLE_TYPES.includes(sp.get('type')) ? [sp.get('type')] : [] }));
  const [open, setOpen] = useState(false);
  const debouncedSearch = useDebounce(f.search, 300);

  const toggle = (key, val) => setF((s) => ({ ...s, [key]: s[key].includes(val) ? s[key].filter((x) => x !== val) : [...s[key], val] }));
  const query = useMemo(() => {
    const q = { sort: f.sort };
    if (f.price.length) q.price = f.price.join(',');
    if (f.fuel.length) q.fuel = f.fuel.join(',');
    if (f.seats.length) q.seats = f.seats.join(',');
    if (f.transmission.length) q.transmission = f.transmission.join(',');
    if (f.location.length) q.location = f.location.join(',');
    if (f.type.length) q.type = f.type.join(',');
    if (f.availability) q.availability = f.availability;
    if (debouncedSearch.trim()) q.search = debouncedSearch.trim();
    if (trip) { q.pickupAt = trip.pickupAt; q.returnAt = trip.returnAt; q.onlyAvailable = 'true'; }
    return q;
  }, [f, debouncedSearch, trip]);

  const { data, loading, error, reload } = useAsync(() => carApi.list(query), [JSON.stringify(query)]);
  useEffect(() => { document.title = 'Cars — SSB CAR RENTALS'; }, []);

  const activeCount = f.price.length + f.fuel.length + f.seats.length + f.transmission.length + f.location.length + f.type.length + (f.availability ? 1 : 0);
  const clearTrip = () => { const n = new URLSearchParams(sp); ['pickupLocation', 'returnLocation', 'pickupAt', 'returnAt', 'type'].forEach((k) => n.delete(k)); setSp(n, { replace: true }); };
  const bookQuery = trip ? paramsToQuery(trip) : '';

  return (
    <>
      <PageHeader eyebrow="SSB CAR RENTALS" title="Available cars & daily rental rates">Every SSB vehicle in Coimbatore and Tirupattur, with transparent daily pricing and live availability. Maximum 300 kms per day on every rental.</PageHeader>
      <div className="container section-tight">
        {trip && (
          <div className="notice mb-2 trip-banner">
            <CalendarClock size={20} />
            <div style={{ flex: 1 }}>
              Showing cars available <strong>{fmtDateTime(trip.pickupAt)}</strong> → <strong>{fmtDateTime(trip.returnAt)}</strong>, pickup in <strong>{trip.pickupLocation}</strong>.
            </div>
            <button className="btn btn-ghost btn-sm" onClick={clearTrip}>Clear search</button>
          </div>
        )}
        <div className="cars-layout">
          <aside className={`filters ${open ? 'open' : ''}`} aria-label="Filters">
            <div className="row between filters-head">
              <h3 style={{ margin: 0 }}>Filters</h3>
              <div className="row">
                {activeCount > 0 && <button className="btn btn-ghost btn-sm" onClick={() => setF((s) => ({ ...EMPTY, sort: s.sort, search: s.search }))}>Reset</button>}
                <button className="btn btn-ghost btn-icon filters-close" onClick={() => setOpen(false)} aria-label="Close filters"><X size={18} /></button>
              </div>
            </div>
            <Group title="Price per day">{PRICE_RANGES.map((p) => <label className="check" key={p.key}><input type="checkbox" checked={f.price.includes(p.key)} onChange={() => toggle('price', p.key)} />{p.label}</label>)}</Group>
            <Group title="Fuel">{FUELS.map((x) => <label className="check" key={x}><input type="checkbox" checked={f.fuel.includes(x)} onChange={() => toggle('fuel', x)} />{x}</label>)}</Group>
            <Group title="Seats">{SEATS.map((x) => <label className="check" key={x}><input type="checkbox" checked={f.seats.includes(x)} onChange={() => toggle('seats', x)} />{x} seater</label>)}</Group>
            <Group title="Transmission">{TRANSMISSIONS.map((x) => <label className="check" key={x}><input type="checkbox" checked={f.transmission.includes(x)} onChange={() => toggle('transmission', x)} />{x}</label>)}</Group>
            <Group title="Location">{LOCATIONS.map((x) => <label className="check" key={x}><input type="checkbox" checked={f.location.includes(x)} onChange={() => toggle('location', x)} />{x}</label>)}</Group>
            <Group title="Vehicle type">{VEHICLE_TYPES.map((x) => <label className="check" key={x}><input type="checkbox" checked={f.type.includes(x)} onChange={() => toggle('type', x)} />{x}</label>)}</Group>
            <Group title="Availability">
              {[['', 'All'], ['available', 'Available'], ['booked', 'Booked']].map(([v, l]) => <label className="check" key={l}><input type="radio" name="avail" checked={f.availability === v} onChange={() => setF((s) => ({ ...s, availability: v }))} />{l}</label>)}
            </Group>
            <Btn className="btn-gold btn-block filters-apply" onClick={() => setOpen(false)}>Show {data?.count ?? ''} cars</Btn>
          </aside>

          <div>
            <div className="cars-toolbar">
              <input className="input" placeholder="Search by name or brand…" value={f.search} onChange={(e) => setF((s) => ({ ...s, search: e.target.value }))} aria-label="Search cars" />
              <select className="input" value={f.sort} onChange={(e) => setF((s) => ({ ...s, sort: e.target.value }))} aria-label="Sort cars">{SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select>
              <button className="btn btn-outline filters-toggle" onClick={() => setOpen(true)}><SlidersHorizontal size={16} /> Filters{activeCount ? ` (${activeCount})` : ''}</button>
            </div>
            <p className="muted" aria-live="polite">{loading ? 'Loading…' : `${data?.count ?? 0} car${data?.count === 1 ? '' : 's'} found`}</p>
            {error && <ErrorState message={error} onRetry={reload} />}
            {!error && (
              <div className="grid grid-auto cars-grid">
                {loading ? Array.from({ length: 4 }, (_, i) => <Skeleton key={i} h={400} />) : data?.vehicles.map((c) => <CarCard key={c._id} car={c} search={bookQuery} />)}
              </div>
            )}
            {!loading && !error && data?.count === 0 && (
              <Empty icon={SearchX} title="No cars match those filters" action={<div className="row-wrap" style={{ justifyContent: 'center' }}>
                <button className="btn btn-outline btn-sm" onClick={() => setF({ ...EMPTY })}>Clear filters</button>
                {trip && <button className="btn btn-outline btn-sm" onClick={clearTrip}>Try different dates</button>}
                <Link to="/support" className="btn btn-ghost btn-sm">Ask our team</Link></div>}>
                {trip ? 'Nothing is free for those dates in that city. Try other dates, another pickup city, or call us — we may be able to help.' : 'Try removing a filter or two.'}
              </Empty>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
