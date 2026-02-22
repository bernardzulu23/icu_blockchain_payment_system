/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        icu: {
          primary: '#0f172a',
          secondary: '#1e293b',
          accent: '#38bdf8',
          accentAlt: '#818cf8',
          success: '#22c55e',
          warning: '#f59e0b',
          muted: '#64748b',
        },
      },
      fontFamily: {
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
        display: ['Outfit', 'system-ui', 'sans-serif'],
      },
      backdropBlur: {
        xs: '2px',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-mesh': 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
      },
      boxShadow: {
        glass: '0 8px 32px 0 rgba(0, 0, 0, 0.2), inset 0 1px 0 0 rgba(255,255,255,0.1)',
        'glass-sm': '0 4px 16px 0 rgba(0, 0, 0, 0.15)',
      },
    },
  },
  plugins: [],
};
