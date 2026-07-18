import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { toast } from 'react-toastify';
import CrudTable from '../components/CrudTable';
import { PaginationBar } from '../components/CrudPagination';
import { paymentService, type Payment } from '../api/services';
import { useAuth } from '../hooks/useAuth';

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

const canModify = (status: string) => status === 'pending' || status === 'rejected';

export default function PaymentHistory() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [editing, setEditing] = useState<Payment | null>(null);
  const [form, setForm] = useState({ amount: '', reference: '' });
  const limit = 15;
  const isStaff = user?.role === 'admin' || user?.role === 'accountant';

  const { data, isLoading } = useQuery(['payments-history', page, statusFilter], () =>
    paymentService.list({ page, limit, status: statusFilter || undefined }).then((r) => r.data)
  );

  const payments = data?.payments ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const updateMutation = useMutation(
    () => paymentService.update(editing!.id, { amount: parseFloat(form.amount), reference: form.reference }),
    {
      onSuccess: () => {
        toast.success('Payment updated');
        queryClient.invalidateQueries('payments-history');
        setEditing(null);
      },
      onError: () => { toast.error('Update failed'); },
    }
  );

  const deleteMutation = useMutation((id: string) => paymentService.remove(id), {
    onSuccess: () => {
      toast.success('Payment removed');
      queryClient.invalidateQueries('payments-history');
    },
    onError: () => { toast.error('Delete failed — only pending/rejected payments can be removed'); },
  });

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">Payment History</h1>
      <p className="text-slate-600 dark:text-slate-400 mb-6">
        Permanent blockchain records — accessible 24/7 for 20+ years.
      </p>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <select
          className="input-field sm:max-w-xs"
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="verified">Verified</option>
          <option value="rejected">Rejected</option>
          <option value="auto_matched">Auto matched</option>
        </select>
      </div>

      <div className="card">
        <CrudTable<Payment>
          loading={isLoading}
          rows={payments}
          rowKey={(p) => p.id}
          columns={[
            { key: 'createdAt', label: 'Date', render: (p) => new Date(p.createdAt).toLocaleDateString() },
            { key: 'studentId', label: 'Student ID' },
            { key: 'studentName', label: 'Name' },
            { key: 'amount', label: 'Amount', render: (p) => `${p.amount.toLocaleString()} ZMW` },
            { key: 'reference', label: 'Reference', className: 'font-mono text-sm' },
            { key: 'status', label: 'Status', render: (p) => statusBadge(p.status) },
            {
              key: 'txHash',
              label: 'Blockchain TX',
              render: (p) => (p.txHash ? `${p.txHash.slice(0, 16)}...` : '—'),
            },
          ]}
          onEdit={isStaff ? (p) => {
            if (!canModify(p.status)) return toast.info('Only pending/rejected payments can be edited');
            setEditing(p);
            setForm({ amount: String(p.amount), reference: p.reference });
          } : undefined}
          onDelete={isStaff ? (p) => {
            if (!canModify(p.status)) return toast.info('Only pending/rejected payments can be deleted');
            if (confirm('Remove this payment record?')) deleteMutation.mutate(p.id);
          } : undefined}
        />
        <PaginationBar page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="card max-w-md w-full">
            <h2 className="text-lg font-semibold mb-4">Edit Payment</h2>
            <div className="space-y-3">
              <input className="input-field" type="number" placeholder="Amount" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              <input className="input-field" placeholder="Reference" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
            </div>
            <div className="flex gap-3 mt-6">
              <button type="button" className="btn-primary flex-1" disabled={updateMutation.isLoading} onClick={() => updateMutation.mutate()}>Save</button>
              <button type="button" className="btn-secondary flex-1" onClick={() => setEditing(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
