import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Printer, Download, Navigation, ScanSearch, Star, Siren, XCircle, FileText, ClipboardCheck, Wallet } from 'lucide-react';
import PriceBreakdown from '../components/PriceBreakdown';
import EmergencyModal from '../components/EmergencyModal';
import { Btn, ConfirmModal, ErrorState, Loader, Notice, Plate, StatusBadge, Field } from '../components/ui';
import useAsync from '../hooks/useAsync';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { bookingApi, errMsg } from '../services/api';
import { COMPANY } from '../utils/constants';
import { durationLabel, fmtDate, fmtDateTime, inr } from '../utils/format';

function AgreementCard({ booking, isOwner }) {
  const toast = useToast();
  const { data, loading, error, reload, setData } = useAsync(() => bookingApi.agreement(booking._id), [booking._id]);
  const [busy, setBusy] = useState(false);
  const [dl, setDl] = useState(false);
  if (loading) return <div className="card"><Loader label="Preparing agreement…" /></div>;
  if (error) return <div className="card"><ErrorState message={error} onRetry={reload} /></div>;
  const a = data.agreement;

  const ack = async () => {
    setBusy(true);
    try { const r = await bookingApi.acknowledge(booking._id); setData(r); toast.success('Agreement accepted. Thank you!'); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  const download = async () => {
    setDl(true);
    try {
      const blob = await bookingApi.downloadAgreement(booking._id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = url; link.download = `${booking.bookingId}-rental-agreement.pdf`; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (e) { toast.error('The agreement could not be downloaded. Please try again.'); } finally { setDl(false); }
  };

  return (
    <div className="card">
      <h3><FileText size={18} className="gold" /> Digital rental agreement</h3>
      <p className="muted" style={{ marginBottom: 8 }}>Agreement no. <strong style={{ color: '#fff' }}>{a.agreementNo}</strong></p>
      <details className="terms">
        <summary>Read terms &amp; conditions and cancellation policy</summary>
        <ol>{a.terms.map((t) => <li key={t}>{t}</li>)}</ol>
        <strong>Cancellation policy</strong>
        <ul>{a.cancellationPolicy.map((t) => <li key={t}>{t}</li>)}</ul>
      </details>
      {a.acknowledgedAt
        ? <Notice kind="ok">Accepted by {a.acknowledgedBy} on {fmtDateTime(a.acknowledgedAt)}.</Notice>
        : isOwner ? <Notice kind="info" icon={ClipboardCheck}>Please confirm you have read and accept the agreement before pickup.<div className="mt-1"><Btn loading={busy} onClick={ack} className="btn-gold btn-sm">I acknowledge &amp; accept</Btn></div></Notice> : <Notice>Not yet acknowledged by the customer.</Notice>}
      <div className="form-actions"><Btn loading={dl} onClick={download} className="btn-outline" icon={Download}>Download agreement</Btn></div>
    </div>
  );
}

export default function BookingConfirmation() {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const { data, loading, error, reload } = useAsync(() => bookingApi.get(id), [id]);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [sos, setSos] = useState(false);

  if (loading) return <Loader label="Loading booking…" />;
  if (error) return <div className="container section"><ErrorState message={error} onRetry={reload} /><Link to="/dashboard" className="btn btn-outline mt-2">Back to dashboard</Link></div>;

  const { booking: b, payments, refundPreview, damageReport } = data;
  const isOwner = String(b.user._id || b.user) === String(user._id);
  const pay = payments.find((p) => p.kind === 'booking');
  const fresh = sp.get('new') === '1' && b.status === 'Confirmed';
  const canCancel = ['Pending', 'Confirmed'].includes(b.status);
  const paidOnline = pay?.status === 'Success';
  const pctRefund = paidOnline ? (isOwner ? refundPreview?.refundPercent ?? 0 : 100) : 0;
  const rentalRefund = Math.round((b.pricing.rentalTotal * pctRefund) / 100);
  const refund = paidOnline ? rentalRefund + b.pricing.deposit : 0;

  const cancel = async () => {
    setBusy(true);
    try { await bookingApi.cancel(b._id, reason || undefined); toast.success('Booking cancelled.'); setCancelOpen(false); reload(); }
    catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };

  return (
    <div className="container section-tight confirm">
      {fresh ? (
        <div className="confirm-hero card card-gold center">
          <div className="tick"><CheckCircle2 size={56} /></div>
          <h1 style={{ fontSize: 'clamp(2rem,5vw,3.2rem)' }}>Booking <span className="gold-text">confirmed</span></h1>
          <p className="muted">A confirmation and rental agreement are ready. We've also sent a notification to your account.</p>
          <Plate large>{b.bookingId}</Plate>
        </div>
      ) : (
        <div className="row-wrap between mb-2">
          <div><span className="eyebrow">Booking details</span><h1 style={{ fontSize: 'clamp(2rem,5vw,3rem)', marginBottom: 8 }}>{b.vehicle.name}</h1></div>
          <Plate large>{b.bookingId}</Plate>
        </div>
      )}
      <div className="row-wrap mb-2"><StatusBadge status={b.status} /><StatusBadge status={b.paymentStatus} />{b.status === 'Cancelled' && b.cancellation?.refundAmount > 0 && <span className="badge b-ok">Refund {inr(b.cancellation.refundAmount)}</span>}</div>

      <div className="confirm-grid">
        <div className="stack">
          <div className="card">
            <h3>Trip details</h3>
            <dl className="kv">
              <dt>Vehicle</dt><dd><Link to={`/cars/${b.vehicle._id}`} className="gold">{b.vehicle.name}</Link> · {b.vehicle.fuelDisplay} · {b.vehicle.seats} seats</dd>
              <dt>Pickup</dt><dd>{b.pickupLocation} — {fmtDateTime(b.pickupAt)}</dd>
              <dt>Return</dt><dd>{b.returnLocation} — {fmtDateTime(b.returnAt)}</dd>
              <dt>Duration</dt><dd>{durationLabel(b.pickupAt, b.returnAt)}</dd>
              <dt>Extras</dt><dd>{b.pricing.serviceLines?.length ? b.pricing.serviceLines.map((s) => s.label).join(', ') : 'None'}</dd>
              <dt>Driver</dt><dd>{b.customer.name} · {b.customer.phone}<br /><span className="muted">Licence {b.customer.licenseNumber}</span></dd>
            </dl>
          </div>
          <div className="card"><h3>Price breakdown</h3><PriceBreakdown pricing={b.pricing} /></div>
        </div>

        <div className="stack">
          {b.status === 'Pending' && isOwner && <Notice kind="info" icon={Wallet}>Payment is pending. <Link to={`/payment/${b._id}`} className="btn btn-gold btn-sm" style={{ marginLeft: 8 }}>Pay {inr(b.pricing.total)}</Link></Notice>}

          <div className="card receipt">
            <div className="row between"><h3 style={{ margin: 0 }}>Payment &amp; receipt</h3><button className="btn btn-ghost btn-sm no-print" onClick={() => window.print()}><Printer size={15} /> Print</button></div>
            {pay ? (
              <dl className="kv mt-1" style={{ gridTemplateColumns: '120px 1fr' }}>
                <dt>Receipt no.</dt><dd>{pay.receiptNo || '—'}</dd>
                <dt>Amount</dt><dd>{inr(pay.amount)}</dd>
                <dt>Method</dt><dd>{pay.method}{pay.details?.last4 ? ` ····${pay.details.last4}` : ''}{pay.details?.upiId ? ` (${pay.details.upiId})` : ''}{pay.details?.bank ? ` (${pay.details.bank})` : ''}</dd>
                <dt>Status</dt><dd><StatusBadge status={pay.status} /></dd>
                {pay.verificationStatus && pay.verificationStatus !== 'Not Required' && (
                  <><dt>Screenshot</dt><dd><StatusBadge status={pay.verificationStatus} /></dd></>
                )}
                <dt>Transaction</dt><dd style={{ wordBreak: 'break-all' }}>{pay.transactionId}</dd>
                <dt>Date</dt><dd>{fmtDateTime(pay.paidAt || pay.createdAt)}</dd>
                {pay.refundAmount > 0 && (<><dt>Refunded</dt><dd>{inr(pay.refundAmount)}</dd></>)}
              </dl>
            ) : <p className="muted mt-1">No payment recorded yet.</p>}
            {pay?.method === 'Cash on Pickup' && pay.status === 'Pending' && <Notice kind="info">Pay {inr(pay.amount)} to our staff when you collect the vehicle.</Notice>}
            <p className="hint mt-1">Simulated payment — receipt for demonstration only. Issued by {COMPANY.name}.</p>
          </div>

          {['Confirmed', 'Active', 'Completed'].includes(b.status) && <AgreementCard booking={b} isOwner={isOwner} />}

          <div className="card no-print">
            <h3>What next?</h3>
            <div className="stack">
              {['Confirmed', 'Active'].includes(b.status) && <Link to={`/auto-inspect/${b._id}`} className="btn btn-outline btn-block"><ScanSearch size={17} /> Before-rental inspection {b.inspection?.before && '✓'}</Link>}
              {['Confirmed', 'Active'].includes(b.status) && <Link to="/track-rental" className="btn btn-outline btn-block"><Navigation size={17} /> Track rental</Link>}
              {b.status === 'Active' && isOwner && <button className="btn btn-danger btn-block" onClick={() => setSos(true)}><Siren size={17} /> Emergency assistance</button>}
              {b.status === 'Completed' && isOwner && !b.reviewed && <Link to={`/review/${b._id}`} className="btn btn-gold btn-block"><Star size={17} /> Review this rental</Link>}
              {damageReport && <Link to={`/damage-reports/${damageReport._id}`} className="btn btn-outline btn-block"><ScanSearch size={17} /> Damage report {damageReport.reportId}</Link>}
              {canCancel && <button className="btn btn-danger btn-block" onClick={() => setCancelOpen(true)}><XCircle size={17} /> Cancel booking</button>}
              <Link to="/dashboard" className="btn btn-ghost btn-block">Go to dashboard</Link>
            </div>
          </div>
        </div>
      </div>

      {cancelOpen && (
        <ConfirmModal title="Cancel this booking?" danger confirmLabel="Yes, cancel booking" loading={busy} onConfirm={cancel} onClose={() => setCancelOpen(false)}>
          <p>{paidOnline ? <>Under our policy ({refundPreview?.label?.toLowerCase()}), you will be refunded <strong style={{ color: '#fff' }}>{inr(refund)}</strong> — {pctRefund}% of the rental ({inr(rentalRefund)}){b.pricing.deposit > 0 ? <> plus your full {inr(b.pricing.deposit)} deposit</> : null}.</> : 'No payment has been taken for this booking, so there is nothing to refund.'}</p>
          <Field label="Reason (optional)"><input className="input" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} /></Field>
        </ConfirmModal>
      )}
      {sos && <EmergencyModal booking={b} onClose={() => setSos(false)} />}
    </div>
  );
}
