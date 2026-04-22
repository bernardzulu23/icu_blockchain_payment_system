import { Link } from 'react-router-dom';

export default function StudentDashboard() {
  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-slate-800 dark:text-slate-100 mb-8">
        Student Dashboard
      </h1>
      <p className="text-slate-600 dark:text-slate-400 mb-6">
        Manage your profile, payments, clearance, and feedback.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Link
          to="/student-portal/profile"
          className="card hover:border-icu-accent/50 transition-colors group"
        >
          <span className="text-3xl mb-2 block">👤</span>
          <h2 className="font-display font-semibold text-slate-800 dark:text-slate-100 group-hover:text-icu-accent">
            My Profile
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            View profile and upload picture
          </p>
        </Link>
        <Link
          to="/student-portal/payments"
          className="card hover:border-icu-accent/50 transition-colors group"
        >
          <span className="text-3xl mb-2 block">💰</span>
          <h2 className="font-display font-semibold text-slate-800 dark:text-slate-100 group-hover:text-icu-accent">
            My Payments
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            View your payment history and status
          </p>
        </Link>
        <Link
          to="/student-portal/submit-payment"
          className="card hover:border-icu-accent/50 transition-colors group"
        >
          <span className="text-3xl mb-2 block">📤</span>
          <h2 className="font-display font-semibold text-slate-800 dark:text-slate-100 group-hover:text-icu-accent">
            Submit Payment
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Upload deposit slip and submit payment
          </p>
        </Link>
        <Link
          to="/student-portal/clearance"
          className="card hover:border-icu-accent/50 transition-colors group"
        >
          <span className="text-3xl mb-2 block">📋</span>
          <h2 className="font-display font-semibold text-slate-800 dark:text-slate-100 group-hover:text-icu-accent">
            Clearance
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Request graduation clearance
          </p>
        </Link>
        <Link
          to="/student-portal/feedback"
          className="card hover:border-icu-accent/50 transition-colors group"
        >
          <span className="text-3xl mb-2 block">💬</span>
          <h2 className="font-display font-semibold text-slate-800 dark:text-slate-100 group-hover:text-icu-accent">
            Feedback
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Send feedback about the system
          </p>
        </Link>
      </div>
    </div>
  );
}
