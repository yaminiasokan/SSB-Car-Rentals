import { useState } from 'react';
import { Plus, Pencil, Trash2, Upload, X, Power } from 'lucide-react';
import { CarImage } from '../../components/CarCard';
import { Btn, ConfirmModal, ErrorState, Field, Loader, Modal, Notice, StatusBadge } from '../../components/ui';
import useAsync from '../../hooks/useAsync';
import { useToast } from '../../context/ToastContext';
import { carApi, assetUrl, errMsg, fieldErrors } from '../../services/api';
import { FUELS, LOCATIONS, TRANSMISSIONS, VEHICLE_TYPES } from '../../utils/constants';
import { inr } from '../../utils/format';

const BLANK = { name: '', brand: '', model: '', variant: '', bodyType: 'Hatchback', fuel: 'Petrol', fuelDisplay: '', transmission: 'Manual', seats: 5, pricePerDay: '', pricePerHour: '', registrationYear: new Date().getFullYear(), mileage: '', features: '', description: '', location: 'Coimbatore', availability: true, status: 'Active' };

function VehicleForm({ vehicle, onClose, onSaved }) {
  const toast = useToast();
  const editing = !!vehicle;
  const [f, setF] = useState(editing ? { ...BLANK, ...vehicle, features: (vehicle.features || []).join(', '), registrationYear: vehicle.registrationYear || '' } : BLANK);
  const [errors, setErrors] = useState({});
  const [files, setFiles] = useState([]);
  const [images, setImages] = useState(vehicle?.images || []);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => { setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }); setErrors({ ...errors, [k]: undefined }); };

  const validate = () => {
    const e = {};
    if (!f.name.trim()) e.name = 'Enter the vehicle name';
    if (!f.brand.trim()) e.brand = 'Enter the brand';
    if (!f.model.trim()) e.model = 'Enter the model';
    if (!(Number(f.seats) >= 2)) e.seats = 'Enter the seating capacity';
    if (!(Number(f.pricePerDay) > 0)) e.pricePerDay = 'Enter a price per day';
    if (f.pricePerHour !== '' && !(Number(f.pricePerHour) >= 0)) e.pricePerHour = 'Enter a valid hourly price';
    return e;
  };

  const save = async () => {
    const e = validate(); setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    const body = { ...f, seats: Number(f.seats), pricePerDay: Number(f.pricePerDay), registrationYear: f.registrationYear ? Number(f.registrationYear) : undefined, features: f.features };
    if (f.pricePerHour === '' || f.pricePerHour == null) delete body.pricePerHour; else body.pricePerHour = Number(f.pricePerHour);
    if (!body.fuelDisplay) delete body.fuelDisplay;
    ['_id', '__v', 'createdAt', 'updatedAt', 'images', 'slug', 'rating', 'reviewCount', 'bookingCount', 'currentlyBooked', 'availabilityLabel', 'ecoScore'].forEach((k) => delete body[k]);
    try {
      const res = editing ? await carApi.update(vehicle._id, body) : await carApi.create(body);
      if (files.length) await carApi.addImages(res.vehicle._id, files);
      toast.success(editing ? 'Vehicle updated.' : 'Vehicle added.');
      onSaved();
    } catch (err) { setErrors(fieldErrors(err)); toast.error(errMsg(err)); } finally { setBusy(false); }
  };

  const removeImage = async (url) => {
    try { const r = await carApi.removeImage(vehicle._id, url); setImages(r.vehicle.images); } catch (e) { toast.error(errMsg(e)); }
  };

  return (
    <Modal title={editing ? `Edit ${vehicle.name}` : 'Add vehicle'} onClose={onClose} large>
      <Notice kind="info">SSB CAR RENTALS charges no security deposit — there is no deposit field to set here.</Notice>
      <div className="grid grid-3 mt-2">
        <Field label="Vehicle name" error={errors.name}><input className={`input ${errors.name ? 'invalid' : ''}`} value={f.name} onChange={set('name')} placeholder="Maruti Suzuki Ertiga" /></Field>
        <Field label="Brand" error={errors.brand}><input className={`input ${errors.brand ? 'invalid' : ''}`} value={f.brand} onChange={set('brand')} /></Field>
        <Field label="Model" error={errors.model}><input className={`input ${errors.model ? 'invalid' : ''}`} value={f.model} onChange={set('model')} /></Field>
        <Field label="Variant"><input className="input" value={f.variant} onChange={set('variant')} /></Field>
        <Field label="Body type"><select className="input" value={f.bodyType} onChange={set('bodyType')}>{VEHICLE_TYPES.map((x) => <option key={x}>{x}</option>)}</select></Field>
        <Field label="Fuel"><select className="input" value={f.fuel} onChange={set('fuel')}>{FUELS.map((x) => <option key={x}>{x}</option>)}</select></Field>
        <Field label="Fuel label (optional)" hint="e.g. “Petrol / CNG”"><input className="input" value={f.fuelDisplay || ''} onChange={set('fuelDisplay')} /></Field>
        <Field label="Transmission"><select className="input" value={f.transmission} onChange={set('transmission')}>{TRANSMISSIONS.map((x) => <option key={x}>{x}</option>)}</select></Field>
        <Field label="Seating capacity" error={errors.seats}><input className={`input ${errors.seats ? 'invalid' : ''}`} type="number" min="2" value={f.seats} onChange={set('seats')} /></Field>
        <Field label="Price per day (₹)" error={errors.pricePerDay}><input className={`input ${errors.pricePerDay ? 'invalid' : ''}`} type="number" min="0" value={f.pricePerDay} onChange={set('pricePerDay')} /></Field>
        <Field label="Price per hour (₹)" error={errors.pricePerHour} hint="Blank = auto (≈ 10% of daily)"><input className={`input ${errors.pricePerHour ? 'invalid' : ''}`} type="number" min="0" value={f.pricePerHour ?? ''} onChange={set('pricePerHour')} /></Field>
        <Field label="Registration year" error={errors.registrationYear}><input className="input" type="number" value={f.registrationYear} onChange={set('registrationYear')} /></Field>
        <Field label="Mileage"><input className="input" value={f.mileage} onChange={set('mileage')} placeholder="≈ 20 km/l" /></Field>
        <Field label="Location"><select className="input" value={f.location} onChange={set('location')}>{LOCATIONS.map((x) => <option key={x}>{x}</option>)}</select></Field>
        <Field label="Status"><select className="input" value={f.status} onChange={set('status')}>{['Active', 'Maintenance', 'Retired'].map((x) => <option key={x}>{x}</option>)}</select></Field>
        <label className="check" style={{ alignSelf: 'end', paddingBottom: 12 }}><input type="checkbox" checked={f.availability} onChange={set('availability')} /> Available for booking</label>
      </div>
      <Field label="Features (comma separated)" className="mt-2"><textarea className="input" value={f.features} onChange={set('features')} placeholder="Air conditioning, Bluetooth, Dual airbags" /></Field>
      <Field label="Description" className="mt-2"><textarea className="input" value={f.description} onChange={set('description')} /></Field>

      <div className="mt-2">
        <span className="label">Images</span>
        <div className="row-wrap mt-1">
          {images.map((u) => <div className="extra" key={u}><img src={assetUrl(u)} alt="" /><button className="slot-x" onClick={() => removeImage(u)} aria-label="Delete image"><X size={14} /></button></div>)}
          {files.map((x, i) => <div className="extra" key={i}><img src={URL.createObjectURL(x)} alt="" /><button className="slot-x" onClick={() => setFiles(files.filter((_, j) => j !== i))} aria-label="Remove"><X size={14} /></button></div>)}
          <label className="btn btn-outline btn-sm"><Upload size={14} /> Add images<input type="file" hidden multiple accept="image/jpeg,image/png,image/webp" onChange={(e) => { setFiles([...files, ...Array.from(e.target.files)].slice(0, 8)); e.target.value = ''; }} /></label>
        </div>
        <span className="hint">JPG, PNG or WebP, up to 5 MB each. Without photos, a car illustration is shown.</span>
      </div>
      <div className="form-actions"><Btn loading={busy} onClick={save}>{editing ? 'Save changes' : 'Add vehicle'}</Btn><button className="btn btn-ghost" onClick={onClose}>Cancel</button></div>
    </Modal>
  );
}

export default function AdminVehicles() {
  const toast = useToast();
  const { data, loading, error, reload } = useAsync(() => carApi.list({ sort: 'price-asc' }), []);
  const [form, setForm] = useState(null); // null | 'new' | vehicle
  const [del, setDel] = useState(null);
  const [busy, setBusy] = useState(false);

  const toggle = async (v) => { try { await carApi.update(v._id, { availability: !v.availability }); toast.success(`${v.name} ${v.availability ? 'marked unavailable' : 'is available again'}.`); reload(true); } catch (e) { toast.error(errMsg(e)); } };
  const remove = async () => { setBusy(true); try { const r = await carApi.remove(del._id); toast.success(r.message); setDel(null); reload(true); } catch (e) { toast.error(errMsg(e)); setDel(null); } finally { setBusy(false); } };

  return (
    <div className="stack">
      <div className="row-wrap between"><div><span className="eyebrow">Fleet</span><h1 style={{ fontSize: '2.4rem', marginBottom: 0 }}>Vehicles</h1></div><button className="btn btn-gold" onClick={() => setForm('new')}><Plus size={17} /> Add vehicle</button></div>
      {loading && <Loader />}{error && <ErrorState message={error} onRetry={reload} />}
      {data && (
        <div className="table-wrap"><table className="rtable"><thead><tr><th>Vehicle</th><th>Fuel</th><th>Seats</th><th>Price/day</th><th>Location</th><th>Availability</th><th>Status</th><th /></tr></thead><tbody>
          {data.vehicles.map((v) => (
            <tr key={v._id}>
              <td data-label="Vehicle"><div className="row"><div className="wl-thumb"><CarImage car={v} /></div><div><b>{v.name}</b><br /><small className="muted">{v.variant} · {v.transmission}</small></div></div></td>
              <td data-label="Fuel">{v.fuelDisplay}</td><td data-label="Seats">{v.seats}</td><td data-label="Price/day">{inr(v.pricePerDay)}<br /><small className="muted">{inr(v.pricePerHour)}/hr</small></td>
              <td data-label="Location">{v.location}</td><td data-label="Availability"><StatusBadge status={v.availabilityLabel} /></td><td data-label="Status"><StatusBadge status={v.status === 'Active' ? 'Active_vehicle' : v.status}>{v.status}</StatusBadge></td>
              <td data-label=""><div className="actions">
                <button className="btn btn-outline btn-sm" onClick={() => setForm(v)}><Pencil size={14} /> Edit</button>
                <button className="btn btn-ghost btn-sm" onClick={() => toggle(v)} title="Toggle availability"><Power size={14} /> {v.availability ? 'Disable' : 'Enable'}</button>
                <button className="btn btn-danger btn-sm" onClick={() => setDel(v)}><Trash2 size={14} /></button>
              </div></td>
            </tr>))}</tbody></table></div>
      )}
      <Notice kind="info">Vehicles that were removed from the SSB inventory are blocked and cannot be re-added.</Notice>
      {form && <VehicleForm vehicle={form === 'new' ? null : form} onClose={() => setForm(null)} onSaved={() => { setForm(null); reload(true); }} />}
      {del && <ConfirmModal title={`Delete ${del.name}?`} danger confirmLabel="Delete vehicle" loading={busy} onConfirm={remove} onClose={() => setDel(null)}>Vehicles with booking history are retired (hidden) instead of erased. Vehicles with upcoming bookings can't be deleted.</ConfirmModal>}
    </div>
  );
}
