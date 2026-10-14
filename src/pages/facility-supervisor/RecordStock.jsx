import { useState } from 'react'
import { PackageOpen, ChevronDown, ChevronUp, X } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getStockRequests, createStockRequest, recordReceived, cancelStockRequest, getVaccines,
} from '../../lib/api'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Toast from '../../components/ui/Toast'
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

const OPEN_STAGES    = new Set(['awaiting_both', 'awaiting_sent', 'awaiting_received', 'figures_differ'])
const CAN_RECEIVE    = new Set(['awaiting_both', 'awaiting_received'])
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

// ── Raise-request modal ────────────────────────────────────────────────────────
function RaiseModal({ vaccines, onClose, onSubmit, isPending }) {
  const [quantities, setQuantities] = useState(() =>
    Object.fromEntries(vaccines.map(v => [v.id, '0']))
  )
  const [note,  setNote]  = useState('')
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
  const [note,  setNote]  = useState('')
  const [error, setError] = useState(null)

  function update(idx, field, value) {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it))
  }

  function handleSubmit() {
    const payload = items.map(it => {
      const vials = parseInt(it.receivedVials, 10) || 0
      const base  = { vaccineId: it.vaccineId, receivedVials: vials }
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
    <div className="mt-3 bg-primary/5 rounded-xl border border-primary/20 p-4 space-y-4">
      <p className="text-xs font-bold text-primary uppercase tracking-wide">Record Received</p>
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
  const [expanded,      setExpanded]      = useState(false)
  const [showReceive,   setShowReceive]   = useState(false)
  const [cancelConfirm, setCancelConfirm] = useState(false)
  const [cancelReason,  setCancelReason]  = useState('')
  const [mutError,      setMutError]      = useState('')

  const isOpen      = OPEN_STAGES.has(req.stage)
  const isCloseShort = req.status === 'partially_fulfilled' && !req.closedAt
  const hasFigures  = req.items?.some(it => (it.sentVials ?? 0) > 0 || (it.receivedVials ?? 0) > 0)
  const reasonRequired = isCloseShort || hasFigures

  const pStep = pipelineStep(req.stage)
  const PIPELINE_STEPS = ['Requested', 'Sent', 'Received']

  const receiveMutation = useMutation({
    mutationFn: (payload) => recordReceived(req.id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock-requests'] })
      qc.invalidateQueries({ queryKey: ['audit-log'] })
      setShowReceive(false)
    },
    onError: (err) => setMutError(err.message || 'Failed to record received. Please try again.'),
  })

  const cancelMutation = useMutation({
    mutationFn: () => cancelStockRequest(req.id, reasonRequired ? cancelReason : undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock-requests'] })
      qc.invalidateQueries({ queryKey: ['audit-log'] })
      setCancelConfirm(false)
    },
    onError: (err) => setMutError(err.message || 'Failed to cancel request. Please try again.'),
  })

  return (
    <div className="bg-surface rounded-[18px] border border-surface-border p-5 flex flex-col gap-3">
      {/* Top row: badge + meta + toggle */}
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

      {mutError && <p className="text-sm text-danger">{mutError}</p>}

      {expanded && (
        <div className="pt-1 space-y-2 border-t border-surface-border">
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
            <p className="text-xs text-warning-dark bg-warning-bg border border-warning/20 rounded-lg px-3 py-2">
              Shortfall note: "{req.shortfallNote}"
            </p>
          )}

          <div className="flex gap-2 pt-1 flex-wrap">
            {CAN_RECEIVE.has(req.stage) && !showReceive && (
              <Button onClick={() => setShowReceive(true)} className="text-xs">Record Received</Button>
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
            <div className="mt-2 bg-danger-bg rounded-xl border border-danger/20 p-4 space-y-3">
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
  const [toast,     setToast]     = useState(null)
  const [filter,    setFilter]    = useState('all')

  const { data: reqData, isLoading } = useQuery({
    queryKey: ['stock-requests'],
    queryFn:  () => getStockRequests(),
    refetchInterval: 30_000,
  })

  const { data: vaccineData } = useQuery({
    queryKey: ['vaccines'],
    queryFn:  getVaccines,
    enabled:  showRaise,
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
    onError: (err) => setToast({ message: err.message || 'Failed to raise request. Please try again.', type: 'error' }),
  })

  const activeFilter = FILTER_CONFIG.find(f => f.key === filter)
  const filtered = requests.filter(activeFilter.test)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        breadcrumb="Facility Supervisor"
        title="Stock Requests"
        subtitle="Request and track vaccine stock from the district"
        actions={
          <Button onClick={() => setShowRaise(true)}>Raise Request</Button>
        }
      />

      {/* Filter stat cards */}
      <div className="grid grid-cols-4 gap-4">
        {FILTER_CONFIG.map(f => {
          const count   = requests.filter(f.test).length
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
        {filtered.map(req => (
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

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
