import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, Trash2, CalendarCheck, CreditCard, Clock, XCircle, ScanSearch, MessageSquare, Gift, LifeBuoy } from 'lucide-react';
import { Empty, ErrorState, Loader, PageHeader } from '../components/ui';
import useAsync from '../hooks/useAsync';
import { notificationApi } from '../services/api';
import { timeAgo } from '../utils/format';

const ICONS = { booking_confirmed: CalendarCheck, payment_success: CreditCard, pickup_reminder: Clock, return_reminder: Clock, booking_cancelled: XCircle, inspection_completed: ScanSearch, damage_report: ScanSearch, admin_message: MessageSquare, reward: Gift, support: LifeBuoy };
const changed = () => window.dispatchEvent(new Event('ssb:notifications-changed'));

export default function Notifications() {
  const navigate = useNavigate();
  const { data, loading, error, reload, setData } = useAsync(() => notificationApi.list(), []);

  const open = async (n) => {
    if (!n.read) { setData((d) => ({ ...d, notifications: d.notifications.map((x) => (x._id === n._id ? { ...x, read: true } : x)), unread: d.unread - 1 })); notificationApi.read(n._id).then(changed).catch(() => {}); }
    if (n.link) navigate(n.link);
  };
  const readAll = async () => { await notificationApi.readAll(); changed(); reload(true); };
  const remove = async (e, n) => { e.stopPropagation(); setData((d) => ({ ...d, notifications: d.notifications.filter((x) => x._id !== n._id) })); await notificationApi.remove(n._id).catch(() => {}); changed(); };

  return (
    <>
      <PageHeader eyebrow="Inbox" title="Notifications" />
      <div className="container section-tight" style={{ maxWidth: 820 }}>
        {loading && <Loader />}
        {error && <ErrorState message={error} onRetry={reload} />}
        {data && (
          <>
            <div className="row between mb-2"><span className="muted">{data.unread} unread</span><button className="btn btn-ghost btn-sm" onClick={readAll} disabled={!data.unread}><CheckCheck size={15} /> Mark all read</button></div>
            {data.notifications.length === 0 ? <Empty icon={Bell} title="You're all caught up">Booking, payment and inspection updates will appear here.</Empty> : (
              <div className="stack">{data.notifications.map((n) => {
                const Icon = ICONS[n.type] || Bell;
                return (
                  <div key={n._id} className={`notif card ${n.read ? '' : 'unread'}`} role="button" tabIndex={0} onClick={() => open(n)} onKeyDown={(e) => e.key === 'Enter' && open(n)}>
                    <span className="notif-ic"><Icon size={20} /></span>
                    <div style={{ flex: 1 }}><b>{n.title}</b><div className="muted">{n.message}</div><small className="hint">{timeAgo(n.createdAt)}</small></div>
                    <button className="btn btn-ghost btn-icon" onClick={(e) => remove(e, n)} aria-label="Delete notification"><Trash2 size={15} /></button>
                  </div>
                );
              })}</div>
            )}
          </>
        )}
      </div>
    </>
  );
}
