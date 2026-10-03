import { Link } from 'react-router-dom';
import { Car, CheckCircle2, Navigation, Users, CalendarCheck, IndianRupee, ScanSearch, LifeBuoy, Hourglass } from 'lucide-react';
import { ErrorState, Loader, Plate, StatusBadge } from '../../components/ui';
import useAsync from '../../hooks/useAsync';
import { adminApi } from '../../services/api';
import { fmtDateTime, inr } from '../../utils/format';

export default function AdminDashboard() {
  const { data, loading, error, reload } = useAsync(() => adminApi.stats(), []);
  if (loading) return <Loader />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  const s = data.stats;
  const cards = [
    [Car, 'Total vehicles', s.totalVehicles, '/admin/vehicles'], [CheckCircle2, 'Available vehicles', s.availableVehicles, '/admin/vehicles'], [Navigation, 'Active rentals', s.activeRentals, '/admin/bookings'],
    [Users, 'Total customers', s.totalCustomers, '/admin/customers'], [CalendarCheck, 'Total bookings', s.totalBookings, '/admin/bookings'], [IndianRupee, 'Total revenue', inr(s.totalRevenue), '/admin/analytics'],
    [ScanSearch, 'Pending damage reports', s.pendingDamageReports, '/admin/damage-reports'], [LifeBuoy, 'Support tickets', s.supportTickets, '/admin/support'],
  ];
  return (
    <div className="stack">
      <div><span className="eyebrow">Overview</span><h1 style={{ fontSize: '2.4rem' }}>Admin dashboard</h1></div>
      <div className="grid grid-4 admin-cards">
        {cards.map(([Icon, label, value, to]) => <Link to={to} className="card card-hover admin-card" key={label}><Icon size={22} className="gold" /><b>{value}</b><small>{label}</small></Link>)}
      </div>
      {s.pendingBookings > 0 && <Link to="/admin/bookings" className="notice"><Hourglass size={20} /><div><strong>{s.pendingBookings} booking{s.pendingBookings > 1 ? 's' : ''}</strong> awaiting payment or approval.</div></Link>}
      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        <div className="card">
          <div className="row between"><h3>Recent bookings</h3><Link to="/admin/bookings" className="btn btn-ghost btn-sm">All</Link></div>
          {data.recentBookings.map((b) => <div className="mini-row" key={b._id}><div><b>{b.vehicle?.name}</b><small className="muted">{b.user?.name} · {fmtDateTime(b.pickupAt)}</small></div><div className="row"><Plate>{b.bookingId}</Plate><StatusBadge status={b.status} /></div></div>)}
        </div>
        <div className="card">
          <div className="row between"><h3>Damage reports to review</h3><Link to="/admin/damage-reports" className="btn btn-ghost btn-sm">All</Link></div>
          {data.recentDamage.length === 0 ? <p className="muted">Nothing waiting. 🎉</p> : data.recentDamage.map((r) => <Link to={`/admin/damage-reports/${r._id}`} className="mini-row" key={r._id}><div><b>{r.vehicle?.name}</b><small className="muted">{r.booking?.bookingId} · {r.damages.length} finding(s)</small></div><StatusBadge status={r.status} /></Link>)}
        </div>
      </div>
    </div>
  );
}
