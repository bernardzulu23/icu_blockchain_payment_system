import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Sun, Moon } from 'lucide-react';
import { authService } from '../api/services';
import { useTheme } from '../contexts/ThemeContext';
import BrandLogo from '../components/BrandLogo';
import FabricPoweredBadge from '../components/FabricPoweredBadge';

type FormData = {
  email: string;
};

export default function ForgotPassword() {
  const [loading, setLoading] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>();

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const res = await authService.forgotPassword(data.email);
      toast.success(res.data.message || 'If this email exists, you will receive a reset link.');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string; message?: string } } })?.response?.data?.error
        || (err as { response?: { data?: { error?: string; message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Unable to send reset email');
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
            <BrandLogo size="lg" />
          </div>
          <h1 className="font-display text-3xl text-ink">Forgot Password</h1>
          <p className="font-mono text-xs text-ink/50 uppercase tracking-widest mt-2">
            Enter your email to receive a reset link
          </p>
          <div className="flex justify-center mt-3">
            <FabricPoweredBadge />
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div>
            <input
              {...register('email', {
                required: 'Email is required',
                pattern: { value: /^\S+@\S+$/i, message: 'Invalid email' },
              })}
              type="email"
              className="input-field"
              placeholder="Enter your email"
            />
            {errors.email && (
              <p className="text-accent text-xs mt-1 font-semibold">{errors.email.message}</p>
            )}
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full py-3">
            {loading ? 'Sending…' : 'Send Reset Link'}
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
