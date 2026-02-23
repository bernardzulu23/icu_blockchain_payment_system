import { useQuery } from 'react-query';
import { studentService, type Payment } from '../../api/services';
import LoadingSpinner from '../../components/LoadingSpinner';

const statusBadge = (status: Payment['status']) => {
  const styles: Record<string, string> = {
    pending: 'bg-amber-500/20 text-amber-600 dark:text-amber-400',
    auto_matched: 'bg-blue-500/20 text-blue-600 dark:text-blue-400',
    manual_review: 'bg-amber-500/20 text-amber-600 dark:text-amber-400',
    verified: 'bg-green-500/20 text-green-600 dark:text-green-400',
    rejected: 'bg-red-500/20 text-red-600 dark:text-red-400',
    duplicate: 'bg-slate-500/20 text-slate-600 dark:text-slate-400',
  };
  return <span className={`px-2 py-1 rounded-lg text-xs font-medium ${styles[status] || 'bg-slate-500/20'}`}>{status}</span>;
};

export default function StudentPayments() {
  const { data, isLoading } = useQuery('my-payments', () => studentService.myPayments().then((r) => r.data));

  const payments = data?.payments ?? [];

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-slate-800 dark:text-slate-100 mb-8">
        My Payments
      </h1>
      {isLoading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700">
                <th className="text-left py-2 text-slate-600 dark:text-slate-400">Semester</th>
                <th className="text-left py-2 text-slate-600 dark:text-slate-400">Amount</th>
                <th className="text-left py-2 text-slate-600 dark:text-slate-400">Reference</th>
                <th className="text-left py-2 text-slate-600 dark:text-slate-400">Status</th>
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-500 dark:text-slate-400">
                    No payments yet
                  </td>
                </tr>
              ) : (
                payments.map((p) => (
                  <tr key={p.id} className="border-b border-slate-100 dark:border-slate-700/50">
                    <td className="py-3 text-slate-800 dark:text-slate-200">
                      {p.semester || '-'} {p.academicYear || ''}
                    </td>
                    <td className="py-3 text-slate-800 dark:text-slate-200">{p.amount?.toLocaleString?.() ?? p.amount} ZMW</td>
                    <td className="py-3 font-mono text-sm text-slate-600 dark:text-slate-400">{p.reference}</td>
                    <td className="py-3">{statusBadge(p.status)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
