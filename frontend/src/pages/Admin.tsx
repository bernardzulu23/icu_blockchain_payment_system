import { Link } from 'react-router-dom';

const links = [
  { to: '/admin/students', icon: '👥', title: 'Students', desc: 'Full CRUD — create, edit, search, and deactivate student accounts.' },
  { to: '/admin/staff', icon: '🛡️', title: 'Staff Users', desc: 'Manage accountant, registrar, and admin accounts.' },
  { to: '/admin/audit-logs', icon: '📋', title: 'Audit Logs', desc: 'View system activity and change history.' },
  { to: '/admin/register-student', icon: '👤', title: 'Register Student', desc: 'Quick student registration form.' },
  { to: '/admin/feedback', icon: '💬', title: 'Feedback', desc: 'Review and manage user feedback.' },
];

export default function Admin() {
  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-slate-800 dark:text-slate-100 mb-8">Admin</h1>
      <p className="text-slate-600 dark:text-slate-400 mb-6">
        Manage students, staff, audit logs, and system feedback.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {links.map((item) => (
          <Link key={item.to} to={item.to} className="card hover:border-icu-accent/50 transition-colors group">
            <span className="text-3xl mb-2 block">{item.icon}</span>
            <h2 className="font-display text-lg font-semibold text-slate-800 dark:text-slate-100 group-hover:text-icu-accent">
              {item.title}
            </h2>
            <p className="text-slate-600 dark:text-slate-400 text-sm">{item.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
