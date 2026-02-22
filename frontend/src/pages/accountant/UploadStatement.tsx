import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'react-toastify';
import { apiClient } from '../../api/client';

type FormData = {
  bank_name: string;
  upload_date: string;
};

export default function UploadStatement() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit } = useForm<FormData>();

  const onSubmit = async (data: FormData) => {
    if (!file) {
      toast.error('Please select a PDF file');
      return;
    }
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('statement', file);
      formData.append('bank_name', data.bank_name);
      formData.append('upload_date', data.upload_date || new Date().toISOString().split('T')[0]);
      await apiClient.post('/accountant/bank-statement', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
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
        Upload Bank Statement
      </h1>
      <div className="card max-w-xl">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Bank Name</label>
            <input {...register('bank_name', { required: true })} className="input-field w-full" placeholder="e.g. Zanaco" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Statement Date</label>
            <input {...register('upload_date')} type="date" className="input-field w-full" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Statement PDF</label>
            <input
              type="file"
              accept=".pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="input-field w-full"
            />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'Uploading...' : 'Upload Statement'}
          </button>
        </form>
        <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">
          The system will extract transactions and run automated matching in the background.
        </p>
      </div>
    </div>
  );
}
