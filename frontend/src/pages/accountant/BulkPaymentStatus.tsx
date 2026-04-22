import { useState } from 'react';
import { useMutation } from 'react-query';
import { toast } from 'react-toastify';
import { Search, Download } from 'lucide-react';
import { apiClient } from '../../api/client';
import LoadingSpinner from '../../components/LoadingSpinner';

const MIN_STUDENT_NUMBERS = 1;

type ResultRow = {
  student_number: string;
  student_id: string | null;
  student_name: string | null;
  found: boolean;
  paid_semesters: string[];
  missing_semesters: string[];
  clearance_eligible: boolean;
  total_verified_payments: number;
  total_verified_amount: number;
};

type BulkResponse = {
  success: boolean;
  results: ResultRow[];
  summary: {
    total_requested: number;
    found: number;
    not_found: number;
    clearance_eligible_count: number;
  };
};

export default function BulkPaymentStatus() {
  const [input, setInput] = useState('');
  const [data, setData] = useState<BulkResponse | null>(null);

  const parseNumbers = (text: string): string[] => {
    return text
      .split(/[\n,;]+/)
      .map((n) => n.trim())
      .filter(Boolean);
  };

  const numbers = parseNumbers(input);
  const uniqueCount = new Set(numbers).size;
  const canSubmit = uniqueCount >= MIN_STUDENT_NUMBERS;

  const mutation = useMutation(
    () =>
      apiClient.post<BulkResponse>('/accountant/bulk-payment-status', {
        studentNumbers: numbers,
      }),
    {
      onSuccess: (res) => {
        setData(res.data);
        toast.success(`Verification complete: ${res.data.summary.found} students found`);
      },
      onError: (err: unknown) => {
        const res = err as { response?: { data?: { message?: string } } };
        const msg = res.response?.data?.message || res.response?.data?.error || 'Verification failed';
        toast.error(msg);
      },
    }
  );

  const handleExportCSV = () => {
    if (!data?.results?.length) return;
    const headers = [
      'Student Number',
      'Student ID',
      'Student Name',
      'Found',
      'Clearance Eligible',
      'Paid Semesters',
      'Missing Semesters',
      'Verified Payments Count',
      'Total Verified Amount',
    ];
    const rows = data.results.map((r) =>
      [
        r.student_number,
        r.student_id ?? '',
        r.student_name ?? '',
        r.found ? 'Yes' : 'No',
        r.clearance_eligible ? 'Yes' : 'No',
        r.paid_semesters.join(';'),
        r.missing_semesters.join(';'),
        r.total_verified_payments,
        r.total_verified_amount,
      ].join(',')
    );
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `bulk-payment-status-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    toast.success('CSV downloaded');
  };

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-slate-800 dark:text-slate-100 mb-8">
        Bulk Payment Status & Cross-Reference
      </h1>
      <p className="text-slate-600 dark:text-slate-400 mb-6">
        Enter one or more student numbers (one per line or comma separated). The system will verify and cross-reference payment status and clearance eligibility for each. You can verify from 1 student up to any number.
      </p>

      <div className="card p-6 mb-6">
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
          Student numbers
        </label>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="ICU2024001&#10;ICU2024002&#10;..."
          rows={12}
          className="input-field w-full font-mono text-sm"
        />
        <div className="flex items-center justify-between mt-3">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {uniqueCount} unique student number(s)
            {!canSubmit && (
              <span className="text-amber-600 dark:text-amber-400 ml-2">
                — enter at least one student number to run verification
              </span>
            )}
          </p>
          <button
            type="button"
            onClick={() => mutation.mutate()}
            disabled={!canSubmit || mutation.isLoading}
            className="btn-primary flex items-center gap-2 disabled:opacity-50"
          >
            {mutation.isLoading ? (
              <LoadingSpinner size="sm" />
            ) : (
              <Search className="w-4 h-4" />
            )}
            Run verification
          </button>
        </div>
      </div>

      {mutation.isLoading && (
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      )}

      {data && !mutation.isLoading && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="card">
              <p className="text-sm text-slate-600 dark:text-slate-400">Requested</p>
              <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                {data.summary.total_requested}
              </p>
            </div>
            <div className="card">
              <p className="text-sm text-slate-600 dark:text-slate-400">Found</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {data.summary.found}
              </p>
            </div>
            <div className="card">
              <p className="text-sm text-slate-600 dark:text-slate-400">Not found</p>
              <p className="text-2xl font-bold text-slate-600 dark:text-slate-400">
                {data.summary.not_found}
              </p>
            </div>
            <div className="card">
              <p className="text-sm text-slate-600 dark:text-slate-400">Clearance eligible</p>
              <p className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">
                {data.summary.clearance_eligible_count}
              </p>
            </div>
          </div>

          <div className="flex justify-end mb-4">
            <button
              type="button"
              onClick={handleExportCSV}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>

          <div className="card overflow-hidden">
            <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
              <table className="w-full">
                <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800/95">
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <th className="text-left py-3 px-4 text-slate-600 dark:text-slate-400">Student #</th>
                    <th className="text-left py-3 px-4 text-slate-600 dark:text-slate-400">Name</th>
                    <th className="text-left py-3 px-4 text-slate-600 dark:text-slate-400">Found</th>
                    <th className="text-left py-3 px-4 text-slate-600 dark:text-slate-400">Clearance</th>
                    <th className="text-left py-3 px-4 text-slate-600 dark:text-slate-400">Paid semesters</th>
                    <th className="text-left py-3 px-4 text-slate-600 dark:text-slate-400">Missing</th>
                    <th className="text-left py-3 px-4 text-slate-600 dark:text-slate-400">Verified count</th>
                    <th className="text-left py-3 px-4 text-slate-600 dark:text-slate-400">Amount (ZMW)</th>
                  </tr>
                </thead>
                <tbody>
                  {data.results.map((r, i) => (
                    <tr
                      key={`${r.student_number}-${i}`}
                      className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-white/5"
                    >
                      <td className="py-2 px-4 font-medium text-slate-800 dark:text-slate-200">
                        {r.student_number}
                      </td>
                      <td className="py-2 px-4 text-slate-700 dark:text-slate-300">
                        {r.student_name ?? '—'}
                      </td>
                      <td className="py-2 px-4">
                        {r.found ? (
                          <span className="text-green-600 dark:text-green-400">Yes</span>
                        ) : (
                          <span className="text-red-600 dark:text-red-400">No</span>
                        )}
                      </td>
                      <td className="py-2 px-4">
                        {r.found && (
                          r.clearance_eligible ? (
                            <span className="text-green-600 dark:text-green-400">Eligible</span>
                          ) : (
                            <span className="text-amber-600 dark:text-amber-400">Not yet</span>
                          )
                        )}
                      </td>
                      <td className="py-2 px-4 text-slate-600 dark:text-slate-400 text-sm">
                        {r.paid_semesters.length ? r.paid_semesters.join(', ') : '—'}
                      </td>
                      <td className="py-2 px-4 text-slate-600 dark:text-slate-400 text-sm">
                        {r.missing_semesters.length ? r.missing_semesters.join(', ') : '—'}
                      </td>
                      <td className="py-2 px-4 text-slate-700 dark:text-slate-300">
                        {r.total_verified_payments}
                      </td>
                      <td className="py-2 px-4 text-slate-700 dark:text-slate-300">
                        {r.total_verified_amount.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
