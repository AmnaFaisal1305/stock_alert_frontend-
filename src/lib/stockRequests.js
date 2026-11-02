// Stock-request logic shared by the facility supervisor, UC supervisor and facility head pages.
// `status` is stored; `stage` is computed per read. A request is open while `closedAt` is null,
// which includes an open `partially_fulfilled` one waiting for its next delivery round.

export const isOpenRequest = (r) => r.closedAt == null

// null = that side hasn't recorded yet; 0 is a real figure.
export const hasFigures = (r) => (r.items ?? []).some((it) => it.sentVials != null || it.receivedVials != null)
export const hasSent     = (r) => (r.items ?? []).length > 0 && r.items.every((it) => it.sentVials != null)
export const hasReceived = (r) => (r.items ?? []).length > 0 && r.items.every((it) => it.receivedVials != null)

export const REQUEST_FILTERS = [
  { value: 'all',                 label: 'All',                 test: () => true },
  { value: 'awaiting',            label: 'In progress',         test: isOpenRequest },
  { value: 'partially_fulfilled', label: 'Partially fulfilled', test: (r) => r.status === 'partially_fulfilled' },
  { value: 'completed',           label: 'Completed',           test: (r) => r.status === 'completed' },
  { value: 'cancelled',           label: 'Cancelled',           test: (r) => r.status === 'cancelled' },
  { value: 'declined',            label: 'Declined',            test: (r) => r.status === 'declined' },
]

// Sent and received can be recorded in either order, so each step is worked out on its own.
// The figures belong to the current round; they're cleared after a partial approval.
export function pipelineSteps(r) {
  const closed = !isOpenRequest(r)
  return [
    { label: 'Requested', done: true },
    { label: 'Sent',      done: hasSent(r) || closed },
    { label: 'Received',  done: hasReceived(r) || closed },
    { label: 'Approved',  done: closed },
  ]
}

export function vaccineSummary(items = []) {
  const names = items.map((it) => it.vaccineName)
  if (names.length <= 2) return names.join(', ')
  return `${names.slice(0, 2).join(', ')} +${names.length - 2} more`
}

export const totalVials = (items = [], key = 'requestedVials') => items.reduce((s, it) => s + (it[key] ?? 0), 0)
