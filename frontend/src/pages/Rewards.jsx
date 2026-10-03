import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Gift, Copy, Sparkles } from 'lucide-react';
import { Btn, ErrorState, Loader, Notice, PageHeader, Plate, ConfirmModal } from '../components/ui';
import useAsync from '../hooks/useAsync';
import { rewardApi, errMsg } from '../services/api';
import { useToast } from '../context/ToastContext';
import { fmtDate } from '../utils/format';

export default function Rewards() {
  const toast = useToast();
  const { data, loading, error, reload } = useAsync(() => rewardApi.summary(), []);
  const [pick, setPick] = useState(null);
  const [busy, setBusy] = useState(false);
  const [issued, setIssued] = useState(null);

  if (loading) return <Loader />;
  if (error) return <div className="container section"><ErrorState message={error} onRetry={reload} /></div>;

  const redeem = async () => {
    setBusy(true);
    try { const r = await rewardApi.redeem(pick.key); setIssued({ code: r.couponCode, label: pick.label }); setPick(null); window.dispatchEvent(new Event('ssb:notifications-changed')); reload(true); }
    catch (e) { toast.error(errMsg(e)); setPick(null); } finally { setBusy(false); }
  };
  const copy = async (code) => { try { await navigator.clipboard.writeText(code); toast.success('Coupon code copied.'); } catch { toast.info(`Your code: ${code}`); } };

  return (
    <>
      <PageHeader eyebrow="Loyalty" title="SSB Rewards">Every ₹100 you spend earns {data.pointsPer100} points. Redeem them for discounts and perks.</PageHeader>
      <div className="container section-tight">
        <div className="grid grid-3 stat-tiles">
          <div className="card card-gold"><Gift size={20} className="gold" /><b className="gold-text">{data.balance}</b><small>Total points</small></div>
          <div className="card"><Sparkles size={20} className="gold" /><b>{data.earned}</b><small>Earned points</small></div>
          <div className="card"><Gift size={20} className="gold" /><b>{data.redeemed}</b><small>Redeemed points</small></div>
        </div>

        {issued && <div className="mt-2"><Notice kind="ok"><strong>{issued.label} unlocked!</strong> Use coupon <Plate>{issued.code}</Plate> at the Price step when you book. <button className="btn btn-ghost btn-sm" onClick={() => copy(issued.code)}><Copy size={14} /> Copy</button></Notice></div>}

        <h2 className="mt-3">Redeem your points</h2>
        <div className="grid grid-auto">
          {data.catalog.map((r) => {
            const can = data.balance >= r.points;
            return (
              <div className="card card-hover reward" key={r.key}>
                <Gift size={26} className="gold" /><h3>{r.label}</h3>
                <div className="reward-cost gold-text">{r.points} pts</div>
                <div className="progress mt-1"><i style={{ width: `${Math.min(100, (data.balance / r.points) * 100)}%` }} /></div>
                <Btn className={can ? 'btn-gold btn-block mt-2' : 'btn-ghost btn-block mt-2'} disabled={!can} onClick={() => setPick(r)}>{can ? 'Redeem' : `${r.points - data.balance} more points`}</Btn>
              </div>
            );
          })}
        </div>

        <h3 className="mt-3">Your coupons</h3>
        {data.coupons.length === 0 ? <p className="muted">No coupons yet.</p> : (
          <div className="table-wrap"><table className="rtable"><thead><tr><th>Coupon</th><th>Reward</th><th>Issued</th><th>Status</th></tr></thead><tbody>
            {data.coupons.map((c) => <tr key={c._id}><td data-label="Coupon"><Plate>{c.couponCode}</Plate></td><td data-label="Reward">{c.description}</td><td data-label="Issued">{fmtDate(c.createdAt)}</td><td data-label="Status">{c.couponUsed ? <span className="badge">Used</span> : <span className="badge b-ok">Available</span>}</td></tr>)}
          </tbody></table></div>
        )}

        <h3 className="mt-3">Points history</h3>
        {data.ledger.length === 0 ? <p className="muted">Book a car to start earning. <Link to="/cars" className="gold">Browse cars</Link></p> : (
          <div className="table-wrap"><table className="rtable"><thead><tr><th>Date</th><th>Activity</th><th>Points</th></tr></thead><tbody>
            {data.ledger.slice(0, 30).map((l) => <tr key={l._id}><td data-label="Date">{fmtDate(l.createdAt)}</td><td data-label="Activity">{l.description || l.type}</td><td data-label="Points" style={{ color: l.points >= 0 ? 'var(--ok)' : 'var(--bad)', fontWeight: 700 }}>{l.points > 0 ? '+' : ''}{l.points}</td></tr>)}
          </tbody></table></div>
        )}
      </div>
      {pick && <ConfirmModal title={`Redeem ${pick.label}?`} confirmLabel={`Spend ${pick.points} points`} loading={busy} onConfirm={redeem} onClose={() => setPick(null)}>This uses {pick.points} of your {data.balance} points and gives you a one-time coupon code for your next booking.</ConfirmModal>}
    </>
  );
}
