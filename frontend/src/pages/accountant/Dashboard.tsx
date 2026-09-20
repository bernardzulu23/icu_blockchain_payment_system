import { useQuery } from 'react-query';
import { Link } from 'react-router-dom';
import { BadgeCheck, FileUp, ClipboardList, Search } from 'lucide-react';
import { accountantService } from '../../api/services';
import LoadingSpinner from '../../components/LoadingSpinner';

const QUERY_OPTS = { retry: 1, staleTime: 30_000, refetchOnWindowFocus: true } as const;

function StatSkeleton() {
  return (
    <div className="card animate-pulse">
      <div className="h-3 w-16 bg-ink/15 mb-3" />
      <div className="h-7 w-10 bg-ink/20" />
    </div>
  );
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export default function AccountantDashboard() {
  const { data: stats, isLoading, isError, error, refetch, isFetching } = useQuery(
    'accountant-stats',
    () => accountantService.getStats().then((r) => r.data),
    QUERY_OPTS
  );

  const s = stats?.statistics ?? {};
  const errMsg =
    (error as { response?: { data?: { message?: string; error?: string } } })?.response?.data
      ?.message ||
    (error as { response?: { data?: { error?: string } } })?.response?.data?.error ||
    'Could not load stats.';

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-slate-800 dark:text-slate-100 mb-8">
        Accountant Dashboard
      </h1>

      {isError && (
        <div className="card mb-6 flex flex-wrap items-center justify-between gap-3 text-sm">
          <span className="text-red-600 dark:text-red-400">{errMsg}</span>
          <button type="button" className="btn-secondary text-xs py-1.5 px-3" onClick={() => refetch()}>
            Retry
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {isLoading ? (
          <>
            <StatSkeleton />
            <StatSkeleton />
            <StatSkeleton />
            <StatSkeleton />
          </>
        ) : (
          <>
            <div className="card">
              <p className="text-sm text-slate-600 dark:text-slate-400">Pending</p>
              <p className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-1">
                {num(s.pending)}
              </p>
            </div>
            <div className="card">
              <p className="text-sm text-slate-600 dark:text-slate-400">Auto Matched</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
                {num(s.auto_matched)}
              </p>
            </div>
            <div className="card">
              <p className="text-sm text-slate-600 dark:text-slate-400">Verified</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
                {num(s.verified)}
              </p>
            </div>
            <div className="card">
              <p className="text-sm text-slate-600 dark:text-slate-400">Rejected</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">
                {num(s.rejected)}
              </p>
            </div>
          </>
        )}
      </div>

      {isFetching && !isLoading && (
        <div className="mb-4 flex justify-end">
          <LoadingSpinner size="sm" label="Refreshing" />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link to="/accountant/verification" className="card hover:border-icu-accent/50 transition-colors group">
          <BadgeCheck className="h-8 w-8 mb-2 text-ink" aria-hidden />
          <h2 className="font-display font-semibold text-slate-800 dark:text-slate-100 group-hover:text-icu-accent">
            Verification
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Verify and approve payments</p>
        </Link>
        <Link
          to="/accountant/upload-statement"
          className="card hover:border-icu-accent/50 transition-colors group"
        >
          <FileUp className="h-8 w-8 mb-2 text-ink" aria-hidden />
          <h2 className="font-display font-semibold text-slate-800 dark:text-slate-100 group-hover:text-icu-accent">
            Upload Statement
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Upload bank statement for matching
          </p>
        </Link>
        <Link
          to="/accountant/mass-clearance"
          className="card hover:border-icu-accent/50 transition-colors group"
        >
          <ClipboardList className="h-8 w-8 mb-2 text-ink" aria-hidden />
          <h2 className="font-display font-semibold text-slate-800 dark:text-slate-100 group-hover:text-icu-accent">
            Mass Clearance
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Verify and approve student clearance requests in bulk
          </p>
        </Link>
        <Link
          to="/accountant/bulk-payment-status"
          className="card hover:border-icu-accent/50 transition-colors group"
        >
          <Search className="h-8 w-8 mb-2 text-ink" aria-hidden />
          <h2 className="font-display font-semibold text-slate-800 dark:text-slate-100 group-hover:text-icu-accent">
            Bulk Payment Status
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Enter student numbers (1 or more) for verification and cross-reference of payment status
          </p>
        </Link>
      </div>
    </div>
  );
}
