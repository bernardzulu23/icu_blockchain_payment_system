import { useQuery } from 'react-query';
import { Link } from 'react-router-dom';
import { UserPlus, MessageSquare, Shield, Users } from 'lucide-react';
import { adminService } from '../../api/services';
import LoadingSpinner from '../../components/LoadingSpinner';

export default function AdminDashboard() {
  const { data: stats, isLoading } = useQuery('admin-stats-page', () =>
    adminService.getStats().then((r) => r.data)
  );

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-slate-800 dark:text-slate-100 mb-8">Admin Dashboard</h1>
      {isLoading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="card">
              <p className="text-sm text-slate-600 dark:text-slate-400">Students</p>
              <p className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-1">{stats?.totalStudents ?? 0}</p>
            </div>
            <div className="card">
              <p className="text-sm text-slate-600 dark:text-slate-400">Total Payments</p>
              <p className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-1">{stats?.totalPayments ?? 0}</p>
            </div>
            <div className="card">
              <p className="text-sm text-slate-600 dark:text-slate-400">Verified Amount</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
                ZMW {(stats?.totalVerifiedAmount ?? 0).toLocaleString()}
              </p>
            </div>
            <div className="card">
              <p className="text-sm text-slate-600 dark:text-slate-400">Status Types</p>
              <p className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-1">{stats?.payments?.length ?? 0}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Link to="/admin/register-accountant" className="card hover:border-icu-accent/50 transition-colors group">
              <Shield className="h-8 w-8 mb-2 text-ink" aria-hidden />
              <h2 className="font-display font-semibold text-slate-800 dark:text-slate-100 group-hover:text-icu-accent">
                Register Accountant
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                Create accountant officer accounts (Employee ID, email, password, address, D.O.B.)
              </p>
            </Link>
            <Link to="/admin/register-student" className="card hover:border-icu-accent/50 transition-colors group">
              <UserPlus className="h-8 w-8 mb-2 text-ink" aria-hidden />
              <h2 className="font-display font-semibold text-slate-800 dark:text-slate-100 group-hover:text-icu-accent">
                Register Student
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Create student accounts</p>
            </Link>
            <Link to="/admin/staff" className="card hover:border-icu-accent/50 transition-colors group">
              <Users className="h-8 w-8 mb-2 text-ink" aria-hidden />
              <h2 className="font-display font-semibold text-slate-800 dark:text-slate-100 group-hover:text-icu-accent">
                Staff List
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                View and manage accountant, registrar, and admin accounts
              </p>
            </Link>
            <Link to="/admin/feedback" className="card hover:border-icu-accent/50 transition-colors group">
              <MessageSquare className="h-8 w-8 mb-2 text-ink" aria-hidden />
              <h2 className="font-display font-semibold text-slate-800 dark:text-slate-100 group-hover:text-icu-accent">
                View Feedback
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Review user feedback</p>
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
