import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { toast } from 'react-toastify';
import { CheckCircle, XCircle } from 'lucide-react';
import { apiClient } from '../../api/client';
import LoadingSpinner from '../../components/LoadingSpinner';
import { useAuth } from '../../hooks/useAuth';

type ClearanceRequest = {
  clearance_id: string;
  student_id: string;
  student_number?: string;
  first_name?: string;
  last_name?: string;
  clearance_type: string;
  status: string;
  requested_date: string;
};

export default function MassClearance() {
  const { user } = useAuth();
  const canVerify = user?.role === 'accountant' || user?.role === 'admin';
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { data, isLoading } = useQuery(
    ['clearance-requests', statusFilter],
    () =>
      apiClient
        .get('/clearance', { params: statusFilter ? { status: statusFilter } : {} })
        .then((r) => r.data)
  );

  const massVerifyMutation = useMutation(
    ({ clearanceIds, status }: { clearanceIds: string[]; status: string }) =>
      apiClient.patch('/clearance/mass-verify', { clearanceIds, status }),
    {
      onSuccess: (_, { status }) => {
        toast.success(`Clearance(s) ${status} successfully`);
        setSelectedIds(new Set());
        queryClient.invalidateQueries('clearance-requests');
      },
      onError: (err: unknown) => {
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
        toast.error(msg || 'Failed to update clearance');
      },
    }
  );

  const requests: ClearanceRequest[] = data?.requests ?? [];

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const pending = requests.filter((r) => r.status === 'pending');
    if (selectedIds.size === pending.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pending.map((r) => r.clearance_id)));
    }
  };

  const handleMassApprove = () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) {
      toast.warn('Select at least one clearance to approve');
      return;
    }
    massVerifyMutation.mutate({ clearanceIds: ids, status: 'approved' });
  };

  const handleMassReject = () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) {
      toast.warn('Select at least one clearance to reject');
      return;
    }
    massVerifyMutation.mutate({ clearanceIds: ids, status: 'rejected' });
  };

  const statusBadge = (s: string) => {
    const base = 'px-2 py-1 rounded text-xs font-medium';
    if (s === 'approved') return `${base} bg-green-500/20 text-green-400`;
    if (s === 'rejected') return `${base} bg-red-500/20 text-red-400`;
    if (s === 'requires_payment') return `${base} bg-amber-500/20 text-amber-400`;
    return `${base} bg-slate-500/20 text-slate-400`;
  };

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-slate-800 dark:text-slate-100 mb-8">
        Mass Clearance Verification
      </h1>
      <p className="text-slate-600 dark:text-slate-400 mb-6">
        {canVerify
          ? 'Verify and approve student clearance requests in bulk. Only pending requests can be selected.'
          : 'View clearance requests. Verification is performed by the accountant.'}
      </p>

      <div className="flex flex-wrap gap-4 mb-6">
        {['pending', 'approved', 'rejected'].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              statusFilter === s
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                : 'bg-white/5 text-slate-400 hover:bg-white/10 border border-white/5'
            }`}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {statusFilter === 'pending' && canVerify && (
        <div className="flex gap-4 mb-6">
          <button
            onClick={handleMassApprove}
            disabled={selectedIds.size === 0 || massVerifyMutation.isLoading}
            className="btn-primary flex items-center gap-2 disabled:opacity-50"
          >
            <CheckCircle className="w-4 h-4" />
            Approve Selected ({selectedIds.size})
          </button>
          <button
            onClick={handleMassReject}
            disabled={selectedIds.size === 0 || massVerifyMutation.isLoading}
            className="px-4 py-2 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 flex items-center gap-2 disabled:opacity-50"
          >
            <XCircle className="w-4 h-4" />
            Reject Selected ({selectedIds.size})
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      ) : (
        <div className="card overflow-hidden">
          {requests.length === 0 ? (
            <p className="text-slate-500 dark:text-slate-400 py-8 text-center">
              No clearance requests found.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    {statusFilter === 'pending' && canVerify && (
                      <th className="text-left py-3 px-4">
                        <input
                          type="checkbox"
                          checked={
                            requests.filter((r) => r.status === 'pending').length > 0 &&
                            selectedIds.size === requests.filter((r) => r.status === 'pending').length
                          }
                          onChange={toggleSelectAll}
                          className="rounded"
                        />
                      </th>
                    )}
                    <th className="text-left py-3 px-4 text-slate-600 dark:text-slate-400">Student</th>
                    <th className="text-left py-3 px-4 text-slate-600 dark:text-slate-400">Type</th>
                    <th className="text-left py-3 px-4 text-slate-600 dark:text-slate-400">Requested</th>
                    <th className="text-left py-3 px-4 text-slate-600 dark:text-slate-400">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((r) => (
                    <tr
                      key={r.clearance_id}
                      className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-white/5"
                    >
                      {statusFilter === 'pending' && canVerify && (
                        <td className="py-3 px-4">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(r.clearance_id)}
                            onChange={() => toggleSelect(r.clearance_id)}
                            className="rounded"
                          />
                        </td>
                      )}
                      <td className="py-3 px-4">
                        <span className="font-medium text-slate-800 dark:text-slate-200">
                          {r.first_name && r.last_name
                            ? `${r.first_name} ${r.last_name}`
                            : r.student_id}
                        </span>
                        {r.student_number && (
                          <span className="text-slate-500 dark:text-slate-400 text-sm ml-2">
                            ({r.student_number})
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-700 dark:text-slate-300">{r.clearance_type}</td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                        {r.requested_date
                          ? new Date(r.requested_date).toLocaleDateString()
                          : '-'}
                      </td>
                      <td className="py-3 px-4">
                        <span className={statusBadge(r.status)}>{r.status}</span>
                      </td>
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
