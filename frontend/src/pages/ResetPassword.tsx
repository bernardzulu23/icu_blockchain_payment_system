import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Sun, Moon } from 'lucide-react';
import { authService } from '../api/services';
import { useTheme } from '../contexts/ThemeContext';

type FormData = {
  newPassword: string;
  confirmPassword: string;
};

export default function ResetPassword() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>();

  const onSubmit = async (data: FormData) => {
    if (!token) {
      toast.error('Reset token is missing');
      return;
    }
    setLoading(true);
    try {
      const res = await authService.resetPassword(token, data.newPassword, data.confirmPassword);
      if (res.data.success) {
        toast.success(res.data.message || 'Password reset successful');
        navigate('/login');
      } else {
        toast.error(res.data.error || 'Invalid or expired reset link');
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string; message?: string } } })?.response?.data?.error
        || (err as { response?: { data?: { error?: string; message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 page-bg text-ink selection:bg-accent selection:text-white">
      <button type="button" onClick={toggleTheme} className="absolute top-4 right-4 btn-secondary text-xs z-20 inline-flex items-center gap-1.5">
        {theme === 'dark' ? <><Sun className="h-3.5 w-3.5" aria-hidden /> Light</> : <><Moon className="h-3.5 w-3.5" aria-hidden /> Dark</>}
      </button>

      <div className="w-full max-w-md relative z-10 border-2 border-ink bg-paper p-8 brutal-shadow-lg">
        <div className="text-center mb-8 border-b-2 border-ink pb-6">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 border-2 border-ink bg-white p-2 brutal-shadow">
              <img src="/logo.jpg" alt="ICU Logo" className="w-full h-full object-contain" />
            </div>
          </div>
          <h1 className="font-display text-3xl text-ink">Reset Password</h1>
          <p className="font-mono text-xs text-ink/50 uppercase tracking-widest mt-2">
            Choose a new password for your account
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div>
            <input
              {...register('newPassword', {
                required: 'New password is required',
                minLength: { value: 6, message: 'Min 6 characters' },
              })}
              type="password"
              className="input-field"
              placeholder="New password"
            />
            {errors.newPassword && (
              <p className="text-accent text-xs mt-1 font-semibold">{errors.newPassword.message}</p>
            )}
          </div>

          <div>
            <input
              {...register('confirmPassword', {
                required: 'Confirm password is required',
                minLength: { value: 6, message: 'Min 6 characters' },
              })}
              type="password"
              className="input-field"
              placeholder="Confirm password"
            />
            {errors.confirmPassword && (
              <p className="text-accent text-xs mt-1 font-semibold">{errors.confirmPassword.message}</p>
            )}
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full py-3">
            {loading ? 'Resetting…' : 'Reset Password'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm">
          <Link to="/login" className="font-bold text-ink hover:text-accent underline">
            Back to login
          </Link>
        </p>
      </div>
    </div>
  );
}
