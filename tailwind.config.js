/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary:      { DEFAULT: '#006241', light: '#00754A', dark: '#1E3932', bg: '#EAF4EF' },
        secondary:    { DEFAULT: '#64748B', light: '#94A3B8', dark: '#334155' },
        success:      { DEFAULT: '#10B981', light: '#34D399', dark: '#065F46', bg: '#ECFDF5' },
        warning:      { DEFAULT: '#F59E0B', light: '#FBBF24', dark: '#92400E', bg: '#FFFBEB' },
        danger:       { DEFAULT: '#EF4444', light: '#F87171', dark: '#991B1B', bg: '#FEF2F2' },
        surface:      { DEFAULT: '#FFFFFF', alt: '#f2f0eb', border: '#edeae5' },
        text:         { DEFAULT: '#0F172A', muted: '#475569', inverse: '#FFFFFF' },
        'epi-dark':   '#1E3932',
        'epi-mint':   '#d4e9e2',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        'toast-in': {
          '0%':   { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'ken-burns': {
          '0%':   { transform: 'scale(1.0)' },
          '100%': { transform: 'scale(1.08)' },
        },
      },
      animation: {
        'toast-in':  'toast-in 200ms cubic-bezier(0.16, 1, 0.3, 1)',
        'ken-burns': 'ken-burns 5s ease-in-out forwards',
      },
    },
  },
  plugins: [],
}
