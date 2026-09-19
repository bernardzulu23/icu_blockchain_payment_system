import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Sun, Moon, Shield, Link2, FileCheck, Mail, MapPin, Phone } from 'lucide-react';
import gsap from 'gsap';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../hooks/useAuth';
import { getHomeForRole } from '../utils/routing';
import BrandLogo from '../components/BrandLogo';
import FabricPoweredBadge from '../components/FabricPoweredBadge';
import ShapeGrid from '../components/ShapeGrid/ShapeGrid';

const NAV = [
  { id: 'home', label: 'Home' },
  { id: 'about', label: 'About' },
  { id: 'contact', label: 'Contact Us' },
] as const;

function scrollToSection(id: string) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export default function Landing() {
  const { theme, toggleTheme } = useTheme();
  const { user, isAuthenticated } = useAuth();
  const heroRef = useRef<HTMLElement>(null);
  const isDark = theme === 'dark';
  const gridBorder = isDark ? 'rgba(201, 195, 183, 0.18)' : 'rgba(17, 17, 17, 0.28)';

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('.lp-nav', { y: -24, opacity: 0, duration: 0.6, ease: 'power3.out' });
      gsap.from('.lp-brand', { y: 28, opacity: 0, duration: 0.8, delay: 0.1, ease: 'power3.out' });
      gsap.from('.lp-headline', { y: 36, opacity: 0, duration: 0.9, delay: 0.25, ease: 'power3.out' });
      gsap.from('.lp-sub', { y: 24, opacity: 0, duration: 0.8, delay: 0.4, ease: 'power3.out' });
      gsap.from('.lp-cta', { y: 20, opacity: 0, duration: 0.7, delay: 0.55, ease: 'power3.out' });
      gsap.from('.lp-about-item', {
        y: 40,
        opacity: 0,
        duration: 0.7,
        stagger: 0.12,
        delay: 0.8,
        ease: 'power2.out',
      });
    }, heroRef);
    return () => ctx.revert();
  }, []);

  const primaryCta = isAuthenticated
    ? { to: getHomeForRole(user?.role), label: 'Open dashboard' }
    : { to: '/login', label: 'Staff login' };

  return (
    <div className="relative min-h-screen bg-paper text-ink dark:bg-ink dark:text-paper overflow-x-hidden">
      {/* Atmosphere */}
      <div className="fixed inset-0 z-0 pointer-events-none" aria-hidden>
        <div
          className="absolute inset-0 opacity-90"
          style={{
            background: isDark
              ? 'radial-gradient(ellipse 80% 60% at 15% 20%, rgba(255,59,0,0.22), transparent 55%), radial-gradient(ellipse 70% 50% at 85% 10%, rgba(0,200,180,0.18), transparent 50%), linear-gradient(165deg, #0a0a0a 0%, #141414 45%, #1a1210 100%)'
              : 'radial-gradient(ellipse 80% 55% at 10% 15%, rgba(255,59,0,0.28), transparent 50%), radial-gradient(ellipse 65% 45% at 90% 5%, rgba(0,170,160,0.22), transparent 48%), linear-gradient(160deg, #d4cfc4 0%, #c9c3b7 40%, #b8d4ce 100%)',
          }}
        />
        <ShapeGrid
          speed={0.35}
          squareSize={48}
          direction="diagonal"
          borderColor={gridBorder}
          hoverFillColor="#ff3b00"
          shape="square"
          hoverTrailAmount={4}
        />
      </div>

      {/* Nav */}
      <header className="lp-nav sticky top-0 z-40 border-b-2 border-ink dark:border-paper/40 bg-[#e8e4dc]/90 dark:bg-ink/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => scrollToSection('home')}
            className="flex items-center gap-3 cursor-target"
          >
            <BrandLogo size="sm" />
            <span className="font-display text-2xl leading-none tracking-tight">ICU Pay</span>
          </button>

          <nav className="hidden md:flex items-center gap-1" aria-label="Primary">
            {NAV.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => scrollToSection(item.id)}
                className="cursor-target px-3 py-2 font-mono text-[10px] uppercase tracking-[0.18em] font-bold hover:text-accent transition-colors"
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              className="btn-secondary text-xs p-2 cursor-target"
              aria-label="Toggle theme"
            >
              {isDark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
            </button>
            <Link to={primaryCta.to} className="btn-primary text-xs py-2 px-3 cursor-target inline-flex items-center gap-1.5">
              {primaryCta.label}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        {/* Mobile section links */}
        <div className="md:hidden flex border-t-2 border-ink/20 dark:border-paper/20">
          {NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => scrollToSection(item.id)}
              className="flex-1 py-2.5 font-mono text-[9px] uppercase tracking-widest font-bold text-center hover:bg-accent hover:text-white transition-colors cursor-target"
            >
              {item.label}
            </button>
          ))}
        </div>
      </header>

      <main className="relative z-10">
        {/* HOME / Hero — one composition */}
        <section
          id="home"
          ref={heroRef}
          className="relative min-h-[calc(100vh-4rem)] flex flex-col justify-center px-4 sm:px-6 py-16 sm:py-24"
        >
          <div className="max-w-6xl mx-auto w-full">
            <div className="lp-brand flex flex-col sm:flex-row sm:items-end gap-5 mb-10">
              <BrandLogo size="lg" />
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.25em] font-bold text-accent mb-2">
                  Information & Communications University
                </p>
                <h1 className="font-display text-6xl sm:text-8xl md:text-9xl leading-[0.85] tracking-tight">
                  ICU Pay
                </h1>
              </div>
            </div>

            <p className="lp-headline font-display text-2xl sm:text-3xl md:text-4xl max-w-2xl leading-snug text-ink/90 dark:text-paper/90 mb-5">
              Blockchain payment reconciliation for ICU Zambia
            </p>
            <p className="lp-sub font-medium text-base sm:text-lg max-w-xl text-ink/70 dark:text-paper/70 mb-10">
              Match deposit slips to bank statements, verify with confidence, and keep a tamper-evident trail —
              built for students, accountants, and administrators.
            </p>

            <div className="lp-cta flex flex-wrap items-center gap-3">
              <Link to={primaryCta.to} className="btn-primary py-3 px-6 cursor-target inline-flex items-center gap-2">
                {primaryCta.label}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/student" className="btn-secondary py-3 px-6 cursor-target">
                Check payment status
              </Link>
              <div className="w-full sm:w-auto sm:ml-2 mt-2 sm:mt-0">
                <FabricPoweredBadge />
              </div>
            </div>
          </div>
        </section>

        {/* ABOUT */}
        <section id="about" className="relative border-t-2 border-ink dark:border-paper/30 bg-[#e8e4dc]/85 dark:bg-ink/80 backdrop-blur-sm">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-28">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] font-bold text-accent mb-3">About</p>
            <h2 className="font-display text-4xl sm:text-5xl mb-4 max-w-2xl leading-tight">
              One system for slips, statements, and clearance
            </h2>
            <p className="max-w-2xl text-ink/70 dark:text-paper/70 font-medium mb-14">
              ICU Pay automates fee reconciliation: students submit deposit slips, accountants upload bank
              statements, and the platform matches, verifies, and records outcomes with Hyperledger Fabric when
              available.
            </p>

            <div className="grid sm:grid-cols-3 gap-6 sm:gap-8">
              {[
                {
                  icon: FileCheck,
                  title: 'Deposit & OCR',
                  body: 'Students upload slips; staff process bank PDFs with guided matching and review.',
                },
                {
                  icon: Link2,
                  title: 'Verified trail',
                  body: 'Approved payments can be anchored on-chain for an independent integrity record.',
                },
                {
                  icon: Shield,
                  title: 'Role-based access',
                  body: 'Students, accountants, registrars, and admins each see only what their role needs.',
                },
              ].map(({ icon: Icon, title, body }) => (
                <div key={title} className="lp-about-item border-t-2 border-ink dark:border-paper/40 pt-5">
                  <Icon className="h-6 w-6 text-accent mb-4" strokeWidth={2} />
                  <h3 className="font-display text-2xl mb-2">{title}</h3>
                  <p className="text-sm font-medium text-ink/65 dark:text-paper/65 leading-relaxed">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CONTACT */}
        <section id="contact" className="relative border-t-2 border-ink dark:border-paper/30">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-28">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] font-bold text-accent mb-3">
              Contact Us
            </p>
            <h2 className="font-display text-4xl sm:text-5xl mb-4 leading-tight">Get in touch</h2>
            <p className="max-w-xl text-ink/70 dark:text-paper/70 font-medium mb-12">
              For access, training, or deployment questions about ICU Pay at Information and Communications
              University.
            </p>

            <div className="grid sm:grid-cols-3 gap-8 max-w-3xl">
              <div className="flex gap-3">
                <Mail className="h-5 w-5 text-accent shrink-0 mt-0.5" />
                <div>
                  <p className="font-mono text-[9px] uppercase tracking-widest font-bold mb-1">Email</p>
                  <a
                    href="mailto:support@icu.edu.zm"
                    className="font-semibold hover:text-accent underline-offset-2 hover:underline cursor-target"
                  >
                    support@icu.edu.zm
                  </a>
                </div>
              </div>
              <div className="flex gap-3">
                <Phone className="h-5 w-5 text-accent shrink-0 mt-0.5" />
                <div>
                  <p className="font-mono text-[9px] uppercase tracking-widest font-bold mb-1">Phone</p>
                  <p className="font-semibold">+260 (ICU campus line)</p>
                </div>
              </div>
              <div className="flex gap-3">
                <MapPin className="h-5 w-5 text-accent shrink-0 mt-0.5" />
                <div>
                  <p className="font-mono text-[9px] uppercase tracking-widest font-bold mb-1">Campus</p>
                  <p className="font-semibold">Lusaka, Zambia</p>
                </div>
              </div>
            </div>

            <div className="mt-12 flex flex-wrap gap-3">
              <Link to="/login" className="btn-primary py-3 px-5 cursor-target">
                Staff login
              </Link>
              <Link to="/student" className="btn-secondary py-3 px-5 cursor-target">
                Student payment check
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t-2 border-ink dark:border-paper/40 bg-ink text-paper">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-8">
          <div>
            <p className="font-display text-3xl mb-1">ICU Pay</p>
            <p className="font-mono text-[10px] uppercase tracking-widest opacity-70">
              Blockchain payment reconciliation
            </p>
          </div>
          <div className="sm:text-right">
            <p className="font-mono text-[9px] uppercase tracking-[0.2em] opacity-60 mb-1">Created by</p>
            <p className="font-display text-2xl leading-none">Bernard Zulu</p>
            <p className="font-semibold text-sm mt-1 text-[#5eead4]">Bluepeak Technologies</p>
          </div>
        </div>
        <div className="border-t border-paper/20 px-4 sm:px-6 py-4">
          <p className="max-w-6xl mx-auto font-mono text-[9px] uppercase tracking-wider opacity-50 text-center sm:text-left">
            © {new Date().getFullYear()} ICU · Built by Bernard Zulu · Bluepeak Technologies
          </p>
        </div>
      </footer>
    </div>
  );
}
