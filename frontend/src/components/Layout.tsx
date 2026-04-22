import { Outlet } from 'react-router-dom';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../contexts/ThemeContext';

const staffNavItems = [
  { path: '/', label: 'Dashboard', icon: '📊' },
  { path: '/history', label: 'Payment History', icon: '📜' },
  { path: '/batch-verification', label: 'Batch Verify', icon: '✅' },
  { path: '/accountant/mass-clearance', label: 'Mass Clearance', icon: '📋' },
  { path: '/accountant/bulk-payment-status', label: 'Bulk Payment Status', icon: '🔍' },
  { path: '/feedback', label: 'Feedback', icon: '💬' },
  { path: '/admin', label: 'Admin', icon: '⚙️' },
];

const studentNavItems = [
  { path: '/student-portal', label: 'Dashboard', icon: '📊' },
  { path: '/student-portal/profile', label: 'Profile', icon: '👤' },
  { path: '/student-portal/payments', label: 'Payments', icon: '💰' },
  { path: '/student-portal/submit-payment', label: 'Submit Payment', icon: '📤' },
  { path: '/student-portal/clearance', label: 'Clearance', icon: '📋' },
  { path: '/student-portal/feedback', label: 'Feedback', icon: '💬' },
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
    <div className="min-h-screen flex bg-[#020617] text-slate-100 font-sans selection:bg-cyan-500/30">
      <aside className="w-72 bg-[#0a0f1e]/80 backdrop-blur-2xl border-r border-white/5 flex flex-col z-50">
        <div className="p-8">
          <div className="flex items-center gap-4 mb-10">
            <div className="w-12 h-12 bg-gradient-to-br from-cyan-500/20 to-blue-600/20 rounded-xl p-2.5 border border-white/10 shadow-lg shadow-cyan-500/10">
              <img 
                src="/logo.jpg" 
                alt="BluePeack Logo" 
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <h1 className="font-display font-bold text-lg text-white leading-tight">
                BluePeack
              </h1>
              <p className="text-[10px] text-slate-500 uppercase tracking-[0.2em] font-medium">
                Technologies
              </p>
            </div>
          </div>
          
          <nav className="space-y-2">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-4 px-5 py-3.5 rounded-2xl transition-all duration-300 group ${
                  isActive(item.path)
                    ? 'bg-gradient-to-r from-cyan-500/20 to-blue-600/10 text-cyan-400 border border-cyan-500/20 shadow-lg shadow-cyan-500/5'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-white/5 border border-transparent'
                }`}
              >
                <span className={`text-xl transition-transform duration-300 group-hover:scale-110 ${isActive(item.path) ? 'scale-110' : ''}`}>
                  {item.icon}
                </span>
                <span className="font-medium tracking-wide text-sm">{item.label}</span>
                {isActive(item.path) && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
                )}
              </Link>
            ))}
          </nav>
        </div>

        <div className="mt-auto p-8 space-y-6">
          <div className="bg-gradient-to-br from-white/5 to-transparent rounded-3xl p-6 border border-white/10 relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-cyan-500/10 blur-3xl rounded-full" />
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center mb-4 overflow-hidden">
                <span className="text-sm font-bold text-cyan-400 uppercase">
                  {user?.role?.[0] || 'A'}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mb-1 uppercase tracking-wider">Admin Panel</p>
              <p className="text-sm font-bold text-white truncate mb-4">
                {user?.name || user?.email || 'Administrator'}
              </p>
              <button
                onClick={() => {
                  localStorage.removeItem('token');
                  window.location.href = '/login';
                }}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-900 font-bold text-xs hover:shadow-[0_0_20px_rgba(34,211,238,0.4)] transition-all active:scale-95"
              >
                Log Out
              </button>
            </div>
          </div>

          <button
            onClick={toggleTheme}
            className="w-full flex items-center justify-center gap-3 py-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 text-slate-400 text-xs transition-all"
          >
            {theme === 'dark' ? '☀️ Switch to Light' : '🌙 Switch to Dark'}
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col relative overflow-hidden">
        {/* Background glow effects */}
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-600/10 blur-[150px] rounded-full" />
        <div className="absolute bottom-[-5%] left-[-5%] w-[40%] h-[40%] bg-cyan-500/5 blur-[120px] rounded-full" />
        
        <header className="h-20 border-b border-white/5 px-12 flex items-center justify-between bg-[#020617]/50 backdrop-blur-md sticky top-0 z-40">
          <div className="flex items-center gap-8">
            <h2 className="text-xl font-bold text-white tracking-tight">Statistics</h2>
            <nav className="hidden lg:flex items-center gap-8 text-sm text-slate-500 font-medium">
              <a href="#" className="text-cyan-400 relative after:absolute after:-bottom-7 after:left-0 after:w-full after:h-0.5 after:bg-cyan-400 after:shadow-[0_0_8px_rgba(34,211,238,0.8)]">Statistics</a>
            </nav>
          </div>
          
          <div className="flex items-center gap-6">
            <button className="p-2.5 rounded-xl hover:bg-white/5 text-slate-400 transition-all">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
            </button>
            <button className="p-2.5 rounded-xl hover:bg-white/5 text-slate-400 transition-all relative">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>
              <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-red-500 border-2 border-[#020617]" />
            </button>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 p-0.5 shadow-lg shadow-cyan-500/20 cursor-pointer hover:scale-105 transition-transform">
              <div className="w-full h-full rounded-[9px] bg-slate-900 flex items-center justify-center">
                <span className="text-sm font-bold text-cyan-400 uppercase">{user?.role?.[0] || 'A'}</span>
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-auto custom-scrollbar">
          <div className="p-12">
            <Outlet />
          </div>
          
          <footer className="border-t border-white/5 px-12 py-8 text-[11px] text-slate-600 font-medium tracking-widest uppercase">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
              <div className="flex items-center gap-4">
                <span className="text-slate-500">Built for ICU Zambia</span>
                <div className="w-1 h-1 rounded-full bg-slate-800" />
                <span>Blockchain-Based Payment Reconciliation</span>
              </div>
              <div className="flex items-center gap-6">
                <a href="#" className="hover:text-cyan-400 transition-colors">Privacy</a>
                <a href="#" className="hover:text-cyan-400 transition-colors">Terms</a>
                <span>© 2024. All rights reserved.</span>
              </div>
            </div>
          </footer>
        </div>
      </main>
    </div>
  );
}
