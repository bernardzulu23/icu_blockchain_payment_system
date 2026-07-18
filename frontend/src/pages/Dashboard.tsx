import { useQuery } from 'react-query';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useAuth } from '../hooks/useAuth';
import { accountantService, adminService, paymentService } from '../api/services';
import LoadingSpinner from '../components/LoadingSpinner';

export default function Dashboard() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const { data: accountantStats, isLoading: accountantLoading } = useQuery(
    'accountant-stats',
    () => accountantService.getStats().then((r) => r.data),
    { enabled: !isAdmin }
  );

  const { data: adminStats, isLoading: adminLoading } = useQuery(
    'admin-stats',
    () => adminService.getStats().then((r) => r.data),
    { enabled: isAdmin }
  );

  const { data: paymentsData } = useQuery('payments-overview', () =>
    paymentService.list({ limit: 100 }).then((r) => r.data)
  );

  const isLoading = isAdmin ? adminLoading : accountantLoading;
  const stats = accountantStats?.statistics ?? {};
  const payments = paymentsData?.payments ?? [];

  const pending = Number(stats.pending ?? 0);
  const autoMatched = Number(stats.auto_matched ?? 0);
  const verified = Number(stats.verified ?? 0);
  const rejected = Number(stats.rejected ?? 0);
  const verifiedToday = Number(stats.submitted_today ?? 0);
  const total = pending + autoMatched + verified + rejected;

  const matchRate = total > 0 ? Math.round(((autoMatched + verified) / total) * 100) : 0;
  const verifyRate = total > 0 ? Math.round((verified / total) * 100) : 0;

  const chartData = [
    { name: 'Pending', count: pending, color: '#f59e0b' },
    { name: 'Auto-Matched', count: autoMatched, color: '#3b82f6' },
    { name: 'Verified', count: verified, color: '#22c55e' },
    { name: 'Rejected', count: rejected, color: '#ef4444' },
  ];

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div>
        <h1 className="font-display text-2xl font-bold text-white mb-2">Dashboard</h1>
        <p className="text-slate-400 text-sm">Live payment reconciliation statistics</p>
      </div>

      {isAdmin && adminStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card p-6">
            <p className="text-sm text-slate-400">Total Students</p>
            <p className="text-3xl font-bold text-white mt-1">{adminStats.totalStudents}</p>
          </div>
          <div className="card p-6">
            <p className="text-sm text-slate-400">Total Payments</p>
            <p className="text-3xl font-bold text-white mt-1">{adminStats.totalPayments}</p>
          </div>
          <div className="card p-6">
            <p className="text-sm text-slate-400">Verified Amount</p>
            <p className="text-3xl font-bold text-green-400 mt-1">
              ZMW {adminStats.totalVerifiedAmount.toLocaleString()}
            </p>
          </div>
          <div className="card p-6">
            <p className="text-sm text-slate-400">Submitted Today</p>
            <p className="text-3xl font-bold text-cyan-400 mt-1">{verifiedToday}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-5 grid grid-cols-2 gap-6">
          <div className="bg-[#0a0f1e]/40 backdrop-blur-xl rounded-[2rem] p-8 border border-white/5 flex flex-col items-center justify-center">
            <div className="relative w-28 h-28 mb-4">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="56" cy="56" r="50" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-white/5" />
                <circle
                  cx="56"
                  cy="56"
                  r="50"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="transparent"
                  strokeDasharray={314}
                  strokeDashoffset={314 - (314 * matchRate) / 100}
                  className="text-cyan-400 transition-all duration-1000"
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xl font-bold text-white">{matchRate}%</span>
              </div>
            </div>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Match Rate</p>
          </div>

          <div className="bg-[#0a0f1e]/40 backdrop-blur-xl rounded-[2rem] p-8 border border-white/5 flex flex-col items-center justify-center">
            <div className="relative w-28 h-28 mb-4">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="56" cy="56" r="50" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-white/5" />
                <circle
                  cx="56"
                  cy="56"
                  r="50"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="transparent"
                  strokeDasharray={314}
                  strokeDashoffset={314 - (314 * verifyRate) / 100}
                  className="text-green-400 transition-all duration-1000"
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xl font-bold text-white">{verifyRate}%</span>
              </div>
            </div>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Verified</p>
          </div>
        </div>

        <div className="lg:col-span-7 bg-[#0a0f1e]/40 backdrop-blur-xl rounded-[2rem] p-10 border border-white/5">
          <h3 className="text-xl font-bold text-white mb-8">Payment Status Overview</h3>
          <div className="grid grid-cols-2 gap-8">
            <div>
              <p className="text-4xl font-bold text-amber-400">{pending}</p>
              <p className="text-xs text-slate-500 mt-1">Pending</p>
            </div>
            <div>
              <p className="text-4xl font-bold text-blue-400">{autoMatched}</p>
              <p className="text-xs text-slate-500 mt-1">Auto-Matched</p>
            </div>
            <div>
              <p className="text-4xl font-bold text-green-400">{verified}</p>
              <p className="text-xs text-slate-500 mt-1">Verified</p>
            </div>
            <div>
              <p className="text-4xl font-bold text-red-400">{rejected}</p>
              <p className="text-xs text-slate-500 mt-1">Rejected</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-[#0a0f1e]/40 backdrop-blur-xl rounded-[2rem] p-10 border border-white/5">
        <h3 className="text-xl font-bold text-white mb-8">Payments by Status</h3>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
              <YAxis stroke="#64748b" fontSize={12} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(10, 15, 30, 0.95)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '12px',
                }}
              />
              <Bar dataKey="count" fill="#06b6d4" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="text-sm text-slate-500 mt-4">
          Showing {payments.length} of {paymentsData?.total ?? payments.length} recent payment records
        </p>
      </div>
    </div>
  );
}
