import { useState } from 'react'
import { PackageOpen, ChevronDown, ChevronUp } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getStockRequests, approveStockRequest } from '../../lib/api'
import Button from '../../components/ui/Button'
import PageHeader from '../../components/shared/PageHeader'
import { displayVaccineName } from '../../lib/vaccineNames'

const STAGE_BADGE = {
  awaiting_both:       'bg-warning-bg text-warning-dark',
  awaiting_sent:       'bg-warning-bg text-warning-dark',
  awaiting_received:   'bg-warning-bg text-warning-dark',
  figures_differ:      'bg-danger-bg text-danger',
  ready_for_approval:  'bg-primary/10 text-primary',
  completed:           'bg-success-bg text-success-dark',
  partially_fulfilled: 'bg-warning-bg text-warning-dark',
  cancelled:           'bg-surface-chip text-text-muted',
  declined:            'bg-surface-chip text-text-muted',
}

const STAGE_LABEL = {
  awaiting_both:       'Awaiting Sent & Received',
  awaiting_sent:       'Awaiting Sent',
  awaiting_received:   'Awaiting Received',
  figures_differ:      'Figures Differ',
  ready_for_approval:  'Ready for Approval',
  completed:           'Completed',
  partially_fulfilled: 'Partially Fulfilled',
  cancelled:           'Cancelled',
  declined:            'Declined',
}

const TERMINAL       = new Set(['completed', 'partially_fulfilled', 'cancelled', 'declined'])
const SENT_STAGES    = new Set(['awaiting_received', 'figures_differ', 'ready_for_approval', 'completed', 'partially_fulfilled'])
const RECEIVED_STAGES = new Set(['completed', 'partially_fulfilled'])

const FILTER_CONFIG = [
  { key: 'all',       label: 'All requests', dot: '#1d2b25', test: () => true },
  { key: 'awaiting',  label: 'Awaiting',     dot: '#e0a21b', test: r => !TERMINAL.has(r.stage) },
  { key: 'completed', label: 'Completed',    dot: '#2f8f4e', test: r => r.stage === 'completed' || r.stage === 'partially_fulfilled' },
  { key: 'cancelled', label: 'Cancelled',    dot: '#9aa39d', test: r => r.stage === 'cancelled' || r.stage === 'declined' },
]

function pipelineStep(stage) {
  if (RECEIVED_STAGES.has(stage)) return 3
  if (SENT_STAGES.has(stage)) return 2
  return 1
}

function RequestCard({ req }) {
  const qc = useQueryClient()
  const [expanded,     setExpanded]     = useState(false)
  const [mismatchRows, setMismatchRows] = useState(null)
  const [approveNote,  setApproveNote]  = useState('')

  const needsNote = req.stage === 'ready_for_approval' &&
    (req.items ?? []).some(it => (it.receivedVials ?? 0) < (it.outstandingVials ?? it.requestedVials))

  const approveMutation = useMutation({
    mutationFn: () => approveStockRequest(req.id, approveNote.trim() || undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock-requests'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      qc.invalidateQueries({ queryKey: ['audit-log'] })
      setMismatchRows(null)
    },
    onError: (err) => {
      if (err.status === 409 && err.body?.mismatches) {
        setMismatchRows(err.body.mismatches)
      }
    },
  })

  const pStep = pipelineStep(req.stage)
  const PIPELINE_STEPS = ['Requested', 'Sent', 'Received']

  return (
    <div className="bg-surface rounded-[18px] border border-surface-border p-5 flex flex-col gap-3">
      {/* Top row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5 flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg ${STAGE_BADGE[req.stage] ?? 'bg-surface-chip text-text-muted'}`}>
              {STAGE_LABEL[req.stage] ?? req.stage}
            </span>
            <span className="text-xs text-text-muted">{req.items?.length ?? 0} vaccines</span>
            <span className="text-xs text-text-muted">· {new Date(req.createdAt).toLocaleDateString()}</span>
          </div>
          {req.note && <p className="text-xs text-text-muted italic truncate">"{req.note}"</p>}
        </div>
        <button
          onClick={() => setExpanded(v => !v)}
          className="text-text-muted hover:text-text transition-colors p-1 flex-shrink-0 cursor-pointer"
        >
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {/* Pipeline */}
      {req.stage !== 'cancelled' && req.stage !== 'declined' && (
        <div className="flex items-start">
          {PIPELINE_STEPS.map((label, i) => {
            const done = pStep > i
            return (
              <div key={label} className="flex items-start">
                <div className="flex flex-col items-center gap-1 w-[72px]">
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center text-[10px] font-bold ${
                    done ? 'bg-primary border-primary text-white' : 'bg-surface border-surface-border'
                  }`}>
                    {done ? '✓' : ''}
                  </div>
                  <span className={`text-[11px] text-center leading-tight ${done ? 'text-text font-medium' : 'text-text-muted'}`}>
                    {label}
                  </span>
                </div>
                {i < 2 && (
                  <div className={`h-0.5 w-8 mt-2.5 ${pStep >= i + 2 ? 'bg-primary' : 'bg-surface-border'}`} />
                )}
              </div>
            )
          })}
        </div>
      )}

      {expanded && (
        <div className="pt-1 space-y-2 border-t border-surface-border">
          <div className="rounded-xl border border-surface-border overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-surface-alt text-text-muted uppercase tracking-wide">
                <tr>
                  <th className="px-3 py-2 text-left">Vaccine</th>
                  <th className="px-3 py-2 text-center">Req</th>
                  <th className="px-3 py-2 text-center">Fulfilled</th>
                  <th className="px-3 py-2 text-center">Left</th>
                  <th className="px-3 py-2 text-center">Sent</th>
                  <th className="px-3 py-2 text-center">Received</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {(req.items ?? []).map(it => (
                  <tr key={it.vaccineId}>
                    <td className="px-3 py-2 text-text">{displayVaccineName(it.vaccineName)}</td>
                    <td className="px-3 py-2 text-center text-text">{it.requestedVials}</td>
                    <td className="px-3 py-2 text-center text-text">{it.fulfilledVials ?? 0}</td>
                    <td className="px-3 py-2 text-center text-text">{it.outstandingVials ?? it.requestedVials}</td>
                    <td className="px-3 py-2 text-center text-text">{it.sentVials ?? '—'}</td>
                    <td className="px-3 py-2 text-center text-text">{it.receivedVials ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {mismatchRows && (
            <div className="bg-danger-bg border border-danger/20 rounded-xl p-3 space-y-2">
              <p className="text-xs font-bold text-danger uppercase tracking-wide">Sent / Received figures differ</p>
              {mismatchRows.map(m => (
                <p key={m.vaccineId} className="text-xs text-danger">
                  {displayVaccineName(m.vaccineName)}: sent {m.sentVials}, received {m.receivedVials}
                </p>
              ))}
            </div>
          )}

          {req.shortfallNote && (
            <p className="text-xs text-warning-dark bg-warning-bg border border-warning/20 rounded-lg px-3 py-2">
              Shortfall note: "{req.shortfallNote}"
            </p>
          )}

          {req.stage === 'ready_for_approval' && (
            <div className="space-y-2">
              {needsNote && (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-text-muted uppercase tracking-wide">
                    Shortfall note <span className="text-danger">*</span>
                  </label>
                  <textarea
                    value={approveNote}
                    onChange={e => setApproveNote(e.target.value)}
                    placeholder="Explain why this delivery is short (required)"
                    rows={2}
                    maxLength={500}
                    className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                  />
                </div>
              )}
              <Button
                onClick={() => approveMutation.mutate()}
                disabled={approveMutation.isPending || (needsNote && !approveNote.trim())}
                className="w-full text-xs"
              >
                {approveMutation.isPending ? 'Approving…' : 'Approve Stock Request'}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function FacilityHeadStockRequests() {
  const [filter, setFilter] = useState('all')

  const { data, isLoading } = useQuery({
    queryKey: ['stock-requests'],
    queryFn:  () => getStockRequests(),
    refetchInterval: 30_000,
  })

  const requests = data?.stockRequests ?? []
  const activeFilter = FILTER_CONFIG.find(f => f.key === filter)
  const filtered = requests.filter(activeFilter.test)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        breadcrumb="Facility Head"
        title="Stock Requests"
        subtitle="Review and approve stock requests for this facility"
      />

      {/* Filter stat cards */}
      <div className="grid grid-cols-4 gap-4">
        {FILTER_CONFIG.map(f => {
          const count    = requests.filter(f.test).length
          const isActive = filter === f.key
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`bg-surface border rounded-[18px] p-4 flex items-center justify-between text-left transition-all cursor-pointer ${
                isActive ? 'border-primary ring-1 ring-primary/20' : 'border-surface-border hover:border-surface-border/80'
              }`}
            >
              <div>
                <p className="text-2xl font-semibold text-text">{count}</p>
                <p className="text-xs text-text-muted mt-0.5">{f.label}</p>
              </div>
              <span className="w-2.5 h-2.5 rounded-full flex-none" style={{ background: f.dot }} />
            </button>
          )
        })}
      </div>

      {isLoading && <p className="text-sm text-text-muted">Loading…</p>}
      {!isLoading && filtered.length === 0 && (
        <div className="bg-surface border border-surface-border rounded-[18px] py-12 text-center">
          <p className="text-sm text-text-muted">No requests here.</p>
        </div>
      )}
      <div className="flex flex-col gap-3">
        {filtered.map(req => <RequestCard key={req.id} req={req} />)}
      </div>
    </div>
  )
}
