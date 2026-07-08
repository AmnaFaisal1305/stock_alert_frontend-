// Single source of truth for the dashboard/detail `status` vocabulary:
// critical | low | adequate | no_data (was red | amber | green | no_data pre-Round-5).

export const STATUS_CONFIG = {
  critical: {
    dot: 'bg-danger', text: 'text-danger-dark', bg: 'bg-danger-bg', label: 'Critical',
    borderL: 'border-l-danger', ring: 'ring-1 ring-danger/20', gaugeHex: '#DC2626',
  },
  low: {
    dot: 'bg-warning', text: 'text-warning-dark', bg: 'bg-warning-bg', label: 'Low',
    borderL: 'border-l-warning', ring: '', gaugeHex: '#D97706',
  },
  adequate: {
    dot: 'bg-success', text: 'text-success-dark', bg: 'bg-success-bg', label: 'OK',
    borderL: 'border-l-success', ring: '', gaugeHex: '#16A34A',
  },
  no_data: {
    dot: 'bg-secondary', text: 'text-text-muted', bg: 'bg-surface-alt', label: 'No data',
    borderL: 'border-l-secondary', ring: '', gaugeHex: '#9CA3AF',
  },
}

// Most severe first — drives worstStatus()/sort order across dashboards.
// no_data ranks above adequate: an unrecorded vaccine needs attention sooner than a healthy one.
const STATUS_ORDER = ['critical', 'low', 'no_data', 'adequate']

export const STATUS_RANK = Object.fromEntries(STATUS_ORDER.map((s, i) => [s, i]))

export function statusConfig(status) {
  return STATUS_CONFIG[status] ?? STATUS_CONFIG.no_data
}

export function gaugeHex(status) {
  return statusConfig(status).gaugeHex
}

// Accepts either an array of status strings/rows ({status}) or a statusCounts object.
export function worstStatus(input) {
  if (Array.isArray(input)) {
    const statuses = new Set(input.map((r) => (typeof r === 'string' ? r : r?.status)))
    for (const s of STATUS_ORDER) if (statuses.has(s)) return s
    return 'no_data'
  }
  for (const s of STATUS_ORDER) if (input?.[s] > 0) return s
  return 'no_data'
}

// Pill-filter definitions shared by list/grid screens that filter a row set by status.
// 'Low' intentionally matches both 'low' and 'no_data' rows (an unrecorded vaccine needs
// the same attention as a low one) even though their badge/border styling stays distinct.
export const FILTERS = [
  { label: 'All',      match: () => true },
  { label: 'Critical', match: (s) => s === 'critical' },
  { label: 'Low',      match: (s) => s === 'low' || s === 'no_data' },
  { label: 'OK',       match: (s) => s === 'adequate' },
]
