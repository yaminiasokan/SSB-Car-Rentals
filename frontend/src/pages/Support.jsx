import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Phone, Mail, Ticket, HelpCircle, Siren, Send, Clock } from 'lucide-react';
import { Btn, Field, Notice, PageHeader, StatusBadge, Plate } from '../components/ui';
import useAsync from '../hooks/useAsync';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { bookingApi, supportApi, errMsg, fieldErrors } from '../services/api';
import { COMPANY, FAQ } from '../utils/constants';
import { fmtDateTime } from '../utils/format';

function TicketCard({ t, onChanged }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const send = async () => {
    if (msg.trim().length < 2) return;
    setBusy(true);
    try { await supportApi.reply(t._id, msg.trim()); setMsg(''); onChanged(); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  return (
    <div className="card">
      <button className="ticket-head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <div style={{ textAlign: 'left' }}><b>{t.subject}</b><br /><small className="muted">{t.ticketNo} · {t.category} · {fmtDateTime(t.createdAt)}</small></div>
        <div className="row"><StatusBadge status={t.priority} /><StatusBadge status={t.status} /></div>
      </button>
      {open && (
        <div className="mt-2 stack">
          <div className="bubble me"><small>You</small>{t.message}</div>
          {t.replies.map((r, i) => <div key={i} className={`bubble ${r.role === 'customer' ? 'me' : 'them'}`}><small>{r.role === 'customer' ? 'You' : `SSB team · ${r.name}`} · {fmtDateTime(r.at)}</small>{r.message}</div>)}
          {t.status !== 'Closed' && <div className="row"><input className="input" value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Write a reply…" maxLength={1000} onKeyDown={(e) => e.key === 'Enter' && send()} /><Btn loading={busy} onClick={send} icon={Send} className="btn-gold btn-sm">Send</Btn></div>}
        </div>
      )}
    </div>
  );
}

export default function Support() {
  const { user } = useAuth();
  const toast = useToast();
  const { hash } = useLocation();
  const tickets = useAsync(() => (user ? supportApi.mine() : Promise.resolve({ tickets: [] })), [user?._id]);
  const bookings = useAsync(() => (user ? bookingApi.mine() : Promise.resolve({ bookings: [] })), [user?._id]);
  const [f, setF] = useState({ subject: '', category: 'General', bookingId: '', message: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState(null);

  useEffect(() => { document.title = 'Support — SSB CAR RENTALS'; }, []);
  useEffect(() => { if (hash) setTimeout(() => document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100); }, [hash]);

  const set = (k) => (e) => { setF({ ...f, [k]: e.target.value }); setErrors({ ...errors, [k]: undefined }); };
  const submit = async (e) => {
    e.preventDefault();
    const er = {};
    if (f.subject.trim().length < 4) er.subject = 'Enter a subject (at least 4 characters)';
    if (f.message.trim().length < 10) er.message = 'Describe the issue (at least 10 characters)';
    setErrors(er);
    if (Object.keys(er).length) return;
    setBusy(true);
    try {
      const r = await supportApi.create({ subject: f.subject.trim(), category: f.category, message: f.message.trim(), bookingId: f.bookingId || undefined });
      setCreated(r.ticket); setF({ subject: '', category: 'General', bookingId: '', message: '' }); tickets.reload(true); toast.success('Ticket created.');
    } catch (x) { setErrors(fieldErrors(x)); toast.error(errMsg(x)); } finally { setBusy(false); }
  };

  return (
    <>
      <PageHeader eyebrow="We're here" title="24x7 Customer Support">Day or night, a real person is on the line.</PageHeader>
      <div className="container section-tight">
        <div className="grid grid-4 support-actions">
          <a className="card card-hover support-tile" href={`tel:${COMPANY.phone}`}><Phone size={28} className="gold" /><b>Call</b><Plate>{COMPANY.phone}</Plate></a>
          <a className="card card-hover support-tile" href={`mailto:${COMPANY.email}`}><Mail size={28} className="gold" /><b>Email</b><small className="muted" style={{ wordBreak: 'break-all' }}>{COMPANY.email}</small></a>
          <a className="card card-hover support-tile" href="#ticket"><Ticket size={28} className="gold" /><b>Create ticket</b><small className="muted">Track replies in your account</small></a>
          <a className="card card-hover support-tile" href="#faq"><HelpCircle size={28} className="gold" /><b>FAQ</b><small className="muted">Quick answers</small></a>
        </div>

        <div className="notice notice-bad mt-3"><Siren size={22} /><div><strong>Emergency during a rental?</strong> Open <Link to="/track-rental" className="gold">Track rental</Link> and tap <em>Emergency assistance</em> (roadside help, accident assistance, towing), or call <a href={`tel:${COMPANY.phone}`} className="gold">{COMPANY.phone}</a> right away.</div></div>

        <div className="grid grid-2 mt-3" id="ticket" style={{ alignItems: 'start' }}>
          <div className="card card-gold">
            <h3>Create a support ticket</h3>
            {!user ? <Notice kind="info">Please <Link to="/login" state={{ from: '/support#ticket' }} className="gold">sign in</Link> to create a ticket and follow the conversation.</Notice> : created ? (
              <div className="stack"><Notice kind="ok">Ticket <strong>{created.ticketNo}</strong> created. We'll reply as soon as possible.</Notice><button className="btn btn-outline" onClick={() => setCreated(null)}>Create another</button></div>
            ) : (
              <form onSubmit={submit} noValidate className="stack">
                <Field label="Subject" error={errors.subject}><input className={`input ${errors.subject ? 'invalid' : ''}`} value={f.subject} onChange={set('subject')} maxLength={140} /></Field>
                <div className="grid grid-2">
                  <Field label="Category"><select className="input" value={f.category} onChange={set('category')}>{['General', 'Booking', 'Payment', 'Vehicle', 'Damage'].map((c) => <option key={c}>{c}</option>)}</select></Field>
                  <Field label="Related booking (optional)"><select className="input" value={f.bookingId} onChange={set('bookingId')}><option value="">None</option>{(bookings.data?.bookings || []).map((b) => <option key={b._id} value={b._id}>{b.bookingId} — {b.vehicle?.name}</option>)}</select></Field>
                </div>
                <Field label="How can we help?" error={errors.message}><textarea className={`input ${errors.message ? 'invalid' : ''}`} value={f.message} onChange={set('message')} maxLength={2000} /></Field>
                <Btn type="submit" loading={busy} icon={Send}>Submit ticket</Btn>
              </form>
            )}
          </div>
          <div className="stack">
            <h3 style={{ margin: 0 }}>Your tickets</h3>
            {!user && <p className="muted">Sign in to see your tickets.</p>}
            {user && tickets.data?.tickets.length === 0 && <p className="muted">No tickets yet.</p>}
            {tickets.data?.tickets.map((t) => <TicketCard key={t._id} t={t} onChanged={() => tickets.reload(true)} />)}
          </div>
        </div>

        <div id="faq" className="mt-3">
          <div className="section-head"><span className="eyebrow">FAQ</span><h2>Common questions</h2></div>
          <div className="faq">{FAQ.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}</div>
        </div>
        <p className="center muted mt-3"><Clock size={14} /> Support hours: 24 hours, 7 days a week.</p>
      </div>
    </>
  );
}
