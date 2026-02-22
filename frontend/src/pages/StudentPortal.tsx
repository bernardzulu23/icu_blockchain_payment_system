import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery } from 'react-query';
import { studentService } from '../api/services';
import { useTheme } from '../contexts/ThemeContext';

type FormData = { studentId: string; reference: string };

export default function StudentPortal() {
  const [query, setQuery] = useState<FormData | null>(null);
  const { theme, toggleTheme } = useTheme();
  const { register, handleSubmit } = useForm<FormData>();

  const { data, isLoading } = useQuery(
    ['student-check', query],
    () => query ? studentService.checkPayment(query.studentId, query.reference).then((r) => r.data) : null,
    { enabled: !!query }
  );

  const onSubmit = (formData: FormData) => {
    setQuery(formData);
  };

  return (
    <div className="min-h-screen flex items-center justify-center page-bg-auth p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-icu-accent/10 via-transparent to-transparent" />
      <button
        onClick={toggleTheme}
        className="absolute top-4 right-4 glass px-3 py-2 rounded-xl text-sm text-slate-600 dark:text-slate-300 hover:text-icu-accent transition-colors"
      >
        {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
      </button>
      <div className="card w-full max-w-lg relative z-10">
        <div className="text-center mb-8">
          <h1 className="font-display text-2xl font-bold text-slate-800 dark:text-slate-100">
            Check Payment Status
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2">
            No queues. No lost slips. 24/7 access.
          </p>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Student ID
            </label>
            <input
              {...register('studentId', { required: true })}
              className="input-field"
              placeholder="e.g. ICU2024001"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Batch Number / Reference
            </label>
            <input
              {...register('reference', { required: true })}
              className="input-field"
              placeholder="From your deposit slip"
            />
          </div>
          <button type="submit" className="btn-primary w-full py-3">
            Check Status
          </button>
        </form>
        {query && (
          <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-700">
            {isLoading ? (
              <p className="text-slate-500 dark:text-slate-400">Checking...</p>
            ) : data ? (
              <div className="glass-subtle bg-green-500/10 border-green-500/30 rounded-xl p-4">
                <p className="font-semibold text-green-600 dark:text-green-400">Payment Verified ✓</p>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                  {data.studentName} - {data.amount.toLocaleString()} ZMW
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Reference: {data.reference}</p>
                {data.txHash && (
                  <p className="text-xs font-mono text-slate-600 dark:text-slate-400 mt-2">
                    Blockchain: {data.txHash.slice(0, 32)}...
                  </p>
                )}
              </div>
            ) : (
              <div className="glass-subtle bg-amber-500/10 border-amber-500/30 rounded-xl p-4">
                <p className="font-semibold text-amber-600 dark:text-amber-400">
                  No matching payment found
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                  Verify your Student ID and Reference. If you paid recently, allow 24-48 hours for
                  processing.
                </p>
              </div>
            )}
          </div>
        )}
        <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
          <a href="/login" className="text-icu-accent font-medium hover:underline">
            Staff login
          </a>
        </p>
      </div>
    </div>
  );
}
