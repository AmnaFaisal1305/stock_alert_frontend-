/** @type {import('tailwindcss').Config} */

// Semantic colours are backed by CSS variables (channel triplets) defined in
// src/index.css, so a single token set drives both light and dark themes and
// Tailwind opacity modifiers (bg-primary/5, ring-danger/20) keep working.
const v = (name) => `rgb(var(${name}) / <alpha-value>)`

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary:      { DEFAULT: v('--pri'), light: v('--pri-light'), dark: v('--side'), bg: v('--pri-bg') },
        secondary:    { DEFAULT: v('--neutral'), light: v('--mut'), dark: v('--ink') },
        success:      { DEFAULT: v('--ok'),   light: v('--ok'),   dark: v('--ok-text'),   bg: v('--ok-bg') },
        warning:      { DEFAULT: v('--low'),  light: v('--low'),  dark: v('--low-text'),  bg: v('--low-bg') },
        danger:       { DEFAULT: v('--crit'), light: v('--crit'), dark: v('--crit-text'), bg: v('--crit-bg') },
        info:         { DEFAULT: v('--info'), dark: v('--info-text'), bg: v('--info-bg') },
        surface:      { DEFAULT: v('--card'), alt: v('--bg'), border: v('--line'), chip: v('--chip') },
        text:         { DEFAULT: v('--ink'), muted: v('--mut'), inverse: '#FFFFFF' },
        'epi-dark':   v('--side'),
        'epi-mint':   v('--ok-bg'),
      },
      borderRadius: {
        card: '1.125rem',  // 18px — cards, panels, dialogs
        control: '0.625rem', // 10px — buttons, inputs, selects, tab tracks, inner tiles
      },
      // DESIGN.md "Flat-By-Default": resting surfaces use a hairline, only floating layers get these.
      boxShadow: {
        float:   '0 8px 24px rgb(28 33 30 / 0.12)',
        overlay: '0 24px 48px rgb(28 33 30 / 0.18)',
      },
      fontFamily: {
        sans: ['"Figtree Variable"', 'Figtree', 'ui-sans-serif', 'system-ui', 'sans-serif'],
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
