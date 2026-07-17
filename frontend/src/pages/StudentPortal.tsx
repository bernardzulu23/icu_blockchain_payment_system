import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery } from 'react-query';
import { studentService } from '../api/services';
import { useTheme } from '../contexts/ThemeContext';

type FormData = { studentNumber: string; reference: string };

export default function StudentPortal() {
  const [query, setQuery] = useState<FormData | null>(null);
  const { theme, toggleTheme } = useTheme();
  const { register, handleSubmit } = useForm<FormData>();

  const { data, isLoading, isError } = useQuery(
    ['student-check', query],
    () =>
      query
        ? studentService.checkPayment(query.studentNumber, query.reference).then((r) => r.data)
        : Promise.reject(new Error('No query')),
    { enabled: !!query, retry: false }
  );

  const onSubmit = (formData: FormData) => {
    setQuery(formData);
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-cover bg-center bg-no-repeat"
      style={{
        backgroundImage:
          'url("https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=2070&auto=format&fit=crop")',
      }}
    >
      <div className="absolute inset-0 bg-black/40" />

      <button
        onClick={toggleTheme}
        className="absolute top-4 right-4 bg-white/10 backdrop-blur-md border border-white/20 px-3 py-2 rounded-xl text-sm text-white hover:bg-white/20 transition-all z-20"
      >
        {theme === 'dark' ? '☀️' : '🌙'}
      </button>

      <div className="w-full max-w-lg relative z-10 bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-8 shadow-2xl">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/20 shadow-xl">
              <img src="/logo.jpg" alt="BluePeack Logo" className="w-full h-full object-contain filter drop-shadow-lg" />
            </div>
          </div>
          <h1 className="font-display text-3xl font-bold text-white tracking-tight">Check Payment Status</h1>
          <p className="text-white/60 text-sm mt-2 font-medium uppercase tracking-widest">
            No queues. No lost slips. 24/7 access.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          <div>
            <input
              {...register('studentNumber', { required: true })}
              type="text"
              className="w-full bg-transparent border-b border-white/30 text-white py-3 placeholder:text-white/50 focus:outline-none focus:border-white transition-colors"
              placeholder="Student number (e.g. ICU2024001)"
            />
          </div>
          <div>
            <input
              {...register('reference', { required: true })}
              type="text"
              className="w-full bg-transparent border-b border-white/30 text-white py-3 placeholder:text-white/50 focus:outline-none focus:border-white transition-colors"
              placeholder="Batch number from your deposit slip"
            />
          </div>
          <button
            type="submit"
            className="w-full bg-white text-slate-900 font-bold py-4 rounded-lg hover:bg-white/90 active:scale-[0.98] transition-all shadow-xl uppercase tracking-widest text-xs"
          >
            Check Status
          </button>
        </form>

        {query && (
          <div className="mt-8 pt-8 border-t border-white/10">
            {isLoading ? (
              <div className="flex items-center justify-center gap-3 text-white/60 animate-pulse">
                <div className="w-2 h-2 rounded-full bg-white/60" />
                <span className="text-sm font-medium tracking-widest uppercase">Checking...</span>
              </div>
            ) : data && !isError ? (
              <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-6 shadow-xl">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center border border-cyan-500/30">
                    <span className="text-cyan-400 font-bold">✓</span>
                  </div>
                  <p className="font-bold text-white tracking-wide uppercase text-sm">Payment Verified</p>
                </div>
                <div className="space-y-2 pl-11">
                  <p className="text-lg font-bold text-white">{data.studentName}</p>
                  <p className="text-2xl font-bold text-cyan-400">{data.amount.toLocaleString()} ZMW</p>
                  <div className="pt-2">
                    <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold">Reference</p>
                    <p className="text-sm text-white/80">{data.reference}</p>
                  </div>
                  {data.semester && (
                    <div className="pt-2">
                      <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold">Semester</p>
                      <p className="text-sm text-white/80">
                        {data.semester} {data.academicYear || ''}
                      </p>
                    </div>
                  )}
                  {data.txHash && (
                    <div className="pt-2">
                      <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold">Blockchain ID</p>
                      <p className="text-[10px] font-mono text-cyan-400/80 break-all bg-black/20 p-2 rounded-lg border border-white/5 mt-1">
                        {data.txHash}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 shadow-xl">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center border border-red-500/30">
                    <span className="text-red-400 font-bold">!</span>
                  </div>
                  <p className="font-bold text-white tracking-wide uppercase text-sm">No Match Found</p>
                </div>
                <div className="pl-11">
                  <p className="text-sm text-white/60 leading-relaxed">
                    Verify your student number and batch number. If you paid recently, allow 24–48 hours for
                    verification.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mt-8 text-center">
          <a
            href="/login"
            className="text-white/60 hover:text-white font-bold text-xs uppercase tracking-widest transition-all"
          >
            Staff login
          </a>
        </div>
      </div>
    </div>
  );
}
