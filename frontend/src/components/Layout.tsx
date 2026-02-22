import { Outlet } from 'react-router-dom';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../contexts/ThemeContext';

const staffNavItems = [
  { path: '/', label: 'Dashboard', icon: '📊' },
  { path: '/payments', label: 'Payments', icon: '💰' },
  { path: '/batch-verification', label: 'Batch Verify', icon: '✅' },
  { path: '/history', label: 'History', icon: '📜' },
  { path: '/admin', label: 'Admin', icon: '⚙️' },
];

const studentNavItems = [
  { path: '/student-portal', label: 'Dashboard', icon: '📊' },
  { path: '/student-portal/profile', label: 'Profile', icon: '👤' },
  { path: '/student-portal/payments', label: 'Payments', icon: '💰' },
  { path: '/student-portal/submit-payment', label: 'Submit Payment', icon: '📤' },
  { path: '/student-portal/clearance', label: 'Clearance', icon: '📋' },
];

export default function Layout() {
  const location = useLocation();
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const isStudent = user?.role === 'student';
  const navItems = isStudent ? studentNavItems : staffNavItems;

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    if (path === '/student-portal') return location.pathname === '/student-portal';
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen flex page-bg">
      <aside className="w-64 glass border-r border-slate-200/50 dark:border-slate-700/50 flex flex-col">
        <div className="p-6 border-b border-slate-200/50 dark:border-slate-700/50">
          <h1 className="font-display font-bold text-xl text-slate-800 dark:text-slate-100">
            ICU Payments
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Blockchain Reconciliation
          </p>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                isActive(item.path)
                  ? 'bg-icu-accent/20 text-icu-accent dark:bg-icu-accent/10 dark:text-icu-accent'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-200/50 dark:border-slate-700/50 space-y-3">
          <button
            onClick={toggleTheme}
            className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-icu-accent transition-colors"
          >
            {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
          </button>
          <p className="text-sm text-slate-600 dark:text-slate-400 truncate">
            {user?.email || (user as { student_number?: string })?.student_number || '—'}
          </p>
          <button
            onClick={() => {
              localStorage.removeItem('token');
              window.location.href = '/login';
            }}
            className="text-sm text-icu-accent hover:underline"
          >
            Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto flex flex-col">
        <div className="flex-1 p-8">
          <Outlet />
        </div>
        <footer className="border-t border-slate-200/50 dark:border-slate-700/50 px-8 py-4 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <span>Built for ICU Zambia</span>
            <span>Blockchain-Based Payment Reconciliation System</span>
            <span>© 2024. All rights reserved.</span>
          </div>
        </footer>
      </main>
    </div>
  );
}
