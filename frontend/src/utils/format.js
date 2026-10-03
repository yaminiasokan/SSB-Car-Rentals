export const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
export const fmtTime = (d) => (d ? new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '');
export const fmtDateTime = (d) => (d ? `${fmtDate(d)}, ${fmtTime(d)}` : '—');
export const timeAgo = (d) => {
  const s = Math.max(1, Math.floor((Date.now() - new Date(d)) / 1000));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60); if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h} hr ago`;
  const days = Math.floor(h / 24); return days < 30 ? `${days} day${days > 1 ? 's' : ''} ago` : fmtDate(d);
};

const pad = (n) => String(n).padStart(2, '0');
export const toDateInput = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const toTimeInput = (d) => `${pad(d.getHours())}:${d.getMinutes() < 30 ? '00' : '30'}`;
/** Combine <input type=date> + time "HH:MM" into a local Date */
export const combine = (date, time) => (date && time ? new Date(`${date}T${time}:00`) : null);
export const splitDate = (iso) => { const d = new Date(iso); return { date: toDateInput(d), time: toTimeInput(d) }; };
export const nextHalfHour = (addHours = 0) => {
  const d = new Date(Date.now() + addHours * 3600e3);
  d.setMinutes(d.getMinutes() <= 30 ? 30 : 60, 0, 0);
  return d;
};

export const durationLabel = (from, to) => {
  const h = Math.round((new Date(to) - new Date(from)) / 36e5);
  const d = Math.floor(h / 24); const r = h % 24;
  return [d ? `${d} day${d > 1 ? 's' : ''}` : '', r ? `${r} hr` : ''].filter(Boolean).join(' ') || '0 hr';
};

export const pct = (n) => `${Math.round(n * 100)}%`;
export const cx = (...c) => c.filter(Boolean).join(' ');
