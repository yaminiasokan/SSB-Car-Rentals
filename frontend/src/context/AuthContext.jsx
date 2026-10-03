import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authApi, tokenStore } from '../services/api';

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!tokenStore.get());

  useEffect(() => {
    if (!tokenStore.get()) return;
    authApi.me().then((r) => setUser(r.user)).catch(() => tokenStore.clear()).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const onExpired = () => setUser(null);
    window.addEventListener('ssb:session-expired', onExpired);
    return () => window.removeEventListener('ssb:session-expired', onExpired);
  }, []);

  const accept = useCallback((res) => { tokenStore.set(res.token); setUser(res.user); return res.user; }, []);
  const login = useCallback(async (email, password) => accept(await authApi.login({ email, password })), [accept]);
  const register = useCallback(async (body) => accept(await authApi.register(body)), [accept]);
  const logout = useCallback(() => { tokenStore.clear(); setUser(null); }, []);
  const refresh = useCallback(async () => { const r = await authApi.me(); setUser(r.user); return r.user; }, []);

  const value = useMemo(() => ({
    user, loading, login, register, logout, refresh, accept, setUser,
    isAdmin: user?.role === 'admin', isStaff: user?.role === 'staff' || user?.role === 'admin',
  }), [user, loading, login, register, logout, refresh, accept]);

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
