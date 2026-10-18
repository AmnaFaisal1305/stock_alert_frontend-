import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getStockRequests, createStockRequest, recordReceived, cancelStockRequest, getVaccines,
} from '../../lib/api'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import DatePicker from '../../components/ui/DatePicker'
import { ReviewPanel, SummaryDialog } from '../../components/ui/ReviewDialog'
import { plural, formatDate } from '../../lib/format'
import Modal from '../../components/ui/Modal'
import Textarea from '../../components/ui/Textarea'
import Toast from '../../components/ui/Toast'
import PageHeader from '../../components/shared/PageHeader'
import { SkeletonRows } from '../../components/shared/SkeletonCard'
import RequestList from '../../components/stock-requests/RequestList'
import { OPEN_STAGES } from '../../lib/stockRequests'

const CAN_RECEIVE = new Set(['awaiting_both', 'awaiting_received'])
const vaccineLabel = (vaccines, id) => (vaccines.find(v => v.id === id)?.name ?? '—')

// ── Raise request ──────────────────────────────────────────────────────────────
function RaiseForm({ vaccines, onCancel, onSubmit, isPending }) {
  const [quantities, setQuantities] = useState({})
  const [note,  setNote]  = useState('')
  const [error, setError] = useState(null)
  const [reviewing, setReviewing] = useState(false)

  const items = vaccines
    .map(v => ({ vaccineId: v.id, requestedVials: parseInt(quantities[v.id], 10) || 0 }))
    .filter(it => it.requestedVials > 0)

  function handleSubmit(e) {
    e.preventDefault()
    if (!items.length) { setError('Enter at least 1 vial for one vaccine.'); return }
    setReviewing(true)
  }

  if (reviewing) return (
    <ReviewPanel
      intro="This goes to your UC supervisor, who records what they send."
      items={items.map(it => ({ name: vaccineLabel(vaccines, it.vaccineId), value: plural(it.requestedVials, 'vial') }))}
      total={plural(items.reduce((s, it) => s + it.requestedVials, 0), 'vial')}
      rows={note.trim() ? [{ label: 'Note', value: note.trim() }] : []}
      onClose={() => setReviewing(false)}
      onConfirm={() => onSubmit({ items, ...(note.trim() ? { note: note.trim() } : {}) })}
      confirmLabel="Send request"
      isPending={isPending}
    />
  )

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <p className="text-sm text-text-muted">Enter vials needed per vaccine. Leave blank to skip a vaccine.</p>
      <ul className="divide-y divide-surface-border border-y border-surface-border">
        {vaccines.map(v => (
          <li key={v.id} className="flex items-center justify-between gap-3 py-2">
            <label htmlFor={`req-${v.id}`} className="text-sm text-text flex-1">{v.name}</label>
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
      <Textarea id="raise-note" label="Note" value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Outreach session on Friday" />
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
  const [review, setReview] = useState(null)

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
          setError(`${it.vaccineName}: batch number, expiry date and manufacturer are required when vials were received.`)
          return null
        }
        return { ...base, batchNo: it.batchNo.trim(), expiryDate: it.expiryDate, manufacturer: it.manufacturer.trim() }
      }
      return base
    })
    if (payload.includes(null)) return
    setReview({ items: payload, ...(note.trim() ? { note: note.trim() } : {}) })
  }

  if (review) {
    const name = (id) => items.find(it => it.vaccineId === id)?.vaccineName
    const short = review.items.filter(it => {
      const sent = items.find(x => x.vaccineId === it.vaccineId)?.sentVials
      return sent != null && it.receivedVials !== sent
    })
    return (
      <div className="rounded-control border border-surface-border p-4">
        <h3 className="text-sm font-semibold text-text mb-3">Check what arrived</h3>
        <ReviewPanel
          items={review.items.map(it => ({
            name: name(it.vaccineId),
            value: it.receivedVials ? `${plural(it.receivedVials, 'vial')} · batch ${it.batchNo} · exp ${formatDate(it.expiryDate)}` : 'none received',
          }))}
          total={plural(review.items.reduce((s, it) => s + it.receivedVials, 0), 'vial')}
          rows={review.note ? [{ label: 'Note', value: review.note }] : []}
          warnings={[short.length > 0 && `${short.map(it => name(it.vaccineId)).join(', ')}: received differs from what was sent, so the request will show figures differ.`]}
          onClose={() => setReview(null)}
          onConfirm={() => onSubmit(review)}
          confirmLabel="Save received"
          isPending={isPending}
        />
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-control border border-surface-border p-4 flex flex-col gap-4">
      <h3 className="text-sm font-semibold text-text">Record what arrived</h3>
      {items.map((it, idx) => {
        const received = (parseInt(it.receivedVials, 10) || 0) > 0
        return (
          <fieldset key={it.vaccineId} className="flex flex-col gap-2">
            <legend className="text-sm font-medium text-text mb-1">
              {it.vaccineName}
              {it.sentVials != null && <span className="text-text-muted font-normal"> · {it.sentVials} sent</span>}
            </legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input id={`rcv-${it.vaccineId}`} label="Vials received" type="number" min={0} inputMode="numeric" value={it.receivedVials} onChange={e => update(idx, 'receivedVials', e.target.value)} />
              {received && (
                <>
                  <Input id={`batch-${it.vaccineId}`} label="Batch number" value={it.batchNo} onChange={e => update(idx, 'batchNo', e.target.value)} />
                  <DatePicker id={`exp-${it.vaccineId}`} label="Expiry date" value={it.expiryDate} onChange={e => update(idx, 'expiryDate', e.target.value)} />
                  <Input id={`mfr-${it.vaccineId}`} label="Manufacturer" value={it.manufacturer} onChange={e => update(idx, 'manufacturer', e.target.value)} />
                </>
              )}
            </div>
          </fieldset>
        )
      })}
      <Textarea id={`rcv-note-${req.id}`} label="Note" value={note} onChange={e => setNote(e.target.value)} />
      {error && <p role="alert" className="text-sm text-danger-dark">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={isPending}>{isPending ? 'Saving…' : 'Save received'}</Button>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
      </div>
    </form>
  )
}

// ── Per-request actions (facility supervisor) ──────────────────────────────────
function RequestActions({ req, onReceived }) {
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
    onSuccess: (_data, payload) => {
      qc.invalidateQueries({ queryKey: ['stock-requests'] })
      qc.invalidateQueries({ queryKey: ['audit-log'] })
      setShowReceive(false)
      onReceived(req, payload)
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
            <Button variant="ghost-danger" onClick={() => setCancelConfirm(true)}>
              {isCloseShort ? 'Close as partially fulfilled' : 'Cancel request'}
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
            <Textarea
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
              {cancelMutation.isPending ? 'Submitting…' : isCloseShort ? 'Close as partially fulfilled' : 'Cancel request'}
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
  const [sent,      setSent]      = useState(null)
  const [received,  setReceived]  = useState(null)

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
    onSuccess: (_data, payload) => {
      qc.invalidateQueries({ queryKey: ['stock-requests'] })
      qc.invalidateQueries({ queryKey: ['audit-log'] })
      setShowRaise(false)
      setSent(payload)
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
        renderActions={(req) => <RequestActions req={req} onReceived={(r, payload) => setReceived({ req: r, payload })} />}
      />

      <Modal open={showRaise} onClose={() => setShowRaise(false)} title="Raise stock request">
        {loadingVaccines
          ? <SkeletonRows rows={4} />
          : <RaiseForm vaccines={vaccineData?.vaccines ?? []} onCancel={() => setShowRaise(false)} onSubmit={(p) => createMutation.mutate(p)} isPending={createMutation.isPending} />}
      </Modal>

      {sent && (
        <SummaryDialog
          open
          onClose={() => setSent(null)}
          title="Request raised"
          message="Your UC supervisor has it. You’ll record what arrives here."
          items={sent.items.map(it => ({ name: vaccineLabel(vaccineData?.vaccines ?? [], it.vaccineId), value: plural(it.requestedVials, 'vial') }))}
          total={plural(sent.items.reduce((s, it) => s + it.requestedVials, 0), 'vial')}
        />
      )}

      {received && (
        <SummaryDialog
          open
          onClose={() => setReceived(null)}
          title="Stock received"
          message="Saved. The vials are added to your store once the Facility Head approves."
          items={received.payload.items.map(it => ({ name: (received.req.items?.find(x => x.vaccineId === it.vaccineId)?.vaccineName ?? '—'), value: plural(it.receivedVials, 'vial') }))}
          total={plural(received.payload.items.reduce((s, it) => s + it.receivedVials, 0), 'vial')}
        />
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
