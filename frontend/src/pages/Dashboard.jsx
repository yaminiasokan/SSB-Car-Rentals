import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Gift, Navigation, Siren, ScanSearch, Star, CreditCard, ArrowRight, CalendarClock, Car, Heart, Bell, LifeBuoy, Timer } from 'lucide-react';
import EmergencyModal from '../components/EmergencyModal';
import { CarImage } from '../components/CarCard';
import { Empty, ErrorState, Loader, StatusBadge, Plate } from '../components/ui';
import useAsync from '../hooks/useAsync';
import useCountdown from '../hooks/useCountdown';
import { useAuth } from '../context/AuthContext';
import { bookingApi, damageApi, notificationApi, paymentApi, rewardApi, supportApi, wishlistApi } from '../services/api';
import { fmtDate, fmtDateTime, inr, timeAgo } from '../utils/format';

const TABS = [['overview', 'Overview'], ['bookings', 'Booking history'], ['payments', 'Payments'], ['damage', 'Damage reports'], ['support', 'Support tickets']];

function ActiveRental({ b, onSos }) {
  const c = useCountdown(b.returnAt);
  return (
    <div className="card card-gold active-rental">
      <div className="row-wrap between"><span className="badge b-ok">● Active rental</span><Plate>{b.bookingId}</Plate></div>
      <div className="active-grid">
        <div className="active-img"><CarImage car={b.vehicle} /></div>
        <div>
          <h3 style={{ marginBottom: 4 }}>{b.vehicle.name}</h3>
          <div className="muted">{b.pickupLocation} → {b.returnLocation} · return by {fmtDateTime(b.returnAt)}</div>
          <div className="countdown mt-2" aria-label="Time remaining">
            <Timer size={18} className="gold" />
            {c.done ? <b className="err">Return time reached — please return the vehicle</b> : <span><b>{c.days}d {String(c.hours).padStart(2, '0')}h {String(c.minutes).padStart(2, '0')}m {String(c.seconds).padStart(2, '0')}s</b> remaining</span>}
          </div>
          <div className="row-wrap mt-2">
            <Link to="/track-rental" className="btn btn-gold btn-sm"><Navigation size={15} /> Track</Link>
            <Link to={`/auto-inspect/${b._id}`} className="btn btn-outline btn-sm"><ScanSearch size={15} /> Inspection</Link>
            <button className="btn btn-danger btn-sm" onClick={() => onSos(b)}><Siren size={15} /> Emergency</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function BookingTable({ rows, showActions = true }) {
  if (!rows.length) return <Empty icon={CalendarClock} title="No bookings yet" action={<Link to="/book" className="btn btn-gold btn-sm">Book a car</Link>} />;
  return (
    <div className="table-wrap">
      <table className="rtable">
        <thead><tr><th>Booking ID</th><th>Vehicle</th><th>Pickup</th><th>Return</th><th>Booked on</th><th>Amount</th><th>Payment</th><th>Status</th>{showActions && <th />}</tr></thead>
        <tbody>
          {rows.map((b) => (
            <tr key={b._id}>
              <td data-label="Booking ID"><Plate>{b.bookingId}</Plate></td>
              <td data-label="Vehicle">{b.vehicle?.name}</td>
              <td data-label="Pickup">{b.pickupLocation}<br /><small className="muted">{fmtDateTime(b.pickupAt)}</small></td>
              <td data-label="Return">{b.returnLocation}<br /><small className="muted">{fmtDateTime(b.returnAt)}</small></td>
              <td data-label="Booked on">{fmtDate(b.createdAt)}</td>
              <td data-label="Amount">{inr(b.pricing.total)}</td>
              <td data-label="Payment"><StatusBadge status={b.paymentStatus} /></td>
              <td data-label="Status"><StatusBadge status={b.status} /></td>
              {showActions && <td data-label=""><div className="actions">
                <Link className="btn btn-outline btn-sm" to={`/booking/confirmation/${b._id}`}>View</Link>
                {b.status === 'Pending' && <Link className="btn btn-gold btn-sm" to={`/payment/${b._id}`}>Pay now</Link>}
                {b.status === 'Completed' && !b.reviewed && <Link className="btn btn-gold btn-sm" to={`/review/${b._id}`}><Star size={13} /> Review</Link>}
              </div></td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [sp, setSp] = useSearchParams();
  const tab = TABS.some(([k]) => k === sp.get('tab')) ? sp.get('tab') : 'overview';
  const [sos, setSos] = useState(null);

  const { data, loading, error, reload } = useAsync(async () => {
    const [b, r, w, n, p, d, s] = await Promise.all([bookingApi.mine(), rewardApi.summary(), wishlistApi.get(), notificationApi.list(), paymentApi.mine(), damageApi.list(), supportApi.mine()]);
    return { bookings: b.bookings, rewards: r, wishlist: w.vehicles, notifications: n.notifications, payments: p.payments, damage: d.reports, tickets: s.tickets };
  }, []);

  if (loading) return <Loader label="Loading your dashboard…" />;
  if (error) return <div className="container section"><ErrorState message={error} onRetry={reload} /></div>;
  const { bookings, rewards, wishlist, notifications, payments, damage, tickets } = data;
  const active = bookings.filter((b) => b.status === 'Active');
  const upcoming = bookings.filter((b) => ['Confirmed', 'Pending'].includes(b.status)).sort((a, b) => new Date(a.pickupAt) - new Date(b.pickupAt));
  const completed = bookings.filter((b) => b.status === 'Completed');

  return (
    <div className="container section-tight dash">
      <div className="row-wrap between mb-2">
        <div><span className="eyebrow">My account</span><h1 style={{ fontSize: 'clamp(2rem,5vw,3rem)', marginBottom: 4 }}>Hello, {user.name.split(' ')[0]}</h1></div>
        <Link to="/book" className="btn btn-gold">Book a car</Link>
      </div>
      <div className="tabs" role="tablist">{TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} className={`tab ${tab === k ? 'active' : ''}`} onClick={() => setSp(k === 'overview' ? {} : { tab: k })}>{l}</button>)}</div>

      {tab === 'overview' && (
        <div className="stack">
          <div className="grid grid-4 stat-tiles">
            <div className="card"><Gift size={20} className="gold" /><b>{rewards.balance}</b><small>Reward points</small></div>
            <div className="card"><Car size={20} className="gold" /><b>{active.length}</b><small>Active rental</small></div>
            <div className="card"><CalendarClock size={20} className="gold" /><b>{upcoming.length}</b><small>Upcoming bookings</small></div>
            <div className="card"><Star size={20} className="gold" /><b>{completed.length}</b><small>Completed rentals</small></div>
          </div>

          {active.map((b) => <ActiveRental key={b._id} b={b} onSos={setSos} />)}
          {!active.length && <div className="card"><h3>Active rental</h3><p className="muted" style={{ margin: 0 }}>You have no active rental right now.</p></div>}

          <div className="grid grid-2">
            <div className="card">
              <div className="row between"><h3>Upcoming bookings</h3><button className="btn btn-ghost btn-sm" onClick={() => setSp({ tab: 'bookings' })}>All <ArrowRight size={14} /></button></div>
              {upcoming.length === 0 ? <p className="muted">Nothing booked. <Link to="/cars" className="gold">Browse cars</Link></p> : upcoming.slice(0, 3).map((b) => (
                <Link key={b._id} to={`/booking/confirmation/${b._id}`} className="mini-row"><div><b>{b.vehicle.name}</b><small className="muted">{fmtDateTime(b.pickupAt)} · {b.pickupLocation}</small></div><StatusBadge status={b.status} /></Link>
              ))}
            </div>
            <div className="card">
              <div className="row between"><h3>Completed rentals</h3><button className="btn btn-ghost btn-sm" onClick={() => setSp({ tab: 'bookings' })}>All <ArrowRight size={14} /></button></div>
              {completed.length === 0 ? <p className="muted">Your finished trips will show here.</p> : completed.slice(0, 3).map((b) => (
                <Link key={b._id} to={`/booking/confirmation/${b._id}`} className="mini-row"><div><b>{b.vehicle.name}</b><small className="muted">{fmtDate(b.pickupAt)} · {inr(b.pricing.total)}</small></div>{!b.reviewed ? <span className="badge b-gold">Review</span> : <StatusBadge status="Completed" />}</Link>
              ))}
            </div>
            <div className="card">
              <div className="row between"><h3><Gift size={18} className="gold" /> SSB Rewards</h3><Link to="/rewards" className="btn btn-ghost btn-sm">Redeem <ArrowRight size={14} /></Link></div>
              <div className="big-points gold-text">{rewards.balance}<small> points</small></div>
              <p className="muted" style={{ margin: 0 }}>Earned {rewards.earned} · Redeemed {rewards.redeemed}. Every ₹100 you spend earns {rewards.pointsPer100} points.</p>
            </div>
            <div className="card">
              <div className="row between"><h3><Heart size={18} className="gold" /> Wishlist</h3><Link to="/wishlist" className="btn btn-ghost btn-sm">View <ArrowRight size={14} /></Link></div>
              {wishlist.length === 0 ? <p className="muted">Tap the heart on any car to save it.</p> : wishlist.slice(0, 3).map((v) => <Link key={v._id} to={`/cars/${v._id}`} className="mini-row"><div><b>{v.name}</b><small className="muted">{v.fuelDisplay} · {inr(v.pricePerDay)}/day</small></div><StatusBadge status={v.availabilityLabel} /></Link>)}
            </div>
          </div>

          <div className="card">
            <div className="row between"><h3><Bell size={18} className="gold" /> Notifications</h3><Link to="/notifications" className="btn btn-ghost btn-sm">All <ArrowRight size={14} /></Link></div>
            {notifications.slice(0, 4).map((n) => <Link key={n._id} to={n.link || '/notifications'} className={`mini-row ${n.read ? '' : 'unread'}`}><div><b>{n.title}</b><small className="muted">{n.message}</small></div><small className="muted">{timeAgo(n.createdAt)}</small></Link>)}
            {notifications.length === 0 && <p className="muted">You're all caught up.</p>}
          </div>
        </div>
      )}

      {tab === 'bookings' && <BookingTable rows={bookings} />}

      {tab === 'payments' && (payments.length === 0 ? <Empty icon={CreditCard} title="No payments yet" /> : (
        <div className="table-wrap"><table className="rtable"><thead><tr><th>Receipt</th><th>Booking</th><th>Type</th><th>Method</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead><tbody>
          {payments.map((p) => (
            <tr key={p._id}><td data-label="Receipt">{p.receiptNo || '—'}</td><td data-label="Booking">{p.booking ? <Link to={`/booking/confirmation/${p.booking._id}`} className="gold">{p.booking.bookingId}</Link> : '—'}</td>
              <td data-label="Type">{p.kind === 'damage' ? 'Damage charge' : 'Rental'}</td><td data-label="Method">{p.method}</td><td data-label="Amount">{inr(p.amount)}</td>
              <td data-label="Status"><StatusBadge status={p.status} /></td><td data-label="Date">{fmtDate(p.paidAt || p.createdAt)}</td></tr>
          ))}</tbody></table></div>
      ))}

      {tab === 'damage' && (damage.length === 0 ? <Empty icon={ScanSearch} title="No damage reports" >Reports appear here only after SSB staff have verified them. AI findings are never charged automatically.</Empty> : (
        <div className="table-wrap"><table className="rtable"><thead><tr><th>Report</th><th>Booking</th><th>Vehicle</th><th>Proposed charge</th><th>Status</th><th /></tr></thead><tbody>
          {damage.map((r) => (
            <tr key={r._id}><td data-label="Report"><Plate>{r.reportId}</Plate></td><td data-label="Booking">{r.booking?.bookingId}</td><td data-label="Vehicle">{r.vehicle?.name}</td><td data-label="Proposed charge">{inr(r.finalAmount)}</td>
              <td data-label="Status"><StatusBadge status={r.status} /></td><td data-label=""><Link to={`/damage-reports/${r._id}`} className="btn btn-outline btn-sm">Review</Link></td></tr>
          ))}</tbody></table></div>
      ))}

      {tab === 'support' && (
        <div className="stack">
          <div className="row between"><h3 style={{ margin: 0 }}>Your support tickets</h3><Link to="/support#ticket" className="btn btn-gold btn-sm">New ticket</Link></div>
          {tickets.length === 0 ? <Empty icon={LifeBuoy} title="No tickets" >Need help? Our team is available 24x7.</Empty> : tickets.map((t) => (
            <div className="card" key={t._id}><div className="row-wrap between"><b>{t.subject}</b><div className="row"><StatusBadge status={t.priority} /><StatusBadge status={t.status} /></div></div><small className="muted">{t.ticketNo} · {t.category} · {fmtDate(t.createdAt)} · {t.replies.length} repl{t.replies.length === 1 ? 'y' : 'ies'}</small></div>
          ))}
          <Link to="/support" className="btn btn-outline">Open support centre</Link>
        </div>
      )}
      {sos && <EmergencyModal booking={sos} onClose={() => { setSos(null); reload(true); }} />}
    </div>
  );
}
