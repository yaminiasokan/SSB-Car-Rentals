import { Link, useNavigate } from 'react-router-dom';
import { Heart, Trash2 } from 'lucide-react';
import { CarImage } from '../components/CarCard';
import { Empty, ErrorState, Loader, PageHeader, StatusBadge } from '../components/ui';
import useAsync from '../hooks/useAsync';
import { useWishlist } from '../context/WishlistContext';
import { wishlistApi } from '../services/api';
import { inr } from '../utils/format';

export default function Wishlist() {
  const navigate = useNavigate();
  const wl = useWishlist();
  const { data, loading, error, reload, setData } = useAsync(() => wishlistApi.get(), []);

  const remove = async (id) => { await wl.toggle(id); setData((d) => ({ ...d, vehicles: d.vehicles.filter((v) => v._id !== id) })); };

  return (
    <>
      <PageHeader eyebrow="Saved for later" title="My wishlist" />
      <div className="container section-tight">
        {loading && <Loader />}
        {error && <ErrorState message={error} onRetry={reload} />}
        {data && data.vehicles.length === 0 && <Empty icon={Heart} title="Your wishlist is empty" action={<Link to="/cars" className="btn btn-gold btn-sm">Browse cars</Link>}>Tap the heart on any car to save it here.</Empty>}
        {data && data.vehicles.length > 0 && (
          <div className="table-wrap"><table className="rtable">
            <thead><tr><th>Vehicle</th><th>Price</th><th>Fuel</th><th>Location</th><th>Availability</th><th /></tr></thead>
            <tbody>{data.vehicles.map((v) => (
              <tr key={v._id}>
                <td data-label="Vehicle"><div className="row"><div className="wl-thumb"><CarImage car={v} /></div><Link to={`/cars/${v._id}`}><b>{v.name}</b><br /><small className="muted">{v.variant}</small></Link></div></td>
                <td data-label="Price">{inr(v.pricePerDay)}/day</td><td data-label="Fuel">{v.fuelDisplay}</td><td data-label="Location">{v.location}</td>
                <td data-label="Availability"><StatusBadge status={v.availabilityLabel} /></td>
                <td data-label=""><div className="actions">
                  <button className="btn btn-danger btn-sm" onClick={() => remove(v._id)}><Trash2 size={14} /> Remove</button>
                  <button className="btn btn-gold btn-sm" onClick={() => navigate(`/book?vehicle=${v._id}`)} disabled={v.availabilityLabel !== 'Available'}>Book now</button>
                </div></td>
              </tr>))}</tbody></table></div>
        )}
      </div>
    </>
  );
}
