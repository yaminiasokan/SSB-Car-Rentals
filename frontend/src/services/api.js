import axios from 'axios';

const TOKEN_KEY = 'ssb_token';
export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api', timeout: 25000 });

api.interceptors.request.use((cfg) => {
  const t = tokenStore.get();
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    const isAuthCall = /\/auth\/(login|register|forgot-password|reset-password)/.test(err.config?.url || '');
    if (err.response?.status === 401 && tokenStore.get() && !isAuthCall) {
      tokenStore.clear();
      window.dispatchEvent(new Event('ssb:session-expired'));
    }
    return Promise.reject(err);
  }
);

/** User-friendly message for any thrown API error */
export const errMsg = (err) => {
  if (err?.response?.data?.message) return err.response.data.message;
  if (err?.code === 'ECONNABORTED') return 'The request took too long. Please try again.';
  if (err?.request && !err.response) return 'We could not reach the server. Check your connection and make sure the API is running.';
  return err?.message || 'Something went wrong. Please try again.';
};
export const fieldErrors = (err) => err?.response?.data?.details?.fields || {};
export const assetUrl = (p) => (!p ? '' : /^(https?:|data:|blob:)/.test(p) ? p : `${import.meta.env.VITE_ASSET_URL || ''}${p}`);

const d = (p) => p.then((r) => r.data);

export const authApi = {
  register: (b) => d(api.post('/auth/register', b)),
  login: (b) => d(api.post('/auth/login', b)),
  me: () => d(api.get('/auth/me')),
  forgot: (b) => d(api.post('/auth/forgot-password', b)),
  reset: (token, b) => d(api.post(`/auth/reset-password/${token}`, b)),
};
export const userApi = {
  updateProfile: (b) => d(api.put('/users/profile', b)),
  changePassword: (b) => d(api.put('/users/password', b)),
  list: (params) => d(api.get('/users', { params })),
  get: (id) => d(api.get(`/users/${id}`)),
  setActive: (id, isActive) => d(api.patch(`/users/${id}/active`, { isActive })),
  setLicense: (id, verified) => d(api.patch(`/users/${id}/license`, { verified })),
};
export const carApi = {
  list: (params) => d(api.get('/cars', { params })),
  get: (id) => d(api.get(`/cars/${id}`)),
  create: (b) => d(api.post('/cars', b)),
  update: (id, b) => d(api.put(`/cars/${id}`, b)),
  remove: (id) => d(api.delete(`/cars/${id}`)),
  addImages: (id, files) => { const f = new FormData(); files.forEach((x) => f.append('images', x)); return d(api.post(`/cars/${id}/images`, f)); },
  removeImage: (id, url) => d(api.delete(`/cars/${id}/images`, { data: { url } })),
};
export const bookingApi = {
  config: () => d(api.get('/bookings/config')),
  quote: (b) => d(api.post('/bookings/quote', b)),
  create: (b) => d(api.post('/bookings', b)),
  mine: () => d(api.get('/bookings/mine')),
  get: (id) => d(api.get(`/bookings/${id}`)),
  cancel: (id, reason) => d(api.patch(`/bookings/${id}/cancel`, { reason })),
  track: (id) => d(api.get(`/bookings/${id}/track`)),
  agreement: (id) => d(api.get(`/bookings/${id}/agreement`)),
  acknowledge: (id) => d(api.post(`/bookings/${id}/agreement/acknowledge`)),
  downloadAgreement: (id) => api.get(`/bookings/${id}/agreement/download`, { responseType: 'blob' }).then((r) => r.data),
};
export const paymentApi = {
  pay: (b) => d(api.post('/payments/pay', b)),
  mine: () => d(api.get('/payments/mine')),
  get: (id) => d(api.get(`/payments/${id}`)),
  adminAll: () => d(api.get('/payments/admin/all')),
  collect: (id) => d(api.patch(`/payments/${id}/collect`)),
  uploadScreenshot: (id, file) => { const fd = new FormData(); fd.append('screenshot', file); return d(api.post(`/payments/${id}/screenshot`, fd)); },
  verify: (id, status) => d(api.patch(`/payments/${id}/verify`, { status })),
};
export const inspectionApi = {
  config: () => d(api.get('/inspections/config')),
  eligible: () => d(api.get('/inspections/bookings')),
  submit: (formData) => d(api.post('/inspections', formData, { timeout: 90000 })),
  forBooking: (bookingId) => d(api.get(`/inspections/booking/${bookingId}`)),
};
export const damageApi = {
  engine: () => d(api.get('/damage-detection/engine')),
  analyze: (bookingId) => d(api.post('/damage-detection/analyze', { bookingId }, { timeout: 60000 })),
  list: (params) => d(api.get('/damage-reports', { params })),
  get: (id) => d(api.get(`/damage-reports/${id}`)),
  review: (id, b) => d(api.patch(`/damage-reports/${id}/review`, b)),
  resolve: (id, b) => d(api.patch(`/damage-reports/${id}/resolve`, b)),
  dispute: (id, message) => d(api.post(`/damage-reports/${id}/dispute`, { message })),
  pay: (id, b) => d(api.post(`/damage-reports/${id}/pay`, b)),
};
export const reviewApi = {
  list: (params) => d(api.get('/reviews', { params })),
  mine: () => d(api.get('/reviews/mine')),
  create: (b) => d(api.post('/reviews', b)),
};
export const wishlistApi = {
  get: () => d(api.get('/wishlist')),
  add: (id) => d(api.post(`/wishlist/${id}`)),
  remove: (id) => d(api.delete(`/wishlist/${id}`)),
};
export const rewardApi = {
  summary: () => d(api.get('/rewards')),
  redeem: (rewardKey) => d(api.post('/rewards/redeem', { rewardKey })),
};
export const notificationApi = {
  list: () => d(api.get('/notifications')),
  read: (id) => d(api.patch(`/notifications/${id}/read`)),
  readAll: () => d(api.patch('/notifications/read-all')),
  remove: (id) => d(api.delete(`/notifications/${id}`)),
  adminMessage: (b) => d(api.post('/notifications/admin-message', b)),
};
export const supportApi = {
  create: (b) => d(api.post('/support', b)),
  emergency: (b) => d(api.post('/support/emergency', b)),
  mine: () => d(api.get('/support/mine')),
  reply: (id, message) => d(api.post(`/support/${id}/replies`, { message })),
  adminList: (params) => d(api.get('/support/admin/all', { params })),
  adminUpdate: (id, b) => d(api.patch(`/support/${id}`, b)),
};
export const adminApi = {
  stats: () => d(api.get('/admin/stats')),
  bookings: (params) => d(api.get('/admin/bookings', { params })),
  booking: (id) => d(api.get(`/admin/bookings/${id}`)),
  setStatus: (id, status, note) => d(api.patch(`/admin/bookings/${id}/status`, { status, note })),
  approve: (id) => d(api.post(`/admin/bookings/${id}/approve`)),
  cancel: (id, reason) => d(api.post(`/admin/bookings/${id}/cancel`, { reason })),
};
export const analyticsApi = { overview: (params) => d(api.get('/analytics', { params })) };

export default api;
