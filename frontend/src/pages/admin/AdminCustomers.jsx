import { useState } from 'react';
import { MessageSquare, UserX, UserCheck, BadgeCheck, Eye } from 'lucide-react';
import { Btn, ErrorState, Field, Loader, Modal, Plate, StatusBadge } from '../../components/ui';
import useAsync from '../../hooks/useAsync';
import useDebounce from '../../hooks/useDebounce';
import { useToast } from '../../context/ToastContext';
import { notificationApi, userApi, errMsg } from '../../services/api';
import { fmtDate, fmtDateTime, inr } from '../../utils/format';

export default function AdminCustomers() {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const q = useDebounce(search, 300);
  const { data, loading, error, reload } = useAsync(() => userApi.list({ role: 'customer', ...(q ? { search: q } : {}) }), [q]);
  const [msgTo, setMsgTo] = useState(null);
  const [msg, setMsg] = useState({ title: '', message: '' });
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState(null);

  const send = async () => {
    if (msg.message.trim().length < 3) { toast.error('Write a message first.'); return; }
    setBusy(true);
    try { const r = await notificationApi.adminMessage({ userId: msgTo._id, title: msg.title.trim() || undefined, message: msg.message.trim() }); toast.success(r.message); setMsgTo(null); setMsg({ title: '', message: '' }); }
    catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  const act = async (fn, ok) => { try { await fn(); toast.success(ok); reload(true); } catch (e) { toast.error(errMsg(e)); } };
  const open = async (u) => { try { setDetail(await userApi.get(u._id)); } catch (e) { toast.error(errMsg(e)); } };

  return (
    <div className="stack">
      <div><span className="eyebrow">People</span><h1 style={{ fontSize: '2.4rem' }}>Customers</h1></div>
      <input className="input" style={{ maxWidth: 340 }} placeholder="Search name, email or phone…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search customers" />
      {loading && <Loader />}{error && <ErrorState message={error} onRetry={reload} />}
      {data && (data.users.length === 0 ? <p className="muted">No customers found.</p> : (
        <div className="table-wrap"><table className="rtable"><thead><tr><th>Customer</th><th>Phone</th><th>Licence</th><th>Bookings</th><th>Points</th><th>Joined</th><th>Status</th><th /></tr></thead><tbody>
          {data.users.map((u) => (
            <tr key={u._id}>
              <td data-label="Customer"><b>{u.name}</b><br /><small className="muted">{u.email}</small></td><td data-label="Phone">{u.phone}</td>
              <td data-label="Licence">{u.license?.number || '—'} {u.license?.verified && <span className="badge b-ok">verified</span>}</td><td data-label="Bookings">{u.bookingCount}</td><td data-label="Points">{u.rewardPoints}</td><td data-label="Joined">{fmtDate(u.createdAt)}</td>
              <td data-label="Status">{u.isActive ? <span className="badge b-ok">Active</span> : <span className="badge b-bad">Deactivated</span>}</td>
              <td data-label=""><div className="actions">
                <button className="btn btn-outline btn-sm" onClick={() => open(u)}><Eye size={14} /></button>
                <button className="btn btn-outline btn-sm" onClick={() => setMsgTo(u)}><MessageSquare size={14} /> Message</button>
                {u.license?.number && <button className="btn btn-ghost btn-sm" onClick={() => act(() => userApi.setLicense(u._id, !u.license.verified), u.license.verified ? 'Licence unverified.' : 'Licence verified.')}><BadgeCheck size={14} /> {u.license.verified ? 'Unverify' : 'Verify'}</button>}
                <button className={`btn btn-sm ${u.isActive ? 'btn-danger' : 'btn-ghost'}`} onClick={() => act(() => userApi.setActive(u._id, !u.isActive), u.isActive ? 'Account deactivated.' : 'Account reactivated.')}>{u.isActive ? <UserX size={14} /> : <UserCheck size={14} />} {u.isActive ? 'Deactivate' : 'Activate'}</button>
              </div></td>
            </tr>))}</tbody></table></div>
      ))}
      {msgTo && (
        <Modal title={`Message ${msgTo.name}`} onClose={() => setMsgTo(null)}>
          <Field label="Title (optional)"><input className="input" value={msg.title} maxLength={100} onChange={(e) => setMsg({ ...msg, title: e.target.value })} placeholder="Message from SSB Car Rentals" /></Field>
          <Field label="Message" className="mt-1"><textarea className="input" value={msg.message} maxLength={500} onChange={(e) => setMsg({ ...msg, message: e.target.value })} /></Field>
          <div className="form-actions"><Btn loading={busy} onClick={send}>Send notification</Btn><button className="btn btn-ghost" onClick={() => setMsgTo(null)}>Cancel</button></div>
        </Modal>
      )}
      {detail && (
        <Modal title={detail.user.name} onClose={() => setDetail(null)} large>
          <dl className="kv"><dt>Email</dt><dd>{detail.user.email}</dd><dt>Phone</dt><dd>{detail.user.phone}</dd><dt>Address</dt><dd>{detail.user.address || '—'}</dd><dt>Licence</dt><dd>{detail.user.license?.number || '—'}{detail.user.license?.expiry ? ` (expires ${fmtDate(detail.user.license.expiry)})` : ''}</dd><dt>Reward points</dt><dd>{detail.user.rewardPoints}</dd></dl>
          <h4 className="mt-2">Recent bookings</h4>
          {detail.bookings.length === 0 ? <p className="muted">None yet.</p> : detail.bookings.map((b) => <div className="mini-row" style={{ cursor: 'default' }} key={b._id}><div><Plate>{b.bookingId}</Plate> <small className="muted">{b.vehicle?.name} · {fmtDateTime(b.pickupAt)} · {inr(b.pricing.total)}</small></div><StatusBadge status={b.status} /></div>)}
        </Modal>
      )}
    </div>
  );
}
