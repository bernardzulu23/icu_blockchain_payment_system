import { useQuery } from 'react-query';
import { apiClient } from '../../api/client';
import LoadingSpinner from '../../components/LoadingSpinner';

export default function RegistrarDashboard() {
  const { data: clearances, isLoading } = useQuery(
    'clearance-requests',
    () => apiClient.get('/clearance').then((r) => r.data).catch(() => ({ requests: [] }))
  );

  const requests = clearances?.requests ?? [];

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-slate-800 dark:text-slate-100 mb-8">
        Registrar Dashboard
      </h1>
      {isLoading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      ) : (
        <div className="card">
          <h2 className="font-display text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">
            Clearance Requests
          </h2>
          {requests.length === 0 ? (
            <p className="text-slate-500 dark:text-slate-400">No clearance requests</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <th className="text-left py-2 text-slate-600 dark:text-slate-400">Student</th>
                    <th className="text-left py-2 text-slate-600 dark:text-slate-400">Type</th>
                    <th className="text-left py-2 text-slate-600 dark:text-slate-400">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((r: { clearance_id: string; student_id: string; clearance_type: string; status: string }) => (
                    <tr key={r.clearance_id} className="border-b border-slate-100 dark:border-slate-700/50">
                      <td className="py-3 text-slate-800 dark:text-slate-200">{r.student_id}</td>
                      <td className="py-3 text-slate-800 dark:text-slate-200">{r.clearance_type}</td>
                      <td className="py-3 text-slate-800 dark:text-slate-200">{r.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
