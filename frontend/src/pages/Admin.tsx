import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { Users, Shield, ClipboardList, UserPlus, MessageSquare, BadgeCheck } from 'lucide-react';

const links: { to: string; icon: LucideIcon; title: string; desc: string }[] = [
  { to: '/admin/register-accountant', icon: BadgeCheck, title: 'Register Accountant', desc: 'Create accountant officer accounts with Employee ID, email, password, address, and D.O.B.' },
  { to: '/admin/staff', icon: Shield, title: 'Staff List', desc: 'View, edit, and deactivate accountant, registrar, and admin accounts.' },
  { to: '/admin/students', icon: Users, title: 'Students', desc: 'Full CRUD — create, edit, search, and deactivate student accounts.' },
  { to: '/admin/register-student', icon: UserPlus, title: 'Register Student', desc: 'Quick student registration form.' },
  { to: '/admin/audit-logs', icon: ClipboardList, title: 'Audit Logs', desc: 'View system activity and change history.' },
  { to: '/admin/feedback', icon: MessageSquare, title: 'Feedback', desc: 'Review and manage user feedback.' },
];

export default function Admin() {
  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-slate-800 dark:text-slate-100 mb-8">Admin</h1>
      <p className="text-slate-600 dark:text-slate-400 mb-6">
        Manage students, accountant officers, audit logs, and system feedback.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {links.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.to} to={item.to} className="card hover:border-icu-accent/50 transition-colors group">
              <Icon className="h-8 w-8 mb-2 text-ink" aria-hidden />
              <h2 className="font-display text-lg font-semibold text-slate-800 dark:text-slate-100 group-hover:text-icu-accent">
                {item.title}
              </h2>
              <p className="text-slate-600 dark:text-slate-400 text-sm">{item.desc}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
