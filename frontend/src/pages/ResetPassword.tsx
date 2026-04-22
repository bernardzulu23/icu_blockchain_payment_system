import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
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
    <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: 'url("https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=2070&auto=format&fit=crop")' }}
    >
      <div className="absolute inset-0 bg-black/40" />

      <button
        onClick={toggleTheme}
        className="absolute top-4 right-4 bg-white/10 backdrop-blur-md border border-white/20 px-3 py-2 rounded-xl text-sm text-white hover:bg-white/20 transition-all z-20"
      >
        {theme === 'dark' ? '☀️' : '🌙'}
      </button>

      <div className="w-full max-w-md relative z-10 bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-8 shadow-2xl">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/20 shadow-xl">
              <img
                src="/logo.jpg"
                alt="BluePeack Logo"
                className="w-full h-full object-contain filter drop-shadow-lg"
              />
            </div>
          </div>
          <h1 className="font-display text-2xl font-bold text-white tracking-tight">
            Reset Password
          </h1>
          <p className="text-white/60 text-sm mt-2">
            Choose a new password for your account.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          <div>
            <input
              {...register('newPassword', {
                required: 'New password is required',
                minLength: { value: 6, message: 'Min 6 characters' },
              })}
              type="password"
              className="w-full bg-transparent border-b border-white/30 text-white py-3 placeholder:text-white/50 focus:outline-none focus:border-white transition-colors"
              placeholder="New password"
            />
            {errors.newPassword && (
              <p className="text-red-400 text-xs mt-1">{errors.newPassword.message}</p>
            )}
          </div>

          <div>
            <input
              {...register('confirmPassword', {
                required: 'Confirm password is required',
                minLength: { value: 6, message: 'Min 6 characters' },
              })}
              type="password"
              className="w-full bg-transparent border-b border-white/30 text-white py-3 placeholder:text-white/50 focus:outline-none focus:border-white transition-colors"
              placeholder="Confirm password"
            />
            {errors.confirmPassword && (
              <p className="text-red-400 text-xs mt-1">{errors.confirmPassword.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-white text-slate-900 font-bold py-4 rounded-lg hover:bg-white/90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100 shadow-xl"
          >
            {loading ? 'RESETTING...' : 'Reset Password'}
          </button>
        </form>

        <p className="mt-8 text-center text-sm text-white/60">
          <Link to="/login" className="text-white font-bold hover:underline">
            Back to login
          </Link>
        </p>
      </div>
    </div>
  );
}
