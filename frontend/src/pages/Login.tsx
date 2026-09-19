import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, Link } from 'react-router-dom';
import { useQueryClient } from 'react-query';
import { toast } from 'react-toastify';
import { Sun, Moon, ArrowLeft, Home } from 'lucide-react';
import { authService } from '../api/services';
import { ensureCsrfToken } from '../utils/csrf';
import { useTheme } from '../contexts/ThemeContext';
import { getHomeForRole } from '../utils/routing';
import BrandLogo from '../components/BrandLogo';
import PasswordInput from '../components/PasswordInput';
import FabricPoweredBadge from '../components/FabricPoweredBadge';
import ShapeGrid from '../components/ShapeGrid/ShapeGrid';

type LoginFormData = {
  identifier: string;
  password: string;
};

export default function Login() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { register, handleSubmit, formState: { errors } } = useForm<LoginFormData>();

  const isDark = theme === 'dark';
  const gridBorderColor = isDark ? 'rgba(201, 195, 183, 0.2)' : 'rgba(17, 17, 17, 0.35)';

  useEffect(() => {
    ensureCsrfToken().catch(() => {
      /* login will surface CSRF error if cookie missing */
    });
  }, []);

  const onSubmit = async (data: LoginFormData) => {
    setLoading(true);
    try {
      await ensureCsrfToken();
      const res = await authService.login(data.identifier, data.password);
      const token = res.data.token || res.data.accessToken;
      const rawUser = res.data.user;
      if (!token || !rawUser) {
        throw new Error('Login response missing token or user');
      }

      const role =
        rawUser.role || (rawUser.type === 'student' ? 'student' : undefined);
      const user = {
        id: rawUser.id || rawUser.user_id || rawUser.student_id,
        userId: rawUser.id || rawUser.user_id || rawUser.student_id,
        email: rawUser.email,
        student_number: rawUser.student_number,
        name:
          rawUser.name ||
          rawUser.full_name ||
          `${rawUser.first_name || ''} ${rawUser.last_name || ''}`.trim(),
        role,
        type: rawUser.type,
        username: rawUser.username,
        employee_id: rawUser.employee_id,
        first_name: rawUser.first_name,
        last_name: rawUser.last_name,
      };

      localStorage.setItem('token', token);
      queryClient.setQueryData('auth-user', user);

      toast.success('Welcome back!');
      navigate(getHomeForRole(role));
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string; error?: string } } })?.response?.data
          ?.message ||
        (err as { response?: { data?: { message?: string; error?: string } } })?.response?.data
          ?.error ||
        (err instanceof Error ? err.message : undefined);
      toast.error(msg || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden flex flex-col bg-paper text-ink dark:bg-ink dark:text-paper selection:bg-accent selection:text-white">
      <div className="absolute inset-0 z-0" aria-hidden>
        <div
          className="absolute inset-0"
          style={{
            background: isDark
              ? 'radial-gradient(ellipse 70% 50% at 20% 10%, rgba(255,59,0,0.2), transparent 55%), radial-gradient(ellipse 60% 40% at 90% 0%, rgba(0,200,180,0.15), transparent 50%)'
              : 'radial-gradient(ellipse 70% 50% at 15% 10%, rgba(255,59,0,0.22), transparent 50%), radial-gradient(ellipse 55% 40% at 95% 5%, rgba(0,170,160,0.18), transparent 45%)',
          }}
        />
        <ShapeGrid
          speed={0.5}
          squareSize={40}
          direction="diagonal"
          borderColor={gridBorderColor}
          hoverFillColor="#ff3b00"
          shape="square"
          hoverTrailAmount={5}
        />
      </div>

      {/* Top bar: back + home + theme */}
      <div className="relative z-20 flex items-center justify-between gap-3 px-4 sm:px-6 pt-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="btn-secondary text-xs py-2 px-3 inline-flex items-center gap-1.5 cursor-target"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            Back
          </button>
          <Link
            to="/"
            className="btn-secondary text-xs py-2 px-3 inline-flex items-center gap-1.5 cursor-target"
          >
            <Home className="h-3.5 w-3.5" aria-hidden />
            Home
          </Link>
        </div>
        <button
          type="button"
          onClick={toggleTheme}
          className="btn-secondary text-xs z-20 inline-flex items-center gap-1.5 cursor-target"
        >
          {isDark ? (
            <>
              <Sun className="h-3.5 w-3.5" aria-hidden /> Light
            </>
          ) : (
            <>
              <Moon className="h-3.5 w-3.5" aria-hidden /> Dark
            </>
          )}
        </button>
      </div>

      <div className="relative z-10 flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md border-2 border-ink bg-[#e8e4dc] text-ink p-8 brutal-shadow-lg">
          <div className="text-center mb-8 border-b-2 border-ink pb-6">
            <Link to="/" className="inline-flex flex-col items-center gap-3 cursor-target group">
              <BrandLogo size="lg" />
              <h1 className="font-display text-4xl text-ink leading-none group-hover:text-accent transition-colors">
                ICU Pay
              </h1>
            </Link>
            <p className="font-mono text-xs text-ink font-semibold uppercase tracking-[0.15em] mt-3">
              Blockchain Reconciliation
            </p>
            <div className="flex justify-center mt-3">
              <FabricPoweredBadge />
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="block font-mono text-[10px] uppercase tracking-widest text-ink font-bold mb-1">
                Email, student ID, or employee ID
              </label>
              <input
                {...register('identifier', { required: 'This field is required' })}
                type="text"
                className="input-field"
                placeholder="Enter your login ID"
                autoComplete="username"
              />
              {errors.identifier && (
                <p className="text-accent text-xs mt-1 font-semibold">{errors.identifier.message}</p>
              )}
            </div>

            <div>
              <label className="block font-mono text-[10px] uppercase tracking-widest text-ink font-bold mb-1">
                Password
              </label>
              <PasswordInput
                {...register('password', { required: 'Password is required' })}
                className="input-field"
                placeholder="Enter your password"
                autoComplete="current-password"
              />
              {errors.password && (
                <p className="text-accent text-xs mt-1 font-semibold">{errors.password.message}</p>
              )}
            </div>

            <div className="flex items-center justify-between text-sm text-ink">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="w-4 h-4 border-2 border-ink accent-[var(--color-accent)]" />
                <span className="font-medium">Remember me</span>
              </label>
              <Link to="/forgot-password" className="font-semibold text-accent hover:underline">
                Forgot password?
              </Link>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full py-3 cursor-target">
              {loading ? 'Signing in…' : 'Log In'}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-ink font-medium border-t-2 border-ink pt-6">
            Not registered?{' '}
            <Link to="/student" className="font-bold text-accent hover:underline">
              Check payment status
            </Link>
          </p>

          <div className="mt-6 pt-4 border-t border-ink/20 text-center">
            <p className="font-mono text-[9px] uppercase tracking-widest text-ink/50 mb-1">Created by</p>
            <p className="font-display text-lg leading-none">Bernard Zulu</p>
            <p className="text-xs font-semibold mt-1 text-[#0d9488]">Bluepeak Technologies</p>
            <Link
              to="/"
              className="inline-flex items-center gap-1 mt-3 font-mono text-[10px] uppercase tracking-widest font-bold text-accent hover:underline cursor-target"
            >
              <Home className="h-3 w-3" /> Back to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
