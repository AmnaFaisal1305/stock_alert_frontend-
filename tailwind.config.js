/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary:   { DEFAULT: '#0F766E', light: '#14B8A6', dark: '#0D6B63' },
        secondary: { DEFAULT: '#6B7280', light: '#9CA3AF', dark: '#374151' },
        success:   { DEFAULT: '#16A34A', light: '#22C55E', dark: '#15803D', bg: '#F0FDF4' },
        warning:   { DEFAULT: '#D97706', light: '#F59E0B', dark: '#B45309', bg: '#FFFBEB' },
        danger:    { DEFAULT: '#DC2626', light: '#EF4444', dark: '#B91C1C', bg: '#FEF2F2' },
        surface:   { DEFAULT: '#FFFFFF', alt: '#F9FAFB', border: '#E5E7EB' },
        text:      { DEFAULT: '#111827', muted: '#6B7280', inverse: '#FFFFFF' },
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
