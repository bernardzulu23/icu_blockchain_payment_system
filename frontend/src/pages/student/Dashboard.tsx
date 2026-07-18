import { Link } from 'react-router-dom';
import { useQuery } from 'react-query';
import { studentService } from '../../api/services';
import LoadingSpinner from '../../components/LoadingSpinner';

export default function StudentDashboard() {
  const { data, isLoading } = useQuery('student-dashboard-stats', () =>
    studentService.myPayments().then((r) => r.data)
  );

  const stats = data?.stats;

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-slate-800 dark:text-slate-100 mb-8">
        Student Dashboard
      </h1>
      {isLoading ? (
        <div className="flex justify-center py-8">
          <LoadingSpinner />
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="card">
            <p className="text-sm text-slate-600 dark:text-slate-400">Total Payments</p>
            <p className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-1">
              {stats?.total_payments ?? 0}
            </p>
          </div>
          <div className="card">
            <p className="text-sm text-slate-600 dark:text-slate-400">Verified</p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
              {stats?.verified_payments ?? 0}
            </p>
          </div>
          <div className="card">
            <p className="text-sm text-slate-600 dark:text-slate-400">Pending</p>
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
              {stats?.pending_payments ?? 0}
            </p>
          </div>
          <div className="card">
            <p className="text-sm text-slate-600 dark:text-slate-400">Total Paid</p>
            <p className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-1">
              ZMW {(stats?.total_amount_paid ?? 0).toLocaleString()}
            </p>
          </div>
        </div>
      )}
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
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">View profile and upload picture</p>
        </Link>
        <Link
          to="/student-portal/payments"
          className="card hover:border-icu-accent/50 transition-colors group"
        >
          <span className="text-3xl mb-2 block">💰</span>
          <h2 className="font-display font-semibold text-slate-800 dark:text-slate-100 group-hover:text-icu-accent">
            My Payments
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">View your payment history and status</p>
        </Link>
        <Link
          to="/student-portal/submit-payment"
          className="card hover:border-icu-accent/50 transition-colors group"
        >
          <span className="text-3xl mb-2 block">📤</span>
          <h2 className="font-display font-semibold text-slate-800 dark:text-slate-100 group-hover:text-icu-accent">
            Submit Payment
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Upload deposit slip and submit payment</p>
        </Link>
        <Link
          to="/student-portal/clearance"
          className="card hover:border-icu-accent/50 transition-colors group"
        >
          <span className="text-3xl mb-2 block">📋</span>
          <h2 className="font-display font-semibold text-slate-800 dark:text-slate-100 group-hover:text-icu-accent">
            Clearance
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Request graduation clearance</p>
        </Link>
        <Link
          to="/student-portal/feedback"
          className="card hover:border-icu-accent/50 transition-colors group"
        >
          <span className="text-3xl mb-2 block">💬</span>
          <h2 className="font-display font-semibold text-slate-800 dark:text-slate-100 group-hover:text-icu-accent">
            Feedback
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Send feedback about the system</p>
        </Link>
      </div>
    </div>
  );
}
