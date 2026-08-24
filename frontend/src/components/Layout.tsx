import { Outlet } from 'react-router-dom';
import { Link, useLocation } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  BadgeCheck,
  FileUp,
  Microscope,
  Landmark,
  ClipboardList,
  Search,
  ScrollText,
  RefreshCw,
  MessageSquare,
  Users,
  Shield,
  UserPlus,
  Wallet,
  Mail,
  User,
  Bell,
  Send,
  Sun,
  Moon,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../contexts/ThemeContext';
import BrandLogo from './BrandLogo';
import FabricPoweredBadge from './FabricPoweredBadge';

type NavItem = { path: string; label: string; icon: LucideIcon };

const accountantNavItems: NavItem[] = [
  { path: '/accountant', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/accountant/verification', label: 'Verification', icon: BadgeCheck },
  { path: '/accountant/upload-statement', label: 'Upload Statement', icon: FileUp },
  { path: '/accountant/batch-reconciliation', label: 'Batch OCR', icon: Microscope },
  { path: '/accountant/bank-statements', label: 'Bank Statements', icon: Landmark },
  { path: '/accountant/mass-clearance', label: 'Mass Clearance', icon: ClipboardList },
  { path: '/accountant/bulk-payment-status', label: 'Bulk Status', icon: Search },
  { path: '/history', label: 'Payment History', icon: ScrollText },
  { path: '/batch-verification', label: 'Batch Preview', icon: RefreshCw },
  { path: '/feedback', label: 'Feedback', icon: MessageSquare },
];

const registrarNavItems: NavItem[] = [
  { path: '/registrar', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/accountant/mass-clearance', label: 'Clearance', icon: ClipboardList },
  { path: '/feedback', label: 'Feedback', icon: MessageSquare },
];

const adminNavItems: NavItem[] = [
  { path: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/admin/students', label: 'Students', icon: Users },
  { path: '/admin/register-accountant', label: 'Register Accountant', icon: BadgeCheck },
  { path: '/admin/staff', label: 'Staff List', icon: Shield },
  { path: '/admin/audit-logs', label: 'Audit Logs', icon: ClipboardList },
  { path: '/admin/register-student', label: 'Register Student', icon: UserPlus },
  { path: '/admin/feedback', label: 'Feedback', icon: MessageSquare },
  { path: '/accountant', label: 'Accountant Panel', icon: Wallet },
  { path: '/history', label: 'Payment History', icon: ScrollText },
  { path: '/feedback', label: 'Submit Feedback', icon: Mail },
];

const studentNavItems: NavItem[] = [
  { path: '/student-portal', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/student-portal/profile', label: 'Profile', icon: User },
  { path: '/student-portal/payments', label: 'Payments', icon: Wallet },
  { path: '/student-portal/submit-payment', label: 'Submit Payment', icon: Send },
  { path: '/student-portal/clearance', label: 'Clearance', icon: ClipboardList },
  { path: '/student-portal/notifications', label: 'Notifications', icon: Bell },
  { path: '/student-portal/feedback', label: 'Feedback', icon: MessageSquare },
];

export default function Layout() {
  const location = useLocation();
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const isStudent = user?.role === 'student';
  const notificationsPath = isStudent ? '/student-portal/notifications' : '/admin/audit-logs';
  const navItems =
    user?.role === 'admin'
      ? adminNavItems
      : user?.role === 'registrar'
        ? registrarNavItems
        : user?.role === 'accountant'
          ? accountantNavItems
          : isStudent
            ? studentNavItems
            : accountantNavItems;

  const isActive = (path: string) => {
    if (path === '/admin/dashboard') return location.pathname === '/admin/dashboard' || location.pathname === '/admin';
    if (path === '/accountant') return location.pathname === '/accountant';
    if (path === '/registrar') return location.pathname === '/registrar';
    if (path === '/student-portal') return location.pathname === '/student-portal';
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen flex bg-paper text-ink font-sans selection:bg-accent selection:text-white">
      <aside className="w-72 bg-paper border-r-2 border-ink flex flex-col z-50 shrink-0">
        <div className="p-6 border-b-2 border-ink">
          <div className="flex items-center gap-3 mb-4">
            <BrandLogo size="sm" />
            <div>
              <h1 className="font-display text-2xl text-ink leading-none">ICU Pay</h1>
              <p className="font-mono text-[10px] text-ink/50 uppercase tracking-[0.15em] mt-1">
                Zambia · Blockchain
              </p>
            </div>
          </div>
          <div className="mb-6">
            <FabricPoweredBadge className="text-[10px] px-2.5 py-0.5" />
          </div>

          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-3 py-2.5 border-2 text-sm font-semibold uppercase tracking-wide transition-colors ${
                    isActive(item.path)
                      ? 'bg-ink text-paper border-ink'
                      : 'border-transparent text-ink hover:bg-ink hover:text-paper hover:border-ink'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="mt-auto p-6 space-y-4 border-t-2 border-ink">
          <div className="border-2 border-ink bg-white p-4 brutal-shadow">
            <p className="font-mono text-[10px] uppercase tracking-wider text-accent mb-1">
              {user?.role ? `${user.role} panel` : 'Account'}
            </p>
            <p className="text-sm font-bold text-ink truncate mb-3">
              {user?.name || user?.email || 'User'}
            </p>
            <button
              type="button"
              onClick={() => {
                localStorage.removeItem('token');
                window.location.href = '/login';
              }}
              className="btn-primary w-full text-xs"
            >
              Log Out
            </button>
          </div>

          <button
            type="button"
            onClick={toggleTheme}
            className="btn-secondary w-full text-xs inline-flex items-center justify-center gap-2"
          >
            {theme === 'dark' ? (
              <>
                <Sun className="h-3.5 w-3.5" aria-hidden /> Light paper
              </>
            ) : (
              <>
                <Moon className="h-3.5 w-3.5" aria-hidden /> Dark ink
              </>
            )}
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-h-0 min-w-0">
        <header className="h-16 border-b-2 border-ink px-8 flex items-center justify-between bg-paper sticky top-0 z-40">
          <h2 className="font-display text-2xl text-ink">Dashboard</h2>
          <div className="flex items-center gap-4">
            <Link
              to={notificationsPath}
              className="w-10 h-10 border-2 border-ink bg-white flex items-center justify-center brutal-shadow hover:bg-accent transition-colors"
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4" aria-hidden />
            </Link>
            <div className="w-10 h-10 border-2 border-ink bg-ink text-paper flex items-center justify-center font-bold uppercase brutal-shadow">
              {user?.role?.[0] || 'U'}
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-auto">
          <div className="p-8 md:p-10">
            <Outlet />
          </div>

          <footer className="border-t-2 border-ink px-8 py-6 font-mono text-[10px] uppercase tracking-widest text-ink/50">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <span>Built for ICU Zambia · Blockchain Payment Reconciliation</span>
            </div>
          </footer>
        </div>
      </main>
    </div>
  );
}
