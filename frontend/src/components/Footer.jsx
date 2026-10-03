import { Link } from 'react-router-dom';
import { Phone, Mail, MapPin, Clock } from 'lucide-react';
import Logo from './Logo';
import { COMPANY } from '../utils/constants';

export default function Footer() {
  return (
    <footer className="footer no-print">
      <div className="container">
        <div className="footer-grid">
          <div>
            <Logo tagline={false} />
            <p className="muted mt-2" style={{ maxWidth: 320 }}>Your Journey, Our Wheels. Reliable cars, flexible rentals and 24x7 availability across Coimbatore and Tirupattur.</p>
            <p className="muted" style={{ fontSize: '.9rem' }}>CEO &amp; Founder: <strong style={{ color: '#fff' }}>{COMPANY.ceo}</strong></p>
          </div>
          <div>
            <h4 className="gold">Quick Links</h4>
            <ul className="flist">
              {[['/', 'Home'], ['/cars', 'Cars'], ['/book', 'Book Now'], ['/about', 'About'], ['/contact', 'Contact'], ['/support', 'Support']].map(([to, l]) => <li key={to}><Link to={to}>{l}</Link></li>)}
            </ul>
          </div>
          <div>
            <h4 className="gold">Contact</h4>
            <ul className="flist">
              <li><Phone size={15} /> <a href={`tel:${COMPANY.phone}`}>{COMPANY.phone}</a></li>
              <li><Mail size={15} /> <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a></li>
              <li><Clock size={15} /> Available 24x7</li>
            </ul>
          </div>
          <div>
            <h4 className="gold">Locations</h4>
            <ul className="flist">{COMPANY.locations.map((l) => <li key={l}><MapPin size={15} /> {l}</li>)}</ul>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© 2026 SSB Car Rentals. All Rights Reserved.</span>
        </div>
      </div>
    </footer>
  );
}
