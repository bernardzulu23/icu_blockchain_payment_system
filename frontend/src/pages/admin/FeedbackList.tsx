import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { toast } from 'react-toastify';
import CrudTable from '../../components/CrudTable';
import { PaginationBar } from '../../components/CrudPagination';
import { feedbackService, type Feedback } from '../../api/services';

export default function FeedbackList() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useQuery(['admin-feedback', page], () =>
    feedbackService.getAll({ page, limit: 10 }).then((r) => r.data),
    { retry: 1 }
  );

  const deleteMutation = useMutation((id: string) => feedbackService.remove(id), {
    onSuccess: () => {
      toast.success('Feedback deleted');
      queryClient.invalidateQueries('admin-feedback');
    },
  });

  if (error) {
    return (
      <div className="card border-red-500/30 bg-red-500/5">
        <p className="text-red-600 dark:text-red-400">Failed to load feedback.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-slate-800 dark:text-slate-100 mb-8">User Feedback</h1>
      <p className="text-slate-600 dark:text-slate-400 mb-6">
        Feedback from students, accountants, and registrars about the payment system.
      </p>

      <div className="card">
        <CrudTable<Feedback>
          loading={isLoading}
          rows={data?.items ?? []}
          rowKey={(f) => f.feedback_id}
          columns={[
            { key: 'user_type', label: 'Role', render: (f) => <span className="uppercase text-xs">{f.user_type}</span> },
            { key: 'user_name', label: 'User', render: (f) => f.user_name || f.user_id },
            {
              key: 'rating',
              label: 'Rating',
              render: (f) => (f.rating != null ? '★'.repeat(f.rating) + '☆'.repeat(5 - f.rating) : '—'),
            },
            { key: 'message', label: 'Message', className: 'max-w-md' },
            { key: 'created_at', label: 'Date', render: (f) => new Date(f.created_at).toLocaleString() },
          ]}
          onDelete={(f) => {
            if (confirm('Delete this feedback?')) deleteMutation.mutate(f.feedback_id);
          }}
        />
        {data && (
          <PaginationBar page={data.page} totalPages={data.totalPages} total={data.total} onPageChange={setPage} />
        )}
      </div>
    </div>
  );
}
