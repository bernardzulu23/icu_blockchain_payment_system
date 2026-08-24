import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Sun, Moon } from 'lucide-react';
import { authService } from '../api/services';
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
  const [loading, setLoading] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { register, handleSubmit, formState: { errors } } = useForm<LoginFormData>();

  const isDark = theme === 'dark';
  const gridBorderColor = isDark ? 'rgba(201, 195, 183, 0.2)' : 'rgba(17, 17, 17, 0.35)';

  const onSubmit = async (data: LoginFormData) => {
    setLoading(true);
    try {
      const res = await authService.login(data.identifier, data.password);
      const token = res.data.token || res.data.accessToken;
      localStorage.setItem('token', token);
      const role = res.data.user?.role || (res.data.user?.type === 'student' ? 'student' : undefined);
      toast.success('Welcome back!');
      navigate(getHomeForRole(role));
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string; error?: string } } })?.response?.data
          ?.message ||
        (err as { response?: { data?: { message?: string; error?: string } } })?.response?.data
          ?.error;
      toast.error(msg || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden flex items-center justify-center p-4 bg-paper text-ink dark:bg-ink dark:text-paper selection:bg-accent selection:text-white">
      <div className="absolute inset-0 z-0" aria-hidden>
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

      <button
        type="button"
        onClick={toggleTheme}
        className="absolute top-4 right-4 btn-secondary text-xs z-20 inline-flex items-center gap-1.5"
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

      <div className="w-full max-w-md relative z-10 border-2 border-ink bg-[#e8e4dc] text-ink p-8 brutal-shadow-lg">
        <div className="text-center mb-8 border-b-2 border-ink pb-6">
          <div className="flex justify-center mb-4">
            <BrandLogo size="lg" />
          </div>
          <h1 className="font-display text-4xl text-ink leading-none">ICU Pay</h1>
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

          <button type="submit" disabled={loading} className="btn-primary w-full py-3">
            {loading ? 'Signing in…' : 'Log In'}
          </button>
        </form>

        <p className="mt-8 text-center text-sm text-ink font-medium border-t-2 border-ink pt-6">
          Not registered?{' '}
          <Link to="/student" className="font-bold text-accent hover:underline">
            Check payment status
          </Link>
        </p>
      </div>
    </div>
  );
}
