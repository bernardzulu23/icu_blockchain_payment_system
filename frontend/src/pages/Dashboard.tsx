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
    { name: 'Pending', count: pending },
    { name: 'Auto-Matched', count: autoMatched },
    { name: 'Verified', count: verified },
    { name: 'Rejected', count: rejected },
  ];

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="border-b-2 border-ink pb-4">
        <h1 className="font-display text-4xl text-ink">Dashboard</h1>
        <p className="font-mono text-xs uppercase tracking-widest text-ink/50 mt-1">
          Live payment reconciliation statistics
        </p>
      </div>

      {isAdmin && adminStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card">
            <p className="font-mono text-[10px] uppercase tracking-wider text-accent">Total Students</p>
            <p className="text-3xl font-bold text-ink mt-1">{adminStats.totalStudents}</p>
          </div>
          <div className="card">
            <p className="font-mono text-[10px] uppercase tracking-wider text-accent">Total Payments</p>
            <p className="text-3xl font-bold text-ink mt-1">{adminStats.totalPayments}</p>
          </div>
          <div className="card">
            <p className="font-mono text-[10px] uppercase tracking-wider text-accent">Verified Amount</p>
            <p className="text-3xl font-bold text-ink mt-1">
              ZMW {adminStats.totalVerifiedAmount.toLocaleString()}
            </p>
          </div>
          <div className="card">
            <p className="font-mono text-[10px] uppercase tracking-wider text-accent">Submitted Today</p>
            <p className="text-3xl font-bold text-accent mt-1">{verifiedToday}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 grid grid-cols-2 gap-4">
          <div className="card flex flex-col items-center justify-center py-8">
            <div className="relative w-28 h-28 mb-4">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="56" cy="56" r="50" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-ink/10" />
                <circle
                  cx="56"
                  cy="56"
                  r="50"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="transparent"
                  strokeDasharray={314}
                  strokeDashoffset={314 - (314 * matchRate) / 100}
                  className="text-accent transition-all duration-1000"
                  strokeLinecap="square"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xl font-bold text-ink">{matchRate}%</span>
              </div>
            </div>
            <p className="font-mono text-[10px] text-ink/50 uppercase tracking-widest font-bold">Match Rate</p>
          </div>

          <div className="card flex flex-col items-center justify-center py-8">
            <div className="relative w-28 h-28 mb-4">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="56" cy="56" r="50" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-ink/10" />
                <circle
                  cx="56"
                  cy="56"
                  r="50"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="transparent"
                  strokeDasharray={314}
                  strokeDashoffset={314 - (314 * verifyRate) / 100}
                  className="text-ink transition-all duration-1000"
                  strokeLinecap="square"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xl font-bold text-ink">{verifyRate}%</span>
              </div>
            </div>
            <p className="font-mono text-[10px] text-ink/50 uppercase tracking-widest font-bold">Verified</p>
          </div>
        </div>

        <div className="lg:col-span-7 card">
          <h3 className="font-display text-2xl text-ink mb-6 border-b-2 border-ink pb-2">Payment Status Overview</h3>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-4xl font-bold text-amber-600">{pending}</p>
              <p className="font-mono text-[10px] uppercase tracking-wider text-ink/50 mt-1">Pending</p>
            </div>
            <div>
              <p className="text-4xl font-bold text-accent">{autoMatched}</p>
              <p className="font-mono text-[10px] uppercase tracking-wider text-ink/50 mt-1">Auto-Matched</p>
            </div>
            <div>
              <p className="text-4xl font-bold text-ink">{verified}</p>
              <p className="font-mono text-[10px] uppercase tracking-wider text-ink/50 mt-1">Verified</p>
            </div>
            <div>
              <p className="text-4xl font-bold text-accent">{rejected}</p>
              <p className="font-mono text-[10px] uppercase tracking-wider text-ink/50 mt-1">Rejected</p>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <h3 className="font-display text-2xl text-ink mb-6 border-b-2 border-ink pb-2">Payments by Status</h3>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(17,17,17,0.12)" />
              <XAxis dataKey="name" stroke="#111111" fontSize={12} />
              <YAxis stroke="#111111" fontSize={12} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#EFECE5',
                  border: '2px solid #111111',
                  borderRadius: '0',
                  color: '#111111',
                  boxShadow: '4px 4px 0 #111111',
                }}
              />
              <Bar dataKey="count" fill="#FF3B00" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="font-mono text-xs text-ink/50 mt-4 uppercase tracking-wider">
          Showing {payments.length} of {paymentsData?.total ?? payments.length} recent payment records
        </p>
      </div>
    </div>
  );
}
