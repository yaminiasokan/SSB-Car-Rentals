import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, Check, Play, Flag, XCircle, ScanSearch, Banknote } from 'lucide-react';
import { Btn, ConfirmModal, ErrorState, Field, Loader, Modal, Plate, StatusBadge } from '../../components/ui';
import PriceBreakdown from '../../components/PriceBreakdown';
import useAsync from '../../hooks/useAsync';
import useDebounce from '../../hooks/useDebounce';
import { useToast } from '../../context/ToastContext';
import { adminApi, paymentApi, errMsg } from '../../services/api';
import { fmtDateTime, inr } from '../../utils/format';

const NEXT = { Pending: [['Confirmed', 'Approve', Check]], Confirmed: [['Active', 'Mark picked up', Play]], Active: [['Completed', 'Mark returned', Flag]] };

function Detail({ id, onClose, onChanged }) {
  const toast = useToast();
  const { data, loading, error, reload } = useAsync(() => adminApi.booking(id), [id]);
  const collect = async (pid) => { try { await paymentApi.collect(pid); toast.success('Cash payment recorded.'); reload(true); onChanged(); } catch (e) { toast.error(errMsg(e)); } };
  return (
    <Modal title="Booking details" onClose={onClose} large>
      {loading && <Loader />}{error && <ErrorState message={error} onRetry={reload} />}
      {data && (() => {
        const { booking: b, payments, inspections, damageReport, agreement } = data;
        const has = (t) => inspections.find((i) => i.type === t);
        return (
          <div className="stack">
            <div className="row-wrap between"><Plate large>{b.bookingId}</Plate><div className="row"><StatusBadge status={b.status} /><StatusBadge status={b.paymentStatus} /></div></div>
            <div className="grid grid-2">
              <div className="card"><h4>Customer</h4><dl className="kv" style={{ gridTemplateColumns: '90px 1fr' }}><dt>Name</dt><dd>{b.customer.name}</dd><dt>Phone</dt><dd><a href={`tel:${b.customer.phone}`}>{b.customer.phone}</a></dd><dt>Email</dt><dd>{b.customer.email}</dd><dt>Licence</dt><dd>{b.customer.licenseNumber} {b.user?.license?.verified && <span className="badge b-ok">verified</span>}</dd><dt>Address</dt><dd>{b.customer.address}</dd></dl></div>
              <div className="card"><h4>Trip</h4><dl className="kv" style={{ gridTemplateColumns: '90px 1fr' }}><dt>Vehicle</dt><dd>{b.vehicle.name} · {b.vehicle.fuelDisplay}</dd><dt>Pickup</dt><dd>{b.pickupLocation} — {fmtDateTime(b.pickupAt)}</dd><dt>Return</dt><dd>{b.returnLocation} — {fmtDateTime(b.returnAt)}</dd><dt>Extras</dt><dd>{b.pricing.serviceLines?.map((s) => s.label).join(', ') || 'None'}</dd></dl></div>
            </div>
            <div className="grid grid-2">
              <div className="card"><h4>Payment details</h4>
                {payments.length === 0 ? <p className="muted">No payments.</p> : payments.map((p) => (
                  <div className="mini-row" key={p._id} style={{ cursor: 'default' }}><div><b>{inr(p.amount)}</b> · {p.method} <small className="muted">({p.kind})</small><small className="muted">{p.receiptNo || '—'} · {p.transactionId}</small>{p.failureReason && <small className="err">{p.failureReason}</small>}</div>
                    <div className="row"><StatusBadge status={p.status} />{p.method === 'Cash on Pickup' && p.status === 'Pending' && <button className="btn btn-gold btn-sm" onClick={() => collect(p._id)}><Banknote size={14} /> Collected</button>}</div></div>))}
              </div>
              <div className="card"><h4>Inspection reports</h4>
                <div className="row-wrap"><span className={`badge ${has('before') ? 'b-ok' : ''}`}>Before {has('before') ? '✓' : '—'}</span><span className={`badge ${has('after') ? 'b-ok' : ''}`}>After {has('after') ? '✓' : '—'}</span>{agreement && <span className={`badge ${agreement.acknowledgedAt ? 'b-ok' : 'b-warn'}`}>Agreement {agreement.acknowledgedAt ? 'accepted' : 'pending'}</span>}</div>
                <div className="row-wrap mt-2"><Link className="btn btn-outline btn-sm" to={`/auto-inspect/${b._id}`}><ScanSearch size={14} /> Open AutoInspect</Link>{damageReport && <Link className="btn btn-gold btn-sm" to={`/admin/damage-reports/${damageReport._id}`}>Damage report {damageReport.reportId}</Link>}</div>
              </div>
            </div>
            <div className="card"><h4>Price breakdown</h4><PriceBreakdown pricing={b.pricing} /></div>
            <div className="card"><h4>History</h4>{b.statusHistory.map((h, i) => <div className="mini-row" style={{ cursor: 'default' }} key={i}><div><b>{h.status}</b><small className="muted">{h.by}{h.note ? ` — ${h.note}` : ''}</small></div><small className="muted">{fmtDateTime(h.at)}</small></div>)}</div>
          </div>
        );
      })()}
    </Modal>
  );
}

export default function AdminBookings() {
  const toast = useToast();
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const q = useDebounce(search, 300);
  const { data, loading, error, reload } = useAsync(() => adminApi.bookings({ ...(status ? { status } : {}), ...(q ? { search: q } : {}) }), [status, q]);
  const [view, setView] = useState(null);
  const [cancel, setCancel] = useState(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const move = async (b, next) => { try { await adminApi.setStatus(b._id, next); toast.success(`${b.bookingId} is now ${next.toLowerCase()}.`); reload(true); } catch (e) { toast.error(errMsg(e)); } };
  const doCancel = async () => { setBusy(true); try { await adminApi.cancel(cancel._id, reason || undefined); toast.success('Booking cancelled and refund (if any) issued.'); setCancel(null); setReason(''); reload(true); } catch (e) { toast.error(errMsg(e)); setCancel(null); } finally { setBusy(false); } };

  return (
    <div className="stack">
      <div><span className="eyebrow">Operations</span><h1 style={{ fontSize: '2.4rem' }}>Bookings</h1></div>
      <div className="row-wrap">
        <input className="input" style={{ maxWidth: 320 }} placeholder="Search ID, name or phone…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search bookings" />
        <select className="input" style={{ maxWidth: 200 }} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status"><option value="">All statuses</option>{['Pending', 'Confirmed', 'Active', 'Completed', 'Cancelled'].map((s) => <option key={s}>{s}</option>)}</select>
      </div>
      {loading && <Loader />}{error && <ErrorState message={error} onRetry={reload} />}
      {data && (data.bookings.length === 0 ? <p className="muted">No bookings match.</p> : (
        <div className="table-wrap"><table className="rtable"><thead><tr><th>Booking</th><th>Customer</th><th>Vehicle</th><th>Pickup</th><th>Return</th><th>Amount</th><th>Payment</th><th>Status</th><th /></tr></thead><tbody>
          {data.bookings.map((b) => (
            <tr key={b._id}>
              <td data-label="Booking"><Plate>{b.bookingId}</Plate></td><td data-label="Customer">{b.customer.name}<br /><small className="muted">{b.customer.phone}</small></td><td data-label="Vehicle">{b.vehicle?.name}</td>
              <td data-label="Pickup">{b.pickupLocation}<br /><small className="muted">{fmtDateTime(b.pickupAt)}</small></td><td data-label="Return">{b.returnLocation}<br /><small className="muted">{fmtDateTime(b.returnAt)}</small></td>
              <td data-label="Amount">{inr(b.pricing.total)}</td><td data-label="Payment"><StatusBadge status={b.paymentStatus} /></td><td data-label="Status"><StatusBadge status={b.status} /></td>
              <td data-label=""><div className="actions">
                <button className="btn btn-outline btn-sm" onClick={() => setView(b._id)}><Eye size={14} /> View</button>
                {(NEXT[b.status] || []).map(([s, label, Icon]) => <button key={s} className="btn btn-gold btn-sm" onClick={() => move(b, s)}><Icon size={14} /> {label}</button>)}
                {['Pending', 'Confirmed'].includes(b.status) && <button className="btn btn-danger btn-sm" onClick={() => setCancel(b)}><XCircle size={14} /> Cancel</button>}
              </div></td>
            </tr>))}</tbody></table></div>
      ))}
      {view && <Detail id={view} onClose={() => setView(null)} onChanged={() => reload(true)} />}
      {cancel && (
        <ConfirmModal title={`Cancel ${cancel.bookingId}?`} danger confirmLabel="Cancel booking" loading={busy} onConfirm={doCancel} onClose={() => setCancel(null)}>
          Cancelling as staff gives the customer a <strong>full refund</strong> of the rental amount if they paid online.
          <Field label="Reason (shown to customer)" className="mt-1"><input className="input" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} /></Field>
        </ConfirmModal>
      )}
    </div>
  );
}
