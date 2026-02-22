import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Eye, EyeOff } from 'lucide-react';
import { authService } from '../api/services';
import { useTheme } from '../contexts/ThemeContext';

type LoginFormData = {
  role: 'staff' | 'student';
  identifier: string;
  password: string;
};

export default function Login() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { register, handleSubmit, formState: { errors } } = useForm<LoginFormData>({
    defaultValues: { role: 'staff' },
  });

  const onSubmit = async (data: LoginFormData) => {
    setLoading(true);
    try {
      let res;
      if (data.role === 'student') {
        res = await authService.studentLogin(data.identifier, data.password);
        localStorage.setItem('token', res.data.token);
        toast.success('Welcome back!');
        navigate('/student-portal');
      } else {
        res = await authService.staffLogin(data.identifier, data.password);
        localStorage.setItem('token', res.data.token);
        toast.success('Welcome back!');
        navigate('/');
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Login failed');
    } finally {
      setLoading(false);
    }
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
      <div className="card w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <h1 className="font-display text-2xl font-bold text-slate-800 dark:text-slate-100">
            ICU Payment System
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2">
            Blockchain-Based Reconciliation
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Sign in as
            </label>
            <select
              {...register('role', { required: 'Role is required' })}
              className="input-field"
            >
              <option value="staff">Staff</option>
              <option value="student">Student</option>
            </select>
            {errors.role && (
              <p className="text-red-500 text-sm mt-1">{errors.role.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Email or Student Number
            </label>
            <input
              {...register('identifier', { required: 'This field is required' })}
              type="text"
              className="input-field"
              placeholder="admin@icu.edu.zm or ICU2024001"
            />
            {errors.identifier && (
              <p className="text-red-500 text-sm mt-1">{errors.identifier.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Password
            </label>
            <div className="relative">
              <input
                {...register('password', { required: 'Password is required' })}
                type={showPassword ? 'text' : 'password'}
                className="input-field pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            {errors.password && (
              <p className="text-red-500 text-sm mt-1">{errors.password.message}</p>
            )}
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full py-3">
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
          Not registered?{' '}
          <Link to="/student" className="text-icu-accent font-medium hover:underline">
            Check payment status (no login)
          </Link>
        </p>
      </div>
    </div>
  );
}
