import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Btn, ErrorState, Field, Loader, Notice, PageHeader, StarRating } from '../components/ui';
import useAsync from '../hooks/useAsync';
import { useToast } from '../context/ToastContext';
import { bookingApi, reviewApi, errMsg } from '../services/api';

const CATS = [['overall', 'Overall'], ['vehicleCondition', 'Vehicle condition'], ['cleanliness', 'Cleanliness'], ['pickupExperience', 'Pickup experience']];

export default function Review() {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { data, loading, error, reload } = useAsync(() => bookingApi.get(bookingId), [bookingId]);
  const [r, setR] = useState({ overall: 0, vehicleCondition: 0, cleanliness: 0, pickupExperience: 0 });
  const [comment, setComment] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  if (loading) return <Loader />;
  if (error) return <div className="container section"><ErrorState message={error} onRetry={reload} /></div>;
  const b = data.booking;

  const submit = async () => {
    if (Object.values(r).some((v) => !v)) { setErr('Please rate all four categories.'); return; }
    setBusy(true); setErr('');
    try { await reviewApi.create({ bookingId, ratings: r, comment: comment.trim() }); toast.success('Thanks for your review!'); navigate(`/cars/${b.vehicle._id}`); }
    catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  };

  return (
    <>
      <PageHeader eyebrow="Verified review" title={`Review ${b.vehicle.name}`}>Booking {b.bookingId}. Only customers who completed a rental can review.</PageHeader>
      <div className="container section-tight" style={{ maxWidth: 720 }}>
        {b.status !== 'Completed' && <Notice kind="info">You can review this rental once it is completed. <Link to="/dashboard" className="gold">Back to dashboard</Link></Notice>}
        {b.reviewed && <Notice kind="ok">You've already reviewed this rental. Thank you!</Notice>}
        {b.status === 'Completed' && !b.reviewed && (
          <div className="card card-gold stack">
            {CATS.map(([k, l]) => <div className="row between" key={k}><b>{l}</b><StarRating value={r[k]} size={26} onChange={(v) => { setR({ ...r, [k]: v }); setErr(''); }} label={`${l} rating`} /></div>)}
            <Field label="Comments (optional)"><textarea className="input" value={comment} maxLength={1000} onChange={(e) => setComment(e.target.value)} placeholder="How was the car and the pickup experience?" /></Field>
            {err && <Notice kind="bad">{err}</Notice>}
            <Btn loading={busy} onClick={submit}>Submit review</Btn>
          </div>
        )}
      </div>
    </>
  );
}
