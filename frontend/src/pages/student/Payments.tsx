import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { toast } from 'react-toastify';
import CrudTable from '../../components/CrudTable';
import { studentService, paymentService, type Payment } from '../../api/services';

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
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Payment | null>(null);
  const [form, setForm] = useState({ amount: '', reference: '' });

  const { data, isLoading } = useQuery('my-payments', () => studentService.myPayments().then((r) => r.data));

  const payments = data?.payments ?? [];

  const updateMutation = useMutation(
    () => paymentService.update(editing!.id, { amount: parseFloat(form.amount), reference: form.reference }),
    {
      onSuccess: () => {
        toast.success('Payment updated');
        queryClient.invalidateQueries('my-payments');
        setEditing(null);
      },
      onError: () => { toast.error('Update failed — only pending payments can be edited'); },
    }
  );

  const deleteMutation = useMutation((id: string) => paymentService.remove(id), {
    onSuccess: () => {
      toast.success('Payment removed');
      queryClient.invalidateQueries('my-payments');
    },
    onError: () => { toast.error('Delete failed — only pending payments can be removed'); },
  });

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-slate-800 dark:text-slate-100 mb-8">My Payments</h1>

      <div className="card">
        <CrudTable<Payment>
          loading={isLoading}
          rows={payments}
          rowKey={(p) => p.id}
          columns={[
            {
              key: 'semester',
              label: 'Semester',
              render: (p) => `${p.semester || '—'} ${p.academicYear || ''}`.trim(),
            },
            { key: 'amount', label: 'Amount', render: (p) => `${p.amount?.toLocaleString?.() ?? p.amount} ZMW` },
            { key: 'reference', label: 'Reference', className: 'font-mono text-sm' },
            { key: 'status', label: 'Status', render: (p) => statusBadge(p.status) },
          ]}
          onEdit={(p) => {
            if (p.status !== 'pending') return toast.info('Only pending payments can be edited');
            setEditing(p);
            setForm({ amount: String(p.amount), reference: p.reference });
          }}
          onDelete={(p) => {
            if (p.status !== 'pending') return toast.info('Only pending payments can be deleted');
            if (confirm('Remove this payment submission?')) deleteMutation.mutate(p.id);
          }}
        />
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
