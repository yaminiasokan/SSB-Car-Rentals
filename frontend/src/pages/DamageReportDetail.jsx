import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ScanSearch, ShieldAlert, Gavel, CreditCard, MessageSquareWarning, ArrowLeft, Info } from 'lucide-react';
import ImageCompare from '../components/ImageCompare';
import PaymentForm from '../components/PaymentForm';
import { Btn, ConfirmModal, Empty, ErrorState, Field, Loader, Modal, Notice, Plate, StatusBadge, Stepper } from '../components/ui';
import useAsync from '../hooks/useAsync';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { damageApi, paymentApi, errMsg } from '../services/api';
import { AI_DISCLAIMER, slotLabel } from '../utils/constants';
import { fmtDateTime, inr, pct } from '../utils/format';

const FLOW = ['AI detection', 'Damage report', 'Admin verification', 'Customer notification', 'Final decision', 'Payment / dispute'];
const FLOW_POS = { 'Pending Review': 2, Confirmed: 5, 'Customer Disputed': 4, Resolved: 6, Rejected: 6 };

export default function DamageReportDetail({ admin = false }) {
  const { id } = useParams();
  const { user, isAdmin } = useAuth();
  const toast = useToast();
  const { data, loading, error, reload } = useAsync(() => damageApi.get(id), [id]);
  const [slot, setSlot] = useState('');
  const [hl, setHl] = useState(null);
  const [edits, setEdits] = useState(null);
  const [comments, setComments] = useState('');
  const [finalAmount, setFinalAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [payOpen, setPayOpen] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [disputeMsg, setDisputeMsg] = useState('');
  const [resolve, setResolve] = useState({ outcome: 'upheld', finalAmount: '', note: '' });

  const report = data?.report;
  const slots = useMemo(() => {
    if (!report) return [];
    const after = report.afterInspection?.images.filter((i) => i.slot !== 'extra').map((i) => i.slot) || [];
    const withDamage = [...new Set(report.damages.map((d) => d.slot))];
    return [...withDamage.filter((s) => after.includes(s)), ...after.filter((s) => !withDamage.includes(s))];
  }, [report]);

  if (loading) return <Loader label="Loading damage report…" />;
  if (error) return <div className="container section"><ErrorState message={error} onRetry={reload} /></div>;

  const activeSlot = slot || slots[0];
  const isOwner = String(report.customer._id) === String(user._id);
  const reviewing = isAdmin && report.status === 'Pending Review';
  const ed = edits || Object.fromEntries(report.damages.map((d) => [d._id, { decision: d.decision === 'pending' ? 'confirmed' : d.decision, severity: d.severity, min: d.estimatedRepairCost.min, max: d.estimatedRepairCost.max, note: d.note || '' }]));
  const setEd = (did, p) => setEdits({ ...ed, [did]: { ...ed[did], ...p } });
  const suggested = Object.values(ed).filter((e) => e.decision === 'confirmed').reduce((s, e) => s + Math.round((Number(e.min) + Number(e.max)) / 2 / 100) * 100, 0);
  const shownFinal = finalAmount === '' ? suggested : Number(finalAmount);

  const wrap = async (fn, msg) => { setBusy(true); try { await fn(); toast.success(msg); setConfirm(null); await reload(true); } catch (e) { toast.error(errMsg(e)); setConfirm(null); } finally { setBusy(false); } };

  const submitReview = (decision) => wrap(() => damageApi.review(id, {
    decision, comments,
    finalAmount: decision === 'confirm' ? shownFinal : undefined,
    damages: report.damages.map((d) => ({ id: d._id, decision: ed[d._id].decision, severity: ed[d._id].severity, min: Number(ed[d._id].min), max: Number(ed[d._id].max), note: ed[d._id].note })),
  }), decision === 'confirm' ? 'Report confirmed and customer notified.' : 'AI detection rejected. Nothing will be charged.');

  const submitResolve = () => wrap(() => damageApi.resolve(id, { outcome: resolve.outcome, note: resolve.note, finalAmount: resolve.outcome === 'adjusted' ? Number(resolve.finalAmount) : undefined }), 'Decision recorded and customer notified.');
  const submitDispute = () => { if (disputeMsg.trim().length < 10) { toast.error('Please explain why you disagree (at least 10 characters).'); return; } wrap(async () => { await damageApi.dispute(id, disputeMsg.trim()); setDisputeOpen(false); }, 'Dispute submitted. SSB will review it.'); };
  const doPay = async (method, details, screenshotFile) => {
    const res = await damageApi.pay(id, { method, details });
    if (screenshotFile) await paymentApi.uploadScreenshot(res.payment._id, screenshotFile);
    setPayOpen(false); toast.success('Payment received. Thank you.'); reload(true);
  };

  const before = report.beforeInspection?.images.find((i) => i.slot === activeSlot);
  const after = report.afterInspection?.images.find((i) => i.slot === activeSlot);
  const backTo = admin ? '/admin/damage-reports' : isAdmin || user.role === 'staff' ? '/damage-reports' : '/dashboard?tab=damage';

  return (
    <div className={admin ? '' : 'container section-tight'}>
      <Link to={backTo} className="muted back-link"><ArrowLeft size={16} /> Damage reports</Link>
      <div className="row-wrap between mb-2">
        <div><span className="eyebrow">AI AutoInspect report</span><h1 style={{ fontSize: 'clamp(1.8rem,4vw,2.8rem)', marginBottom: 8 }}>{report.vehicle.name}</h1>
          <div className="row-wrap"><Plate large>{report.reportId}</Plate><StatusBadge status={report.status} /></div></div>
        <dl className="kv" style={{ gridTemplateColumns: '90px 1fr' }}>
          <dt>Booking</dt><dd><Link className="gold" to={admin ? '/admin/bookings' : `/booking/confirmation/${report.booking._id}`}>{report.booking.bookingId}</Link></dd>
          <dt>Customer</dt><dd>{report.customer.name}</dd><dt>Rental</dt><dd>{fmtDateTime(report.booking.pickupAt)} → {fmtDateTime(report.booking.returnAt)}</dd>
        </dl>
      </div>

      <Notice icon={ShieldAlert}><strong>{AI_DISCLAIMER}</strong> {report.engine?.mock && <>Findings come from the <em>{report.engine.name} ({report.engine.version})</em> — a demo placeholder, not a trained model.</>} No charge is made without staff verification and the customer's opportunity to dispute.</Notice>

      <div className="card mt-2"><h4>Review workflow</h4><Stepper steps={FLOW} current={FLOW_POS[report.status]} />
        {report.status === 'Rejected' && <p className="hint">Rejected by staff — the AI detection was not accepted and nothing is charged.</p>}</div>

      <div className="grid grid-2 mt-2">
        <div className="card card-gold">
          <h3>Summary</h3>
          <dl className="kv" style={{ gridTemplateColumns: '150px 1fr' }}>
            <dt>Vehicle</dt><dd>{report.vehicle.name}</dd>
            <dt>Inspection</dt><dd>After rental</dd>
            <dt>Damage detected</dt><dd><b style={{ color: report.damageDetected ? 'var(--bad)' : 'var(--ok)' }}>{report.damageDetected ? 'YES' : 'NO'}</b></dd>
            <dt>Findings</dt><dd>{report.damages.length}</dd>
            <dt>Proposed charge</dt><dd>{['Confirmed', 'Customer Disputed', 'Resolved'].includes(report.status) ? <b className="gold-text" style={{ fontSize: '1.3rem' }}>{inr(report.finalAmount)}</b> : 'Pending staff verification'}</dd>
          </dl>
        </div>
        <div className="card">
          <h3>Staff review</h3>
          {report.adminReview?.reviewedAt ? <><p className="muted" style={{ marginBottom: 6 }}>Reviewed {fmtDateTime(report.adminReview.reviewedAt)}</p><p style={{ margin: 0 }}>{report.adminReview.comments || 'No comments.'}</p></> : <p className="muted" style={{ margin: 0 }}>Awaiting verification by SSB staff.</p>}
          {report.dispute?.at && <div className="mt-2"><Notice kind="bad" icon={MessageSquareWarning}><strong>Customer dispute:</strong> {report.dispute.message}{report.dispute.adminResponse && <div className="mt-1"><strong>SSB response:</strong> {report.dispute.adminResponse}</div>}</Notice></div>}
          {report.resolution?.outcome && <p className="hint mt-1">Resolution: {report.resolution.outcome}{report.resolution.note ? ` — ${report.resolution.note}` : ''}</p>}
        </div>
      </div>

      <h3 className="mt-3">Before vs after</h3>
      {report.damages.length === 0 && <Notice kind="ok">The comparison found no suspected new damage.</Notice>}
      {slots.length > 0 ? (
        <div className="card mt-1">
          <div className="tabs">{slots.map((s) => <button key={s} className={`tab ${s === activeSlot ? 'active' : ''}`} onClick={() => setSlot(s)}>{slotLabel(s)}{report.damages.some((d) => d.slot === s && d.decision !== 'rejected') ? ' ⚠' : ''}</button>)}</div>
          <ImageCompare slot={activeSlot} before={before} after={after} damages={report.damages} highlight={hl} onHighlight={setHl} />
        </div>
      ) : <Empty icon={ScanSearch} title="No photos to compare" />}

      <h3 className="mt-3">Detected damage</h3>
      {report.damages.length > 0 && (
        <div className="table-wrap"><table className="rtable">
          <thead><tr><th>Damage</th><th>Location</th><th>Severity</th><th>AI confidence</th><th>Estimated repair</th><th>Review</th></tr></thead>
          <tbody>{report.damages.map((d) => {
            const e = ed[d._id];
            return (
              <tr key={d._id} className={hl === d._id ? 'hl-row' : ''} onMouseEnter={() => { setHl(d._id); setSlot(d.slot); }} onMouseLeave={() => setHl(null)}>
                <td data-label="Damage"><b>{d.type}</b><br /><small className="muted">{slotLabel(d.slot)} view</small></td>
                <td data-label="Location">{d.location}</td>
                <td data-label="Severity">{reviewing ? <select className="input" value={e.severity} onChange={(x) => setEd(d._id, { severity: x.target.value })}>{['Minor', 'Moderate', 'Severe'].map((s) => <option key={s}>{s}</option>)}</select> : <StatusBadge status={d.severity} />}</td>
                <td data-label="AI confidence">{pct(d.confidence)}</td>
                <td data-label="Estimated repair">{reviewing ? <div className="row"><input className="input" style={{ width: 92 }} type="number" min="0" value={e.min} onChange={(x) => setEd(d._id, { min: x.target.value })} aria-label="Minimum" /><span>–</span><input className="input" style={{ width: 92 }} type="number" min="0" value={e.max} onChange={(x) => setEd(d._id, { max: x.target.value })} aria-label="Maximum" /></div> : `${inr(d.estimatedRepairCost.min)} – ${inr(d.estimatedRepairCost.max)}`}</td>
                <td data-label="Review">{reviewing ? (
                  <div className="stack" style={{ minWidth: 150 }}>
                    <select className="input" value={e.decision} onChange={(x) => setEd(d._id, { decision: x.target.value })}><option value="confirmed">Confirm damage</option><option value="rejected">Reject detection</option></select>
                    <input className="input" placeholder="Comment" value={e.note} maxLength={300} onChange={(x) => setEd(d._id, { note: x.target.value })} aria-label="Comment" />
                  </div>) : <div><span className={`badge ${d.decision === 'confirmed' ? 'b-bad' : d.decision === 'rejected' ? 'b-info' : 'b-warn'}`}>{d.decision}</span>{d.note && <small className="muted" style={{ display: 'block' }}>{d.note}</small>}</div>}</td>
              </tr>);
          })}</tbody></table></div>
      )}

      {reviewing && (
        <div className="card card-gold mt-2">
          <h3><Gavel size={20} className="gold" /> Admin verification</h3>
          <div className="grid grid-2">
            <Field label="Comments (visible to customer)"><textarea className="input" value={comments} onChange={(e) => setComments(e.target.value)} maxLength={1000} placeholder="What you checked, and why." /></Field>
            <Field label="Final chargeable amount (₹)" hint={`Suggested from confirmed findings: ${inr(suggested)}`}><input className="input" type="number" min="0" value={finalAmount === '' ? suggested : finalAmount} onChange={(e) => setFinalAmount(e.target.value)} /></Field>
          </div>
          <div className="form-actions">
            <Btn loading={busy} onClick={() => setConfirm('confirm')}>Confirm damage report</Btn>
            <Btn loading={busy} className="btn-danger" onClick={() => setConfirm('reject')}>Reject AI detection</Btn>
          </div>
          <p className="hint">Confirming notifies the customer, who can then pay or dispute. Rejecting closes the report with no charge.</p>
        </div>
      )}

      {isAdmin && ['Confirmed', 'Customer Disputed'].includes(report.status) && (
        <div className="card mt-2">
          <h3><Gavel size={20} className="gold" /> Final decision</h3>
          <div className="grid grid-3">
            <Field label="Outcome"><select className="input" value={resolve.outcome} onChange={(e) => setResolve({ ...resolve, outcome: e.target.value })}>
              <option value="upheld">Uphold charge ({inr(report.finalAmount)})</option><option value="adjusted">Adjust amount</option><option value="waived">Waive charge</option><option value="settled">Mark settled offline</option></select></Field>
            {resolve.outcome === 'adjusted' && <Field label="New amount (₹)"><input className="input" type="number" min="0" value={resolve.finalAmount} onChange={(e) => setResolve({ ...resolve, finalAmount: e.target.value })} /></Field>}
            <Field label="Note to customer"><input className="input" value={resolve.note} maxLength={500} onChange={(e) => setResolve({ ...resolve, note: e.target.value })} /></Field>
          </div>
          <Btn loading={busy} onClick={() => { if (resolve.outcome === 'adjusted' && resolve.finalAmount === '') { toast.error('Enter the adjusted amount.'); return; } setConfirm('resolve'); }}>Record decision</Btn>
        </div>
      )}

      {isOwner && report.status === 'Confirmed' && report.finalAmount > 0 && (
        <div className="card card-gold mt-2">
          <h3>Action needed</h3>
          <p>SSB staff verified this report and propose a charge of <strong className="gold-text">{inr(report.finalAmount)}</strong>. Review the photos above, then pay or tell us if you disagree.</p>
          <div className="form-actions">
            <button className="btn btn-gold" onClick={() => setPayOpen(true)}><CreditCard size={17} /> Pay {inr(report.finalAmount)}</button>
            {!report.dispute?.at && <button className="btn btn-danger" onClick={() => setDisputeOpen(true)}><MessageSquareWarning size={17} /> Dispute this charge</button>}
          </div>
        </div>
      )}
      {isOwner && report.status === 'Customer Disputed' && <div className="mt-2"><Notice kind="info" icon={Info}>Your dispute is with the SSB team. We'll notify you of the decision — nothing is charged in the meantime.</Notice></div>}

      {confirm && (
        <ConfirmModal title={confirm === 'confirm' ? 'Confirm this report?' : confirm === 'reject' ? 'Reject the AI detection?' : 'Record this decision?'} danger={confirm === 'reject'} loading={busy}
          confirmLabel={confirm === 'confirm' ? 'Confirm & notify customer' : confirm === 'reject' ? 'Reject' : 'Record'}
          onConfirm={() => (confirm === 'resolve' ? submitResolve() : submitReview(confirm))} onClose={() => setConfirm(null)}>
          {confirm === 'confirm' ? `The customer will be notified of a proposed charge of ${inr(shownFinal)} and can pay or dispute it.` : confirm === 'reject' ? 'All findings will be marked rejected and nothing will be charged.' : 'The customer will be notified of the outcome.'}
        </ConfirmModal>
      )}
      {payOpen && <Modal title={`Pay ${inr(report.finalAmount)}`} onClose={() => setPayOpen(false)}><PaymentForm amount={report.finalAmount} allowCash={false} onPay={doPay} /></Modal>}
      {disputeOpen && (
        <Modal title="Dispute this charge" onClose={() => setDisputeOpen(false)}>
          <Field label="Why do you disagree?"><textarea className="input" value={disputeMsg} onChange={(e) => setDisputeMsg(e.target.value)} maxLength={1000} placeholder="e.g. This mark was already there at pickup." /></Field>
          <div className="form-actions"><Btn loading={busy} onClick={submitDispute}>Submit dispute</Btn><button className="btn btn-ghost" onClick={() => setDisputeOpen(false)}>Cancel</button></div>
        </Modal>
      )}
    </div>
  );
}
