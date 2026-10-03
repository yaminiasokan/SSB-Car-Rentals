import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="container section center">
      <Compass size={54} className="gold" style={{ margin: '0 auto 12px' }} />
      <h1 className="gold-text">404</h1>
      <p className="muted">This road doesn't lead anywhere. Let's get you back on track.</p>
      <div className="row-wrap" style={{ justifyContent: 'center' }}><Link to="/" className="btn btn-gold">Home</Link><Link to="/cars" className="btn btn-outline">Browse cars</Link></div>
    </div>
  );
}
