import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { toast } from 'react-toastify';
import CrudTable from '../../components/CrudTable';
import { clearanceService, type ClearanceRequest } from '../../api/services';

const statusStyle = (status: string) => {
  const map: Record<string, string> = {
    pending: 'bg-amber-500/20 text-amber-600',
    approved: 'bg-green-500/20 text-green-600',
    rejected: 'bg-red-500/20 text-red-600',
  };
  return map[status] || 'bg-slate-500/20';
};

export default function Clearance() {
  const queryClient = useQueryClient();
  const [clearanceType, setClearanceType] = useState('graduation');

  const { data, isLoading } = useQuery('my-clearances', () =>
    clearanceService.getMine().then((r) => r.data)
  );

  const requestMutation = useMutation(
    () => clearanceService.request(clearanceType),
    {
      onSuccess: () => {
        toast.success('Clearance request submitted');
        queryClient.invalidateQueries('my-clearances');
      },
      onError: (err: unknown) => {
        const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
        toast.error(msg || 'Failed to submit clearance request');
      },
    }
  );

  const cancelMutation = useMutation((id: string) => clearanceService.remove(id), {
    onSuccess: () => {
      toast.success('Clearance request cancelled');
      queryClient.invalidateQueries('my-clearances');
    },
    onError: () => { toast.error('Only pending requests can be cancelled'); },
  });

  const requests = data?.requests ?? [];

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-slate-800 dark:text-slate-100 mb-8">Clearance</h1>

      <div className="card max-w-xl mb-8">
        <p className="text-slate-600 dark:text-slate-400 mb-6">
          Request clearance. Your identity is taken from your login. You must have uploaded deposit slips in Submit Payment; those batch numbers are cross-referenced against the bank PDF admin uploads.
        </p>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Clearance Type</label>
            <select value={clearanceType} onChange={(e) => setClearanceType(e.target.value)} className="input-field w-full">
              <option value="graduation">Graduation</option>
              <option value="transfer">Transfer</option>
            </select>
          </div>
          <button
            type="button"
            onClick={() => requestMutation.mutate()}
            disabled={requestMutation.isLoading}
            className="btn-primary w-full"
          >
            {requestMutation.isLoading ? 'Submitting...' : 'Request Clearance'}
          </button>
        </div>
      </div>

      <h2 className="font-display text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">My Requests</h2>
      <div className="card">
        <CrudTable<ClearanceRequest>
          loading={isLoading}
          rows={requests}
          rowKey={(r) => r.clearance_id}
          columns={[
            { key: 'clearance_type', label: 'Type' },
            {
              key: 'status',
              label: 'Status',
              render: (r) => (
                <span className={`px-2 py-0.5 rounded text-xs ${statusStyle(r.status)}`}>{r.status}</span>
              ),
            },
            {
              key: 'requested_date',
              label: 'Requested',
              render: (r) => (r.requested_date ? new Date(r.requested_date).toLocaleDateString() : '—'),
            },
          ]}
          onDelete={(r) => {
            if (r.status !== 'pending') return toast.info('Only pending requests can be cancelled');
            if (confirm('Cancel this clearance request?')) cancelMutation.mutate(r.clearance_id);
          }}
          extraActions={(r) =>
            r.status === 'approved' && r.clearance_certificate_url ? (
              <button
                type="button"
                className="text-cyan-600 text-xs font-medium hover:underline"
                onClick={() => clearanceService.downloadCertificate(r.clearance_id)}
              >
                Download
              </button>
            ) : null
          }
        />
      </div>
    </div>
  );
}
