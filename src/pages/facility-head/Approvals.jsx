import { useState } from 'react'
import { ClipboardCheck, CheckCircle2, XCircle, Clock } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getApprovals, approveApproval, rejectApproval } from '../../lib/api'
import Button from '../../components/ui/Button'
import { displayVaccineName } from '../../lib/vaccineNames'

const TABS = ['Pending', 'History']

const STATUS_COLORS = {
  pending:   'bg-amber-100 text-amber-700',
  approved:  'bg-green-100 text-green-700',
  rejected:  'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-500',
}

function ApprovalRow({ a, onApprove, onReject, approvePending, rejectPending }) {
  const [rejectMode, setRejectMode] = useState(false)
  const [reason, setReason] = useState('')

  return (
    <div className="bg-surface rounded-xl border border-surface-border p-4 space-y-3">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[a.status] ?? 'bg-gray-100 text-gray-500'}`}>
              {a.type === 'stock_correction' ? 'Stock Correction' : 'Threshold Change'}
            </span>
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full flex items-center gap-1">
              <Clock size={11} /> Pending
            </span>
          </div>
          <p className="text-sm font-semibold text-text">{displayVaccineName(a.vaccineName)}</p>
          <p className="text-xs text-text-muted">Requested by <strong>{a.requestedByName}</strong></p>
        </div>
      </div>

      {/* Current vs. proposed */}
      {a.type === 'stock_correction' && a.current && (
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-text-muted mb-1">Current store</p>
            <p className="font-semibold text-text">{a.current.storeVials} vials</p>
          </div>
          <div className="bg-primary/5 rounded-lg p-3">
            <p className="text-xs text-text-muted mb-1">Proposed store</p>
            <p className="font-semibold text-primary">{a.payload?.storeVials} vials</p>
          </div>
        </div>
      )}

      {a.type === 'threshold_change' && a.current && (
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="bg-gray-50 rounded-lg p-3 space-y-1">
            <p className="text-xs text-text-muted mb-1">Current thresholds</p>
            <p className="text-xs text-text">Critical: {a.current.criticalDoses}d / {a.current.criticalVials}v</p>
            <p className="text-xs text-text">Low: {a.current.lowDoses}d / {a.current.lowVials}v</p>
            {a.current.thresholdOverridden && <p className="text-xs text-amber-600">(facility override)</p>}
          </div>
          <div className="bg-primary/5 rounded-lg p-3 space-y-1">
            <p className="text-xs text-text-muted mb-1">Proposed thresholds</p>
            {a.payload?.thresholds ? (
              <>
                <p className="text-xs text-primary">Critical: {a.payload.thresholds.criticalDoses}d / {a.payload.thresholds.criticalVials}v</p>
                <p className="text-xs text-primary">Low: {a.payload.thresholds.lowDoses}d / {a.payload.thresholds.lowVials}v</p>
              </>
            ) : (
              <p className="text-xs text-primary">Reset to vaccine default</p>
            )}
          </div>
        </div>
      )}

      {a.note && <p className="text-xs text-text-muted italic">Note: "{a.note}"</p>}

      {!rejectMode ? (
        <div className="flex gap-2">
          <Button
            onClick={() => onApprove(a.id)}
            disabled={approvePending}
            className="flex items-center gap-1.5"
          >
            <CheckCircle2 size={14} /> Approve
          </Button>
          <Button
            variant="outline"
            onClick={() => setRejectMode(true)}
            className="flex items-center gap-1.5 text-danger border-danger/30 hover:bg-danger/5"
          >
            <XCircle size={14} /> Reject
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Reason for rejection (required)"
            rows={2}
            maxLength={500}
            className="w-full rounded-lg border border-surface-border bg-white px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-danger/30 resize-none"
          />
          <div className="flex gap-2">
            <Button
              onClick={() => { onReject(a.id, reason); setRejectMode(false); setReason('') }}
              disabled={!reason.trim() || rejectPending}
              className="bg-danger hover:bg-danger/90 flex items-center gap-1.5"
            >
              <XCircle size={14} /> Confirm Reject
            </Button>
            <Button variant="outline" onClick={() => { setRejectMode(false); setReason('') }}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function FacilityHeadApprovals() {
  const qc = useQueryClient()
  const [tab, setTab] = useState(0)

  const { data: pendingData, isLoading: pendingLoading } = useQuery({
    queryKey: ['approvals', 'pending'],
    queryFn: () => getApprovals('pending'),
  })

  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['approvals', 'history'],
    queryFn: () => getApprovals(),
    enabled: tab === 1,
  })

  const pending = pendingData?.approvals ?? []
  const history = (historyData?.approvals ?? []).filter(a => a.status !== 'pending')

  const approveMutation = useMutation({
    mutationFn: (id) => approveApproval(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['approvals'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      qc.invalidateQueries({ queryKey: ['audit-log'] })
    },
  })

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }) => rejectApproval(id, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['approvals'] })
      qc.invalidateQueries({ queryKey: ['audit-log'] })
    },
  })

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <ClipboardCheck size={22} className="text-primary" />
        <div>
          <h1 className="text-xl font-bold text-text">Approvals</h1>
          <p className="text-sm text-text-muted">Review stock corrections and threshold changes</p>
        </div>
      </div>

      <div className="flex gap-2 border-b border-surface-border">
        {TABS.map((t, i) => (
          <button
            key={t}
            onClick={() => setTab(i)}
            className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${tab === i ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-text'}`}
          >
            {t}
            {i === 0 && pending.length > 0 && (
              <span className="ml-1.5 bg-amber-100 text-amber-700 text-xs px-1.5 py-0.5 rounded-full">{pending.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Pending tab */}
      {tab === 0 && (
        <div className="space-y-3">
          {pendingLoading && <p className="text-sm text-text-muted">Loading…</p>}
          {!pendingLoading && pending.length === 0 && (
            <p className="text-sm text-text-muted">No pending approvals.</p>
          )}
          {pending.map(a => (
            <ApprovalRow
              key={a.id}
              a={a}
              onApprove={(id) => approveMutation.mutate(id)}
              onReject={(id, reason) => rejectMutation.mutate({ id, reason })}
              approvePending={approveMutation.isPending}
              rejectPending={rejectMutation.isPending}
            />
          ))}
        </div>
      )}

      {/* History tab */}
      {tab === 1 && (
        <div className="space-y-3">
          {historyLoading && <p className="text-sm text-text-muted">Loading…</p>}
          {!historyLoading && history.length === 0 && (
            <p className="text-sm text-text-muted">No approval history.</p>
          )}
          {history.map(a => (
            <div key={a.id} className="bg-surface rounded-xl border border-surface-border p-4 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[a.status] ?? 'bg-gray-100 text-gray-500'}`}>
                  {a.status.charAt(0).toUpperCase() + a.status.slice(1)}
                </span>
                <span className="text-xs text-text-muted">
                  {a.type === 'stock_correction' ? 'Stock Correction' : 'Threshold Change'}
                </span>
              </div>
              <p className="text-sm font-medium text-text">{displayVaccineName(a.vaccineName)}</p>
              <p className="text-xs text-text-muted">Requested by {a.requestedByName}</p>
              {a.decisionReason && <p className="text-xs text-text-muted italic">Reason: "{a.decisionReason}"</p>}
              {a.decidedAt && (
                <p className="text-xs text-text-muted">{new Date(a.decidedAt).toLocaleDateString()}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
