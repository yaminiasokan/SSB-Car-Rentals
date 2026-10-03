import { useState } from 'react';
import { Phone, Mail, MapPin, Clock, Send } from 'lucide-react';
import { Field, PageHeader, Plate } from '../components/ui';
import { COMPANY } from '../utils/constants';

export default function Contact() {
  const [f, setF] = useState({ name: '', phone: '', message: '' });
  const [errors, setErrors] = useState({});
  const set = (k) => (e) => { setF({ ...f, [k]: e.target.value }); setErrors({ ...errors, [k]: undefined }); };

  // Opens the visitor's email app with the message pre-filled (no backend needed for a public contact form).
  const submit = (e) => {
    e.preventDefault();
    const er = {};
    if (f.name.trim().length < 2) er.name = 'Enter your name';
    if (!/^[6-9]\d{9}$/.test(f.phone.trim())) er.phone = 'Enter a valid 10-digit mobile number';
    if (f.message.trim().length < 10) er.message = 'Write a message (at least 10 characters)';
    setErrors(er);
    if (Object.keys(er).length) return;
    const body = `${f.message.trim()}\n\n— ${f.name.trim()}, ${f.phone.trim()}`;
    window.location.href = `mailto:${COMPANY.email}?subject=${encodeURIComponent('Enquiry from ' + f.name.trim())}&body=${encodeURIComponent(body)}`;
  };

  return (
    <>
      <PageHeader eyebrow="Get in touch" title="Contact us">Call any time — we're available 24x7.</PageHeader>
      <div className="container section-tight">
        <div className="grid grid-2" style={{ alignItems: 'start' }}>
          <div className="stack">
            <div className="card card-gold stack">
              <h3>SSB CAR RENTALS</h3>
              <div className="row"><Clock className="gold" /><span>Availability: <strong>24x7</strong></span></div>
              <div className="row"><Phone className="gold" /><a href={`tel:${COMPANY.phone}`}><Plate>{COMPANY.phone}</Plate></a></div>
              <div className="row"><Mail className="gold" /><a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a></div>
              <div className="row"><MapPin className="gold" /><span>{COMPANY.locations.join(' · ')}</span></div>
              <div className="muted">CEO: {COMPANY.ceo}</div>
            </div>
            <div className="grid grid-2">{COMPANY.locations.map((l) => <div className="card" key={l}><MapPin className="gold" size={22} /><h4 style={{ marginTop: 8 }}>{l}</h4><small className="muted">Pickup &amp; return point</small></div>)}</div>
          </div>
          <form className="card stack" onSubmit={submit} noValidate>
            <h3>Send us a message</h3>
            <Field label="Your name" error={errors.name}><input className={`input ${errors.name ? 'invalid' : ''}`} value={f.name} onChange={set('name')} /></Field>
            <Field label="Mobile number" error={errors.phone}><input className={`input ${errors.phone ? 'invalid' : ''}`} value={f.phone} onChange={set('phone')} maxLength={10} inputMode="tel" /></Field>
            <Field label="Message" error={errors.message}><textarea className={`input ${errors.message ? 'invalid' : ''}`} value={f.message} onChange={set('message')} /></Field>
            <button className="btn btn-gold" type="submit"><Send size={16} /> Send message</button>
            <p className="hint">This opens your email app with the message ready to send. For urgent help, please call.</p>
          </form>
        </div>
      </div>
    </>
  );
}
