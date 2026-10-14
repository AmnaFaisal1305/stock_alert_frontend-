import { useState } from 'react'
import { PackageOpen, ChevronDown, ChevronUp } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getStockRequests, approveStockRequest } from '../../lib/api'
import Button from '../../components/ui/Button'
import { displayVaccineName } from '../../lib/vaccineNames'

const STAGE_BADGE = {
  awaiting_both:        'bg-amber-100 text-amber-700',
  awaiting_sent:        'bg-amber-100 text-amber-700',
  awaiting_received:    'bg-amber-100 text-amber-700',
  figures_differ:       'bg-red-100 text-red-700',
  ready_for_approval:   'bg-blue-100 text-blue-700',
  completed:            'bg-green-100 text-green-700',
  partially_fulfilled:  'bg-orange-100 text-orange-700',
  cancelled:            'bg-gray-100 text-gray-500',
  declined:             'bg-gray-100 text-gray-500',
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

function RequestCard({ req }) {
  const qc = useQueryClient()
  const [expanded, setExpanded] = useState(false)
  const [mismatchRows, setMismatchRows] = useState(null)
  const [approveNote, setApproveNote] = useState('')

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

  return (
    <div className="bg-surface rounded-xl border border-surface-border p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1 flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STAGE_BADGE[req.stage] ?? 'bg-gray-100 text-gray-500'}`}>
              {STAGE_LABEL[req.stage] ?? req.stage}
            </span>
            <span className="text-xs text-text-muted">{req.items?.length ?? 0} vaccines</span>
          </div>
          <p className="text-xs text-text-muted">{new Date(req.createdAt).toLocaleDateString()}</p>
          {req.note && <p className="text-xs text-text-muted italic truncate">"{req.note}"</p>}
        </div>
        <button
          onClick={() => setExpanded(v => !v)}
          className="text-text-muted hover:text-text transition-colors p-1 flex-shrink-0"
        >
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {expanded && (
        <div className="pt-2 space-y-2">
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
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 space-y-2">
              <p className="text-xs font-bold text-danger uppercase tracking-wide">Sent / Received figures differ</p>
              {mismatchRows.map(m => (
                <p key={m.vaccineId} className="text-xs text-danger">
                  {displayVaccineName(m.vaccineName)}: sent {m.sentVials}, received {m.receivedVials}
                </p>
              ))}
            </div>
          )}

          {req.shortfallNote && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
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
  const { data, isLoading } = useQuery({
    queryKey: ['stock-requests'],
    queryFn: () => getStockRequests(),
    refetchInterval: 30_000,
  })

  const requests = data?.stockRequests ?? []

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <PackageOpen size={22} className="text-primary" />
        <div>
          <h1 className="text-xl font-bold text-text">Stock Requests</h1>
          <p className="text-sm text-text-muted">Review and approve stock requests for this facility</p>
        </div>
      </div>

      {isLoading && <p className="text-sm text-text-muted">Loading…</p>}
      {!isLoading && requests.length === 0 && (
        <p className="text-sm text-text-muted">No stock requests.</p>
      )}
      <div className="space-y-3">
        {requests.map(req => <RequestCard key={req.id} req={req} />)}
      </div>
    </div>
  )
}
