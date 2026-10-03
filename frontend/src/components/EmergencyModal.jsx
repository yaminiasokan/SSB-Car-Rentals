import { useState } from 'react';
import { Wrench, CarFront, Truck, Headset, Phone, LocateFixed } from 'lucide-react';
import { Modal, Btn, Field, Notice, Plate } from './ui';
import { supportApi, errMsg } from '../services/api';
import { useToast } from '../context/ToastContext';
import { COMPANY } from '../utils/constants';

const OPTIONS = [
  ['Roadside assistance', Wrench, 'Flat tyre, battery, fuel or a minor breakdown'],
  ['Accident assistance', CarFront, 'Collision or damage — we guide you step by step'],
  ['Towing', Truck, 'Vehicle cannot be driven'],
  ['Customer support', Headset, 'Anything else during your rental'],
];

export default function EmergencyModal({ booking, onClose }) {
  const toast = useToast();
  const [type, setType] = useState('');
  const [location, setLocation] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [ticket, setTicket] = useState(null);

  const locate = () => {
    if (!navigator.geolocation) { toast.error('Location is not available on this device. Please type where you are.'); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => setLocation(`GPS ${p.coords.latitude.toFixed(5)}, ${p.coords.longitude.toFixed(5)}`),
      () => toast.error('Could not read your location. Please type where you are.'), { timeout: 8000 });
  };

  const submit = async () => {
    if (!type) { setError('Choose the type of help you need.'); return; }
    setBusy(true); setError('');
    try { setTicket((await supportApi.emergency({ bookingId: booking._id, emergencyType: type, location, message })).ticket); }
    catch (e) { setError(errMsg(e)); } finally { setBusy(false); }
  };

  return (
    <Modal title="Emergency assistance" onClose={onClose}>
      {ticket ? (
        <div className="stack">
          <Notice kind="ok"><strong>Help is on the way.</strong> Our 24x7 team has been alerted and will call you shortly.</Notice>
          <div>Emergency ticket: <Plate>{ticket.ticketNo}</Plate></div>
          <a className="btn btn-gold btn-block" href={`tel:${COMPANY.phone}`}><Phone size={17} /> Call {COMPANY.phone} now</a>
          <button className="btn btn-ghost btn-block" onClick={onClose}>Close</button>
        </div>
      ) : (
        <div className="stack">
          <Notice kind="bad" icon={Phone}>In danger or injured? Call local emergency services first (112), then us on <a href={`tel:${COMPANY.phone}`}><strong>{COMPANY.phone}</strong></a>.</Notice>
          <div className="opt-grid">
            {OPTIONS.map(([label, Icon, sub]) => (
              <button type="button" key={label} className={`opt ${type === label ? 'on' : ''}`} onClick={() => { setType(label); setError(''); }} aria-pressed={type === label}>
                <Icon size={22} /><b>{label}</b><small>{sub}</small>
              </button>
            ))}
          </div>
          <Field label="Where are you?" hint="A landmark or road name helps us reach you faster.">
            <div className="row"><input className="input" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. NH 544 near Avinashi" /><button type="button" className="btn btn-ghost btn-icon" onClick={locate} aria-label="Use my current location"><LocateFixed size={18} /></button></div>
          </Field>
          <Field label="Details (optional)"><textarea className="input" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={500} /></Field>
          {error && <Notice kind="bad">{error}</Notice>}
          <Btn loading={busy} onClick={submit} className="btn-gold btn-block">Request help</Btn>
        </div>
      )}
    </Modal>
  );
}
