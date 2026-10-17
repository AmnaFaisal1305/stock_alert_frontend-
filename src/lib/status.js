// Single source of truth for the dashboard/detail `status` vocabulary:
// critical | low | adequate | no_data (was red | amber | green | no_data pre-Round-5).

export const STATUS_CONFIG = {
  critical: {
    dot: 'bg-danger', text: 'text-danger-dark', bg: 'bg-danger-bg', label: 'Critical',
    borderL: 'border-l-danger', ring: 'ring-1 ring-danger/20', gaugeHex: '#C5483F',
  },
  low: {
    dot: 'bg-warning', text: 'text-warning-dark', bg: 'bg-warning-bg', label: 'Low',
    borderL: 'border-l-warning', ring: 'ring-1 ring-warning/20', gaugeHex: '#E0A53A',
  },
  adequate: {
    dot: 'bg-success', text: 'text-success-dark', bg: 'bg-success-bg', label: 'Normal',
    borderL: 'border-l-success', ring: 'ring-1 ring-success/20', gaugeHex: '#2F9E66',
  },
  no_data: {
    dot: 'bg-secondary', text: 'text-text-muted', bg: 'bg-surface-chip', label: 'Stock Not Updated',
    borderL: 'border-l-secondary', ring: 'ring-1 ring-secondary/20', gaugeHex: '#9AA39C',
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

// Facility-level status from its statusCounts object.
// Priority: critical > low > adequate > no_data (no_data is last — one unrecorded vaccine
// must not override real adequate/low/critical counts on the same facility).
export function facilityStatus(statusCounts) {
  if (statusCounts?.critical > 0) return 'critical'
  if (statusCounts?.low      > 0) return 'low'
  if (statusCounts?.adequate > 0) return 'adequate'
  return 'no_data'
}

// District-level rollup: ignore no_data facilities — only return no_data if every facility has no_data.
export function districtStatus(facilityStatuses) {
  const withData = facilityStatuses.filter((s) => s !== 'no_data')
  return withData.length ? worstStatus(withData) : 'no_data'
}

// Workflow vocabulary: stock-request stages + approval statuses. Same tone classes as stock
// status so every pill in the app reads from one palette.
const TONE = {
  warning: { dot: 'bg-warning', text: 'text-warning-dark', bg: 'bg-warning-bg' },
  danger:  { dot: 'bg-danger',  text: 'text-danger-dark',  bg: 'bg-danger-bg'  },
  info:    { dot: 'bg-info',    text: 'text-info-dark',    bg: 'bg-info-bg'    },
  success: { dot: 'bg-success', text: 'text-success-dark', bg: 'bg-success-bg' },
  neutral: { dot: 'bg-secondary', text: 'text-text-muted', bg: 'bg-surface-chip' },
}

export const WORKFLOW_STATUS = {
  awaiting_both:       { tone: 'warning', label: 'Awaiting sent & received' },
  awaiting_sent:       { tone: 'warning', label: 'Awaiting sent' },
  awaiting_received:   { tone: 'info',    label: 'Awaiting received' },
  figures_differ:      { tone: 'danger',  label: 'Figures differ' },
  ready_for_approval:  { tone: 'info',    label: 'Ready for approval' },
  completed:           { tone: 'success', label: 'Completed' },
  partially_fulfilled: { tone: 'warning', label: 'Partially fulfilled' },
  cancelled:           { tone: 'neutral', label: 'Cancelled' },
  declined:            { tone: 'neutral', label: 'Declined' },
  pending:             { tone: 'warning', label: 'Pending' },
  approved:            { tone: 'success', label: 'Approved' },
  rejected:            { tone: 'danger',  label: 'Rejected' },
}

export function workflowStatusConfig(status) {
  const s = WORKFLOW_STATUS[status]
  if (!s) return { ...TONE.neutral, label: String(status ?? '').replace(/_/g, ' ') }
  return { ...TONE[s.tone], tone: s.tone, label: s.label }
}

// Pill-filter definitions shared by list/grid screens that filter a row set by status.
// 'Low' intentionally matches both 'low' and 'no_data' rows (an unrecorded vaccine needs
// the same attention as a low one) even though their badge/border styling stays distinct.
export const FILTERS = [
  { label: 'All',      match: () => true },
  { label: 'Critical', match: (s) => s === 'critical' },
  { label: 'Low',      match: (s) => s === 'low' || s === 'no_data' },
  { label: 'Normal',   match: (s) => s === 'adequate' },
]
