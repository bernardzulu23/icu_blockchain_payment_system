import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'react-toastify';
import { apiClient } from '../../api/client';
import { BANKS } from '../../constants/options';

type FormData = {
  bank_name: string;
  upload_date: string;
};

export default function UploadStatement() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadPercent, setUploadPercent] = useState(0);

  const { register, handleSubmit } = useForm<FormData>({
    defaultValues: { bank_name: BANKS[0].value },
  });

  const onSubmit = async (data: FormData) => {
    if (!file) {
      toast.error('Please select a PDF file');
      return;
    }
    setLoading(true);
    setUploadPercent(0);
    try {
      const formData = new FormData();
      formData.append('statement', file);
      formData.append('bank_name', data.bank_name);
      formData.append('upload_date', data.upload_date || new Date().toISOString().split('T')[0]);
      await apiClient.post('/accountant/bank-statement', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (evt) => {
          if (!evt.total) return;
          setUploadPercent(Math.round((evt.loaded / evt.total) * 100));
        },
      });
      setUploadPercent(100);
      toast.success('Bank statement uploaded. Processing in background.');
      setFile(null);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Failed to upload statement');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-slate-800 dark:text-slate-100 mb-8">
        Upload Bank Batch / Statement PDF
      </h1>
      <p className="text-slate-600 dark:text-slate-400 mb-6 max-w-xl">
        Upload the PDF from the bank containing batch numbers (transactions received). Student deposit slip batch numbers are cross-referenced against this list for clearance. Upload from time to time when the bank provides a new batch list.
      </p>
      <div className="card max-w-xl">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Bank Name</label>
            <select {...register('bank_name', { required: true })} className="input-field w-full">
              {BANKS.map((b) => (
                <option key={b.value} value={b.value}>
                  {b.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Statement / Batch List Date</label>
            <input {...register('upload_date')} type="date" className="input-field w-full" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Bank Batch PDF</label>
            <input
              type="file"
              accept=".pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="input-field w-full"
            />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? `Uploading ${uploadPercent}%` : 'Upload Statement'}
          </button>
        </form>
        <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">
          The system will extract batch numbers from the PDF and match them to student deposit slips. Clearance eligibility is based on this cross-reference.
        </p>
      </div>
    </div>
  );
}
