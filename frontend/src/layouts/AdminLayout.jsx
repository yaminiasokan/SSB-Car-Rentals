import { useEffect, useState } from 'react';
import { NavLink, Outlet, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Car, CalendarCheck, ScanSearch, BarChart3, Users, LifeBuoy, ArrowLeft, Menu, X } from 'lucide-react';
import Logo from '../components/Logo';
import { useAuth } from '../context/AuthContext';

const ITEMS = [
  ['/admin', 'Dashboard', LayoutDashboard, true], ['/admin/vehicles', 'Vehicles', Car], ['/admin/bookings', 'Bookings', CalendarCheck],
  ['/admin/damage-reports', 'Damage Reports', ScanSearch], ['/admin/analytics', 'Analytics', BarChart3], ['/admin/customers', 'Customers', Users], ['/admin/support', 'Support', LifeBuoy],
];

export default function AdminLayout() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  useEffect(() => { setOpen(false); window.scrollTo({ top: 0 }); }, [pathname]);
  return (
    <div className="admin">
      <aside className={`admin-side ${open ? 'open' : ''}`}>
        <div className="admin-brand"><Logo tagline={false} to="/admin" /></div>
        <nav>
          {ITEMS.map(([to, label, Icon, end]) => <NavLink key={to} to={to} end={end} className={({ isActive }) => (isActive ? 'active' : '')}><Icon size={18} /> {label}</NavLink>)}
        </nav>
        <div className="admin-foot">
          <div className="muted" style={{ fontSize: '.85rem' }}>Signed in as<br /><strong style={{ color: '#fff' }}>{user?.name}</strong></div>
          <Link to="/" className="btn btn-ghost btn-sm btn-block mt-1"><ArrowLeft size={15} /> Back to site</Link>
        </div>
      </aside>
      <div className="admin-main">
        <div className="admin-top">
          <button className="icon-btn" onClick={() => setOpen((o) => !o)} aria-label="Toggle admin menu">{open ? <X size={22} /> : <Menu size={22} />}</button>
          <strong className="gold-text" style={{ fontFamily: 'var(--display)', letterSpacing: '.12em' }}>SSB ADMIN</strong>
        </div>
        <div className="admin-content page" key={pathname}><Outlet /></div>
      </div>
    </div>
  );
}
