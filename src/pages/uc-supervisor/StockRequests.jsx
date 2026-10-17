import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getStockRequests, recordSent, declineStockRequest } from '../../lib/api'
import Button from '../../components/ui/Button'
import Textarea from '../../components/ui/Textarea'
import PageHeader from '../../components/shared/PageHeader'
import RequestList from '../../components/stock-requests/RequestList'
import { displayVaccineName } from '../../lib/vaccineNames'

const CAN_SEND    = new Set(['awaiting_both', 'awaiting_sent'])
const CAN_DECLINE = new Set(['awaiting_both'])

function RecordSentForm({ req, onClose }) {
  const qc = useQueryClient()
  const [items, setItems] = useState(() =>
    (req.items ?? [])
      .filter((it) => (it.outstandingVials ?? it.requestedVials) > 0)
      .map((it) => ({ vaccineId: it.vaccineId, vaccineName: it.vaccineName, wanted: it.outstandingVials ?? it.requestedVials, sentVials: '' }))
  )
  const [note, setNote] = useState('')

  const sentMutation = useMutation({
    mutationFn: (payload) => recordSent(req.id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock-requests'] })
      qc.invalidateQueries({ queryKey: ['audit-log'] })
      onClose()
    },
  })

  function submit(e) {
    e.preventDefault()
    sentMutation.mutate({
      items: items.map((it) => ({ vaccineId: it.vaccineId, sentVials: parseInt(it.sentVials, 10) || 0 })),
      ...(note.trim() ? { note: note.trim() } : {}),
    })
  }

  return (
    <form onSubmit={submit} className="rounded-control border border-surface-border p-4 flex flex-col gap-4">
      <h3 className="text-sm font-semibold text-text">Record what you sent</h3>
      <ul className="divide-y divide-surface-border border-y border-surface-border sm:max-w-md">
        {items.map((it, idx) => (
          <li key={it.vaccineId} className="flex items-center justify-between gap-3 py-2">
            <label htmlFor={`sent-${req.id}-${it.vaccineId}`} className="text-sm text-text flex-1 min-w-0">
              {displayVaccineName(it.vaccineName)}
              <span className="text-text-muted tabular-nums"> · {it.wanted} asked</span>
            </label>
            {/* raw input: compact per-row cell, same exception as RaiseForm quantities */}
            <input
              id={`sent-${req.id}-${it.vaccineId}`}
              type="number"
              min={0}
              inputMode="numeric"
              placeholder="0"
              value={it.sentVials}
              onChange={(e) => setItems((prev) => prev.map((p, i) => (i === idx ? { ...p, sentVials: e.target.value } : p)))}
              className="w-24 h-9 text-center rounded-control border border-surface-border bg-surface text-sm text-text focus:outline-none focus:ring-[3px] focus:ring-primary/10 focus:border-primary"
            />
          </li>
        ))}
      </ul>
      <Textarea id={`sent-note-${req.id}`} label="Note" value={note} onChange={(e) => setNote(e.target.value)} />
      {sentMutation.isError && <p role="alert" className="text-sm text-danger-dark">{sentMutation.error.message || 'Failed to record sent. Please try again.'}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={sentMutation.isPending}>{sentMutation.isPending ? 'Saving…' : 'Save sent'}</Button>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
      </div>
    </form>
  )
}

function DeclineForm({ req, onClose }) {
  const qc = useQueryClient()
  const [reason, setReason] = useState('')

  const declineMutation = useMutation({
    mutationFn: () => declineStockRequest(req.id, reason.trim()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock-requests'] })
      qc.invalidateQueries({ queryKey: ['audit-log'] })
      onClose()
    },
  })

  return (
    <div className="rounded-control bg-danger-bg p-4 flex flex-col gap-3">
      <p className="text-sm font-medium text-danger-dark">Decline this request? The facility will see your reason.</p>
      <Textarea id={`decline-${req.id}`} label="Reason" required value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
      {declineMutation.isError && <p role="alert" className="text-sm text-danger-dark">{declineMutation.error.message || 'Failed to decline. Please try again.'}</p>}
      <div className="flex gap-2">
        <Button variant="danger" onClick={() => declineMutation.mutate()} disabled={declineMutation.isPending || !reason.trim()}>
          {declineMutation.isPending ? 'Declining…' : 'Decline request'}
        </Button>
        <Button variant="secondary" onClick={onClose}>Keep it</Button>
      </div>
    </div>
  )
}

function RequestActions({ req }) {
  const [mode, setMode] = useState(null)
  const canSend = CAN_SEND.has(req.stage)
  const canDecline = CAN_DECLINE.has(req.stage)
  if (!canSend && !canDecline) return null

  if (mode === 'sent') return <RecordSentForm req={req} onClose={() => setMode(null)} />
  if (mode === 'decline') return <DeclineForm req={req} onClose={() => setMode(null)} />
  return (
    <div className="flex gap-2 flex-wrap">
      {canSend && <Button onClick={() => setMode('sent')}>Record sent</Button>}
      {canDecline && <Button variant="ghost-danger" onClick={() => setMode('decline')}>Decline</Button>}
    </div>
  )
}

export default function UCStockRequests() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['stock-requests'],
    queryFn:  () => getStockRequests(),
    refetchInterval: 30_000,
  })

  const requests = data?.stockRequests ?? []
  const toSend = requests.filter((r) => CAN_SEND.has(r.stage)).length

  return (
    <div>
      <PageHeader
        breadcrumb="UC Supervisor › Daily work"
        title="Stock Requests"
        subtitle={toSend ? `${toSend} waiting for you to send stock` : 'Send stock to facilities and record what went out'}
      />
      <RequestList
        requests={requests}
        isLoading={isLoading}
        isError={isError}
        error={error}
        onRetry={refetch}
        showFacility
        emptyHint="Requests from facilities in your union councils appear here."
        renderActions={(req) => <RequestActions req={req} />}
      />
    </div>
  )
}
