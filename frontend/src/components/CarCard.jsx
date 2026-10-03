import { Link } from 'react-router-dom';
import { Heart, Users, Cog, MapPin, Fuel, Star, Gauge } from 'lucide-react';
import CarArt from './CarArt';
import { StatusBadge } from './ui';
import { useWishlist } from '../context/WishlistContext';
import { assetUrl } from '../services/api';
import { inr } from '../utils/format';
import { MAX_KM_PER_DAY } from '../utils/constants';

export function CarImage({ car, className = '' }) {
  return car.images?.length
    ? <img src={assetUrl(car.images[0])} alt={car.name} className={className} loading="lazy" />
    : <CarArt type={car.bodyType} className={className} />;
}

export default function CarCard({ car, search = '' }) {
  const wl = useWishlist();
  const liked = wl.has(car._id);
  const label = car.availableForDates === false ? 'Booked' : car.availabilityLabel;
  const bookable = label === 'Available';
  const bookHref = `/book?vehicle=${car._id}${search ? `&${search}` : ''}`;
  return (
    <article className="card card-hover car-card">
      <div className="car-media">
        <CarImage car={car} />
        <button className={`heart ${liked ? 'on' : ''}`} onClick={() => wl.toggle(car._id)} aria-label={liked ? 'Remove from wishlist' : 'Add to wishlist'} aria-pressed={liked}>
          <Heart size={18} fill={liked ? 'currentColor' : 'none'} />
        </button>
        <span className="car-avail"><StatusBadge status={label} /></span>
      </div>
      <div className="car-body">
        <div className="row between" style={{ alignItems: 'flex-start' }}>
          <div>
            <h3 className="car-name">{car.name}</h3>
            <div className="muted car-variant">{car.variant}</div>
          </div>
          <div className="car-rating" title={`${car.reviewCount} reviews`}><Star size={14} fill="currentColor" /> {car.rating ? car.rating.toFixed(1) : 'New'}</div>
        </div>
        <ul className="car-specs">
          <li><Fuel size={15} /> {car.fuelDisplay || car.fuel}</li>
          <li><Cog size={15} /> {car.transmission}</li>
          <li><Users size={15} /> {car.seats} seats</li>
          <li><MapPin size={15} /> {car.location}</li>
          <li title="Fair-usage limit"><Gauge size={15} /> Max {MAX_KM_PER_DAY} km/day</li>
        </ul>
        <div className="car-price">
          <div><span className="amount gold-text">{inr(car.pricePerDay)}</span><span className="muted">/day</span></div>
          <div className="hint">{inr(car.pricePerHour)}/hr</div>
        </div>
        <div className="car-actions">
          <Link to={`/cars/${car._id}`} className="btn btn-outline btn-sm">View details</Link>
          {bookable ? <Link to={bookHref} className="btn btn-gold btn-sm">Book now</Link> : <button className="btn btn-gold btn-sm" disabled>Unavailable</button>}
        </div>
      </div>
    </article>
  );
}
