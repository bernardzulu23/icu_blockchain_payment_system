import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { toast } from 'react-toastify';
import { Upload, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { apiClient } from '../../api/client';

const getStatementUrl = (path: string | undefined) => {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  const base = (import.meta.env.VITE_API_URL || '/api').replace(/\/api\/?$/, '');
  return `${base || window.location.origin}${path.startsWith('/') ? '' : '/'}${path}`;
};

type FormData = {
  semester: string;
  academic_year: string;
  amount: number;
  batch_number: string;
  bank_name: string;
  payment_date: string;
};

type DuplicateCheck = {
  exists: boolean;
  payment?: {
    status: string;
    amount: number;
    verified_date: string;
    statement_url?: string;
  };
  warning?: string;
};

export default function SubmitPayment() {
  const navigate = useNavigate();
  const { register, handleSubmit, formState: { errors }, watch } = useForm<FormData>();

  const [depositSlip, setDepositSlip] = useState<File | null>(null);
  const [depositSlipPreview, setDepositSlipPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [duplicateCheck, setDuplicateCheck] = useState<DuplicateCheck | null>(null);
  const [, setCheckingDuplicate] = useState(false);

  const semester = watch('semester');
  const academicYear = watch('academic_year');

  useEffect(() => {
    if (semester && academicYear) {
      checkForDuplicatePayment(semester, academicYear);
    } else {
      setDuplicateCheck(null);
    }
  }, [semester, academicYear]);

  const checkForDuplicatePayment = async (sem: string, year: string) => {
    setCheckingDuplicate(true);
    try {
      const response = await apiClient.get<DuplicateCheck>('/payments/check-duplicate', {
        params: { semester: sem, academic_year: year },
      });
      setDuplicateCheck(response.data);
      if (response.data.exists && response.data.payment?.status === 'verified') {
        toast.warning('⚠️ You have already paid for this semester!', { autoClose: 8000 });
      }
    } catch (error) {
      console.error('Duplicate check error:', error);
    } finally {
      setCheckingDuplicate(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
      if (!validTypes.includes(file.type)) {
        toast.error('Please upload a valid image (JPG, PNG) or PDF file');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error('File size must be less than 5MB');
        return;
      }
      setDepositSlip(file);
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => setDepositSlipPreview(reader.result as string);
        reader.readAsDataURL(file);
      } else {
        setDepositSlipPreview(null);
      }
    }
  };

  const onSubmit = async (data: FormData) => {
    if (duplicateCheck?.exists && duplicateCheck.payment?.status === 'verified') {
      toast.error('🚨 CANNOT SUBMIT: You already paid for this semester! DO NOT PAY AGAIN!');
      return;
    }
    if (!depositSlip) {
      toast.error('Please upload your deposit slip');
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('semester', data.semester);
      formData.append('academic_year', data.academic_year);
      formData.append('amount', String(data.amount));
      formData.append('batch_number', data.batch_number);
      formData.append('bank_name', data.bank_name);
      formData.append('payment_date', data.payment_date);
      formData.append('depositSlip', depositSlip);

      await apiClient.post('/payments/submit', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      toast.success('✅ Payment submitted successfully! You will be notified once verified.');
      setTimeout(() => navigate('/student-portal/payments'), 2000);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string; message?: string; warning?: string; action?: string } } };
      const errorData = err.response?.data;

      if (errorData?.error === 'DUPLICATE_PAYMENT_DETECTED') {
        toast.error(
          <div>
            <p className="font-bold">{errorData.message}</p>
            <p className="text-sm mt-2">{errorData.warning}</p>
            <p className="text-sm mt-1">{errorData.action}</p>
          </div>,
          { autoClose: 10000 }
        );
      } else {
        toast.error(errorData?.message || 'Failed to submit payment. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="card p-8">
        <div className="mb-6">
          <h1 className="font-display text-3xl font-bold text-slate-800 dark:text-slate-100">Submit Payment</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2">Upload your bank deposit slip for verification</p>
        </div>

        {duplicateCheck?.exists && (
          <div
            className={`mb-6 p-4 rounded-lg border-2 ${
              duplicateCheck.payment?.status === 'verified'
                ? 'bg-red-50 dark:bg-red-900/20 border-red-500 dark:border-red-600'
                : 'bg-amber-50 dark:bg-amber-900/20 border-amber-500 dark:border-amber-600'
            }`}
          >
            <div className="flex items-start">
              <AlertTriangle
                className={`h-6 w-6 mr-3 flex-shrink-0 ${
                  duplicateCheck.payment?.status === 'verified' ? 'text-red-600' : 'text-amber-600'
                }`}
              />
              <div>
                <h3 className="font-bold text-lg mb-2">
                  {duplicateCheck.payment?.status === 'verified'
                    ? '🚨 PAYMENT ALREADY VERIFIED!'
                    : '⚠️ Payment Already Submitted'}
                </h3>
                <p className="text-sm mb-2">{duplicateCheck.warning}</p>
                {duplicateCheck.payment?.status === 'verified' && duplicateCheck.payment && (
                  <>
                    <div className="bg-white dark:bg-slate-800 p-3 rounded mt-3 border border-red-300 dark:border-red-700">
                      <p className="text-sm font-semibold">Payment Details:</p>
                      <p className="text-sm">Amount: K{duplicateCheck.payment.amount}</p>
                      <p className="text-sm">
                        Verified: {new Date(duplicateCheck.payment.verified_date).toLocaleDateString()}
                      </p>
                    </div>
                    <p className="text-sm font-bold mt-3 text-red-700 dark:text-red-400">
                      DO NOT PROCEED! If you pay again, you will lose your money!
                    </p>
                    {duplicateCheck.payment.statement_url && (
                      <a
                        href={getStatementUrl(duplicateCheck.payment.statement_url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block mt-3 px-4 py-2 bg-icu-accent text-white rounded-lg hover:opacity-90"
                      >
                        Download Your Statement
                      </a>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-300 dark:border-blue-700 rounded-lg">
          <div className="flex items-start">
            <Info className="h-6 w-6 text-blue-600 dark:text-blue-400 mr-3 flex-shrink-0" />
            <div>
              <h3 className="font-bold text-lg mb-2">Before You Submit:</h3>
              <ul className="text-sm space-y-1 list-disc list-inside text-slate-700 dark:text-slate-300">
                <li>Upload a clear photo of your bank deposit slip</li>
                <li>Ensure batch number is visible and correct</li>
                <li>Double-check semester and academic year</li>
                <li>System will automatically verify your payment</li>
                <li>You will receive SMS/Email when verified</li>
              </ul>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Semester <span className="text-red-500">*</span>
            </label>
            <select
              {...register('semester', { required: 'Semester is required' })}
              className="input-field w-full"
            >
              <option value="">Select Semester</option>
              <option value="1">Semester 1</option>
              <option value="2">Semester 2</option>
              <option value="3">Semester 3</option>
            </select>
            {errors.semester && <p className="text-red-500 text-sm mt-1">{errors.semester.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Academic Year <span className="text-red-500">*</span>
            </label>
            <select
              {...register('academic_year', { required: 'Academic year is required' })}
              className="input-field w-full"
            >
              <option value="">Select Academic Year</option>
              <option value="2024-2025">2024-2025</option>
              <option value="2025-2026">2025-2026</option>
              <option value="2026-2027">2026-2027</option>
            </select>
            {errors.academic_year && <p className="text-red-500 text-sm mt-1">{errors.academic_year.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Amount (Kwacha) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              {...register('amount', {
                required: 'Amount is required',
                min: { value: 1, message: 'Amount must be greater than 0' },
              })}
              className="input-field w-full"
              placeholder="e.g., 5000.00"
            />
            {errors.amount && <p className="text-red-500 text-sm mt-1">{errors.amount.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Batch Number <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              {...register('batch_number', {
                required: 'Batch number is required',
                minLength: { value: 3, message: 'Batch number too short' },
              })}
              className="input-field w-full"
              placeholder="e.g., 123456"
            />
            {errors.batch_number && <p className="text-red-500 text-sm mt-1">{errors.batch_number.message}</p>}
            <p className="text-xs text-slate-500 mt-1">Find this on your deposit slip (usually 5-8 digits)</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Bank Name <span className="text-red-500">*</span>
            </label>
            <select
              {...register('bank_name', { required: 'Bank name is required' })}
              className="input-field w-full"
            >
              <option value="">Select Bank</option>
              <option value="ZANACO">ZANACO</option>
              <option value="Stanbic Bank">Stanbic Bank</option>
              <option value="FNB Zambia">FNB Zambia</option>
              <option value="Indo Zambia Bank">Indo Zambia Bank</option>
              <option value="Atlas Mara">Atlas Mara</option>
            </select>
            {errors.bank_name && <p className="text-red-500 text-sm mt-1">{errors.bank_name.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Payment Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              {...register('payment_date', { required: 'Payment date is required' })}
              max={new Date().toISOString().split('T')[0]}
              className="input-field w-full"
            />
            {errors.payment_date && <p className="text-red-500 text-sm mt-1">{errors.payment_date.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Deposit Slip <span className="text-red-500">*</span>
            </label>
            <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-slate-300 dark:border-slate-600 border-dashed rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <Upload className="w-12 h-12 text-slate-400 mb-3" />
                <p className="mb-2 text-sm text-slate-500 dark:text-slate-400">
                  <span className="font-semibold">Click to upload</span> or drag and drop
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">JPG, PNG or PDF (MAX. 5MB)</p>
              </div>
              <input
                type="file"
                className="hidden"
                accept="image/jpeg,image/jpg,image/png,application/pdf"
                onChange={handleFileChange}
              />
            </label>
            {depositSlipPreview && (
              <div className="mt-4">
                <img
                  src={depositSlipPreview}
                  alt="Deposit slip preview"
                  className="max-w-full h-auto rounded-lg border border-slate-300 dark:border-slate-600"
                />
              </div>
            )}
            {depositSlip && (
              <div className="mt-2 flex items-center text-sm text-green-600 dark:text-green-400">
                <CheckCircle className="h-5 w-5 mr-2" />
                {depositSlip.name}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-4">
            <button
              type="button"
              onClick={() => navigate('/student-portal/payments')}
              className="px-6 py-3 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                isSubmitting ||
                (duplicateCheck?.exists && duplicateCheck.payment?.status === 'verified')
              }
              className={`px-6 py-3 rounded-lg text-white font-medium ${
                isSubmitting || (duplicateCheck?.exists && duplicateCheck.payment?.status === 'verified')
                  ? 'bg-slate-400 cursor-not-allowed'
                  : 'bg-icu-accent hover:opacity-90'
              }`}
            >
              {isSubmitting ? 'Submitting...' : 'Submit Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
