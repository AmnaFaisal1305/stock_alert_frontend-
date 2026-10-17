import { useState } from 'react'
import { X, CheckCircle2 } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getDashboard, getApprovals, createApproval, cancelApproval } from '../../lib/api'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import Textarea from '../../components/ui/Textarea'
import Tabs from '../../components/ui/Tabs'
import PageHeader from '../../components/shared/PageHeader'
import Card, { CardHeader } from '../../components/shared/Card'
import StatusBadge from '../../components/shared/StatusBadge'
import EmptyState from '../../components/shared/EmptyState'
import { SkeletonRows } from '../../components/shared/SkeletonCard'
import { displayVaccineName } from '../../lib/vaccineNames'
import { formatDate } from '../../lib/format'

const TYPE_LABEL = { stock_correction: 'Stock correction', threshold_change: 'Threshold change' }

function FormMessage({ error, done }) {
  if (error) return <p role="alert" className="text-sm text-danger-dark bg-danger-bg rounded-control px-3.5 py-2.5">{error}</p>
  if (done) return (
    <p role="status" className="flex items-center gap-2 text-sm text-success-dark bg-success-bg rounded-control px-3.5 py-2.5">
      <CheckCircle2 size={16} strokeWidth={1.75} /> Sent to the facility head for approval.
    </p>
  )
  return null
}

function RequestItem({ a, onCancel, cancelling }) {
  const t = a.payload?.thresholds
  return (
    <li className="px-4 sm:px-5 py-3.5 flex items-start gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium text-text">{displayVaccineName(a.vaccineName)}</p>
          <StatusBadge kind="workflow" status={a.status} />
        </div>
        <p className="text-xs text-text-muted mt-1">
          {TYPE_LABEL[a.type] ?? a.type}
          {a.createdAt && <> · {formatDate(a.createdAt, { withYear: false })}</>}
          {' · '}
          {a.type === 'stock_correction' && <span className="text-text tabular-nums">store → {a.payload?.storeVials} vials</span>}
          {a.type === 'threshold_change' && (t
            ? <span className="text-text tabular-nums">critical {t.criticalDoses}d / {t.criticalVials}v · low {t.lowDoses}d / {t.lowVials}v</span>
            : <span>reset to default</span>)}
        </p>
        {a.note && <p className="text-xs text-text-muted mt-1">“{a.note}”</p>}
        {a.status === 'rejected' && (a.decisionReason ?? a.rejectionReason) && <p className="text-xs text-danger-dark mt-1">Rejected: {a.decisionReason ?? a.rejectionReason}</p>}
      </div>
      {onCancel && (
        <Button variant="ghost" size="sm" onClick={() => onCancel(a.id)} disabled={cancelling} aria-label={`Withdraw ${TYPE_LABEL[a.type]} for ${a.vaccineName}`}>
          <X size={14} strokeWidth={1.75} /> Withdraw
        </Button>
      )}
    </li>
  )
}

export default function Approvals() {
  const qc = useQueryClient()
  const [tab,      setTab]      = useState('stock_correction')
  const [listView, setListView] = useState('pending')

  const [corrVaccineId,  setCorrVaccineId]  = useState('')
  const [corrStoreVials, setCorrStoreVials] = useState('')
  const [corrNote,       setCorrNote]       = useState('')
  const [corrError,      setCorrError]      = useState(null)
  const [corrDone,       setCorrDone]       = useState(false)

  const [thrVaccineId, setThrVaccineId] = useState('')
  const [thrValues,    setThrValues]    = useState({ criticalDoses: '', lowDoses: '', criticalVials: '', lowVials: '' })
  const [thrReset,     setThrReset]     = useState(false)
  const [thrNote,      setThrNote]      = useState('')
  const [thrError,     setThrError]     = useState(null)
  const [thrDone,      setThrDone]      = useState(false)

  const { data: dashData } = useQuery({ queryKey: ['dashboard'], queryFn: getDashboard })
  const vaccines = dashData
    ? [...new Map(dashData.facilities.map(r => [r.vaccineId, r])).values()]
    : []
  const vaccineOptions = vaccines.map(r => ({ value: r.vaccineId, label: displayVaccineName(r.vaccineName) }))

  const { data: pendingData, isLoading: pendingLoading } = useQuery({
    queryKey: ['approvals', 'pending'],
    queryFn:  () => getApprovals('pending'),
  })
  const pending = pendingData?.approvals ?? []

  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['approvals', 'history'],
    queryFn:  () => getApprovals(),
    enabled:  listView === 'history',
  })
  const history = (historyData?.approvals ?? []).filter(a => a.status !== 'pending')

  const corrMutation = useMutation({
    mutationFn: () => createApproval({
      type: 'stock_correction',
      vaccineId: corrVaccineId,
      storeVials: Number(corrStoreVials),
      note: corrNote,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['approvals'] })
      qc.invalidateQueries({ queryKey: ['audit-log'] })
      setCorrDone(true)
      setCorrVaccineId(''); setCorrStoreVials(''); setCorrNote(''); setCorrError(null)
    },
    onError: (err) => setCorrError(
      err.status === 409 ? 'A correction is already pending for this vaccine. Withdraw it first or wait for the head’s decision.' : (err.message || 'Submission failed')
    ),
  })

  const thrMutation = useMutation({
    mutationFn: () => createApproval({
      type: 'threshold_change',
      vaccineId: thrVaccineId,
      thresholds: thrReset ? null : {
        criticalDoses: Number(thrValues.criticalDoses),
        lowDoses:      Number(thrValues.lowDoses),
        criticalVials: Number(thrValues.criticalVials),
        lowVials:      Number(thrValues.lowVials),
      },
      ...(thrNote ? { note: thrNote } : {}),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['approvals'] })
      qc.invalidateQueries({ queryKey: ['audit-log'] })
      setThrDone(true)
      setThrVaccineId(''); setThrValues({ criticalDoses: '', lowDoses: '', criticalVials: '', lowVials: '' })
      setThrNote(''); setThrReset(false); setThrError(null)
    },
    onError: (err) => setThrError(
      err.status === 409 ? 'A threshold change is already pending for this vaccine. Withdraw it first or wait for the head’s decision.' : (err.message || 'Submission failed')
    ),
  })

  const cancelMutation = useMutation({
    mutationFn: (id) => cancelApproval(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['approvals'] })
      qc.invalidateQueries({ queryKey: ['audit-log'] })
    },
  })

  function selectVaccine(vid) {
    const row = vaccines.find(r => r.vaccineId === vid)
    if (!row) return
    setThrVaccineId(vid)
    setThrValues({
      criticalDoses: String(row.criticalDoses),
      lowDoses:      String(row.lowDoses),
      criticalVials: String(row.criticalVials),
      lowVials:      String(row.lowVials),
    })
    setThrReset(false); setThrDone(false); setThrError(null)
  }

  const corrValid = corrVaccineId && corrStoreVials !== '' && Number(corrStoreVials) >= 0 && corrNote.trim().length > 0
  const thrValid  = thrVaccineId && (thrReset || Object.values(thrValues).every(v => v !== ''))

  const isListLoading = listView === 'pending' ? pendingLoading : historyLoading
  const listItems     = listView === 'pending' ? pending : history

  return (
    <div>
      <PageHeader
        breadcrumb="Facility Supervisor › Daily work"
        title="Approvals"
        subtitle="Request a stock correction or threshold change. The facility head approves it, then it applies automatically."
      />

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_400px] gap-5 items-start">
        <Card>
          <Tabs
            label="Request type"
            value={tab}
            onChange={(t) => { setTab(t); setCorrDone(false); setThrDone(false) }}
            tabs={[{ value: 'stock_correction', label: 'Stock correction' }, { value: 'threshold_change', label: 'Threshold change' }]}
            className="mb-5"
          />

          {tab === 'stock_correction' ? (
            <div className="flex flex-col gap-4 max-w-xl">
              <p className="text-sm text-text-muted">Set the correct store total in vials (vials not held by any worker), for example after a physical count.</p>
              <Select
                id="corr-vaccine"
                label="Vaccine"
                placeholder="Select vaccine…"
                options={vaccineOptions}
                value={corrVaccineId}
                onChange={e => { setCorrVaccineId(e.target.value); setCorrDone(false); setCorrError(null) }}
              />
              <Input
                id="corr-vials"
                label="Correct store total (vials)"
                type="number"
                min={0}
                inputMode="numeric"
                value={corrStoreVials}
                onChange={e => { setCorrStoreVials(e.target.value); setCorrDone(false); setCorrError(null) }}
                placeholder="0"
              />
              <Textarea
                id="corr-note"
                label="Reason"
                required
                showCount
                rows={3}
                value={corrNote}
                onChange={e => { setCorrNote(e.target.value); setCorrDone(false); setCorrError(null) }}
                placeholder="e.g. Physical count on 10 Oct confirmed 12 vials in store"
              />
              <FormMessage error={corrError} done={corrDone} />
              <div>
                <Button onClick={() => corrMutation.mutate()} disabled={!corrValid || corrMutation.isPending}>
                  {corrMutation.isPending ? 'Sending…' : 'Send for approval'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4 max-w-xl">
              <p className="text-sm text-text-muted">Override when this vaccine shows as critical or low at your facility. Current values fill in when you pick a vaccine.</p>
              <Select
                id="thr-vaccine"
                label="Vaccine"
                placeholder="Select vaccine…"
                options={vaccineOptions}
                value={thrVaccineId}
                onChange={e => selectVaccine(e.target.value)}
              />
              <label className="flex items-center gap-3 text-sm text-text cursor-pointer rounded-control border border-surface-border px-3.5 py-2.5 hover:bg-surface-alt">
                <input type="checkbox" checked={thrReset} onChange={e => setThrReset(e.target.checked)} className="accent-primary w-4 h-4 flex-shrink-0" />
                Reset to the vaccine’s default thresholds
              </label>
              {!thrReset && (
                <div className="grid grid-cols-2 gap-4">
                  {[
                    ['criticalDoses', 'Critical (doses)'],
                    ['lowDoses',      'Low (doses)'],
                    ['criticalVials', 'Critical (vials)'],
                    ['lowVials',      'Low (vials)'],
                  ].map(([key, label]) => (
                    <Input
                      key={key}
                      id={key}
                      label={label}
                      type="number"
                      min={0}
                      inputMode="numeric"
                      value={thrValues[key]}
                      onChange={e => { setThrValues(prev => ({ ...prev, [key]: e.target.value })); setThrDone(false); setThrError(null) }}
                    />
                  ))}
                </div>
              )}
              <Textarea
                id="thr-note"
                label="Reason"
                value={thrNote}
                onChange={e => setThrNote(e.target.value)}
                placeholder="Why does this facility need different thresholds?"
              />
              <FormMessage error={thrError} done={thrDone} />
              <div>
                <Button onClick={() => thrMutation.mutate()} disabled={!thrValid || thrMutation.isPending}>
                  {thrMutation.isPending ? 'Sending…' : 'Send for approval'}
                </Button>
              </div>
            </div>
          )}
        </Card>

        <Card padding={false} className="lg:sticky lg:top-0">
          <div className="px-4 sm:px-5 pt-4 pb-3 border-b border-surface-border flex flex-col gap-3">
            <CardHeader title="My requests" description="What you’ve sent to the facility head" />
            <Tabs
              size="sm"
              label="Request list"
              value={listView}
              onChange={setListView}
              tabs={[{ value: 'pending', label: 'Pending', count: pending.length }, { value: 'history', label: 'History' }]}
            />
          </div>
          {isListLoading ? (
            <SkeletonRows rows={3} />
          ) : listItems.length === 0 ? (
            <EmptyState
              title={listView === 'pending' ? 'Nothing waiting' : 'No decisions yet'}
              message={listView === 'pending' ? 'Requests you send appear here until the head decides.' : 'Approved, rejected and withdrawn requests appear here.'}
            />
          ) : (
            <ul className="divide-y divide-surface-border max-h-[60vh] overflow-y-auto">
              {listItems.map(a => (
                <RequestItem
                  key={a.id}
                  a={a}
                  onCancel={listView === 'pending' ? (id) => cancelMutation.mutate(id) : null}
                  cancelling={cancelMutation.isPending}
                />
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}
