import { Link } from 'react-router-dom';
import { useQuery } from 'react-query';
import type { LucideIcon } from 'lucide-react';
import { User, Wallet, Send, ClipboardList, MessageSquare } from 'lucide-react';
import { studentService } from '../../api/services';
import LoadingSpinner from '../../components/LoadingSpinner';

const QUERY_OPTS = { retry: 1, staleTime: 30_000, refetchOnWindowFocus: true } as const;

const cards: { to: string; icon: LucideIcon; title: string; desc: string }[] = [
  { to: '/student-portal/profile', icon: User, title: 'My Profile', desc: 'View profile and upload picture' },
  {
    to: '/student-portal/payments',
    icon: Wallet,
    title: 'My Payments',
    desc: 'View your payment history and status',
  },
  {
    to: '/student-portal/submit-payment',
    icon: Send,
    title: 'Submit Payment',
    desc: 'Upload deposit slip and submit payment',
  },
  {
    to: '/student-portal/clearance',
    icon: ClipboardList,
    title: 'Clearance',
    desc: 'Request graduation, term, or semester clearance',
  },
  {
    to: '/student-portal/feedback',
    icon: MessageSquare,
    title: 'Feedback',
    desc: 'Send feedback about the system',
  },
];

function StatSkeleton() {
  return (
    <div className="card animate-pulse">
      <div className="h-3 w-16 bg-ink/15 mb-3" />
      <div className="h-7 w-10 bg-ink/20" />
    </div>
  );
}

export default function StudentDashboard() {
  const { data, isLoading, isError, refetch, isFetching } = useQuery(
    'my-payments',
    () => studentService.myPayments().then((r) => r.data),
    QUERY_OPTS
  );

  const stats = data?.stats;

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-slate-800 dark:text-slate-100 mb-8">
        Student Dashboard
      </h1>

      {isError && (
        <div className="card mb-6 flex flex-wrap items-center justify-between gap-3 text-sm">
          <span className="text-red-600 dark:text-red-400">Could not load payment stats.</span>
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
              <p className="text-sm text-slate-600 dark:text-slate-400">Total Payments</p>
              <p className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-1">
                {stats?.total_payments ?? 0}
              </p>
            </div>
            <div className="card">
              <p className="text-sm text-slate-600 dark:text-slate-400">Verified</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
                {stats?.verified_payments ?? 0}
              </p>
            </div>
            <div className="card">
              <p className="text-sm text-slate-600 dark:text-slate-400">Pending</p>
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
                {stats?.pending_payments ?? 0}
              </p>
            </div>
            <div className="card">
              <p className="text-sm text-slate-600 dark:text-slate-400">Total Paid</p>
              <p className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-1">
                ZMW {(stats?.total_amount_paid ?? 0).toLocaleString()}
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

      <p className="text-slate-600 dark:text-slate-400 mb-6">
        Manage your profile, payments, clearance, and feedback.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {cards.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className="card hover:border-icu-accent/50 transition-colors group"
            >
              <Icon className="h-8 w-8 mb-2 text-ink" aria-hidden />
              <h2 className="font-display font-semibold text-slate-800 dark:text-slate-100 group-hover:text-icu-accent">
                {item.title}
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{item.desc}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
