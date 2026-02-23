import { useQuery } from 'react-query';
import { paymentService, type Payment } from '../api/services';

export default function PaymentHistory() {
  const { data, isLoading } = useQuery('payments-history', () =>
    paymentService.list({ limit: 200 }).then((r) => r.data)
  );

  const payments = data?.payments ?? [];

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

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-slate-800 dark:text-slate-100 mb-8">
        Payment History
      </h1>
      <p className="text-slate-600 dark:text-slate-400 mb-6">
        Permanent blockchain records - accessible 24/7 for 20+ years.
      </p>
      <div className="card overflow-hidden">
        {isLoading ? (
          <p className="p-6 text-slate-500 dark:text-slate-400">Loading...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-100/50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left py-3 px-4 text-slate-600 dark:text-slate-400">Date</th>
                  <th className="text-left py-3 px-4 text-slate-600 dark:text-slate-400">Student ID</th>
                  <th className="text-left py-3 px-4 text-slate-600 dark:text-slate-400">Student Name</th>
                  <th className="text-left py-3 px-4 text-slate-600 dark:text-slate-400">Amount</th>
                  <th className="text-left py-3 px-4 text-slate-600 dark:text-slate-400">Reference</th>
                  <th className="text-left py-3 px-4 text-slate-600 dark:text-slate-400">Status</th>
                  <th className="text-left py-3 px-4 text-slate-600 dark:text-slate-400">Blockchain TX</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-100/50 dark:hover:bg-slate-700/20 transition-colors"
                  >
                    <td className="py-3 px-4 text-slate-800 dark:text-slate-200">
                      {new Date(p.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-800 dark:text-slate-200">{p.studentId}</td>
                    <td className="py-3 px-4 text-slate-800 dark:text-slate-200">{p.studentName}</td>
                    <td className="py-3 px-4 text-slate-800 dark:text-slate-200">{p.amount.toLocaleString()} ZMW</td>
                    <td className="py-3 px-4 font-mono text-sm text-slate-600 dark:text-slate-400">{p.reference}</td>
                    <td className="py-3 px-4">{statusBadge(p.status)}</td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-500 dark:text-slate-400">
                      {p.txHash ? p.txHash.slice(0, 16) + '...' : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
