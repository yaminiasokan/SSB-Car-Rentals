import { Link } from 'react-router-dom';

// If you have the official logo, drop it in src/assets/ as logo.png (or .svg/.jpg/.webp) and it is used automatically.
const supplied = Object.values(import.meta.glob('../assets/logo.{png,svg,jpg,jpeg,webp}', { eager: true, query: '?url', import: 'default' }))[0];

export function LogoMark({ size = 46 }) {
  if (supplied) return <img src={supplied} alt="SSB Car Rentals" height={size} style={{ height: size, width: 'auto' }} />;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id="lg-gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f7e08a" /><stop offset=".5" stopColor="#d4af37" /><stop offset="1" stopColor="#8a6d1d" /></linearGradient>
      </defs>
      <rect x="1.5" y="1.5" width="61" height="61" rx="14" fill="#000" stroke="url(#lg-gold)" strokeWidth="2.5" />
      <path d="M8 44 Q32 34 56 44" fill="none" stroke="url(#lg-gold)" strokeWidth="2" opacity=".7" />
      <text x="32" y="36" textAnchor="middle" fontFamily="'Barlow Condensed',Arial Narrow,sans-serif" fontWeight="800" fontSize="25" fill="url(#lg-gold)" letterSpacing="1">SSB</text>
      <circle cx="20" cy="51" r="3.6" fill="none" stroke="url(#lg-gold)" strokeWidth="1.8" /><circle cx="44" cy="51" r="3.6" fill="none" stroke="url(#lg-gold)" strokeWidth="1.8" />
    </svg>
  );
}

export default function Logo({ tagline = true, to = '/' }) {
  return (
    <Link to={to} className="logo" aria-label="SSB Car Rentals — home">
      <LogoMark />
      {!supplied && (
        <span className="logo-text">
          <b className="gold-text">SSB CAR RENTALS</b>
          {tagline && <small>YOUR JOURNEY, OUR WHEELS.</small>}
        </span>
      )}
    </Link>
  );
}
