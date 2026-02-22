import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { toast } from 'react-toastify';
import {
  CheckCircle,
  XCircle,
  Clock,
  Search,
  Download,
  Eye,
} from 'lucide-react';
import { apiClient } from '../../api/client';

const getAssetUrl = (path: string | undefined) => {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  const base = (import.meta.env.VITE_API_URL || '/api').replace(/\/api\/?$/, '');
  return `${base || window.location.origin}${path.startsWith('/') ? '' : '/'}${path}`;
};

type Payment = {
  payment_id: string;
  student_name: string;
  student_number: string;
  semester: string;
  academic_year: string;
  amount: number;
  batch_number: string;
  bank_name?: string;
  bank_amount?: number;
  bank_depositor_name?: string;
  payment_date: string;
  status: string;
  deposit_slip_url?: string;
};

type StatCardProps = {
  label: string;
  value: number;
  color: string;
  onClick: () => void;
  active: boolean;
};

function StatCard({ label, value, color, onClick, active }: StatCardProps) {
  return (
    <button
      onClick={onClick}
      className={`card p-6 text-left transition-all ${active ? 'ring-2 ring-icu-accent' : 'hover:shadow-lg'}`}
    >
      <div className="text-sm text-slate-500 dark:text-slate-400 mb-1">{label}</div>
      <div className={`text-3xl font-bold ${color}`}>{value}</div>
    </button>
  );
}

export default function AccountantVerification() {
  const queryClient = useQueryClient();
  const [selectedStatus, setSelectedStatus] = useState('auto_matched');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPayments, setSelectedPayments] = useState<Set<string>>(new Set());
  const [viewingPayment, setViewingPayment] = useState<Payment | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const { data, isLoading } = useQuery(
    ['pending-payments', selectedStatus],
    () =>
      apiClient
        .get('/accountant/pending-payments', { params: { status: selectedStatus } })
        .then((r) => r.data)
  );

  const verifyMutation = useMutation(
    ({
      paymentId,
      action,
      rejection_reason,
    }: {
      paymentId: string;
      action: string;
      rejection_reason?: string;
    }) =>
      apiClient.post(`/accountant/verify/${paymentId}`, {
        action,
        rejection_reason,
      }),
    {
      onSuccess: (_data, variables) => {
        if (variables.action === 'approve') {
          toast.success('✅ Payment verified successfully!');
        } else {
          toast.info('Payment rejected');
        }
        queryClient.invalidateQueries(['pending-payments']);
        setViewingPayment(null);
        setRejectReason('');
      },
      onError: (err: unknown) => {
        const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
        toast.error(msg || 'Verification failed');
      },
    }
  );

  const bulkVerifyMutation = useMutation(
    (paymentIds: string[]) =>
      apiClient.post('/accountant/bulk-verify', { payment_ids: paymentIds }),
    {
      onSuccess: (data: { results: { verified: unknown[] } }) => {
        toast.success(`✅ Bulk verification complete: ${data.results.verified.length} verified`);
        queryClient.invalidateQueries(['pending-payments']);
        setSelectedPayments(new Set());
      },
      onError: (err: unknown) => {
        const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
        toast.error(msg || 'Bulk verification failed');
      },
    }
  );

  const payments: Payment[] = data?.payments ?? [];
  const statistics = data?.statistics ?? {};

  const filteredPayments = payments.filter(
    (p) =>
      p.student_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.student_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.batch_number?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelectPayment = (paymentId: string) => {
    const newSelected = new Set(selectedPayments);
    if (newSelected.has(paymentId)) {
      newSelected.delete(paymentId);
    } else {
      newSelected.add(paymentId);
    }
    setSelectedPayments(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedPayments.size === filteredPayments.length) {
      setSelectedPayments(new Set());
    } else {
      setSelectedPayments(new Set(filteredPayments.map((p) => p.payment_id)));
    }
  };

  const handleBulkVerify = () => {
    if (selectedPayments.size === 0) {
      toast.warning('Please select payments to verify');
      return;
    }
    if (window.confirm(`Verify ${selectedPayments.size} payments?`)) {
      bulkVerifyMutation.mutate(Array.from(selectedPayments));
    }
  };

  const handleVerifyPayment = (action: string) => {
    if (!viewingPayment) return;
    if (action === 'reject' && !rejectReason.trim()) {
      toast.error('Please provide a reason for rejection');
      return;
    }
    verifyMutation.mutate({
      paymentId: viewingPayment.payment_id,
      action,
      rejection_reason: action === 'reject' ? rejectReason : undefined,
    });
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<
      string,
      { color: string; icon: React.ReactNode }
    > = {
      pending: {
        color: 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200',
        icon: <Clock className="h-4 w-4" />,
      },
      auto_matched: {
        color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300',
        icon: <CheckCircle className="h-4 w-4" />,
      },
      manual_review: {
        color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300',
        icon: <Clock className="h-4 w-4" />,
      },
      verified: {
        color: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300',
        icon: <CheckCircle className="h-4 w-4" />,
      },
      rejected: {
        color: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300',
        icon: <XCircle className="h-4 w-4" />,
      },
    };
    const badge = badges[status] || badges.pending;
    return (
      <span
        className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${badge.color}`}
      >
        {badge.icon}
        <span className="ml-2 capitalize">{status.replace('_', ' ')}</span>
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-icu-accent" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold text-slate-800 dark:text-slate-100">
          Payment Verification
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mt-2">
          Review and verify student payments
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
        <StatCard
          label="Pending"
          value={Number(statistics.pending) || 0}
          color="text-slate-600 dark:text-slate-400"
          onClick={() => setSelectedStatus('pending')}
          active={selectedStatus === 'pending'}
        />
        <StatCard
          label="Auto Matched"
          value={Number(statistics.auto_matched) || 0}
          color="text-blue-600 dark:text-blue-400"
          onClick={() => setSelectedStatus('auto_matched')}
          active={selectedStatus === 'auto_matched'}
        />
        <StatCard
          label="Manual Review"
          value={Number(statistics.manual_review) || 0}
          color="text-amber-600 dark:text-amber-400"
          onClick={() => setSelectedStatus('manual_review')}
          active={selectedStatus === 'manual_review'}
        />
        <StatCard
          label="Verified"
          value={Number(statistics.verified) || 0}
          color="text-green-600 dark:text-green-400"
          onClick={() => setSelectedStatus('verified')}
          active={selectedStatus === 'verified'}
        />
        <StatCard
          label="Rejected"
          value={Number(statistics.rejected) || 0}
          color="text-red-600 dark:text-red-400"
          onClick={() => setSelectedStatus('rejected')}
          active={selectedStatus === 'rejected'}
        />
      </div>

      <div className="card p-4 mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by student name, number, or batch..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field w-full pl-10"
          />
        </div>
        {selectedPayments.size > 0 && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-600 dark:text-slate-400">
              {selectedPayments.size} selected
            </span>
            <button
              onClick={handleBulkVerify}
              disabled={bulkVerifyMutation.isLoading}
              className="px-4 py-2 bg-green-600 dark:bg-green-700 text-white rounded-lg hover:bg-green-700 dark:hover:bg-green-800 disabled:bg-slate-400"
            >
              {bulkVerifyMutation.isLoading ? 'Verifying...' : 'Bulk Verify'}
            </button>
          </div>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
            <thead className="bg-slate-50 dark:bg-slate-800/50">
              <tr>
                <th className="px-6 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={
                      selectedPayments.size === filteredPayments.length &&
                      filteredPayments.length > 0
                    }
                    onChange={handleSelectAll}
                    className="rounded border-slate-300 dark:border-slate-600"
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Student
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Semester
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Batch Number
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Bank Match
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {filteredPayments.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-6 py-8 text-center text-slate-500 dark:text-slate-400"
                  >
                    No payments found for this status
                  </td>
                </tr>
              ) : (
                filteredPayments.map((payment) => (
                  <tr
                    key={payment.payment_id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/30"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedPayments.has(payment.payment_id)}
                        onChange={() => handleSelectPayment(payment.payment_id)}
                        className="rounded border-slate-300 dark:border-slate-600"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-slate-800 dark:text-slate-200">
                        {payment.student_name}
                      </div>
                      <div className="text-sm text-slate-500 dark:text-slate-400">
                        {payment.student_number}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-800 dark:text-slate-200">
                      {payment.semester}, {payment.academic_year}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-800 dark:text-slate-200">
                      K{parseFloat(String(payment.amount)).toFixed(2)}
                      {payment.bank_amount && (
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          Bank: K{parseFloat(String(payment.bank_amount)).toFixed(2)}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-800 dark:text-slate-200">
                      {payment.batch_number}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {payment.bank_depositor_name ? (
                        <div className="text-sm">
                          <div className="text-green-600 dark:text-green-400 font-medium">
                            ✓ Matched
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {payment.bank_depositor_name}
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-400">No match</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(payment.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => setViewingPayment(payment)}
                        className="text-icu-accent hover:underline flex items-center"
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {viewingPayment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="card max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="font-display text-2xl font-bold text-slate-800 dark:text-slate-100">
                    Payment Details
                  </h2>
                  <p className="text-slate-600 dark:text-slate-400 mt-1">
                    Review and verify this payment
                  </p>
                </div>
                <button
                  onClick={() => setViewingPayment(null)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                >
                  <XCircle className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-4 mb-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                      Student
                    </label>
                    <p className="mt-1 text-sm text-slate-800 dark:text-slate-200">
                      {viewingPayment.student_name}
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {viewingPayment.student_number}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                      Semester
                    </label>
                    <p className="mt-1 text-sm text-slate-800 dark:text-slate-200">
                      {viewingPayment.semester}, {viewingPayment.academic_year}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                      Amount
                    </label>
                    <p className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-200">
                      K{parseFloat(String(viewingPayment.amount)).toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                      Batch Number
                    </label>
                    <p className="mt-1 text-sm text-slate-800 dark:text-slate-200">
                      {viewingPayment.batch_number}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                      Bank
                    </label>
                    <p className="mt-1 text-sm text-slate-800 dark:text-slate-200">
                      {viewingPayment.bank_name || '-'}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                      Payment Date
                    </label>
                    <p className="mt-1 text-sm text-slate-800 dark:text-slate-200">
                      {new Date(viewingPayment.payment_date).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                {viewingPayment.deposit_slip_url && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Deposit Slip
                    </label>
                    <img
                      src={getAssetUrl(viewingPayment.deposit_slip_url)}
                      alt="Deposit slip"
                      className="max-w-full h-auto rounded-lg border border-slate-300 dark:border-slate-600"
                    />
                    <a
                      href={getAssetUrl(viewingPayment.deposit_slip_url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center text-icu-accent hover:underline"
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Download full size
                    </a>
                  </div>
                )}

                {selectedStatus !== 'verified' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Rejection Reason (if rejecting)
                    </label>
                    <textarea
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      rows={3}
                      className="input-field w-full"
                      placeholder="Enter reason for rejection..."
                    />
                  </div>
                )}
              </div>

              {selectedStatus !== 'verified' &&
                selectedStatus !== 'rejected' && (
                  <div className="flex justify-end gap-3 pt-6 border-t border-slate-200 dark:border-slate-700">
                    <button
                      onClick={() => handleVerifyPayment('reject')}
                      disabled={verifyMutation.isLoading}
                      className="px-6 py-2 border border-red-600 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => handleVerifyPayment('approve')}
                      disabled={verifyMutation.isLoading}
                      className="px-6 py-2 bg-green-600 dark:bg-green-700 text-white rounded-lg hover:bg-green-700 dark:hover:bg-green-800 disabled:opacity-50"
                    >
                      {verifyMutation.isLoading
                        ? 'Verifying...'
                        : 'Verify & Record on Blockchain'}
                    </button>
                  </div>
                )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
