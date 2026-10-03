import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { ErrorState, Loader, Notice, PageHeader, Plate } from '../components/ui';
import PaymentForm from '../components/PaymentForm';
import PriceBreakdown from '../components/PriceBreakdown';
import useAsync from '../hooks/useAsync';
import { useToast } from '../context/ToastContext';
import { bookingApi, paymentApi } from '../services/api';
import { fmtDateTime } from '../utils/format';

/** Pay for a booking that was created but not yet paid (e.g. from the dashboard). */
export default function PayBooking() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { data, loading, error, reload } = useAsync(() => bookingApi.get(id), [id]);
  if (loading) return <Loader />;
  if (error) return <div className="container section"><ErrorState message={error} onRetry={reload} /></div>;
  const b = data.booking;
  if (b.status !== 'Pending') return <Navigate to={`/booking/confirmation/${b._id}`} replace />;

  const pay = async (method, details, screenshotFile) => {
    const res = await paymentApi.pay({ bookingId: b._id, method, details });
    if (screenshotFile) await paymentApi.uploadScreenshot(res.payment._id, screenshotFile);
    toast.success(method === 'Cash on Pickup' ? 'Booking confirmed — pay on pickup.' : 'Payment successful!');
    navigate(`/booking/confirmation/${b._id}?new=1`, { replace: true });
  };

  const expired = b.holdExpiresAt && new Date(b.holdExpiresAt) < new Date();
  return (
    <>
      <PageHeader eyebrow="Complete your booking" title="Payment" />
      <div className="container section-tight">
        <div className="wizard">
          <div className="card card-gold">
            <div className="row-wrap between mb-2"><Plate>{b.bookingId}</Plate><span className="muted">{b.vehicle.name} · {fmtDateTime(b.pickupAt)}</span></div>
            {expired && <div className="mb-2"><Notice kind="info">Your 30-minute hold has expired. You can still pay if the car remains free for your dates.</Notice></div>}
            <PaymentForm amount={b.pricing.total} onPay={pay} />
          </div>
          <aside className="card"><h4>Price details</h4><PriceBreakdown pricing={b.pricing} />
            <Link to="/dashboard" className="btn btn-ghost btn-block mt-2">Pay later</Link></aside>
        </div>
      </div>
    </>
  );
}
