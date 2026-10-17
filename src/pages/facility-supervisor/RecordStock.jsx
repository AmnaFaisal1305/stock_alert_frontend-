import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getStockRequests, createStockRequest, recordReceived, cancelStockRequest, getVaccines,
} from '../../lib/api'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import Toast from '../../components/ui/Toast'
import PageHeader from '../../components/shared/PageHeader'
import { SkeletonRows } from '../../components/shared/SkeletonCard'
import RequestList from '../../components/stock-requests/RequestList'
import { OPEN_STAGES } from '../../lib/stockRequests'
import { displayVaccineName } from '../../lib/vaccineNames'

const CAN_RECEIVE = new Set(['awaiting_both', 'awaiting_received'])

const textareaCls = 'w-full rounded-control border border-surface-border bg-surface px-3.5 py-2.5 text-sm text-text focus:outline-none focus:ring-[3px] focus:ring-primary/10 focus:border-primary resize-none placeholder:text-text-muted'

function NoteField({ id, label, value, onChange, placeholder, required = false }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-text">
        {label} <span className="text-text-muted font-normal">{required ? '(required)' : '(optional)'}</span>
      </label>
      <textarea id={id} value={value} onChange={onChange} rows={2} maxLength={500} placeholder={placeholder} className={textareaCls} />
    </div>
  )
}

// ── Raise request ──────────────────────────────────────────────────────────────
function RaiseForm({ vaccines, onCancel, onSubmit, isPending }) {
  const [quantities, setQuantities] = useState({})
  const [note,  setNote]  = useState('')
  const [error, setError] = useState(null)

  const items = vaccines
    .map(v => ({ vaccineId: v.id, requestedVials: parseInt(quantities[v.id], 10) || 0 }))
    .filter(it => it.requestedVials > 0)

  function handleSubmit(e) {
    e.preventDefault()
    if (!items.length) { setError('Enter at least 1 vial for one vaccine.'); return }
    onSubmit({ items, ...(note.trim() ? { note: note.trim() } : {}) })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <p className="text-sm text-text-muted">Enter vials needed per vaccine. Leave blank to skip a vaccine.</p>
      <ul className="divide-y divide-surface-border border-y border-surface-border">
        {vaccines.map(v => (
          <li key={v.id} className="flex items-center justify-between gap-3 py-2">
            <label htmlFor={`req-${v.id}`} className="text-sm text-text flex-1">{displayVaccineName(v.name)}</label>
            <input
              id={`req-${v.id}`}
              type="number"
              min={0}
              inputMode="numeric"
              placeholder="0"
              value={quantities[v.id] ?? ''}
              onChange={e => { setQuantities(prev => ({ ...prev, [v.id]: e.target.value })); setError(null) }}
              className="w-24 h-9 text-center rounded-control border border-surface-border bg-surface text-sm text-text focus:outline-none focus:ring-[3px] focus:ring-primary/10 focus:border-primary"
            />
          </li>
        ))}
      </ul>
      <NoteField id="raise-note" label="Note" value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Outreach session on Friday" />
      {error && <p role="alert" className="text-sm text-danger-dark">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={isPending}>{isPending ? 'Sending…' : `Send request${items.length ? ` (${items.length})` : ''}`}</Button>
      </div>
    </form>
  )
}

// ── Record received ────────────────────────────────────────────────────────────
function RecordReceivedForm({ req, onClose, onSubmit, isPending }) {
  const [items, setItems] = useState(() =>
    (req.items ?? [])
      .filter(it => (it.outstandingVials ?? it.requestedVials) > 0)
      .map(it => ({ vaccineId: it.vaccineId, vaccineName: it.vaccineName, sentVials: it.sentVials, receivedVials: '', batchNo: '', expiryDate: '', manufacturer: '' }))
  )
  const [note,  setNote]  = useState('')
  const [error, setError] = useState(null)

  function update(idx, field, value) {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it))
    setError(null)
  }

  function handleSubmit(e) {
    e.preventDefault()
    const payload = items.map(it => {
      const vials = parseInt(it.receivedVials, 10) || 0
      const base  = { vaccineId: it.vaccineId, receivedVials: vials }
      if (vials > 0) {
        if (!it.batchNo.trim() || !it.expiryDate || !it.manufacturer.trim()) {
          setError(`${displayVaccineName(it.vaccineName)}: batch number, expiry date and manufacturer are required when vials were received.`)
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
    <form onSubmit={handleSubmit} className="rounded-control border border-surface-border p-4 flex flex-col gap-4">
      <h3 className="text-sm font-semibold text-text">Record what arrived</h3>
      {items.map((it, idx) => {
        const received = (parseInt(it.receivedVials, 10) || 0) > 0
        return (
          <fieldset key={it.vaccineId} className="flex flex-col gap-2">
            <legend className="text-sm font-medium text-text mb-1">
              {displayVaccineName(it.vaccineName)}
              {it.sentVials != null && <span className="text-text-muted font-normal"> · {it.sentVials} sent</span>}
            </legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input id={`rcv-${it.vaccineId}`} label="Vials received" type="number" min={0} inputMode="numeric" value={it.receivedVials} onChange={e => update(idx, 'receivedVials', e.target.value)} />
              {received && (
                <>
                  <Input id={`batch-${it.vaccineId}`} label="Batch number" value={it.batchNo} onChange={e => update(idx, 'batchNo', e.target.value)} />
                  <Input id={`exp-${it.vaccineId}`} label="Expiry date" type="date" value={it.expiryDate} onChange={e => update(idx, 'expiryDate', e.target.value)} />
                  <Input id={`mfr-${it.vaccineId}`} label="Manufacturer" value={it.manufacturer} onChange={e => update(idx, 'manufacturer', e.target.value)} />
                </>
              )}
            </div>
          </fieldset>
        )
      })}
      <NoteField id={`rcv-note-${req.id}`} label="Note" value={note} onChange={e => setNote(e.target.value)} />
      {error && <p role="alert" className="text-sm text-danger-dark">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={isPending}>{isPending ? 'Saving…' : 'Save received'}</Button>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
      </div>
    </form>
  )
}

// ── Per-request actions (facility supervisor) ──────────────────────────────────
function RequestActions({ req }) {
  const qc = useQueryClient()
  const [showReceive,   setShowReceive]   = useState(false)
  const [cancelConfirm, setCancelConfirm] = useState(false)
  const [cancelReason,  setCancelReason]  = useState('')
  const [mutError,      setMutError]      = useState('')

  const isOpen         = OPEN_STAGES.has(req.stage)
  const isCloseShort   = req.status === 'partially_fulfilled' && !req.closedAt
  const hasFigures     = req.items?.some(it => (it.sentVials ?? 0) > 0 || (it.receivedVials ?? 0) > 0)
  const reasonRequired = isCloseShort || hasFigures

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

  const canReceive = CAN_RECEIVE.has(req.stage)
  const canCancel  = isOpen || isCloseShort
  if (!canReceive && !canCancel) return null

  return (
    <div className="flex flex-col gap-3">
      {mutError && <p role="alert" className="text-sm text-danger-dark">{mutError}</p>}
      {!showReceive && !cancelConfirm && (
        <div className="flex gap-2 flex-wrap">
          {canReceive && <Button onClick={() => setShowReceive(true)}>Record received</Button>}
          {canCancel && (
            <Button variant="ghost" className="text-danger-dark hover:bg-danger-bg" onClick={() => setCancelConfirm(true)}>
              {isCloseShort ? 'Close short' : 'Cancel request'}
            </Button>
          )}
        </div>
      )}

      {showReceive && (
        <RecordReceivedForm req={req} onClose={() => setShowReceive(false)} onSubmit={(p) => receiveMutation.mutate(p)} isPending={receiveMutation.isPending} />
      )}

      {cancelConfirm && (
        <div className="rounded-control bg-danger-bg p-4 flex flex-col gap-3">
          <p className="text-sm font-medium text-danger-dark">
            {isCloseShort ? 'Close this request short? The remaining vials won’t be sent.' : 'Cancel this request?'}
          </p>
          {reasonRequired && (
            <NoteField
              id={`cancel-${req.id}`}
              label="Reason"
              required
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
              placeholder={isCloseShort ? 'Why close short?' : 'Figures were already recorded, so a reason is required'}
            />
          )}
          <div className="flex gap-2">
            <Button variant="danger" onClick={() => cancelMutation.mutate()} disabled={cancelMutation.isPending || (reasonRequired && !cancelReason.trim())}>
              {cancelMutation.isPending ? 'Submitting…' : isCloseShort ? 'Close short' : 'Cancel request'}
            </Button>
            <Button variant="secondary" onClick={() => setCancelConfirm(false)}>Keep it</Button>
          </div>
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

  const { data: reqData, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['stock-requests'],
    queryFn:  () => getStockRequests(),
    refetchInterval: 30_000,
  })

  const { data: vaccineData, isLoading: loadingVaccines } = useQuery({
    queryKey: ['vaccines'],
    queryFn:  getVaccines,
    enabled:  showRaise,
  })

  const createMutation = useMutation({
    mutationFn: (payload) => createStockRequest(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock-requests'] })
      qc.invalidateQueries({ queryKey: ['audit-log'] })
      setShowRaise(false)
      setToast({ message: 'Request sent to your UC supervisor.', type: 'success' })
    },
    onError: (err) => setToast({ message: err.message || 'Failed to raise request. Please try again.', type: 'error' }),
  })

  return (
    <div>
      <PageHeader
        breadcrumb="Facility Supervisor › Daily work"
        title="Stock Requests"
        subtitle="Request vaccine stock, then record what arrives"
        actions={<Button onClick={() => setShowRaise(true)}><Plus size={16} strokeWidth={1.75} /> Raise request</Button>}
      />

      <RequestList
        requests={reqData?.stockRequests ?? []}
        isLoading={isLoading}
        isError={isError}
        error={error}
        onRetry={refetch}
        emptyHint="Raise a request when stock runs low. It goes to your UC supervisor."
        renderActions={(req) => <RequestActions req={req} />}
      />

      <Modal open={showRaise} onClose={() => setShowRaise(false)} title="Raise stock request">
        {loadingVaccines
          ? <SkeletonRows rows={4} />
          : <RaiseForm vaccines={vaccineData?.vaccines ?? []} onCancel={() => setShowRaise(false)} onSubmit={(p) => createMutation.mutate(p)} isPending={createMutation.isPending} />}
      </Modal>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
