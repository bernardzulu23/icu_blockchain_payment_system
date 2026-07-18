import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Eye, EyeOff } from 'lucide-react';
import { authService } from '../api/services';
import { useTheme } from '../contexts/ThemeContext';
import { getHomeForRole } from '../utils/routing';

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
  const { register, handleSubmit, watch, formState: { errors } } = useForm<LoginFormData>({
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
        navigate(getHomeForRole(res.data.user?.role));
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: 'url("https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=2070&auto=format&fit=crop")' }}
    >
      {/* Dark overlay to ensure contrast */}
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
            <div className="w-24 h-24 bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20 shadow-xl">
              <img 
                src="/logo.jpg" 
                alt="BluePeack Logo" 
                className="w-full h-full object-contain filter drop-shadow-lg"
              />
            </div>
          </div>
          <h1 className="font-display text-3xl font-bold text-white tracking-tight">
            BluePeack
          </h1>
          <p className="text-white/60 text-sm mt-1 uppercase tracking-widest">Technologies</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          <div>
            <label className="block text-xs font-medium text-white/70 uppercase tracking-widest mb-1">
              Sign in as
            </label>
            <select
              {...register('role', { required: 'Role is required' })}
              className="w-full bg-transparent border-b border-white/30 text-white py-2 focus:outline-none focus:border-white transition-colors appearance-none cursor-pointer"
            >
              <option value="staff" className="bg-slate-900 text-white">Staff</option>
              <option value="student" className="bg-slate-900 text-white">Student</option>
            </select>
            {errors.role && (
              <p className="text-red-400 text-xs mt-1">{errors.role.message}</p>
            )}
          </div>

          <div>
            <input
              {...register('identifier', { required: 'This field is required' })}
              type="text"
              className="w-full bg-transparent border-b border-white/30 text-white py-3 placeholder:text-white/50 focus:outline-none focus:border-white transition-colors"
              placeholder={watch('role') === 'student' ? 'Student number or email' : 'Username or email'}
            />
            {errors.identifier && (
              <p className="text-red-400 text-xs mt-1">{errors.identifier.message}</p>
            )}
          </div>

          <div>
            <div className="relative">
              <input
                {...register('password', { required: 'Password is required' })}
                type={showPassword ? 'text' : 'password'}
                className="w-full bg-transparent border-b border-white/30 text-white py-3 placeholder:text-white/50 focus:outline-none focus:border-white transition-colors pr-10"
                placeholder="Enter your password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-0 top-1/2 -translate-y-1/2 text-white/50 hover:text-white"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            {errors.password && (
              <p className="text-red-400 text-xs mt-1">{errors.password.message}</p>
            )}
          </div>

          <div className="flex items-center justify-between text-sm">
            <label className="flex items-center gap-2 text-white cursor-pointer group">
              <input 
                type="checkbox" 
                className="w-4 h-4 rounded border-white/30 bg-transparent checked:bg-white focus:ring-0 transition-all cursor-pointer"
              />
              <span className="group-hover:text-white/80 transition-colors">Remember me</span>
            </label>
            <Link to="/forgot-password" className="text-white hover:text-white/80 transition-colors font-medium">
              Forgot password?
            </Link>
          </div>

          <button 
            type="submit" 
            disabled={loading} 
            className="w-full bg-white text-slate-900 font-bold py-4 rounded-lg hover:bg-white/90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100 shadow-xl"
          >
            {loading ? 'SIGNING IN...' : 'Log In'}
          </button>
        </form>

        <p className="mt-8 text-center text-sm text-white/60">
          Not registered?{' '}
          <Link to="/student" className="text-white font-bold hover:underline">
            Check payment status
          </Link>
        </p>
      </div>
    </div>
  );
}
