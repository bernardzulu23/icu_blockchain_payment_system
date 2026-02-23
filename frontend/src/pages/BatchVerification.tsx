import { useState } from 'react';
import { useMutation } from 'react-query';
import { toast } from 'react-toastify';
import { batchService, type BatchVerificationResult } from '../api/services';

export default function BatchVerification() {
  const [result, setResult] = useState<BatchVerificationResult | null>(null);
  const [paymentsFile, setPaymentsFile] = useState<File | null>(null);
  const [bankFile, setBankFile] = useState<File | null>(null);

  const mutation = useMutation(
    () => {
      const formData = new FormData();
      if (paymentsFile) formData.append('payments', paymentsFile);
      if (bankFile) formData.append('bankStatement', bankFile);
      return batchService.verify(formData);
    },
    {
      onSuccess: (res) => {
        setResult(res.data);
        toast.success(`Processed ${res.data.totalProcessed} payments`);
      },
      onError: (err: unknown) => {
        const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
        toast.error(msg || 'Batch verification failed');
      },
    }
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentsFile || !bankFile) {
      toast.error('Please upload both files');
      return;
    }
    mutation.mutate();
  };

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-slate-800 dark:text-slate-100 mb-8">
        Batch Verification
      </h1>
      <p className="text-slate-600 dark:text-slate-400 mb-8">
        Upload student payments CSV and bank statement (PDF/CSV) to cross-reference 50+ payments in one click.
      </p>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="card">
          <h2 className="font-display text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">
            Upload Files
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Payments CSV</label>
              <input
                type="file"
                accept=".csv"
                onChange={(e) => setPaymentsFile(e.target.files?.[0] ?? null)}
                className="input-field"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Format: studentId,studentName,amount,reference
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Bank Statement (PDF or CSV)
              </label>
              <input
                type="file"
                accept=".pdf,.csv"
                onChange={(e) => setBankFile(e.target.files?.[0] ?? null)}
                className="input-field"
              />
            </div>
            <button type="submit" disabled={mutation.isLoading} className="btn-primary w-full">
              {mutation.isLoading ? 'Verifying...' : 'Run Batch Verification'}
            </button>
          </form>
        </div>
        {result && (
          <div className="card">
            <h2 className="font-display text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">
              Results
            </h2>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="glass-subtle p-4 rounded-xl">
                <p className="text-sm text-slate-600 dark:text-slate-400">Total Processed</p>
                <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{result.totalProcessed}</p>
              </div>
              <div className="glass-subtle p-4 rounded-xl border-green-500/30">
                <p className="text-sm text-slate-600 dark:text-slate-400">Matched</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">{result.matched}</p>
              </div>
              <div className="glass-subtle p-4 rounded-xl border-amber-500/30">
                <p className="text-sm text-slate-600 dark:text-slate-400">Unmatched</p>
                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{result.unmatched}</p>
              </div>
              <div className="glass-subtle p-4 rounded-xl">
                <p className="text-sm text-slate-600 dark:text-slate-400">Duplicates</p>
                <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{result.duplicates}</p>
              </div>
            </div>
            <div className="max-h-64 overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <th className="text-left py-2 text-slate-600 dark:text-slate-400">Student</th>
                    <th className="text-left py-2 text-slate-600 dark:text-slate-400">Amount</th>
                    <th className="text-left py-2 text-slate-600 dark:text-slate-400">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {result.results.map((r, i) => (
                    <tr key={i} className="border-b border-slate-100 dark:border-slate-700/50">
                      <td className="py-2 text-slate-800 dark:text-slate-200">{r.studentName}</td>
                      <td className="py-2 text-slate-800 dark:text-slate-200">{r.amount}</td>
                      <td className="py-2">
                        <span
                          className={`px-2 py-0.5 rounded-lg text-xs ${
                            r.status === 'matched'
                              ? 'bg-green-500/20 text-green-600 dark:text-green-400'
                              : r.status === 'duplicate'
                              ? 'bg-slate-500/20 text-slate-600 dark:text-slate-400'
                              : 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
