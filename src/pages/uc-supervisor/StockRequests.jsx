import { useState } from 'react'
import { PackageOpen, ChevronDown, ChevronUp } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getStockRequests, recordSent, declineStockRequest } from '../../lib/api'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
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

const CAN_SEND = new Set(['awaiting_both', 'awaiting_sent'])
// Decline only before any figures recorded (stage === awaiting_both)
const CAN_DECLINE = new Set(['awaiting_both'])

function RequestCard({ req }) {
  const qc = useQueryClient()
  const [expanded, setExpanded] = useState(false)
  const [showSent, setShowSent] = useState(false)
  const [declineMode, setDeclineMode] = useState(false)
  const [sentItems, setSentItems] = useState(() =>
    (req.items ?? [])
      .filter(it => (it.outstandingVials ?? it.requestedVials) > 0)
      .map(it => ({ vaccineId: it.vaccineId, vaccineName: it.vaccineName, sentVials: '' }))
  )
  const [sentNote, setSentNote] = useState('')
  const [declineReason, setDeclineReason] = useState('')

  function updateSent(idx, value) {
    setSentItems(prev => prev.map((it, i) => i === idx ? { ...it, sentVials: value } : it))
  }

  const sentMutation = useMutation({
    mutationFn: (payload) => recordSent(req.id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock-requests'] })
      qc.invalidateQueries({ queryKey: ['audit-log'] })
      setShowSent(false)
    },
  })

  const declineMutation = useMutation({
    mutationFn: () => declineStockRequest(req.id, declineReason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock-requests'] })
      qc.invalidateQueries({ queryKey: ['audit-log'] })
      setDeclineMode(false)
    },
  })

  function submitSent() {
    const items = sentItems.map(it => ({
      vaccineId: it.vaccineId,
      sentVials: parseInt(it.sentVials, 10) || 0,
    }))
    sentMutation.mutate({ items, ...(sentNote.trim() ? { note: sentNote.trim() } : {}) })
  }

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
          {(req.items ?? []).map(it => (
            <div key={it.vaccineId} className="text-xs text-text-muted flex justify-between gap-2">
              <span className="flex-1">{displayVaccineName(it.vaccineName)}</span>
              <span>
                Req: {it.requestedVials}
                {(it.fulfilledVials ?? 0) > 0 && ` · Done: ${it.fulfilledVials} · Left: ${it.outstandingVials ?? 0}`}
                {' · '}Sent: {it.sentVials ?? '—'} · Rcvd: {it.receivedVials ?? '—'}
              </span>
            </div>
          ))}

          {req.shortfallNote && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Shortfall note: "{req.shortfallNote}"
            </p>
          )}

          <div className="flex gap-2 pt-2 flex-wrap">
            {CAN_SEND.has(req.stage) && !showSent && (
              <Button onClick={() => setShowSent(true)} className="text-xs">Record Sent</Button>
            )}
            {CAN_DECLINE.has(req.stage) && !declineMode && (
              <Button
                variant="outline"
                onClick={() => setDeclineMode(true)}
                className="text-xs text-danger border-danger/30 hover:bg-danger/5"
              >
                Decline
              </Button>
            )}
          </div>

          {showSent && (
            <div className="mt-3 bg-amber-50 rounded-xl border border-amber-200 p-4 space-y-3">
              <p className="text-xs font-bold text-amber-700 uppercase tracking-wide">Record Sent</p>
              {sentItems.map((it, idx) => (
                <div key={it.vaccineId} className="flex items-center justify-between gap-3">
                  <span className="text-sm text-text flex-1">{displayVaccineName(it.vaccineName)}</span>
                  <Input
                    type="number"
                    min={0}
                    placeholder="Sent vials"
                    value={it.sentVials}
                    onChange={e => updateSent(idx, e.target.value)}
                    className="w-28 text-center"
                  />
                </div>
              ))}
              <div className="space-y-1">
                <label className="text-xs font-medium text-text-muted uppercase tracking-wide">Note (optional)</label>
                <textarea
                  value={sentNote}
                  onChange={e => setSentNote(e.target.value)}
                  rows={2}
                  maxLength={500}
                  className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={submitSent} disabled={sentMutation.isPending} className="flex-1 text-xs">
                  {sentMutation.isPending ? 'Saving…' : 'Save Sent'}
                </Button>
                <Button variant="outline" onClick={() => setShowSent(false)} className="text-xs">Cancel</Button>
              </div>
            </div>
          )}

          {declineMode && (
            <div className="mt-3 bg-red-50 rounded-xl border border-red-200 p-4 space-y-3">
              <p className="text-sm font-medium text-danger">Decline this request?</p>
              <textarea
                value={declineReason}
                onChange={e => setDeclineReason(e.target.value)}
                placeholder="Reason for declining (required)"
                rows={2}
                maxLength={500}
                className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-danger/30 resize-none"
              />
              <div className="flex gap-2">
                <Button
                  onClick={() => declineMutation.mutate()}
                  disabled={declineMutation.isPending || !declineReason.trim()}
                  className="bg-danger hover:bg-danger/90 text-xs"
                >
                  {declineMutation.isPending ? 'Declining…' : 'Confirm Decline'}
                </Button>
                <Button variant="outline" onClick={() => setDeclineMode(false)} className="text-xs">Back</Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function UCStockRequests() {
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
          <p className="text-sm text-text-muted">View and process vaccine stock requests from facilities</p>
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
