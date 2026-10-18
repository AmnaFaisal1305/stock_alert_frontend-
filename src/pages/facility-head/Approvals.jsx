import { useState } from 'react'
import { Check, X, ClipboardCheck } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getApprovals, approveApproval, rejectApproval } from '../../lib/api'
import Button from '../../components/ui/Button'
import Tabs from '../../components/ui/Tabs'
import Textarea from '../../components/ui/Textarea'
import Toast from '../../components/ui/Toast'
import ReviewDialog from '../../components/ui/ReviewDialog'
import PageHeader from '../../components/shared/PageHeader'
import Card from '../../components/shared/Card'
import StatusBadge from '../../components/shared/StatusBadge'
import EmptyState from '../../components/shared/EmptyState'
import ErrorState from '../../components/shared/ErrorState'
import { SkeletonRows } from '../../components/shared/SkeletonCard'
import { formatDate } from '../../lib/format'
import { APPROVAL_TYPES as TYPE_LABEL, approvalStatusLabel } from '../../lib/status'

const thresholdText = (t) => `critical ${t.criticalDoses}d / ${t.criticalVials}v · low ${t.lowDoses}d / ${t.lowVials}v`

// "Now → proposed" on one line so the head can decide without opening anything.
function Change({ a }) {
  if (a.type === 'stock_correction') {
    return (
      <p className="text-sm tabular-nums">
        <span className="text-text-muted">Store</span>{' '}
        {a.current && <><span className="text-text-muted">{a.current.storeVials} →</span>{' '}</>}
        <span className="font-medium text-text">{a.payload?.storeVials} vials</span>
      </p>
    )
  }
  const next = a.payload?.thresholds
  return (
    <div className="text-sm tabular-nums flex flex-col gap-0.5">
      {a.current && (
        <p className="text-text-muted">
          Now {thresholdText(a.current)}{a.current.thresholdOverridden && ' (facility override)'}
        </p>
      )}
      <p className="font-medium text-text">{next ? `New ${thresholdText(next)}` : 'Reset to default'}</p>
    </div>
  )
}

function PendingItem({ a, onApprove, onReject, busy }) {
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')

  return (
    <li className="px-4 sm:px-5 py-4 flex flex-col gap-3">
      <div className="flex flex-col sm:flex-row sm:items-start gap-3">
        <div className="flex-1 min-w-0 flex flex-col gap-1.5">
          <p className="text-sm font-medium text-text">
            {a.vaccineName} <span className="text-text-muted font-normal">· {TYPE_LABEL[a.type] ?? a.type}</span>
          </p>
          <Change a={a} />
          <p className="text-xs text-text-muted">
            From {a.requestedByName ?? 'facility supervisor'}{a.createdAt && <> · {formatDate(a.createdAt, { withYear: false })}</>}
            {a.note && <> · “{a.note}”</>}
          </p>
        </div>
        {!rejecting && (
          <div className="flex gap-2 flex-shrink-0">
            <Button size="sm" onClick={() => onApprove(a.id)} disabled={busy}>
              <Check size={14} strokeWidth={1.75} /> Approve
            </Button>
            <Button size="sm" variant="ghost-danger" onClick={() => setRejecting(true)} disabled={busy}>
              <X size={14} strokeWidth={1.75} /> Reject
            </Button>
          </div>
        )}
      </div>

      {rejecting && (
        <div className="rounded-control bg-danger-bg p-4 flex flex-col gap-3">
          <Textarea
            id={`reject-${a.id}`}
            label="Reason for rejecting"
            required
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="The supervisor sees this with the rejected request"
            autoFocus
          />
          <div className="flex gap-2">
            <Button variant="danger" size="sm" onClick={() => onReject(a.id, reason.trim())} disabled={!reason.trim() || busy}>
              Reject request
            </Button>
            <Button variant="secondary" size="sm" onClick={() => { setRejecting(false); setReason('') }}>Keep it</Button>
          </div>
        </div>
      )}
    </li>
  )
}

function HistoryItem({ a }) {
  const reason = a.decisionReason
  return (
    <li className="px-4 sm:px-5 py-3.5 flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4">
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <p className="text-sm font-medium text-text">
          {a.vaccineName} <span className="text-text-muted font-normal">· {TYPE_LABEL[a.type] ?? a.type}</span>
        </p>
        <Change a={a} />
        <p className="text-xs text-text-muted">
          From {a.requestedByName ?? 'facility supervisor'}
          {a.decidedAt && <> · decided {formatDate(a.decidedAt, { withYear: false })}</>}
        </p>
        {reason && <p className="text-xs text-text-muted">Reason: “{reason}”</p>}
      </div>
      <StatusBadge kind="workflow" status={a.status} label={approvalStatusLabel(a.status)} />
    </li>
  )
}

export default function FacilityHeadApprovals() {
  const qc = useQueryClient()
  const [view, setView] = useState('pending')
  const [toast, setToast] = useState(null)
  const [confirming, setConfirming] = useState(null)

  const pendingQ = useQuery({ queryKey: ['approvals', 'pending'], queryFn: () => getApprovals('pending') })
  const historyQ = useQuery({ queryKey: ['approvals', 'history'], queryFn: () => getApprovals(), enabled: view === 'history' })

  const pending = pendingQ.data?.approvals ?? []
  const history = (historyQ.data?.approvals ?? []).filter((a) => a.status !== 'pending')

  const approveMutation = useMutation({
    mutationFn: (id) => approveApproval(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['approvals'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      qc.invalidateQueries({ queryKey: ['audit-log'] })
      setConfirming(null)
      setToast({ message: 'Approved. The change is applied.', type: 'success' })
    },
    onError: (err) => { setConfirming(null); setToast({ message: err.message || 'Failed to approve. Please try again.', type: 'error' }) },
  })

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }) => rejectApproval(id, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['approvals'] })
      qc.invalidateQueries({ queryKey: ['audit-log'] })
      setToast({ message: 'Rejected. The supervisor can see your reason.', type: 'success' })
    },
    onError: (err) => setToast({ message: err.message || 'Failed to reject. Please try again.', type: 'error' }),
  })

  const q = view === 'pending' ? pendingQ : historyQ
  const items = view === 'pending' ? pending : history
  const busy = approveMutation.isPending || rejectMutation.isPending

  return (
    <div>
      <PageHeader
        breadcrumb="Facility Head › Daily work"
        title="Approvals"
        subtitle="Stock corrections and threshold changes from your facility supervisor"
      />

      <Tabs
        label="Approvals"
        value={view}
        onChange={setView}
        tabs={[{ value: 'pending', label: 'Waiting for you', count: pending.length }, { value: 'history', label: 'History' }]}
        className="mb-4"
      />

      {q.isError ? (
        <ErrorState title="Couldn’t load approvals" error={q.error} onRetry={q.refetch} />
      ) : (
        <Card padding={false} className="max-w-4xl">
          {q.isLoading ? (
            <SkeletonRows rows={3} />
          ) : items.length === 0 ? (
            <EmptyState
              icon={ClipboardCheck}
              title={view === 'pending' ? 'Nothing waiting for you' : 'No decisions yet'}
              message={view === 'pending' ? 'Requests from your supervisor appear here.' : 'Approved and rejected requests appear here.'}
            />
          ) : (
            <ul className="divide-y divide-surface-border">
              {view === 'pending'
                ? items.map((a) => (
                    <PendingItem
                      key={a.id}
                      a={a}
                      busy={busy}
                      onApprove={() => setConfirming(a)}
                      onReject={(id, reason) => rejectMutation.mutate({ id, reason })}
                    />
                  ))
                : items.map((a) => <HistoryItem key={a.id} a={a} />)}
            </ul>
          )}
        </Card>
      )}

      {confirming && (
        <ReviewDialog
          open
          onClose={() => setConfirming(null)}
          onConfirm={() => approveMutation.mutate(confirming.id)}
          isPending={approveMutation.isPending}
          title={`Approve ${(TYPE_LABEL[confirming.type] ?? 'change').toLowerCase()}?`}
          intro="It is applied as soon as you approve."
          rows={[
            { label: 'Vaccine', value: confirming.vaccineName },
            { label: 'Requested by', value: confirming.requestedByName ?? 'Facility supervisor' },
            { label: 'Change', value: <Change a={confirming} /> },
            confirming.note && { label: 'Note', value: `“${confirming.note}”` },
          ]}
          confirmLabel="Approve"
        />
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
