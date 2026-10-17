// Stock-request stage logic shared by the facility supervisor, UC supervisor and facility head pages.
import { displayVaccineName } from './vaccineNames'

export const TERMINAL        = new Set(['completed', 'partially_fulfilled', 'cancelled', 'declined'])
export const OPEN_STAGES     = new Set(['awaiting_both', 'awaiting_sent', 'awaiting_received', 'figures_differ'])
export const SENT_STAGES     = new Set(['awaiting_received', 'figures_differ', 'ready_for_approval', 'completed', 'partially_fulfilled'])
export const RECEIVED_STAGES = new Set(['completed', 'partially_fulfilled'])

export const REQUEST_FILTERS = [
  { value: 'all',       label: 'All',       test: () => true },
  { value: 'awaiting',  label: 'In progress', test: (r) => !TERMINAL.has(r.stage) },
  { value: 'completed', label: 'Completed', test: (r) => r.stage === 'completed' || r.stage === 'partially_fulfilled' },
  { value: 'closed',    label: 'Cancelled / declined', test: (r) => r.stage === 'cancelled' || r.stage === 'declined' },
]

export const PIPELINE = ['Requested', 'Sent', 'Received']

// 1 = requested, 2 = sent, 3 = received. Cancelled/declined requests have no pipeline.
export function pipelineStep(stage) {
  if (RECEIVED_STAGES.has(stage)) return 3
  if (SENT_STAGES.has(stage)) return 2
  return 1
}

export function vaccineSummary(items = []) {
  const names = items.map((it) => displayVaccineName(it.vaccineName))
  if (names.length <= 2) return names.join(', ')
  return `${names.slice(0, 2).join(', ')} +${names.length - 2} more`
}

export const totalVials = (items = [], key = 'requestedVials') => items.reduce((s, it) => s + (it[key] ?? 0), 0)
