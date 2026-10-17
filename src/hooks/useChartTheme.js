import { useTheme } from './useTheme'
import { gaugeHex } from '../lib/status'

// Recharts draws SVG attributes, which can't read CSS variables, so charts get concrete
// hex values per theme. Values mirror the tokens in src/index.css.
const NEUTRAL = {
  light: { axis: '#6B726C', grid: '#E6E6E1', tickStrong: '#1C211E', surface: '#FFFFFF', primary: '#2F4234', muted: '#9AA39C' },
  dark:  { axis: '#9AA39C', grid: '#303631', tickStrong: '#ECEFEB', surface: '#212622', primary: '#8FD0A2', muted: '#6B726C' },
}

// Non-status series: the categorical palette (--cat-1…5 in index.css), so charts have colour
// without borrowing status red / amber / green.
const SERIES = {
  light: ['#1F7A7A', '#4F57B0', '#8B4C9C', '#2F7FB8', '#56636F'],
  dark:  ['#7FD1CC', '#A9B0F0', '#D7A7E3', '#94C6EC', '#B4BEC8'],
}

export function useChartTheme() {
  const { resolved } = useTheme()
  const mode = resolved === 'dark' ? 'dark' : 'light'
  return {
    ...NEUTRAL[mode],
    series: SERIES[mode],
    status: (s) => gaugeHex(s),
    tick: { fontSize: 11, fill: NEUTRAL[mode].axis },
  }
}
