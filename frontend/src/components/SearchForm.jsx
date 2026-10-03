import { useState } from 'react';
import { Search } from 'lucide-react';
import { Field } from './ui';
import { LOCATIONS, VEHICLE_TYPES, TIME_OPTIONS } from '../utils/constants';
import { combine, nextHalfHour, toDateInput, toTimeInput, splitDate } from '../utils/format';

export const MIN_HOURS = 4;

export function defaultSearch() {
  const p = nextHalfHour(2); const r = new Date(p.getTime() + 24 * 3600e3);
  return { pickupLocation: 'Coimbatore', returnLocation: 'Coimbatore', pickupDate: toDateInput(p), pickupTime: toTimeInput(p), returnDate: toDateInput(r), returnTime: toTimeInput(r), type: '' };
}

/** URL params → form values */
export function searchFromParams(sp) {
  const base = defaultSearch();
  const out = { ...base };
  if (LOCATIONS.includes(sp.get('pickupLocation'))) out.pickupLocation = sp.get('pickupLocation');
  if (LOCATIONS.includes(sp.get('returnLocation'))) out.returnLocation = sp.get('returnLocation');
  if (sp.get('pickupAt') && !Number.isNaN(new Date(sp.get('pickupAt')))) { const s = splitDate(sp.get('pickupAt')); out.pickupDate = s.date; out.pickupTime = s.time; }
  if (sp.get('returnAt') && !Number.isNaN(new Date(sp.get('returnAt')))) { const s = splitDate(sp.get('returnAt')); out.returnDate = s.date; out.returnTime = s.time; }
  if (VEHICLE_TYPES.includes(sp.get('type'))) out.type = sp.get('type');
  return out;
}

/** form values → validated params (or errors) */
export function validateSearch(v) {
  const errors = {};
  if (!v.pickupLocation) errors.pickupLocation = 'Choose a pickup location';
  if (!v.returnLocation) errors.returnLocation = 'Choose a return location';
  if (!v.pickupDate) errors.pickupDate = 'Choose a pickup date';
  if (!v.pickupTime) errors.pickupTime = 'Choose a pickup time';
  if (!v.returnDate) errors.returnDate = 'Choose a return date';
  if (!v.returnTime) errors.returnTime = 'Choose a return time';
  const pickup = combine(v.pickupDate, v.pickupTime);
  const ret = combine(v.returnDate, v.returnTime);
  if (pickup && pickup.getTime() < Date.now() - 60 * 1000) errors.pickupDate = 'Pickup cannot be in the past';
  if (pickup && ret) {
    if (ret <= pickup) errors.returnDate = 'Return must be after pickup';
    else if ((ret - pickup) / 36e5 < MIN_HOURS) errors.returnDate = `Minimum rental is ${MIN_HOURS} hours`;
  }
  if (Object.keys(errors).length) return { errors };
  return { errors: null, params: { pickupLocation: v.pickupLocation, returnLocation: v.returnLocation, pickupAt: pickup.toISOString(), returnAt: ret.toISOString(), ...(v.type ? { type: v.type } : {}) } };
}

export const paramsToQuery = (p) => new URLSearchParams(p).toString();

export default function SearchForm({ initial, onSubmit, submitLabel = 'Search available cars', showType = true, className = '' }) {
  const [v, setV] = useState(initial || defaultSearch());
  const [errors, setErrors] = useState({});
  const set = (k) => (e) => {
    const value = e.target.value;
    setV((s) => {
      const next = { ...s, [k]: value };
      // keep return on/after pickup date for convenience
      if (k === 'pickupDate' && next.returnDate < value) next.returnDate = value;
      return next;
    });
    setErrors((er) => ({ ...er, [k]: undefined }));
  };
  const today = toDateInput();

  const submit = (e) => {
    e.preventDefault();
    const res = validateSearch(v);
    if (res.errors) { setErrors(res.errors); return; }
    onSubmit(res.params, v);
  };

  return (
    <form className={`search-form ${className}`} onSubmit={submit} noValidate>
      <div className="search-grid">
        <Field label="Pickup location" error={errors.pickupLocation}>
          <select className={`input ${errors.pickupLocation ? 'invalid' : ''}`} value={v.pickupLocation} onChange={set('pickupLocation')}>
            <option value="">Select</option>{LOCATIONS.map((l) => <option key={l}>{l}</option>)}
          </select>
        </Field>
        <Field label="Return location" error={errors.returnLocation}>
          <select className={`input ${errors.returnLocation ? 'invalid' : ''}`} value={v.returnLocation} onChange={set('returnLocation')}>
            <option value="">Select</option>{LOCATIONS.map((l) => <option key={l}>{l}</option>)}
          </select>
        </Field>
        <Field label="Pickup date" error={errors.pickupDate}>
          <input type="date" className={`input ${errors.pickupDate ? 'invalid' : ''}`} min={today} value={v.pickupDate} onChange={set('pickupDate')} />
        </Field>
        <Field label="Pickup time" error={errors.pickupTime}>
          <select className={`input ${errors.pickupTime ? 'invalid' : ''}`} value={v.pickupTime} onChange={set('pickupTime')}>
            {TIME_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </Field>
        <Field label="Return date" error={errors.returnDate}>
          <input type="date" className={`input ${errors.returnDate ? 'invalid' : ''}`} min={v.pickupDate || today} value={v.returnDate} onChange={set('returnDate')} />
        </Field>
        <Field label="Return time" error={errors.returnTime}>
          <select className={`input ${errors.returnTime ? 'invalid' : ''}`} value={v.returnTime} onChange={set('returnTime')}>
            {TIME_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </Field>
        {showType && (
          <Field label="Vehicle type">
            <select className="input" value={v.type} onChange={set('type')}>
              <option value="">Any type</option>{VEHICLE_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </Field>
        )}
        <div className="search-submit">
          <button type="submit" className="btn btn-gold btn-block"><Search size={18} /> {submitLabel}</button>
        </div>
      </div>
    </form>
  );
}
