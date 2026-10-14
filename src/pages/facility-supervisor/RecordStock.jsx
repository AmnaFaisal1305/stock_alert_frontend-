import { useState } from 'react'
import { PackageOpen, ChevronDown, ChevronUp, X } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getStockRequests, createStockRequest, recordReceived, cancelStockRequest, getVaccines,
} from '../../lib/api'
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
  awaiting_both:        'Awaiting Sent & Received',
  awaiting_sent:        'Awaiting Sent',
  awaiting_received:    'Awaiting Received',
  figures_differ:       'Figures Differ',
  ready_for_approval:   'Ready for Approval',
  completed:            'Completed',
  partially_fulfilled:  'Partially Fulfilled',
  cancelled:            'Cancelled',
  declined:             'Declined',
}

const OPEN_STAGES = new Set(['awaiting_both', 'awaiting_sent', 'awaiting_received', 'figures_differ'])
const CAN_RECEIVE = new Set(['awaiting_both', 'awaiting_received'])

// ── Raise-request modal ────────────────────────────────────────────────────────
function RaiseModal({ vaccines, onClose, onSubmit, isPending }) {
  const [quantities, setQuantities] = useState(() =>
    Object.fromEntries(vaccines.map(v => [v.id, '0']))
  )
  const [note, setNote] = useState('')
  const [error, setError] = useState(null)

  const items = vaccines
    .map(v => ({ vaccineId: v.id, requestedVials: parseInt(quantities[v.id], 10) || 0 }))
    .filter(it => it.requestedVials > 0)

  function handleSubmit() {
    if (!items.length) { setError('Enter at least 1 vial for one vaccine.'); return }
    onSubmit({ items, ...(note.trim() ? { note: note.trim() } : {}) })
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-surface w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl border border-surface-border shadow-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-border">
          <p className="text-sm font-bold text-text">Raise Stock Request</p>
          <button onClick={onClose} className="text-text-muted hover:text-text p-1 rounded"><X size={16} /></button>
        </div>
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
          <p className="text-xs text-text-muted">Enter the number of vials needed per vaccine (leave at 0 to skip).</p>
          {vaccines.map(v => (
            <div key={v.id} className="flex items-center justify-between gap-3">
              <span className="text-sm text-text flex-1">{displayVaccineName(v.name)}</span>
              <Input
                type="number"
                min={0}
                value={quantities[v.id]}
                onChange={e => setQuantities(prev => ({ ...prev, [v.id]: e.target.value }))}
                className="w-24 text-center"
              />
            </div>
          ))}
          <div className="pt-2 space-y-1">
            <label className="text-xs font-medium text-text-muted uppercase tracking-wide">Note (optional)</label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={2}
              maxLength={500}
              className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
        </div>
        <div className="px-5 py-4 border-t border-surface-border flex gap-2">
          <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
          <Button onClick={handleSubmit} disabled={isPending} className="flex-1">
            {isPending ? 'Submitting…' : 'Submit Request'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Record-received panel ──────────────────────────────────────────────────────
function RecordReceivedPanel({ req, onClose, onSubmit, isPending }) {
  const [items, setItems] = useState(() =>
    (req.items ?? [])
      .filter(it => (it.outstandingVials ?? it.requestedVials) > 0)
      .map(it => ({
        vaccineId: it.vaccineId,
        vaccineName: it.vaccineName,
        receivedVials: '',
        batchNo: '',
        expiryDate: '',
        manufacturer: '',
      }))
  )
  const [note, setNote] = useState('')
  const [error, setError] = useState(null)

  function update(idx, field, value) {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it))
  }

  function handleSubmit() {
    const payload = items.map(it => {
      const vials = parseInt(it.receivedVials, 10) || 0
      const base = { vaccineId: it.vaccineId, receivedVials: vials }
      if (vials > 0) {
        if (!it.batchNo.trim() || !it.expiryDate || !it.manufacturer.trim()) {
          setError('Batch No, Expiry Date, and Manufacturer are required when receivedVials > 0.')
          return null
        }
        return { ...base, batchNo: it.batchNo.trim(), expiryDate: it.expiryDate, manufacturer: it.manufacturer.trim() }
      }
      return base
    })
    if (payload.includes(null)) return
    onSubmit({ items: payload, ...(note.trim() ? { note: note.trim() } : {}) })
  }

  return (
    <div className="mt-3 bg-blue-50 rounded-xl border border-blue-200 p-4 space-y-4">
      <p className="text-xs font-bold text-blue-700 uppercase tracking-wide">Record Received</p>
      {items.map((it, idx) => (
        <div key={it.vaccineId} className="space-y-2">
          <p className="text-sm font-medium text-text">{displayVaccineName(it.vaccineName)}</p>
          <div className="grid grid-cols-2 gap-2">
            <Input
              type="number" min={0}
              placeholder="Received vials"
              value={it.receivedVials}
              onChange={e => update(idx, 'receivedVials', e.target.value)}
            />
            {(parseInt(it.receivedVials, 10) || 0) > 0 && (
              <>
                <Input placeholder="Batch No." value={it.batchNo} onChange={e => update(idx, 'batchNo', e.target.value)} />
                <Input type="date" value={it.expiryDate} onChange={e => update(idx, 'expiryDate', e.target.value)} />
                <Input placeholder="Manufacturer" value={it.manufacturer} onChange={e => update(idx, 'manufacturer', e.target.value)} />
              </>
            )}
          </div>
        </div>
      ))}
      <div className="space-y-1">
        <label className="text-xs font-medium text-text-muted uppercase tracking-wide">Note (optional)</label>
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          rows={2}
          maxLength={500}
          className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
        />
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex gap-2">
        <Button onClick={handleSubmit} disabled={isPending} className="flex-1">
          {isPending ? 'Saving…' : 'Save Received'}
        </Button>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
      </div>
    </div>
  )
}

// ── Request card ───────────────────────────────────────────────────────────────
function RequestCard({ req }) {
  const qc = useQueryClient()
  const [expanded, setExpanded] = useState(false)
  const [showReceive, setShowReceive] = useState(false)
  const [cancelConfirm, setCancelConfirm] = useState(false)
  const [cancelReason, setCancelReason] = useState('')

  const isOpen = OPEN_STAGES.has(req.stage)
  const isCloseShort = req.status === 'partially_fulfilled' && !req.closedAt
  const hasFigures = req.items?.some(it => (it.sentVials ?? 0) > 0 || (it.receivedVials ?? 0) > 0)
  const reasonRequired = isCloseShort || hasFigures

  const receiveMutation = useMutation({
    mutationFn: (payload) => recordReceived(req.id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock-requests'] })
      qc.invalidateQueries({ queryKey: ['audit-log'] })
      setShowReceive(false)
    },
  })

  const cancelMutation = useMutation({
    mutationFn: () => cancelStockRequest(req.id, reasonRequired ? cancelReason : undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock-requests'] })
      qc.invalidateQueries({ queryKey: ['audit-log'] })
      setCancelConfirm(false)
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
            {CAN_RECEIVE.has(req.stage) && !showReceive && (
              <Button onClick={() => setShowReceive(true)} className="text-xs">
                Record Received
              </Button>
            )}
            {(isOpen || isCloseShort) && !cancelConfirm && (
              <Button
                variant="outline"
                onClick={() => setCancelConfirm(true)}
                className="text-xs text-danger border-danger/30 hover:bg-danger/5"
              >
                {isCloseShort ? 'Close Short' : 'Cancel Request'}
              </Button>
            )}
          </div>

          {showReceive && (
            <RecordReceivedPanel
              req={req}
              onClose={() => setShowReceive(false)}
              onSubmit={(payload) => receiveMutation.mutate(payload)}
              isPending={receiveMutation.isPending}
            />
          )}

          {cancelConfirm && (
            <div className="mt-3 bg-red-50 rounded-xl border border-red-200 p-4 space-y-3">
              <p className="text-sm font-medium text-danger">
                {isCloseShort ? 'Close this request short?' : 'Cancel this request?'}
              </p>
              {reasonRequired && (
                <textarea
                  value={cancelReason}
                  onChange={e => setCancelReason(e.target.value)}
                  placeholder={isCloseShort ? 'Reason for closing short (required)' : 'Reason for cancellation (required since figures were recorded)'}
                  rows={2}
                  maxLength={500}
                  className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-danger/30 resize-none"
                />
              )}
              <div className="flex gap-2">
                <Button
                  onClick={() => cancelMutation.mutate()}
                  disabled={cancelMutation.isPending || (reasonRequired && !cancelReason.trim())}
                  className="bg-danger hover:bg-danger/90 text-xs"
                >
                  {cancelMutation.isPending ? 'Submitting…' : isCloseShort ? 'Confirm Close Short' : 'Confirm Cancel'}
                </Button>
                <Button variant="outline" onClick={() => setCancelConfirm(false)} className="text-xs">Back</Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function RecordStock() {
  const qc = useQueryClient()
  const [showRaise, setShowRaise] = useState(false)

  const { data: reqData, isLoading } = useQuery({
    queryKey: ['stock-requests'],
    queryFn: () => getStockRequests(),
    refetchInterval: 30_000,
  })

  const { data: vaccineData } = useQuery({
    queryKey: ['vaccines'],
    queryFn: getVaccines,
    enabled: showRaise,
  })

  const requests = reqData?.stockRequests ?? []
  const vaccines = vaccineData?.vaccines ?? []

  const createMutation = useMutation({
    mutationFn: (payload) => createStockRequest(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock-requests'] })
      qc.invalidateQueries({ queryKey: ['audit-log'] })
      setShowRaise(false)
    },
  })

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <PackageOpen size={22} className="text-primary" />
          <div>
            <h1 className="text-xl font-bold text-text">Stock Requests</h1>
            <p className="text-sm text-text-muted">Request and track vaccine stock from the district</p>
          </div>
        </div>
        <Button onClick={() => setShowRaise(true)} className="flex-shrink-0">
          Raise Request
        </Button>
      </div>

      {isLoading && <p className="text-sm text-text-muted">Loading…</p>}
      {!isLoading && requests.length === 0 && (
        <p className="text-sm text-text-muted">No stock requests yet.</p>
      )}
      <div className="space-y-3">
        {requests.map(req => (
          <RequestCard key={req.id} req={req} />
        ))}
      </div>

      {showRaise && vaccines.length > 0 && (
        <RaiseModal
          vaccines={vaccines}
          onClose={() => setShowRaise(false)}
          onSubmit={(payload) => createMutation.mutate(payload)}
          isPending={createMutation.isPending}
        />
      )}
    </div>
  )
}
