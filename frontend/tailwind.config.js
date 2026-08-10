/** @type {import('tailwindcss').Config} */

/* EduZambia brutalist core — blue/cyan/indigo remapped away */
const paper = '#C9C3B7';
const ink = '#111111';
const accent = '#FF3B00';

/** Warm neutrals (ex-slate / gray) — paper → ink */
const inkScale = {
  50: '#D6D0C4',
  100: paper,
  200: '#B8B2A6',
  300: '#9E988C',
  400: '#8A857A',
  500: '#5C5850',
  600: '#3D3A35',
  700: '#2A2824',
  800: '#1A1917',
  900: ink,
  950: ink,
};

/** Accent scale (ex-cyan / blue / sky / indigo / violet) */
const accentScale = {
  50: '#FFE8E0',
  100: '#FFD1C2',
  200: '#FFA388',
  300: '#FF7550',
  400: '#FF5328',
  500: accent,
  600: '#E63500',
  700: '#CC2F00',
  800: '#A32600',
  900: '#7A1C00',
  950: '#4D1200',
};

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        paper: paper,
        ink: ink,
        accent: accent,
        /* Brand aliases — do not override Tailwind's built-in `white` */
        icu: {
          primary: ink,
          secondary: '#1A1917',
          accent,
          accentAlt: '#E63500',
          success: '#1A6B6A',
          warning: '#C99A2E',
          muted: '#5C5850',
        },
        /* Remap legacy blue-family → accent (no blue remains) */
        slate: inkScale,
        gray: inkScale,
        zinc: inkScale,
        neutral: inkScale,
        stone: inkScale,
        cyan: accentScale,
        blue: accentScale,
        sky: accentScale,
        indigo: accentScale,
        violet: accentScale,
        purple: accentScale,
        fuchsia: accentScale,
        /* Keep status greens/ambers as non-blue semantics */
        green: {
          50: '#E8F5F0',
          100: '#C5E8DC',
          200: '#8FD0BB',
          300: '#5AB89A',
          400: '#2E9A7A',
          500: '#1A6B6A',
          600: '#155655',
          700: '#104140',
          800: '#0B2C2B',
          900: '#071C1B',
          950: '#041111',
        },
        amber: {
          50: '#FBF6E8',
          100: '#F5E9C5',
          200: '#EBD48A',
          300: '#E0BF4F',
          400: '#D4A932',
          500: '#C99A2E',
          600: '#A37C24',
          700: '#7D5E1B',
          800: '#574113',
          900: '#3A2B0C',
          950: '#1F1707',
        },
        red: accentScale,
        orange: accentScale,
      },
      fontFamily: {
        sans: ['Montserrat', 'system-ui', 'sans-serif'],
        display: ['Instrument Serif', 'Georgia', 'serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        glass: '4px 4px 0 #111111',
        'glass-sm': '2px 2px 0 #111111',
        brutal: '4px 4px 0 #111111',
        'brutal-lg': '8px 8px 0 #111111',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-mesh': 'none',
        'dot-grid':
          'radial-gradient(#111111 1px, transparent 1px)',
      },
      backgroundSize: {
        'dot-grid': '24px 24px',
      },
    },
  },
  plugins: [],
};
