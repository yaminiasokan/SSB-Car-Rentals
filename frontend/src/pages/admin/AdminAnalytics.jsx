import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ErrorState, Loader } from '../../components/ui';
import useAsync from '../../hooks/useAsync';
import { analyticsApi } from '../../services/api';
import { inr } from '../../utils/format';

const GOLDS = ['#d4af37', '#f3d97a', '#8f7220', '#b8952b', '#e8c766', '#6b5615'];
const axis = { stroke: '#a9a398', fontSize: 12 };
const tip = { contentStyle: { background: '#111', border: '1px solid rgba(212,175,55,.35)', borderRadius: 8, color: '#fff' }, labelStyle: { color: '#f3d97a' }, cursor: { fill: 'rgba(212,175,55,.08)' } };

const Panel = ({ title, note, children, empty }) => (
  <div className="card"><h3>{title}</h3>{note && <p className="hint" style={{ marginTop: -6 }}>{note}</p>}
    <div style={{ height: 280 }}>{empty ? <p className="muted">Not enough data yet.</p> : <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>}</div></div>
);

export default function AdminAnalytics() {
  const [months, setMonths] = useState(6);
  const { data, loading, error, reload } = useAsync(() => analyticsApi.overview({ months }), [months]);
  return (
    <div className="stack">
      <div className="row-wrap between"><div><span className="eyebrow">Insights</span><h1 style={{ fontSize: '2.4rem', marginBottom: 0 }}>Analytics</h1></div>
        <select className="input" style={{ maxWidth: 180 }} value={months} onChange={(e) => setMonths(Number(e.target.value))} aria-label="Period"><option value={6}>Last 6 months</option><option value={12}>Last 12 months</option></select></div>
      {loading && <Loader />}{error && <ErrorState message={error} onRetry={reload} />}
      {data && (
        <div className="grid grid-2 charts">
          <Panel title="Monthly revenue" note="Rental revenue excluding refunds.">
            <BarChart data={data.monthlyRevenue}><CartesianGrid stroke="rgba(255,255,255,.07)" vertical={false} /><XAxis dataKey="month" {...axis} /><YAxis {...axis} tickFormatter={(v) => `₹${v / 1000}k`} /><Tooltip {...tip} formatter={(v) => [inr(v), 'Revenue']} /><Bar dataKey="revenue" fill="#d4af37" radius={[6, 6, 0, 0]} /></BarChart>
          </Panel>
          <Panel title="Monthly bookings" note="By pickup month, excluding cancelled.">
            <LineChart data={data.monthlyBookings}><CartesianGrid stroke="rgba(255,255,255,.07)" vertical={false} /><XAxis dataKey="month" {...axis} /><YAxis {...axis} allowDecimals={false} /><Tooltip {...tip} /><Line type="monotone" dataKey="bookings" stroke="#f3d97a" strokeWidth={3} dot={{ r: 4, fill: '#d4af37' }} /></LineChart>
          </Panel>
          <Panel title="Vehicle utilization" note="Share of the last 30 days each vehicle was on rental." empty={!data.utilization.length}>
            <BarChart data={data.utilization} layout="vertical" margin={{ left: 30 }}><CartesianGrid stroke="rgba(255,255,255,.07)" horizontal={false} /><XAxis type="number" domain={[0, 100]} {...axis} tickFormatter={(v) => `${v}%`} /><YAxis type="category" dataKey="vehicle" width={150} {...axis} /><Tooltip {...tip} formatter={(v) => [`${v}%`, 'Utilization']} /><Bar dataKey="utilization" fill="#d4af37" radius={[0, 6, 6, 0]} /></BarChart>
          </Panel>
          <Panel title="Popular vehicles" empty={!data.popularVehicles.length}>
            <BarChart data={data.popularVehicles} layout="vertical" margin={{ left: 30 }}><CartesianGrid stroke="rgba(255,255,255,.07)" horizontal={false} /><XAxis type="number" allowDecimals={false} {...axis} /><YAxis type="category" dataKey="name" width={150} {...axis} /><Tooltip {...tip} /><Bar dataKey="bookings" fill="#f3d97a" radius={[0, 6, 6, 0]} /></BarChart>
          </Panel>
          <Panel title="Popular locations" empty={!data.popularLocations.length}>
            <PieChart><Pie data={data.popularLocations} dataKey="bookings" nameKey="name" innerRadius={55} outerRadius={95} paddingAngle={3} label>{data.popularLocations.map((_, i) => <Cell key={i} fill={GOLDS[i % GOLDS.length]} stroke="#000" />)}</Pie><Tooltip {...tip} /><Legend /></PieChart>
          </Panel>
          <Panel title="Fuel category distribution" note="Bookings by vehicle fuel type." empty={!data.fuelDistribution.length}>
            <PieChart><Pie data={data.fuelDistribution} dataKey="bookings" nameKey="name" outerRadius={95} paddingAngle={2} label>{data.fuelDistribution.map((_, i) => <Cell key={i} fill={GOLDS[i % GOLDS.length]} stroke="#000" />)}</Pie><Tooltip {...tip} /><Legend /></PieChart>
          </Panel>
        </div>
      )}
    </div>
  );
}
