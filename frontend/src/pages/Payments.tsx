import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useForm } from 'react-hook-form';
import { toast } from 'react-toastify';
import { paymentService, type Payment } from '../api/services';

export default function Payments() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery('payments', () => paymentService.list().then((r) => r.data));
  const { register, handleSubmit, reset } = useForm<{ studentId: string; amount: number; reference: string }>();

  const createMutation = useMutation(
    (data: { studentId: string; amount: number; reference: string }) => paymentService.create(data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('payments');
        toast.success('Payment record created');
        reset();
      },
      onError: (err: unknown) => {
        const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
        toast.error(msg || 'Failed to create payment');
      },
    }
  );

  const verifyMutation = useMutation(
    (id: string) => paymentService.verify(id),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('payments');
        toast.success('Payment verified');
      },
    }
  );

  const onSubmit = (data: { studentId: string; amount: number; reference: string }) => {
    createMutation.mutate(data);
  };

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
        Payments
      </h1>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="card lg:col-span-1">
          <h2 className="font-display text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">
            Record Payment
          </h2>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Student ID</label>
              <input {...register('studentId', { required: true })} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Amount (ZMW)</label>
              <input {...register('amount', { required: true, valueAsNumber: true })} type="number" className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Reference</label>
              <input {...register('reference', { required: true })} className="input-field" />
            </div>
            <button type="submit" disabled={createMutation.isLoading} className="btn-primary w-full">
              {createMutation.isLoading ? 'Creating...' : 'Create Record'}
            </button>
          </form>
        </div>
        <div className="card lg:col-span-2">
          <h2 className="font-display text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">
            Recent Payments
          </h2>
          {isLoading ? (
            <p className="text-slate-500 dark:text-slate-400">Loading...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <th className="text-left py-2 text-slate-600 dark:text-slate-400">Student</th>
                    <th className="text-left py-2 text-slate-600 dark:text-slate-400">Amount</th>
                    <th className="text-left py-2 text-slate-600 dark:text-slate-400">Reference</th>
                    <th className="text-left py-2 text-slate-600 dark:text-slate-400">Status</th>
                    <th className="text-left py-2 text-slate-600 dark:text-slate-400">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-100/50 dark:hover:bg-slate-700/20 transition-colors">
                      <td className="py-3 text-slate-800 dark:text-slate-200">{p.studentName} ({p.studentId})</td>
                      <td className="py-3 text-slate-800 dark:text-slate-200">{p.amount.toLocaleString()} ZMW</td>
                      <td className="py-3 font-mono text-sm text-slate-600 dark:text-slate-400">{p.reference}</td>
                      <td className="py-3">{statusBadge(p.status)}</td>
                      <td className="py-3">
                        {(p.status === 'pending' || p.status === 'manual_review' || p.status === 'auto_matched') && (
                          <button
                            onClick={() => verifyMutation.mutate(p.id)}
                            className="text-icu-accent text-sm font-medium hover:underline"
                          >
                            Verify
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
