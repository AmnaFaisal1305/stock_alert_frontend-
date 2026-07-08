/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary:   { DEFAULT: '#A30014', light: '#C21A2E', dark: '#7A000D', bg: '#FFF5F5' }, // AKUH Crimson Brand Red
        secondary: { DEFAULT: '#64748B', light: '#94A3B8', dark: '#334155' }, // Slate neutrals
        success:   { DEFAULT: '#10B981', light: '#34D399', dark: '#065F46', bg: '#ECFDF5' }, // Emerald-based success
        warning:   { DEFAULT: '#F59E0B', light: '#FBBF24', dark: '#92400E', bg: '#FFFBEB' }, // Amber-based warning
        danger:    { DEFAULT: '#EF4444', light: '#F87171', dark: '#991B1B', bg: '#FEF2F2' }, // Red-based alert/danger
        surface:   { DEFAULT: '#FFFFFF', alt: '#F8FAFC', border: '#E2E8F0' }, // Slate-50 background, Slate-200 border
        text:      { DEFAULT: '#0F172A', muted: '#475569', inverse: '#FFFFFF' }, // Slate-900 and Slate-600
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        'toast-in': {
          '0%':   { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'toast-in': 'toast-in 200ms cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
}
