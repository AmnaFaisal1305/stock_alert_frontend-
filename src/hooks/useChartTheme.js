import { useTheme } from './useTheme'
import { gaugeHex } from '../lib/status'

// Recharts draws SVG attributes, which can't read CSS variables, so charts get concrete
// hex values per theme. Values mirror the tokens in src/index.css.
const NEUTRAL = {
  light: { axis: '#6B726C', grid: '#E6E6E1', tickStrong: '#1C211E', surface: '#FFFFFF', primary: '#2F4234', muted: '#9AA39C' },
  dark:  { axis: '#9AA39C', grid: '#303631', tickStrong: '#ECEFEB', surface: '#212622', primary: '#8FD0A2', muted: '#6B726C' },
}

// Non-status series: forest, then stepped neutrals, so only status data carries hue.
const SERIES = {
  light: ['#2F4234', '#7E9583', '#B9C7BC', '#5B625D'],
  dark:  ['#8FD0A2', '#5E8A68', '#3E5A46', '#A9B1AB'],
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
