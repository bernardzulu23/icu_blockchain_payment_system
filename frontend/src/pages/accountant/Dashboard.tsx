import { useQuery } from 'react-query';
import { apiClient } from '../../api/client';
import LoadingSpinner from '../../components/LoadingSpinner';
import { Link } from 'react-router-dom';

export default function AccountantDashboard() {
  const { data: stats, isLoading } = useQuery(
    'accountant-stats',
    () => apiClient.get('/accountant/stats').then((r) => r.data)
  );

  const s = stats?.statistics ?? {};

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-slate-800 dark:text-slate-100 mb-8">
        Accountant Dashboard
      </h1>
      {isLoading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="card">
              <p className="text-sm text-slate-600 dark:text-slate-400">Pending</p>
              <p className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-1">{s.pending ?? 0}</p>
            </div>
            <div className="card">
              <p className="text-sm text-slate-600 dark:text-slate-400">Auto Matched</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">{s.auto_matched ?? 0}</p>
            </div>
            <div className="card">
              <p className="text-sm text-slate-600 dark:text-slate-400">Verified</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">{s.verified ?? 0}</p>
            </div>
            <div className="card">
              <p className="text-sm text-slate-600 dark:text-slate-400">Rejected</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">{s.rejected ?? 0}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Link to="/accountant/verification" className="card hover:border-icu-accent/50 transition-colors group">
              <span className="text-3xl mb-2 block">✅</span>
              <h2 className="font-display font-semibold text-slate-800 dark:text-slate-100 group-hover:text-icu-accent">
                Verification
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                Verify and approve payments
              </p>
            </Link>
            <Link to="/accountant/upload-statement" className="card hover:border-icu-accent/50 transition-colors group">
              <span className="text-3xl mb-2 block">📄</span>
              <h2 className="font-display font-semibold text-slate-800 dark:text-slate-100 group-hover:text-icu-accent">
                Upload Statement
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                Upload bank statement for matching
              </p>
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
