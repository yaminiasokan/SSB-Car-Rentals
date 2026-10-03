import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { Menu, X, Bell, User, LogOut, LayoutDashboard, Heart, Gift, ShieldCheck, ScanSearch, Phone, ChevronDown } from 'lucide-react';
import Logo from './Logo';
import { useAuth } from '../context/AuthContext';
import { useWishlist } from '../context/WishlistContext';
import { notificationApi } from '../services/api';
import { COMPANY } from '../utils/constants';

const LINKS = [['/', 'Home'], ['/cars', 'Cars'], ['/book', 'Book Now'], ['/about', 'About'], ['/contact', 'Contact'], ['/support', 'Support']];

export default function Navbar() {
  const { user, logout, isAdmin, isStaff } = useAuth();
  const wl = useWishlist();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [unread, setUnread] = useState(0);
  const menuRef = useRef(null);

  useEffect(() => { setOpen(false); setMenu(false); }, [location.pathname]);
  useEffect(() => {
    const close = (e) => menuRef.current && !menuRef.current.contains(e.target) && setMenu(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  useEffect(() => {
    if (!user) { setUnread(0); return undefined; }
    const load = () => notificationApi.list().then((r) => setUnread(r.unread)).catch(() => {});
    load();
    const t = setInterval(load, 45000);
    window.addEventListener('ssb:notifications-changed', load);
    return () => { clearInterval(t); window.removeEventListener('ssb:notifications-changed', load); };
  }, [user]);

  const doLogout = () => { logout(); navigate('/'); };

  return (
    <header className="navbar no-print">
      <div className="container nav-inner">
        <Logo />
        <nav className={`nav-links ${open ? 'open' : ''}`} aria-label="Main">
          {LINKS.map(([to, label]) => <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => (isActive ? 'active' : '')}>{label}</NavLink>)}
          {isStaff && <NavLink to="/auto-inspect" className={({ isActive }) => (isActive ? 'active' : '')}>AutoInspect</NavLink>}
          <div className="nav-mobile-only">
            {!user ? (
              <><Link to="/login" className="btn btn-outline btn-block">Sign in</Link><Link to="/register" className="btn btn-gold btn-block mt-1">Create account</Link></>
            ) : (
              <>
                <Link to="/dashboard">Dashboard</Link><Link to="/wishlist">Wishlist</Link><Link to="/rewards">Rewards</Link><Link to="/profile">Profile</Link>
                {isAdmin && <Link to="/admin">Admin panel</Link>}
                <button className="btn btn-ghost btn-block" onClick={doLogout}>Sign out</button>
              </>
            )}
            <a href={`tel:${COMPANY.phone}`} className="btn btn-gold btn-block mt-1"><Phone size={16} /> {COMPANY.phone}</a>
          </div>
        </nav>

        <div className="nav-actions">
          <a href={`tel:${COMPANY.phone}`} className="nav-phone hide-md"><Phone size={15} /> {COMPANY.phone}</a>
          {user ? (
            <>
              <Link to="/notifications" className="icon-btn" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}>
                <Bell size={20} />{unread > 0 && <span className="dot-count">{unread > 9 ? '9+' : unread}</span>}
              </Link>
              <div className="user-menu hide-md" ref={menuRef}>
                <button className="user-chip" onClick={() => setMenu((m) => !m)} aria-expanded={menu}>
                  <span className="avatar">{user.name[0]}</span><span className="uname">{user.name.split(' ')[0]}</span><ChevronDown size={14} />
                </button>
                {menu && (
                  <div className="menu-pop">
                    <Link to="/dashboard"><LayoutDashboard size={16} /> Dashboard</Link>
                    <Link to="/wishlist"><Heart size={16} /> Wishlist {wl.count > 0 && <em>{wl.count}</em>}</Link>
                    <Link to="/rewards"><Gift size={16} /> SSB Rewards</Link>
                    <Link to="/profile"><User size={16} /> Profile</Link>
                    {isStaff && <Link to="/auto-inspect"><ScanSearch size={16} /> AI AutoInspect</Link>}
                    {isAdmin && <Link to="/admin"><ShieldCheck size={16} /> Admin panel</Link>}
                    <button onClick={doLogout}><LogOut size={16} /> Sign out</button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="hide-md row">
              <Link to="/login" className="btn btn-ghost btn-sm">Sign in</Link>
              <Link to="/register" className="btn btn-gold btn-sm">Register</Link>
            </div>
          )}
          <button className="icon-btn burger" onClick={() => setOpen((o) => !o)} aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open}>
            {open ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>
    </header>
  );
}
