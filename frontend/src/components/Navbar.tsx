import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Wallet, BadgeCheck, ScrollText, Settings, Sun, Moon } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../contexts/ThemeContext';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/payments', label: 'Payments', icon: Wallet },
  { path: '/batch-verification', label: 'Batch Verify', icon: BadgeCheck },
  { path: '/history', label: 'History', icon: ScrollText },
  { path: '/admin', label: 'Admin', icon: Settings },
];

export default function Navbar() {
  const location = useLocation();
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <nav className="flex items-center justify-between p-4 glass border-b border-slate-200/50 dark:border-slate-700/50">
      <div className="flex items-center gap-6">
        <Link to="/" className="font-display font-bold text-xl text-slate-800 dark:text-slate-100">
          ICU Payments
        </Link>
        <div className="flex gap-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`px-4 py-2 rounded-lg text-sm transition-all inline-flex items-center gap-2 ${
                  location.pathname === item.path
                    ? 'bg-icu-accent/20 text-icu-accent'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-700/50'
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden />
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={toggleTheme}
          className="text-sm text-slate-600 dark:text-slate-400 hover:text-icu-accent"
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
        <span className="text-sm text-slate-600 dark:text-slate-400 truncate max-w-[180px]">{user?.email}</span>
        <button
          type="button"
          onClick={() => {
            localStorage.removeItem('token');
            window.location.href = '/login';
          }}
          className="text-sm text-icu-accent hover:underline"
        >
          Logout
        </button>
      </div>
    </nav>
  );
}
