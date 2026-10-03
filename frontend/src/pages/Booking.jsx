import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { UserPlus, Baby, ShieldCheck, Truck, Tag, Check, Timer, ArrowLeft, ArrowRight, MapPin, CalendarDays, AlertTriangle, Gauge } from 'lucide-react';
import SearchForm, { defaultSearch, searchFromParams } from '../components/SearchForm';
import { CarImage } from '../components/CarCard';
import PriceBreakdown from '../components/PriceBreakdown';
import PaymentForm from '../components/PaymentForm';
import { Btn, ErrorState, Field, Loader, Notice, Stepper, PageHeader } from '../components/ui';
import useAsync from '../hooks/useAsync';
import useCountdown from '../hooks/useCountdown';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { bookingApi, carApi, paymentApi, errMsg, fieldErrors } from '../services/api';
import { inr, fmtDateTime, durationLabel } from '../utils/format';
import { LOCATIONS, MAX_KM_PER_DAY } from '../utils/constants';

const STEPS = ['Location & dates', 'Vehicle', 'Services', 'Price', 'Your details', 'Payment', 'Confirmation'];
const SERVICE_ICON = { additionalDriver: UserPlus, childSeat: Baby, insurance: ShieldCheck, doorstepDelivery: Truck };

function HoldTimer({ until }) {
  const c = useCountdown(until);
  if (c.done) return <Notice kind="bad" icon={AlertTriangle}>Your 30-minute hold has expired. You can still pay if the car is free — otherwise please start again.</Notice>;
  return <div className="hold"><Timer size={16} /> Vehicle held for you: <b>{String(c.minutes).padStart(2, '0')}:{String(c.seconds).padStart(2, '0')}</b></div>;
}

export default function Booking() {
  const [sp, setSp] = useSearchParams();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const initialTrip = useMemo(() => {
    const t = { pickupLocation: sp.get('pickupLocation'), returnLocation: sp.get('returnLocation') || sp.get('pickupLocation'), pickupAt: sp.get('pickupAt'), returnAt: sp.get('returnAt') };
    const ok = LOCATIONS.includes(t.pickupLocation) && LOCATIONS.includes(t.returnLocation) && !Number.isNaN(new Date(t.pickupAt)) && !Number.isNaN(new Date(t.returnAt)) && new Date(t.returnAt) > new Date(t.pickupAt);
    return ok ? t : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [trip, setTrip] = useState(initialTrip);
  const [vehicleId, setVehicleId] = useState(sp.get('vehicle') || '');
  const [services, setServices] = useState([]);
  const [deliveryKm, setDeliveryKm] = useState('');
  const [promoInput, setPromoInput] = useState('');
  const [promo, setPromo] = useState('');
  const [promoError, setPromoError] = useState('');
  const [customer, setCustomer] = useState({ name: user.name || '', phone: user.phone || '', email: user.email || '', licenseNumber: user.license?.number || '', address: user.address || '' });
  const [cErrors, setCErrors] = useState({});
  const [agree, setAgree] = useState(false);
  const [booking, setBooking] = useState(null);
  const sig = useRef('');
  const [step, setStep] = useState(initialTrip ? 1 : 0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pricing, setPricing] = useState(null);
  const [quoteError, setQuoteError] = useState('');

  const cfg = useAsync(() => bookingApi.config(), []);
  const pre = useAsync(() => (sp.get('vehicle') ? carApi.get(sp.get('vehicle')) : Promise.resolve(null)), []);
  const tripKey = trip ? `${trip.pickupLocation}|${trip.pickupAt}|${trip.returnAt}` : '';
  const list = useAsync(() => (trip ? carApi.list({ location: trip.pickupLocation, pickupAt: trip.pickupAt, returnAt: trip.returnAt, onlyAvailable: 'true', sort: 'price-asc' }) : Promise.resolve({ vehicles: [] })), [tripKey]);
  const vehicles = list.data?.vehicles || [];
  const vehicle = vehicles.find((v) => v._id === vehicleId) || null;

  useEffect(() => { document.title = 'Book a car — SSB CAR RENTALS'; }, []);

  // A preselected car that isn't free for the chosen trip is dropped, with an explanation.
  useEffect(() => {
    if (!trip || list.loading || !list.data || !vehicleId) return;
    if (!vehicles.some((v) => v._id === vehicleId)) {
      setVehicleId('');
      const name = pre.data?.vehicle?.name;
      toast.info(`${name || 'That car'} isn't available for those dates in ${trip.pickupLocation}. Please choose another.`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.data]);

  // Live, server-side quote (single source of truth for pricing)
  useEffect(() => {
    if (!trip || !vehicle || step < 2) { setPricing(null); return undefined; }
    if (services.includes('doorstepDelivery') && !(Number(deliveryKm) > 0)) { setPricing(null); return undefined; }
    let alive = true;
    setQuoteError('');
    bookingApi.quote({ vehicleId: vehicle._id, pickupAt: trip.pickupAt, returnAt: trip.returnAt, services, promoCode: promo || undefined, deliveryKm: services.includes('doorstepDelivery') ? Number(deliveryKm) : undefined })
      .then((r) => { if (alive) { setPricing(r.pricing); if (promo) setPromoError(''); } })
      .catch((e) => {
        if (!alive) return;
        if (promo) { setPromoError(errMsg(e)); setPromo(''); } else { setPricing(null); setQuoteError(errMsg(e)); }
      });
    return () => { alive = false; };
  }, [vehicle?._id, tripKey, services.join(','), deliveryKm, promo, step]); // eslint-disable-line react-hooks/exhaustive-deps

  const submitTrip = (params) => {
    setTrip({ ...params });
    setBooking(null);
    const next = new URLSearchParams({ ...params, ...(vehicleId ? { vehicle: vehicleId } : {}) });
    next.delete('type');
    setSp(next, { replace: true });
    setStep(1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const go = (n) => { setError(''); setStep(n); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const toggleService = (k) => setServices((l) => {
    const next = l.includes(k) ? l.filter((x) => x !== k) : [...l, k];
    if (k === 'doorstepDelivery' && l.includes(k)) setDeliveryKm('');
    return next;
  });

  const applyPromo = () => { if (!promoInput.trim()) { setPromoError('Enter a promo or reward code.'); return; } setPromoError(''); setPromo(promoInput.trim().toUpperCase()); };

  const validateCustomer = () => {
    const e = {};
    if (customer.name.trim().length < 2) e.name = 'Enter your full name';
    if (!/^[6-9]\d{9}$/.test(customer.phone.trim())) e.phone = 'Enter a valid 10-digit mobile number';
    if (!/^\S+@\S+\.\S+$/.test(customer.email.trim())) e.email = 'Enter a valid email address';
    if (!/^[A-Za-z0-9][A-Za-z0-9\s\-/]{6,19}$/.test(customer.licenseNumber.trim())) e.licenseNumber = 'Enter your driving licence number (e.g. TN37 20190012345)';
    if (customer.address.trim().length < 10) e.address = 'Enter your full address (at least 10 characters)';
    if (!agree) e.agree = 'Please accept the rental terms to continue';
    return e;
  };

  const toPayment = async () => {
    const e = validateCustomer();
    setCErrors(e);
    if (Object.keys(e).length) return;
    const signature = JSON.stringify({ vehicleId, trip, services: [...services].sort(), promo: pricing?.promoCode || '', customer });
    if (booking && sig.current === signature) { go(5); return; }
    setBusy(true); setError('');
    try {
      if (booking) await bookingApi.cancel(booking._id, 'Replaced by an updated booking').catch(() => {});
      const res = await bookingApi.create({ vehicleId, ...trip, services, deliveryKm: services.includes('doorstepDelivery') ? Number(deliveryKm) : undefined, promoCode: pricing?.promoCode || undefined, customer: Object.fromEntries(Object.entries(customer).map(([k, v]) => [k, v.trim()])) });
      setBooking(res.booking); sig.current = signature; go(5);
    } catch (err) {
      const fe = fieldErrors(err);
      const mapped = Object.fromEntries(Object.entries(fe).map(([k, v]) => [k.replace('customer.', ''), v]));
      if (Object.keys(mapped).length) setCErrors(mapped);
      setError(errMsg(err));
    } finally { setBusy(false); }
  };

  const pay = async (method, details, screenshotFile) => {
    const res = await paymentApi.pay({ bookingId: booking._id, method, details });
    if (screenshotFile) await paymentApi.uploadScreenshot(res.payment._id, screenshotFile);
    toast.success(method === 'Cash on Pickup' ? 'Booking confirmed — pay on pickup.' : 'Payment successful!');
    navigate(`/booking/confirmation/${res.booking._id}?new=1`, { replace: true });
  };

  const setC = (k) => (e) => { setCustomer((c) => ({ ...c, [k]: e.target.value })); setCErrors((x) => ({ ...x, [k]: undefined })); };
  const svcMap = cfg.data?.services || {};

  return (
    <>
      <PageHeader eyebrow="Book a car" title="Reserve your ride">Seven simple steps. Every charge is shown before you pay.</PageHeader>
      <div className="container section-tight">
        <Stepper steps={STEPS} current={step} />
        {cfg.error && <ErrorState message={cfg.error} onRetry={cfg.reload} />}
        <div className="wizard">
          <div className="wizard-main">
            {/* STEP 1 — location & dates */}
            {step === 0 && (
              <div className="card card-gold">
                <h3>Where and when?</h3>
                {pre.data?.vehicle && <Notice kind="info" icon={Check}>You chose <strong>{pre.data.vehicle.name}</strong> ({pre.data.vehicle.fuelDisplay}) — based in {pre.data.vehicle.location}.</Notice>}
                <div className="mt-2">
                  <SearchForm key={pre.data?.vehicle?._id || 'blank'} showType={false} submitLabel="Continue" onSubmit={submitTrip}
                    initial={trip ? searchFromParams(new URLSearchParams(trip)) : { ...defaultSearch(), ...(pre.data?.vehicle ? { pickupLocation: pre.data.vehicle.location, returnLocation: pre.data.vehicle.location } : {}) }} />
                </div>
              </div>
            )}

            {/* STEP 2 — vehicle */}
            {step === 1 && trip && (
              <div className="card card-gold">
                <h3>Select your vehicle</h3>
                <p className="muted">Available in {trip.pickupLocation} from {fmtDateTime(trip.pickupAt)} to {fmtDateTime(trip.returnAt)}.</p>
                {list.loading && <Loader label="Checking availability…" />}
                {list.error && <ErrorState message={list.error} onRetry={list.reload} />}
                {!list.loading && vehicles.length === 0 && !list.error && (
                  <Notice kind="info">No cars are free in {trip.pickupLocation} for that period. Try different dates or the other city, or call us on 7305786562.</Notice>
                )}
                <div className="stack" role="radiogroup" aria-label="Vehicles">
                  {vehicles.map((v) => (
                    <button type="button" role="radio" aria-checked={vehicleId === v._id} key={v._id} className={`pick ${vehicleId === v._id ? 'on' : ''}`} onClick={() => setVehicleId(v._id)}>
                      <div className="pick-img"><CarImage car={v} /></div>
                      <div className="pick-info">
                        <b>{v.name}</b><small className="muted">{v.fuelDisplay} · {v.transmission} · {v.seats} seats</small>
                        <small className="muted">No security deposit</small>
                      </div>
                      <div className="pick-price"><b className="gold-text">{inr(v.pricePerDay)}</b><small>/day</small></div>
                      <span className="pick-check"><Check size={16} /></span>
                    </button>
                  ))}
                </div>
                <div className="form-actions">
                  <button className="btn btn-ghost" onClick={() => go(0)}><ArrowLeft size={16} /> Change dates</button>
                  <button className="btn btn-gold" disabled={!vehicle} onClick={() => go(2)}>Continue <ArrowRight size={16} /></button>
                </div>
              </div>
            )}

            {/* STEP 3 — services */}
            {step === 2 && vehicle && (
              <div className="card card-gold">
                <h3>Optional services</h3>
                <p className="muted">Add only what you need. Prices are transparent and included in your total.</p>
                <Notice kind="info" icon={Gauge}>Maximum {MAX_KM_PER_DAY} kms per day{pricing?.billingDays ? ` — up to ${MAX_KM_PER_DAY * pricing.billingDays} km for this ${pricing.billingDays}-day trip.` : ' for this trip.'}</Notice>
                <div className="svc-grid mt-2">
                  {Object.entries(svcMap).map(([key, s]) => {
                    const Icon = SERVICE_ICON[key] || Check; const on = services.includes(key);
                    return (
                      <button type="button" key={key} className={`svc ${on ? 'on' : ''}`} onClick={() => toggleService(key)} aria-pressed={on}>
                        <Icon size={24} /><div><b>{s.label}</b><small>{s.description}</small></div>
                        <span className="svc-price">
                          {s.displayPrice ? <small>{s.displayPrice}</small>
                            : s.kind === 'delivery' ? <small>{s.description}</small>
                              : <>{inr(s.price)}<small>{s.unit === 'day' ? '/day' : ' flat'}</small></>}
                        </span>
                        <span className="pick-check"><Check size={16} /></span>
                      </button>
                    );
                  })}
                </div>
                {services.includes('doorstepDelivery') && (
                  <Field label="Delivery distance (km, one way)" className="mt-2" hint="Minimum ₹500 for 10 kms or below. If it is above 10kms add +₹50 per km.">
                    <input className="input" type="number" min="1" step="1" value={deliveryKm} onChange={(e) => setDeliveryKm(e.target.value)} placeholder="e.g. 12" style={{ maxWidth: 180 }} />
                  </Field>
                )}
                <div className="form-actions">
                  <button className="btn btn-ghost" onClick={() => go(1)}><ArrowLeft size={16} /> Back</button>
                  <button className="btn btn-gold" disabled={services.includes('doorstepDelivery') && !(Number(deliveryKm) > 0)} onClick={() => go(3)}>Continue <ArrowRight size={16} /></button>
                </div>
              </div>
            )}

            {/* STEP 4 — price */}
            {step === 3 && vehicle && (
              <div className="card card-gold">
                <h3>Your price</h3>
                {quoteError && <Notice kind="bad">{quoteError}</Notice>}
                {!pricing && !quoteError && <Loader label="Calculating…" />}
                {pricing && <PriceBreakdown pricing={pricing} />}
                <div className="promo mt-2">
                  <Field label="Promo or reward code" error={promoError} hint={cfg.data ? `Try ${cfg.data.promos.map((p) => p.code).join(', ')} — or a reward coupon (SSBR-…) from your Rewards page.` : undefined}>
                    <div className="row"><input className="input" value={promoInput} onChange={(e) => { setPromoInput(e.target.value); setPromoError(''); }} placeholder="e.g. SSB10" style={{ textTransform: 'uppercase' }} />
                      <button className="btn btn-outline" onClick={applyPromo}><Tag size={16} /> Apply</button></div>
                  </Field>
                  {pricing?.promoCode && <p className="badge b-ok mt-1"><Check size={13} /> {pricing.promoCode} applied</p>}
                </div>
                <div className="form-actions">
                  <button className="btn btn-ghost" onClick={() => go(2)}><ArrowLeft size={16} /> Back</button>
                  <button className="btn btn-gold" disabled={!pricing} onClick={() => go(4)}>Continue <ArrowRight size={16} /></button>
                </div>
              </div>
            )}

            {/* STEP 5 — customer details */}
            {step === 4 && vehicle && (
              <div className="card card-gold">
                <h3>Your details</h3>
                <p className="muted">These appear on your rental agreement. Your driving licence must match at pickup.</p>
                <div className="grid grid-2">
                  <Field label="Full name" error={cErrors.name}><input className={`input ${cErrors.name ? 'invalid' : ''}`} value={customer.name} onChange={setC('name')} autoComplete="name" /></Field>
                  <Field label="Phone" error={cErrors.phone}><input className={`input ${cErrors.phone ? 'invalid' : ''}`} value={customer.phone} onChange={setC('phone')} inputMode="tel" maxLength={10} autoComplete="tel" /></Field>
                  <Field label="Email" error={cErrors.email}><input className={`input ${cErrors.email ? 'invalid' : ''}`} value={customer.email} onChange={setC('email')} type="email" autoComplete="email" /></Field>
                  <Field label="Driving licence number" error={cErrors.licenseNumber}><input className={`input ${cErrors.licenseNumber ? 'invalid' : ''}`} value={customer.licenseNumber} onChange={setC('licenseNumber')} placeholder="TN37 20190012345" style={{ textTransform: 'uppercase' }} /></Field>
                </div>
                <Field label="Address" error={cErrors.address} className="mt-2"><textarea className={`input ${cErrors.address ? 'invalid' : ''}`} value={customer.address} onChange={setC('address')} autoComplete="street-address" /></Field>
                <label className="check mt-2"><input type="checkbox" checked={agree} onChange={(e) => { setAgree(e.target.checked); setCErrors((x) => ({ ...x, agree: undefined })); }} />
                  <span>I have read the rental rules and cancellation policy, and agree to the rental terms.</span></label>
                {cErrors.agree && <span className="err">{cErrors.agree}</span>}
                {error && <div className="mt-2"><Notice kind="bad">{error}</Notice></div>}
                <div className="form-actions">
                  <button className="btn btn-ghost" onClick={() => go(3)}><ArrowLeft size={16} /> Back</button>
                  <Btn loading={busy} onClick={toPayment}>Continue to payment <ArrowRight size={16} /></Btn>
                </div>
              </div>
            )}

            {/* STEP 6 — payment */}
            {step === 5 && booking && (
              <div className="card card-gold">
                <h3>Payment</h3>
                {booking.holdExpiresAt && <HoldTimer until={booking.holdExpiresAt} />}
                <div className="mt-2"><PaymentForm amount={booking.pricing.total} onPay={pay} label="Pay" /></div>
                <div className="form-actions"><button className="btn btn-ghost" onClick={() => go(4)}><ArrowLeft size={16} /> Edit details</button></div>
              </div>
            )}
          </div>

          {/* summary */}
          <aside className="wizard-side">
            <div className="card sticky">
              <h4>Booking summary</h4>
              {!trip ? <p className="muted">Choose your location and dates to begin.</p> : (
                <dl className="kv" style={{ gridTemplateColumns: '90px 1fr' }}>
                  <dt><MapPin size={14} /> Pickup</dt><dd>{trip.pickupLocation}<br /><span className="muted">{fmtDateTime(trip.pickupAt)}</span></dd>
                  <dt><MapPin size={14} /> Return</dt><dd>{trip.returnLocation}<br /><span className="muted">{fmtDateTime(trip.returnAt)}</span></dd>
                  <dt><CalendarDays size={14} /> Length</dt><dd>{durationLabel(trip.pickupAt, trip.returnAt)}</dd>
                  {vehicle && (<><dt>Vehicle</dt><dd>{vehicle.name}<br /><span className="muted">{vehicle.fuelDisplay}</span></dd></>)}
                  {services.length > 0 && (<><dt>Extras</dt><dd>{services.map((s) => (s === 'doorstepDelivery' && deliveryKm ? `${svcMap[s]?.label} (${deliveryKm} km)` : svcMap[s]?.label)).join(', ')}</dd></>)}
                </dl>
              )}
              {pricing && step >= 2 && (<><hr className="divider" />
                <div className="bd-row"><span>Rental total<small>incl. GST{pricing.discount ? ', after discount' : ''}</small></span><b>{inr(pricing.rentalTotal)}</b></div>
                {pricing.deposit > 0 && <div className="bd-row"><span>Refundable deposit</span><b>{inr(pricing.deposit)}</b></div>}
                <div className="bd-total"><span>TOTAL</span><b className="gold-text">{inr(pricing.total)}</b></div></>)}
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
