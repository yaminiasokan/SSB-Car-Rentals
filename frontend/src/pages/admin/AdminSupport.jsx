import { useState } from 'react';
import { Send, Siren } from 'lucide-react';
import { Btn, ErrorState, Loader, Modal, Plate, StatusBadge } from '../../components/ui';
import useAsync from '../../hooks/useAsync';
import { useToast } from '../../context/ToastContext';
import { supportApi, errMsg } from '../../services/api';
import { fmtDateTime } from '../../utils/format';

function Thread({ ticket, onClose, onChanged }) {
  const toast = useToast();
  const [t, setT] = useState(ticket);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const update = async (b) => { try { const r = await supportApi.adminUpdate(t._id, b); setT({ ...t, ...r.ticket, user: t.user }); onChanged(); toast.success('Ticket updated.'); } catch (e) { toast.error(errMsg(e)); } };
  const reply = async () => {
    if (msg.trim().length < 2) return;
    setBusy(true);
    try { const r = await supportApi.reply(t._id, msg.trim()); setT({ ...t, ...r.ticket, user: t.user }); setMsg(''); onChanged(); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  return (
    <Modal title={t.subject} onClose={onClose} large>
      <div className="row-wrap between"><Plate>{t.ticketNo}</Plate><div className="row"><StatusBadge status={t.priority} /><StatusBadge status={t.status} /></div></div>
      <p className="muted mt-1">{t.user?.name} · <a href={`tel:${t.user?.phone}`}>{t.user?.phone}</a> · {t.category}{t.location ? ` · ${t.location}` : ''}</p>
      <div className="stack">
        <div className="bubble me"><small>{t.user?.name} · {fmtDateTime(t.createdAt)}</small>{t.message}</div>
        {t.replies.map((r, i) => <div key={i} className={`bubble ${r.role === 'customer' ? 'me' : 'them'}`}><small>{r.name} ({r.role}) · {fmtDateTime(r.at)}</small>{r.message}</div>)}
      </div>
      <div className="row mt-2"><input className="input" value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Reply to customer…" onKeyDown={(e) => e.key === 'Enter' && reply()} /><Btn loading={busy} onClick={reply} icon={Send}>Reply</Btn></div>
      <div className="row-wrap mt-2">
        <select className="input" style={{ maxWidth: 170 }} value={t.status} onChange={(e) => update({ status: e.target.value })} aria-label="Status">{['Open', 'In Progress', 'Resolved', 'Closed'].map((s) => <option key={s}>{s}</option>)}</select>
        <select className="input" style={{ maxWidth: 150 }} value={t.priority} onChange={(e) => update({ priority: e.target.value })} aria-label="Priority">{['Low', 'Normal', 'High', 'Urgent'].map((s) => <option key={s}>{s}</option>)}</select>
      </div>
    </Modal>
  );
}

export default function AdminSupport() {
  const [status, setStatus] = useState('');
  const { data, loading, error, reload } = useAsync(() => supportApi.adminList(status ? { status } : {}), [status]);
  const [open, setOpen] = useState(null);
  return (
    <div className="stack">
      <div><span className="eyebrow">24x7</span><h1 style={{ fontSize: '2.4rem' }}>Support tickets</h1></div>
      <select className="input" style={{ maxWidth: 220 }} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter"><option value="">All tickets</option>{['Open', 'In Progress', 'Resolved', 'Closed'].map((s) => <option key={s}>{s}</option>)}</select>
      {loading && <Loader />}{error && <ErrorState message={error} onRetry={reload} />}
      {data && (data.tickets.length === 0 ? <p className="muted">No tickets.</p> : (
        <div className="table-wrap"><table className="rtable"><thead><tr><th>Ticket</th><th>Customer</th><th>Subject</th><th>Category</th><th>Priority</th><th>Status</th><th>Created</th><th /></tr></thead><tbody>
          {data.tickets.map((t) => (
            <tr key={t._id}><td data-label="Ticket"><Plate>{t.ticketNo}</Plate></td><td data-label="Customer">{t.user?.name}<br /><small className="muted">{t.user?.phone}</small></td>
              <td data-label="Subject">{t.category === 'Emergency' && <Siren size={14} color="#ea5a52" style={{ display: 'inline', marginRight: 6 }} />}{t.subject}</td><td data-label="Category">{t.category}</td>
              <td data-label="Priority"><StatusBadge status={t.priority} /></td><td data-label="Status"><StatusBadge status={t.status} /></td><td data-label="Created">{fmtDateTime(t.createdAt)}</td>
              <td data-label=""><button className="btn btn-outline btn-sm" onClick={() => setOpen(t)}>Open</button></td></tr>
          ))}</tbody></table></div>
      ))}
      {open && <Thread ticket={open} onClose={() => setOpen(null)} onChanged={() => reload(true)} />}
    </div>
  );
}
