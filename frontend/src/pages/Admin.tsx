import { Link } from 'react-router-dom';

export default function Admin() {
  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-slate-800 dark:text-slate-100 mb-8">
        Admin
      </h1>
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
            Create student accounts with profile details.
          </p>
        </Link>
        <div className="card">
          <h2 className="font-display text-lg font-semibold text-slate-800 dark:text-slate-100 mb-2">
            User Management
          </h2>
          <p className="text-slate-600 dark:text-slate-400 text-sm">
            Manage accounts staff and admin users.
          </p>
        </div>
        <div className="card">
          <h2 className="font-display text-lg font-semibold text-slate-800 dark:text-slate-100 mb-2">
            Blockchain Status
          </h2>
          <p className="text-slate-600 dark:text-slate-400 text-sm">
            View Hyperledger Fabric network health and ledger stats.
          </p>
        </div>
        <div className="card">
          <h2 className="font-display text-lg font-semibold text-slate-800 dark:text-slate-100 mb-2">
            Notifications
          </h2>
          <p className="text-slate-600 dark:text-slate-400 text-sm">
            Configure Africa's Talking SMS and SendGrid email templates.
          </p>
        </div>
        <div className="card">
          <h2 className="font-display text-lg font-semibold text-slate-800 dark:text-slate-100 mb-2">
            Audit Log
          </h2>
          <p className="text-slate-600 dark:text-slate-400 text-sm">
            View system audit trail for compliance.
          </p>
        </div>
      </div>
    </div>
  );
}
