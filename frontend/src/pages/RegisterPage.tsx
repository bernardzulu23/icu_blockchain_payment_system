import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { toast } from 'react-toastify';
import { Eye, EyeOff } from 'lucide-react';
import { authService } from '../api/services';

type FormData = {
  student_number: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  password: string;
  program?: string;
};

const BACHELOR_PROGRAMS = [
  'Bachelor of Arts in Development Studies',
  'Bachelor of Economics and Finance',
  'Bachelor of Arts in Economics',
  'Bachelor of Human Resource Management',
  'Bachelor of Arts in Journalism',
  'Bachelor of Arts in Mass Communication',
  'Bachelor of Arts in Public Administration',
  'Bachelor of Arts in Project Management',
  'Bachelor of Social Work Practice and Development',
  'Bachelor of Business Administration',
  'Bachelor of Education in Business Studies',
  'Bachelor of Science in Agriculture with Education',
  'Bachelor of Information and Communications Technology with Education',
  'Bachelor of Design and Technology with Education',
  'Bachelor of Fine Art in Acting and Film Production',
  'Bachelor of Fine Art in Music and Dance Theater',
  'Bachelor of Information and Communications Technology in IT Business Management',
  'Bachelor of Science in Agriculture',
  'Bachelor of Architecture',
  'Bachelor Of Science In Environmental Management System',
  'Bachelor of Information and Communications Technology',
  'Bachelor of Information and Communications Technology in Information Systems',
  'Bachelor of Information Security and Computer Forensics',
  'Bachelor of Mobile Communications',
  'Bachelor of Information and Communications Technology in Network Technology',
  'Bachelor of Information and Communications Technology in Software Engineering',
  'Bachelor of Information and Communications Technology in Systems Engineering',
  'Bachelor of Information and Communications Technology in Technology Management',
  'Bachelor of Science in Electrical and Electronics Engineering',
];
const MASTERS_PROGRAMS = [
  'Master in Development Studies',
  'Master of Education',
  'Master in Project Planning Management',
  'Master in Business Administration',
  'Master of Arts in Economics',
  'Master of Design and Technology',
  'Master In Social Work',
  'Master of Public Administration',
  'Master of Science in Plant and Soil Science',
  'Master in Information and Communications Technology',
];
const PROGRAMS = [...BACHELOR_PROGRAMS, ...MASTERS_PROGRAMS];

export default function RegisterPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>();

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      await authService.registerStudent(data);
      toast.success('Registration successful. Please log in.');
      navigate('/login');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Registration failed';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center page-bg p-4">
      <div className="glass-card w-full max-w-md p-8">
        <h1 className="font-display font-bold text-2xl text-slate-800 dark:text-slate-100 mb-6">
          Student Registration
        </h1>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Student Number</label>
            <input
              {...register('student_number', { required: 'Required' })}
              className="input-field w-full"
              placeholder="e.g. ICU2024001"
            />
            {errors.student_number && <p className="text-red-500 text-sm mt-1">{errors.student_number.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">First Name</label>
              <input {...register('first_name', { required: 'Required' })} className="input-field w-full" />
              {errors.first_name && <p className="text-red-500 text-sm mt-1">{errors.first_name.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Last Name</label>
              <input {...register('last_name', { required: 'Required' })} className="input-field w-full" />
              {errors.last_name && <p className="text-red-500 text-sm mt-1">{errors.last_name.message}</p>}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email</label>
            <input
              {...register('email', { required: 'Required', pattern: { value: /^\S+@\S+$/, message: 'Invalid email' } })}
              type="email"
              className="input-field w-full"
            />
            {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Program</label>
            <select
              {...register('program')}
              className="input-field w-full"
            >
              <option value="">Select program</option>
              {PROGRAMS.map((program) => (
                <option key={program} value={program}>
                  {program}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Phone</label>
            <input {...register('phone')} className="input-field w-full" placeholder="Optional" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Password</label>
            <div className="relative">
              <input
                {...register('password', { required: 'Required', minLength: { value: 6, message: 'Min 6 characters' } })}
                type={showPassword ? 'text' : 'password'}
                className="input-field w-full pr-10"
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
            {errors.password && <p className="text-red-500 text-sm mt-1">{errors.password.message}</p>}
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'Registering...' : 'Register'}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
          Already have an account?{' '}
          <Link to="/login" className="text-icu-accent hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
