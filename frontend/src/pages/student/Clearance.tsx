import { useState } from 'react';
import { useMutation } from 'react-query';
import { toast } from 'react-toastify';
import { apiClient } from '../../api/client';

export default function Clearance() {
  const [clearanceType, setClearanceType] = useState('graduation');

  const requestMutation = useMutation(
    () => apiClient.post('/clearance/request', { clearance_type: clearanceType }),
    {
      onSuccess: () => {
        toast.success('Clearance request submitted');
      },
      onError: (err: unknown) => {
        const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
        toast.error(msg || 'Failed to submit clearance request');
      },
    }
  );

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-slate-800 dark:text-slate-100 mb-8">
        Clearance
      </h1>
      <div className="card max-w-xl">
        <p className="text-slate-600 dark:text-slate-400 mb-6">
          Request graduation clearance. Your payment history will be verified on the blockchain.
        </p>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Clearance Type</label>
            <select
              value={clearanceType}
              onChange={(e) => setClearanceType(e.target.value)}
              className="input-field w-full"
            >
              <option value="graduation">Graduation</option>
              <option value="transfer">Transfer</option>
            </select>
          </div>
          <button
            onClick={() => requestMutation.mutate()}
            disabled={requestMutation.isLoading}
            className="btn-primary w-full"
          >
            {requestMutation.isLoading ? 'Submitting...' : 'Request Clearance'}
          </button>
        </div>
      </div>
    </div>
  );
}
