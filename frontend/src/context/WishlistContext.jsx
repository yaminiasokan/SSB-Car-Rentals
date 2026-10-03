import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { wishlistApi, errMsg } from '../services/api';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';

const Ctx = createContext(null);
export const useWishlist = () => useContext(Ctx);

export function WishlistProvider({ children }) {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [ids, setIds] = useState([]);

  useEffect(() => {
    if (!user) { setIds([]); return; }
    wishlistApi.get().then((r) => setIds(r.ids)).catch(() => {});
  }, [user]);

  const toggle = useCallback(async (vehicleId) => {
    if (!user) { toast.info('Sign in to save vehicles to your wishlist.'); navigate('/login', { state: { from: location.pathname + location.search } }); return; }
    const has = ids.includes(vehicleId);
    setIds((l) => (has ? l.filter((i) => i !== vehicleId) : [...l, vehicleId])); // optimistic
    try {
      if (has) await wishlistApi.remove(vehicleId); else await wishlistApi.add(vehicleId);
      toast.success(has ? 'Removed from wishlist.' : 'Saved to your wishlist.');
    } catch (e) {
      setIds((l) => (has ? [...l, vehicleId] : l.filter((i) => i !== vehicleId)));
      toast.error(errMsg(e));
    }
  }, [user, ids, toast, navigate, location]);

  const value = useMemo(() => ({ ids, has: (id) => ids.includes(id), toggle, count: ids.length }), [ids, toggle]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
