import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { userService } from '../../api/services';
import { ACADEMIC_YEAR_START, ACADEMIC_YEAR_END } from '../../constants/options';

type FormData = {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  residentialAddress: string;
  dateOfBirth: string;
};

export default function RegisterAccountant() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<FormData>();

  const onSubmit = async (data: FormData) => {
    if (data.password !== data.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    setSubmitting(true);
    try {
      const res = await userService.create({
        fullName: data.fullName.trim(),
        email: data.email.trim().toLowerCase(),
        password: data.password,
        role: 'accountant',
        residentialAddress: data.residentialAddress.trim(),
        dateOfBirth: data.dateOfBirth,
      });
      const empId = res.data?.employee_id;
      toast.success(
        empId
          ? `Accountant registered. Employee ID: ${empId}`
          : 'Accountant officer registered successfully'
      );
      navigate('/admin/staff');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string; message?: string } } })?.response
        ?.data?.error
        || (err as { response?: { data?: { error?: string; message?: string } } })?.response?.data
          ?.message;
      toast.error(msg || 'Failed to register accountant');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">
        Register Accountant Officer
      </h1>
      <p className="text-slate-600 dark:text-slate-400 mb-6">
        Create an accountant account. An Employee ID is generated automatically. They sign in with
        email (or Employee ID) and the password you set.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="card space-y-5">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Full Name <span className="text-red-500">*</span>
          </label>
          <input
            className="input-field w-full"
            placeholder="e.g. Jane Banda"
            {...register('fullName', { required: 'Full name is required' })}
          />
          {errors.fullName && (
            <p className="text-red-500 text-sm mt-1">{errors.fullName.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Employee ID
          </label>
          <input
            className="input-field w-full opacity-80"
            value="Auto-generated (e.g. ACC-2026-0001)"
            readOnly
            disabled
          />
          <p className="font-mono text-[10px] uppercase tracking-widest text-ink/50 mt-1">
            Assigned on save — shown after registration
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Email Address <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            className="input-field w-full"
            placeholder="accountant@icu.edu.zm"
            {...register('email', {
              required: 'Email is required',
              pattern: { value: /^\S+@\S+$/i, message: 'Invalid email' },
            })}
          />
          {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Password <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              className="input-field w-full"
              placeholder="Min 8 characters"
              {...register('password', {
                required: 'Password is required',
                minLength: { value: 8, message: 'Min 8 characters' },
              })}
            />
            {errors.password && (
              <p className="text-red-500 text-sm mt-1">{errors.password.message}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Confirm Password <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              className="input-field w-full"
              placeholder="Re-enter password"
              {...register('confirmPassword', {
                required: 'Please confirm password',
                validate: (v) => v === watch('password') || 'Passwords do not match',
              })}
            />
            {errors.confirmPassword && (
              <p className="text-red-500 text-sm mt-1">{errors.confirmPassword.message}</p>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Residential Address <span className="text-red-500">*</span>
          </label>
          <textarea
            className="input-field w-full min-h-[88px]"
            placeholder="Physical / residential address"
            {...register('residentialAddress', { required: 'Residential address is required' })}
          />
          {errors.residentialAddress && (
            <p className="text-red-500 text-sm mt-1">{errors.residentialAddress.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Date of Birth <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            className="input-field w-full"
            min={`${ACADEMIC_YEAR_START}-01-01`}
            max={`${ACADEMIC_YEAR_END}-12-31`}
            {...register('dateOfBirth', { required: 'Date of birth is required' })}
          />
          {errors.dateOfBirth && (
            <p className="text-red-500 text-sm mt-1">{errors.dateOfBirth.message}</p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button type="submit" disabled={submitting} className="btn-primary flex-1">
            {submitting ? 'Registering…' : 'Register Accountant'}
          </button>
          <Link to="/admin/staff" className="btn-secondary flex-1 text-center">
            View all staff
          </Link>
        </div>
      </form>
    </div>
  );
}
