import { useEffect, useState } from 'react';
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
  Menu,
  X,
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
  const [navOpen, setNavOpen] = useState(false);
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
    if (path === '/admin/dashboard')
      return location.pathname === '/admin/dashboard' || location.pathname === '/admin';
    if (path === '/accountant') return location.pathname === '/accountant';
    if (path === '/registrar') return location.pathname === '/registrar';
    if (path === '/student-portal') return location.pathname === '/student-portal';
    return location.pathname.startsWith(path);
  };

  // Close drawer on route change (mobile)
  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);

  // Lock body scroll while drawer is open
  useEffect(() => {
    if (!navOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [navOpen]);

  const sidebar = (
    <>
      <div className="p-4 sm:p-6 border-b-2 border-ink shrink-0">
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <BrandLogo size="sm" />
            <div className="min-w-0">
              <h1 className="font-display text-xl sm:text-2xl text-ink leading-none truncate">
                ICU Pay
              </h1>
              <p className="font-mono text-[10px] text-ink/50 uppercase tracking-[0.15em] mt-1">
                Zambia · Blockchain
              </p>
            </div>
          </div>
          <button
            type="button"
            className="md:hidden w-9 h-9 border-2 border-ink bg-white flex items-center justify-center shrink-0"
            onClick={() => setNavOpen(false)}
            aria-label="Close menu"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <div className="mb-4 sm:mb-6">
          <FabricPoweredBadge className="text-[10px] px-2.5 py-0.5" />
        </div>

        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setNavOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 border-2 text-sm font-semibold uppercase tracking-wide transition-colors ${
                  isActive(item.path)
                    ? 'bg-ink text-paper border-ink'
                    : 'border-transparent text-ink hover:bg-ink hover:text-paper hover:border-ink'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="mt-auto p-4 sm:p-6 space-y-4 border-t-2 border-ink shrink-0">
        <div className="border-2 border-ink bg-white p-3 sm:p-4 brutal-shadow">
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
    </>
  );

  return (
    <div className="min-h-screen flex bg-paper text-ink font-sans selection:bg-accent selection:text-white overflow-x-hidden">
      {/* Mobile overlay */}
      {navOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-ink/50 md:hidden"
          aria-label="Close menu"
          onClick={() => setNavOpen(false)}
        />
      ) : null}

      {/* Sidebar: drawer on mobile, static on md+ */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[min(18rem,88vw)] max-w-full bg-paper border-r-2 border-ink flex flex-col transition-transform duration-200 ease-out md:static md:z-auto md:w-72 md:shrink-0 md:translate-x-0 ${
          navOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {sidebar}
      </aside>

      <main className="flex-1 flex flex-col min-h-0 min-w-0 w-full">
        <header className="h-14 sm:h-16 border-b-2 border-ink px-3 sm:px-6 md:px-8 flex items-center justify-between gap-2 bg-paper sticky top-0 z-30">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              className="md:hidden w-10 h-10 border-2 border-ink bg-white flex items-center justify-center brutal-shadow shrink-0"
              onClick={() => setNavOpen(true)}
              aria-label="Open menu"
              aria-expanded={navOpen}
            >
              <Menu className="h-4 w-4" aria-hidden />
            </button>
            <h2 className="font-display text-lg sm:text-2xl text-ink truncate">Dashboard</h2>
          </div>
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            <Link
              to={notificationsPath}
              className="w-9 h-9 sm:w-10 sm:h-10 border-2 border-ink bg-white flex items-center justify-center brutal-shadow hover:bg-accent transition-colors"
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4" aria-hidden />
            </Link>
            <div className="w-9 h-9 sm:w-10 sm:h-10 border-2 border-ink bg-ink text-paper flex items-center justify-center font-bold uppercase brutal-shadow text-sm">
              {user?.role?.[0] || 'U'}
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-auto overscroll-contain">
          <div className="p-4 sm:p-6 md:p-8 lg:p-10 max-w-[100vw]">
            <Outlet />
          </div>

          <footer className="border-t-2 border-ink px-4 sm:px-6 md:px-8 py-4 sm:py-6 font-mono text-[10px] uppercase tracking-widest text-ink/50">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
              <div className="flex flex-col gap-1">
                <span>Built for ICU Zambia · Blockchain Payment Reconciliation</span>
                <span>Bernard Zulu · Bluepeak Technologies</span>
              </div>
              <Link to="/" className="hover:text-ink transition-colors">
                Home
              </Link>
            </div>
          </footer>
        </div>
      </main>
    </div>
  );
}
