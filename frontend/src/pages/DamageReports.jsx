import { Link } from 'react-router-dom';
import { ScanSearch } from 'lucide-react';
import { Empty, ErrorState, Loader, PageHeader, Plate, StatusBadge } from '../components/ui';
import useAsync from '../hooks/useAsync';
import { damageApi } from '../services/api';
import { fmtDate, inr } from '../utils/format';

export default function DamageReports() {
  const { data, loading, error, reload } = useAsync(() => damageApi.list(), []);
  return (
    <>
      <PageHeader eyebrow="AI AutoInspect" title="Damage reports" />
      <div className="container section-tight">
        {loading && <Loader />}
        {error && <ErrorState message={error} onRetry={reload} />}
        {data?.reports.length === 0 && <Empty icon={ScanSearch} title="No damage reports">Reports appear once an after-rental inspection has been analysed.</Empty>}
        {data?.reports.length > 0 && (
          <div className="table-wrap"><table className="rtable"><thead><tr><th>Report</th><th>Booking</th><th>Vehicle</th><th>Customer</th><th>Charge</th><th>Status</th><th>Created</th><th /></tr></thead><tbody>
            {data.reports.map((r) => (
              <tr key={r._id}><td data-label="Report"><Plate>{r.reportId}</Plate></td><td data-label="Booking">{r.booking?.bookingId}</td><td data-label="Vehicle">{r.vehicle?.name}</td><td data-label="Customer">{r.customer?.name}</td>
                <td data-label="Charge">{inr(r.finalAmount)}</td><td data-label="Status"><StatusBadge status={r.status} /></td><td data-label="Created">{fmtDate(r.createdAt)}</td>
                <td data-label=""><Link to={`/damage-reports/${r._id}`} className="btn btn-outline btn-sm">Open</Link></td></tr>
            ))}</tbody></table></div>
        )}
      </div>
    </>
  );
}
