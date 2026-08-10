import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { studentService, type CreateStudentData } from '../../api/services';
import {
  SEMESTERS,
  TERMS,
  CALENDAR_YEARS,
  ACADEMIC_YEAR_START,
  ACADEMIC_YEAR_END,
} from '../../constants/options';

const YEARS = CALENDAR_YEARS;
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
const SCHOOLS = [
  'School of Business',
  'School of Education',
  'School of Engineering',
  'School of Humanities',
];

export default function RegisterStudent() {
  const navigate = useNavigate();
  const { register, handleSubmit, formState: { errors } } = useForm<CreateStudentData & { confirmPassword?: string }>();

  const onSubmit = async (data: CreateStudentData & { confirmPassword?: string }) => {
    if (data.password && data.password !== data.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    try {
      const { password, confirmPassword, ...rest } = data;
      await studentService.create({
        ...rest,
        password: password!,
      });
      toast.success('Student registered — they can log in with the email and password you set');
      navigate('/admin');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Failed to register student');
    }
  };

  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-2xl font-bold text-slate-800 dark:text-slate-100 mb-8">
        Register Student
      </h1>
      <p className="text-slate-600 dark:text-slate-400 mb-6">
        Set the student&apos;s email and password here. They will use that email (or student number)
        and password to sign in on the login page.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="card p-8 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Student ID <span className="text-red-500">*</span>
            </label>
            <input
              {...register('studentId', { required: 'Required' })}
              className="input-field w-full"
              placeholder="e.g. ICU2024001"
            />
            {errors.studentId && (
              <p className="text-red-500 text-sm mt-1">{errors.studentId.message}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Student Number
            </label>
            <input
              {...register('studentNumber')}
              className="input-field w-full"
              placeholder="Same as ID if blank"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              First Name <span className="text-red-500">*</span>
            </label>
            <input
              {...register('firstName', { required: 'Required' })}
              className="input-field w-full"
            />
            {errors.firstName && (
              <p className="text-red-500 text-sm mt-1">{errors.firstName.message}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Last Name <span className="text-red-500">*</span>
            </label>
            <input
              {...register('lastName', { required: 'Required' })}
              className="input-field w-full"
            />
            {errors.lastName && (
              <p className="text-red-500 text-sm mt-1">{errors.lastName.message}</p>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Date of Birth
          </label>
          <input
            type="date"
            {...register('dateOfBirth')}
            min={`${ACADEMIC_YEAR_START}-01-01`}
            max={`${ACADEMIC_YEAR_END}-12-31`}
            className="input-field w-full"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Program
            </label>
            <select {...register('program')} className="input-field w-full">
              <option value="">Select program</option>
              {PROGRAMS.map((program) => (
                <option key={program} value={program}>
                  {program}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              School
            </label>
            <select
              {...register('department')}
              className="input-field w-full"
            >
              <option value="">Select school</option>
              {SCHOOLS.map((school) => (
                <option key={school} value={school}>
                  {school}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Semester
            </label>
            <select {...register('currentSemester', { valueAsNumber: true })} className="input-field w-full">
              <option value="">Select</option>
              {SEMESTERS.map((s) => (
                <option key={s} value={s}>
                  Semester {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Term
            </label>
            <select {...register('currentTerm', { valueAsNumber: true })} className="input-field w-full">
              <option value="">Select</option>
              {TERMS.map((t) => (
                <option key={t} value={t}>
                  Term {t}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              {...register('email', {
                required: 'Email is required for student login',
                pattern: { value: /^\S+@\S+$/i, message: 'Invalid email' },
              })}
              className="input-field w-full"
              placeholder="Student login email"
            />
            {errors.email && (
              <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Phone
            </label>
            <input {...register('phone')} className="input-field w-full" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Admission Year
          </label>
          <select {...register('admissionYear', { valueAsNumber: true })} className="input-field w-full">
            <option value="">Select</option>
            {YEARS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Password <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              {...register('password', {
                required: 'Password is required for student login',
                minLength: { value: 6, message: 'Min 6 characters' },
              })}
              className="input-field w-full"
              placeholder="Student will use this to log in (min 6 characters)"
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
              {...register('confirmPassword', { required: 'Please confirm password' })}
              className="input-field w-full"
              placeholder="Re-enter password"
            />
            {errors.confirmPassword && (
              <p className="text-red-500 text-sm mt-1">{errors.confirmPassword.message}</p>
            )}
          </div>
        </div>

        <div className="flex gap-4 pt-4">
          <button
            type="button"
            onClick={() => navigate('/admin')}
            className="px-6 py-3 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button type="submit" className="btn-primary px-6 py-3">
            Register Student
          </button>
        </div>
      </form>
    </div>
  );
}
