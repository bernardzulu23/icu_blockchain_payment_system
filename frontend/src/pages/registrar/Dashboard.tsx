import { useQuery } from 'react-query';
import { clearanceService } from '../../api/services';
import LoadingSpinner from '../../components/LoadingSpinner';

const QUERY_OPTS = { retry: 1, staleTime: 30_000 } as const;

export default function RegistrarDashboard() {
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery(
    'clearance-requests',
    () => clearanceService.list().then((r) => r.data),
    QUERY_OPTS
  );

  const requests = data?.requests ?? [];

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-slate-800 dark:text-slate-100 mb-8">
        Registrar Dashboard
      </h1>

      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="font-display text-lg font-semibold text-slate-800 dark:text-slate-100">
            Clearance Requests
          </h2>
          {isFetching && !isLoading && <LoadingSpinner size="sm" label="Refreshing" />}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-10">
            <LoadingSpinner size="lg" />
          </div>
        ) : isError ? (
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <span className="text-red-600 dark:text-red-400">
              Failed to load clearance requests.{' '}
              {(error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
                'Please try again.'}
            </span>
            <button type="button" className="btn-secondary text-xs py-1.5 px-3" onClick={() => refetch()}>
              Retry
            </button>
          </div>
        ) : requests.length === 0 ? (
          <p className="text-slate-500 dark:text-slate-400">No clearance requests</p>
        ) : (
          <>
            <div className="md:hidden space-y-3">
              {requests.map((r) => (
                <div
                  key={r.clearance_id}
                  className="border-2 border-ink/20 p-3 space-y-1 text-sm"
                >
                  <p className="font-semibold text-slate-800 dark:text-slate-100">
                    {r.student_name || r.student_id}
                  </p>
                  <p className="text-slate-600 dark:text-slate-400">{r.student_number || '—'}</p>
                  <p className="text-slate-700 dark:text-slate-300">{r.clearance_type}</p>
                  <p className="font-mono text-xs uppercase tracking-wide text-ink/70">{r.status}</p>
                </div>
              ))}
            </div>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <th className="text-left py-2 text-slate-600 dark:text-slate-400">Student</th>
                    <th className="text-left py-2 text-slate-600 dark:text-slate-400">Number</th>
                    <th className="text-left py-2 text-slate-600 dark:text-slate-400">Type</th>
                    <th className="text-left py-2 text-slate-600 dark:text-slate-400">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((r) => (
                    <tr
                      key={r.clearance_id}
                      className="border-b border-slate-100 dark:border-slate-700/50"
                    >
                      <td className="py-3 text-slate-800 dark:text-slate-200">
                        {r.student_name || r.student_id}
                      </td>
                      <td className="py-3 text-slate-800 dark:text-slate-200">
                        {r.student_number || '—'}
                      </td>
                      <td className="py-3 text-slate-800 dark:text-slate-200">{r.clearance_type}</td>
                      <td className="py-3 text-slate-800 dark:text-slate-200">{r.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
