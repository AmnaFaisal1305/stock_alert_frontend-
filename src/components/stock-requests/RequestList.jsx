import { useState } from 'react'
import { ChevronDown, Truck } from 'lucide-react'
import Card from '../shared/Card'
import FilterChips from '../shared/FilterChips'
import StatusBadge from '../shared/StatusBadge'
import EmptyState from '../shared/EmptyState'
import ErrorState from '../shared/ErrorState'
import { SkeletonRows } from '../shared/SkeletonCard'
import { REQUEST_FILTERS, PIPELINE, pipelineStep, vaccineSummary, totalVials } from '../../lib/stockRequests'
import { displayVaccineName } from '../../lib/vaccineNames'
import { formatDate } from '../../lib/format'

function Pipeline({ stage }) {
  if (stage === 'cancelled' || stage === 'declined') return null
  const step = pipelineStep(stage)
  return (
    <ol className="flex items-center gap-2 text-xs" aria-label={`Step ${step} of 3`}>
      {PIPELINE.map((label, i) => {
        const done = step > i
        return (
          <li key={label} className="flex items-center gap-2">
            {i > 0 && <span className={`h-px w-6 ${step > i ? 'bg-primary' : 'bg-surface-border'}`} aria-hidden="true" />}
            <span className={`inline-flex items-center gap-1.5 ${done ? 'text-text font-medium' : 'text-text-muted'}`}>
              <span className={`w-2 h-2 rounded-full ${done ? 'bg-primary' : 'border border-text-muted'}`} aria-hidden="true" />
              {label}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

export function RequestItemsTable({ items = [] }) {
  const showFulfilled = items.some((it) => (it.fulfilledVials ?? 0) > 0)
  return (
    <div className="overflow-x-auto rounded-control border border-surface-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-surface-border text-xs font-medium text-text-muted">
            <th scope="col" className="text-left px-3.5 py-2">Vaccine</th>
            <th scope="col" className="text-right px-3.5 py-2">Requested</th>
            {showFulfilled && <th scope="col" className="text-right px-3.5 py-2">Fulfilled</th>}
            <th scope="col" className="text-right px-3.5 py-2">Sent</th>
            <th scope="col" className="text-right px-3.5 py-2">Received</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-border">
          {items.map((it) => {
            const differs = it.sentVials != null && it.receivedVials != null && it.sentVials !== it.receivedVials
            return (
              <tr key={it.vaccineId}>
                <td className="px-3.5 py-2 text-text">{displayVaccineName(it.vaccineName)}</td>
                <td className="px-3.5 py-2 text-right">{it.requestedVials}</td>
                {showFulfilled && <td className="px-3.5 py-2 text-right">{it.fulfilledVials ?? 0}<span className="text-text-muted"> · {it.outstandingVials ?? 0} left</span></td>}
                <td className="px-3.5 py-2 text-right">{it.sentVials ?? <span className="text-text-muted">—</span>}</td>
                <td className={`px-3.5 py-2 text-right ${differs ? 'text-danger-dark font-medium' : ''}`}>{it.receivedVials ?? <span className="text-text-muted">—</span>}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function RequestRow({ req, showFacility, renderActions }) {
  const [open, setOpen] = useState(false)
  const id = `req-${req.id}`
  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={id}
        className="w-full text-left px-4 sm:px-5 py-3.5 flex items-center gap-3 hover:bg-surface-alt transition-colors"
      >
        <div className="flex-1 min-w-0 grid gap-1 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-text truncate">
              {showFacility && req.facilityName ? <>{req.facilityName} · </> : null}{vaccineSummary(req.items)}
            </p>
            <p className="text-xs text-text-muted mt-0.5 tabular-nums">
              {totalVials(req.items)} vials requested · {formatDate(req.createdAt)}
              {req.note && <span className="hidden md:inline"> · “{req.note}”</span>}
            </p>
          </div>
          <StatusBadge kind="workflow" status={req.stage} />
        </div>
        <ChevronDown size={16} strokeWidth={1.75} className={`text-text-muted flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {open && (
        <div id={id} className="px-4 sm:px-5 pb-4 flex flex-col gap-3">
          <Pipeline stage={req.stage} />
          <RequestItemsTable items={req.items} />
          {req.shortfallNote && <p className="text-sm text-warning-dark bg-warning-bg rounded-control px-3.5 py-2.5">Shortfall note: “{req.shortfallNote}”</p>}
          {renderActions?.(req)}
        </div>
      )}
    </li>
  )
}

// Filter chips + collapsible list. Each page passes its own role-specific actions.
export default function RequestList({ requests, isLoading, isError, error, onRetry, renderActions, showFacility = false, emptyHint }) {
  const [filter, setFilter] = useState('all')
  const options = REQUEST_FILTERS.map((f) => ({ value: f.value, label: f.label, count: requests.filter(f.test).length }))
  const shown = requests.filter(REQUEST_FILTERS.find((f) => f.value === filter).test)

  if (isError) return <ErrorState title="Couldn’t load stock requests" error={error} onRetry={onRetry} />

  return (
    <div className="flex flex-col gap-4">
      <FilterChips options={options} value={filter} onChange={setFilter} label="Filter requests" />
      <Card padding={false}>
        {isLoading ? (
          <SkeletonRows rows={4} />
        ) : shown.length === 0 ? (
          <EmptyState icon={Truck} title={filter === 'all' ? 'No stock requests yet' : 'No requests in this view'} message={filter === 'all' ? emptyHint : undefined} />
        ) : (
          <ul className="divide-y divide-surface-border">
            {shown.map((req) => <RequestRow key={req.id} req={req} showFacility={showFacility} renderActions={renderActions} />)}
          </ul>
        )}
      </Card>
    </div>
  )
}
