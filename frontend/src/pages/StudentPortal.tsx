import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery } from 'react-query';
import { Link } from 'react-router-dom';
import { Sun, Moon } from 'lucide-react';
import { studentService } from '../api/services';
import { useTheme } from '../contexts/ThemeContext';
import LoadingSpinner from '../components/LoadingSpinner';

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
    <div className="min-h-screen flex items-center justify-center p-4 page-bg text-ink selection:bg-accent selection:text-white">
      <button type="button" onClick={toggleTheme} className="absolute top-4 right-4 btn-secondary text-xs z-20 inline-flex items-center gap-1.5">
        {theme === 'dark' ? <><Sun className="h-3.5 w-3.5" aria-hidden /> Light</> : <><Moon className="h-3.5 w-3.5" aria-hidden /> Dark</>}
      </button>

      <div className="w-full max-w-lg relative z-10 border-2 border-ink bg-paper p-8 brutal-shadow-lg">
        <div className="text-center mb-8 border-b-2 border-ink pb-6">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 border-2 border-ink bg-white p-2 brutal-shadow">
              <img src="/logo.jpg" alt="ICU Logo" className="w-full h-full object-contain" />
            </div>
          </div>
          <h1 className="font-display text-3xl text-ink">Check Payment Status</h1>
          <p className="font-mono text-[10px] text-accent uppercase tracking-[0.2em] mt-2">
            No queues · No lost slips · 24/7
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div>
            <input
              {...register('studentNumber', { required: true })}
              type="text"
              className="input-field"
              placeholder="Student number (e.g. ICU2024001)"
            />
          </div>
          <div>
            <input
              {...register('reference', { required: true })}
              type="text"
              className="input-field"
              placeholder="Batch number from your deposit slip"
            />
          </div>
          <button type="submit" className="btn-primary w-full py-3">
            Check Status
          </button>
        </form>

        {query && (
          <div className="mt-8 pt-6 border-t-2 border-ink">
            {isLoading ? (
              <LoadingSpinner label="Checking" />
            ) : data && !isError ? (
              <div className="border-2 border-ink bg-white p-5 brutal-shadow">
                <p className="font-mono text-[10px] uppercase tracking-wider text-accent mb-2">Payment Verified</p>
                <p className="text-lg font-bold text-ink">{data.studentName}</p>
                <p className="text-2xl font-bold text-accent mt-1">
                  {Number(data.amount || 0).toLocaleString()} ZMW
                </p>
                <div className="mt-4 space-y-2 font-mono text-xs">
                  <div>
                    <p className="text-ink/40 uppercase tracking-wider">Reference</p>
                    <p className="text-ink">{data.reference}</p>
                  </div>
                  {data.semester && (
                    <div>
                      <p className="text-ink/40 uppercase tracking-wider">Semester</p>
                      <p className="text-ink">
                        {data.semester} {data.academicYear || ''}
                      </p>
                    </div>
                  )}
                  {data.txHash && (
                    <div>
                      <p className="text-ink/40 uppercase tracking-wider">Blockchain ID</p>
                      <p className="text-ink break-all border-2 border-ink bg-paper p-2 mt-1">{data.txHash}</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="border-2 border-accent bg-[#FFE8E0] p-5">
                <p className="font-bold text-accent uppercase text-sm mb-2">No Match Found</p>
                <p className="text-sm text-ink/70 leading-relaxed">
                  Verify your student number and batch number. If you paid recently, allow 24–48 hours for
                  verification.
                </p>
              </div>
            )}
          </div>
        )}

        <div className="mt-8 text-center">
          <Link to="/login" className="font-mono text-xs uppercase tracking-widest text-ink/50 hover:text-accent">
            Staff login
          </Link>
        </div>
      </div>
    </div>
  );
}
