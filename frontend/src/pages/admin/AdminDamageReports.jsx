import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ScanSearch } from 'lucide-react';
import { Empty, ErrorState, Loader, Plate, StatusBadge } from '../../components/ui';
import useAsync from '../../hooks/useAsync';
import { damageApi } from '../../services/api';
import { inr, pct } from '../../utils/format';

const RANK = { Minor: 1, Moderate: 2, Severe: 3 };

export default function AdminDamageReports() {
  const [status, setStatus] = useState('');
  const { data, loading, error, reload } = useAsync(() => damageApi.list(status ? { status } : {}), [status]);
  return (
    <div className="stack">
      <div><span className="eyebrow">AI AutoInspect</span><h1 style={{ fontSize: '2.4rem' }}>Damage reports</h1><p className="muted">AI-assisted detection — requires human verification. Nothing is charged until you confirm and the customer has had the chance to respond.</p></div>
      <select className="input" style={{ maxWidth: 240 }} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status"><option value="">All statuses</option>{['Pending Review', 'Confirmed', 'Rejected', 'Customer Disputed', 'Resolved'].map((s) => <option key={s}>{s}</option>)}</select>
      {loading && <Loader />}{error && <ErrorState message={error} onRetry={reload} />}
      {data?.reports.length === 0 && <Empty icon={ScanSearch} title="No reports">Run the AI analysis from a booking's AutoInspect page.</Empty>}
      {data?.reports.length > 0 && (
        <div className="table-wrap"><table className="rtable"><thead><tr><th>Booking ID</th><th>Vehicle</th><th>Customer</th><th>Damage</th><th>Severity</th><th>AI confidence</th><th>Estimated cost</th><th>Status</th><th /></tr></thead><tbody>
          {data.reports.map((r) => {
            const live = r.damages.filter((d) => d.decision !== 'rejected');
            const top = [...live].sort((a, b) => RANK[b.severity] - RANK[a.severity])[0];
            const min = live.reduce((s, d) => s + d.estimatedRepairCost.min, 0); const max = live.reduce((s, d) => s + d.estimatedRepairCost.max, 0);
            return (
              <tr key={r._id}>
                <td data-label="Booking ID"><Plate>{r.booking?.bookingId}</Plate></td><td data-label="Vehicle">{r.vehicle?.name}</td><td data-label="Customer">{r.customer?.name}</td>
                <td data-label="Damage">{live.length ? live.map((d) => `${d.location} ${d.type.toLowerCase()}`).join('; ') : <span className="muted">None</span>}</td>
                <td data-label="Severity">{top ? <StatusBadge status={top.severity} /> : '—'}</td><td data-label="AI confidence">{top ? pct(Math.max(...live.map((d) => d.confidence))) : '—'}</td>
                <td data-label="Estimated cost">{live.length ? `${inr(min)} – ${inr(max)}` : '—'}</td><td data-label="Status"><StatusBadge status={r.status} /></td>
                <td data-label=""><Link className={`btn btn-sm ${r.status === 'Pending Review' ? 'btn-gold' : 'btn-outline'}`} to={`/admin/damage-reports/${r._id}`}>{r.status === 'Pending Review' ? 'Review' : 'Open'}</Link></td>
              </tr>);
          })}</tbody></table></div>
      )}
    </div>
  );
}
