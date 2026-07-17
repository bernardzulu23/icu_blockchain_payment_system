import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { toast } from 'react-toastify';
import CrudTable from '../../components/CrudTable';
import { PaginationBar } from '../../components/CrudPagination';
import { notificationService, type Notification } from '../../api/services';

export default function Notifications() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery(['notifications', page], () =>
    notificationService.list({ page, limit: 15 }).then((r) => r.data)
  );

  const markReadMutation = useMutation((id: string) => notificationService.markRead(id), {
    onSuccess: () => queryClient.invalidateQueries('notifications'),
  });

  const markAllMutation = useMutation(() => notificationService.markAllRead(), {
    onSuccess: () => {
      toast.success('All marked as read');
      queryClient.invalidateQueries('notifications');
    },
  });

  const deleteMutation = useMutation((id: string) => notificationService.remove(id), {
    onSuccess: () => queryClient.invalidateQueries('notifications'),
  });

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <h1 className="font-display text-2xl font-bold text-slate-800 dark:text-slate-100">Notifications</h1>
        <button type="button" className="btn-secondary" onClick={() => markAllMutation.mutate()}>
          Mark all read
        </button>
      </div>
      <div className="card">
        <CrudTable<Notification>
          loading={isLoading}
          rows={data?.items ?? []}
          rowKey={(r) => r.notification_id}
          columns={[
            {
              key: 'read',
              label: 'Status',
              render: (r) => (
                <span className={`px-2 py-0.5 rounded text-xs ${r.read ? 'bg-slate-500/20' : 'bg-cyan-500/20 text-cyan-600'}`}>
                  {r.read ? 'Read' : 'Unread'}
                </span>
              ),
            },
            { key: 'title', label: 'Title' },
            { key: 'message', label: 'Message', className: 'max-w-xs truncate' },
            { key: 'created_at', label: 'Date', render: (r) => new Date(r.created_at).toLocaleString() },
          ]}
          extraActions={(r) =>
            !r.read ? (
              <button type="button" className="text-cyan-600 text-xs font-medium hover:underline" onClick={() => markReadMutation.mutate(r.notification_id)}>
                Mark read
              </button>
            ) : null
          }
          onDelete={(r) => deleteMutation.mutate(r.notification_id)}
        />
        {data && <PaginationBar page={data.page} totalPages={data.totalPages} total={data.total} onPageChange={setPage} />}
      </div>
    </div>
  );
}
