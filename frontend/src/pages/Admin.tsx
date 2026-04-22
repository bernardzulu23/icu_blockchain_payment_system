import { Link } from 'react-router-dom';

export default function Admin() {
  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-slate-800 dark:text-slate-100 mb-8">
        Admin
      </h1>
      <p className="text-slate-600 dark:text-slate-400 mb-6">
        Manage students and view feedback from the system.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link
          to="/admin/register-student"
          className="card hover:border-icu-accent/50 transition-colors group"
        >
          <span className="text-3xl mb-2 block">👤</span>
          <h2 className="font-display text-lg font-semibold text-slate-800 dark:text-slate-100 group-hover:text-icu-accent">
            Register Student
          </h2>
          <p className="text-slate-600 dark:text-slate-400 text-sm">
            Create student accounts with profile details and login password.
          </p>
        </Link>
        <Link
          to="/admin/feedback"
          className="card hover:border-icu-accent/50 transition-colors group"
        >
          <span className="text-3xl mb-2 block">💬</span>
          <h2 className="font-display text-lg font-semibold text-slate-800 dark:text-slate-100 group-hover:text-icu-accent">
            View Feedback
          </h2>
          <p className="text-slate-600 dark:text-slate-400 text-sm">
            See feedback from students and staff.
          </p>
        </Link>
      </div>
    </div>
  );
}
