import { useQuery } from 'react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { paymentService } from '../api/services';

export default function Dashboard() {
  const { data } = useQuery('payments-stats', () =>
    paymentService.list({ limit: 100 }).then((r) => r.data)
  );

  const payments = data?.payments ?? [];
  const pending = payments.filter((p) => p.status === 'pending').length;
  const verified = payments.filter((p) => p.status === 'verified').length;
  const totalAmount = payments.reduce((s, p) => s + p.amount, 0);

  const chartData = [
    { name: 'Pending', count: pending, fill: '#f59e0b' },
    { name: 'Verified', count: verified, fill: '#22c55e' },
    { name: 'Rejected', count: payments.filter((p) => p.status === 'rejected').length, fill: '#ef4444' },
    { name: 'Duplicate', count: payments.filter((p) => p.status === 'duplicate').length, fill: '#64748b' },
  ];

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-slate-800 dark:text-slate-100 mb-8">
        Dashboard
      </h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="card">
          <p className="text-slate-600 dark:text-slate-400 text-sm">Total Payments</p>
          <p className="text-3xl font-bold text-icu-accent mt-1">{payments.length}</p>
        </div>
        <div className="card">
          <p className="text-slate-600 dark:text-slate-400 text-sm">Pending Verification</p>
          <p className="text-3xl font-bold text-icu-warning mt-1">{pending}</p>
        </div>
        <div className="card">
          <p className="text-slate-600 dark:text-slate-400 text-sm">Total Amount (ZMW)</p>
          <p className="text-3xl font-bold text-icu-success mt-1">{totalAmount.toLocaleString()}</p>
        </div>
      </div>
      <div className="card">
        <h2 className="font-display text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">
          Payment Status Overview
        </h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
              <XAxis dataKey="name" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(15, 23, 42, 0.9)',
                  border: '1px solid rgba(148, 163, 184, 0.3)',
                  borderRadius: '12px',
                }}
              />
              <Bar dataKey="count" fill="#38bdf8" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
