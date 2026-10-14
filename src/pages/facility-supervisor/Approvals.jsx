import { useEffect, useState } from 'react'
import { ClipboardCheck, CheckCircle2, XCircle, Clock, X, Settings, Package, AlertTriangle, History } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getDashboard, getApprovals, createApproval, cancelApproval } from '../../lib/api'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import PageHeader from '../../components/shared/PageHeader'
import { displayVaccineName } from '../../lib/vaccineNames'

const TABS = [
  { label: 'Stock Correction', icon: Package },
  { label: 'Threshold Change', icon: Settings },
]

const TYPE_META = {
  stock_correction: { label: 'Stock Correction', cls: 'bg-primary/5 text-primary border-primary/15', icon: Package },
  threshold_change: { label: 'Threshold Change', cls: 'bg-warning-bg text-warning-dark border-warning/20', icon: Settings },
}

const STATUS_META = {
  approved: { label: 'Approved', cls: 'bg-success-bg text-success-dark border-success/20', icon: CheckCircle2 },
  rejected: { label: 'Rejected', cls: 'bg-danger-bg text-danger border-danger/20', icon: XCircle },
  cancelled: { label: 'Cancelled', cls: 'bg-surface-chip text-text-muted border-surface-border', icon: X },
}

const HOW_IT_WORKS = [
  { n: 1, title: 'Fill in the request', desc: 'Choose a vaccine and fill in the correction or threshold values.' },
  { n: 2, title: 'Facility head reviews', desc: 'Your request goes to the facility head for approval or rejection.' },
  { n: 3, title: 'Changes applied automatically', desc: 'Approved requests update vaccine totals and thresholds instantly.' },
]

export default function Approvals() {
  const qc = useQueryClient()
  const [tab,        setTab]        = useState(0)
  const [listView,   setListView]   = useState('pending')
  const [drawerOpen, setDrawerOpen] = useState(false)

  // ── Stock Correction state ──────────────────────────────────────────────────
  const [corrVaccineId,  setCorrVaccineId]  = useState('')
  const [corrStoreVials, setCorrStoreVials] = useState('')
  const [corrNote,       setCorrNote]       = useState('')
  const [corrError,      setCorrError]      = useState(null)
  const [corrDone,       setCorrDone]       = useState(false)

  // ── Threshold Change state ──────────────────────────────────────────────────
  const [thrVaccineId, setThrVaccineId] = useState('')
  const [thrValues,    setThrValues]    = useState({ criticalDoses: '', lowDoses: '', criticalVials: '', lowVials: '' })
  const [thrReset,     setThrReset]     = useState(false)
  const [thrNote,      setThrNote]      = useState('')
  const [thrError,     setThrError]     = useState(null)
  const [thrDone,      setThrDone]      = useState(false)

  useEffect(() => {
    if (!drawerOpen) return
    function onKey(e) { if (e.key === 'Escape') setDrawerOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [drawerOpen])

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
      err.status === 409 ? 'A correction is already pending for this vaccine.' : (err.message || 'Submission failed')
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
      err.status === 409 ? 'A threshold change is already pending for this vaccine.' : (err.message || 'Submission failed')
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
    <div className="max-w-5xl mx-auto flex flex-col gap-6">
      <PageHeader
        breadcrumb="Facility Supervisor"
        title="Approvals"
        subtitle="Submit corrections and threshold changes for facility head review"
        actions={
          <button
            onClick={() => setDrawerOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-surface-border bg-surface text-sm font-semibold text-text hover:bg-surface-alt transition-all cursor-pointer"
          >
            <ClipboardCheck size={14} />
            My Requests
            {pending.length > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                {pending.length}
              </span>
            )}
          </button>
        }
      />

      {/* Two-column layout */}
      <div className="grid grid-cols-[1fr_320px] gap-6 items-start">

        {/* Left: request form */}
        <div className="flex flex-col gap-4">
          {/* Tab bar */}
          <div className="flex gap-1 p-1 bg-surface-chip border border-surface-border rounded-xl w-fit">
            {TABS.map(({ label, icon: Icon }, i) => (
              <button
                key={label}
                onClick={() => { setTab(i); setCorrDone(false); setThrDone(false) }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                  tab === i
                    ? 'bg-surface text-primary shadow-sm border border-surface-border'
                    : 'text-text-muted hover:text-text'
                }`}
              >
                <Icon size={13} strokeWidth={2.2} />
                {label}
              </button>
            ))}
          </div>

          {/* Stock Correction form */}
          {tab === 0 && (
            <div className="bg-surface rounded-2xl border border-surface-border shadow-sm overflow-hidden">
              <div className="px-6 py-4 bg-surface-alt border-b border-surface-border flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Package size={15} className="text-primary" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-text">Stock Correction</h2>
                  <p className="text-xs text-text-muted mt-0.5">Set the new store total in vials (vials not held by any worker). The facility head will approve the adjustment.</p>
                </div>
              </div>
              <div className="p-6 flex flex-col gap-5">
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
                  label="New store total (vials)"
                  type="number"
                  min={0}
                  value={corrStoreVials}
                  onChange={e => { setCorrStoreVials(e.target.value); setCorrDone(false); setCorrError(null) }}
                  placeholder="0"
                />
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="corr-note" className="text-sm font-semibold text-text">
                    Note <span className="text-danger">*</span>
                  </label>
                  <textarea
                    id="corr-note"
                    value={corrNote}
                    onChange={e => { setCorrNote(e.target.value); setCorrDone(false); setCorrError(null) }}
                    maxLength={500}
                    rows={3}
                    placeholder="e.g. Physical count on 10 Oct confirmed 12 vials in store"
                    className="w-full rounded-xl border border-surface-border bg-surface px-4 py-2.5 text-sm text-text focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all resize-none placeholder:text-text-muted/50"
                  />
                  <p className="text-xs text-text-muted text-right">{corrNote.length}/500</p>
                </div>
                {corrError && (
                  <div className="flex items-start gap-2.5 bg-danger-bg border border-danger/15 rounded-xl px-4 py-3">
                    <AlertTriangle size={14} className="text-danger flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-danger font-medium">{corrError}</p>
                  </div>
                )}
                {corrDone && (
                  <div className="flex items-center gap-2.5 bg-success-bg border border-success/15 rounded-xl px-4 py-3">
                    <CheckCircle2 size={14} className="text-success-dark flex-shrink-0" />
                    <p className="text-sm text-success-dark font-medium">Submitted — awaiting facility head approval.</p>
                  </div>
                )}
                <Button onClick={() => corrMutation.mutate()} disabled={!corrValid || corrMutation.isPending} className="w-full">
                  {corrMutation.isPending ? 'Submitting…' : 'Submit for Approval'}
                </Button>
              </div>
            </div>
          )}

          {/* Threshold Change form */}
          {tab === 1 && (
            <div className="bg-surface rounded-2xl border border-surface-border shadow-sm overflow-hidden">
              <div className="px-6 py-4 bg-surface-alt border-b border-surface-border flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-warning-bg flex items-center justify-center flex-shrink-0">
                  <Settings size={15} className="text-warning-dark" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-text">Threshold Change</h2>
                  <p className="text-xs text-text-muted mt-0.5">Override alert thresholds for a vaccine at this facility. The facility head will approve the change.</p>
                </div>
              </div>
              <div className="p-6 flex flex-col gap-5">
                <Select
                  id="thr-vaccine"
                  label="Vaccine"
                  placeholder="Select vaccine…"
                  options={vaccineOptions}
                  value={thrVaccineId}
                  onChange={e => selectVaccine(e.target.value)}
                />
                <label className="flex items-center gap-3 text-sm text-text cursor-pointer bg-surface-alt border border-surface-border rounded-xl px-4 py-3 hover:bg-surface-chip transition-colors">
                  <input
                    type="checkbox"
                    checked={thrReset}
                    onChange={e => setThrReset(e.target.checked)}
                    className="accent-primary w-4 h-4 flex-shrink-0"
                  />
                  <span>Reset to vaccine default (remove facility override)</span>
                </label>
                {!thrReset && (
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      ['criticalDoses', 'Critical Doses'],
                      ['lowDoses',      'Low Doses'],
                      ['criticalVials', 'Critical Vials'],
                      ['lowVials',      'Low Vials'],
                    ].map(([key, label]) => (
                      <Input
                        key={key}
                        id={key}
                        label={label}
                        type="number"
                        min={0}
                        value={thrValues[key]}
                        onChange={e => { setThrValues(prev => ({ ...prev, [key]: e.target.value })); setThrDone(false); setThrError(null) }}
                      />
                    ))}
                  </div>
                )}
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="thr-note" className="text-sm font-semibold text-text">
                    Note <span className="text-text-muted font-normal text-xs">(optional)</span>
                  </label>
                  <textarea
                    id="thr-note"
                    value={thrNote}
                    onChange={e => setThrNote(e.target.value)}
                    maxLength={500}
                    rows={2}
                    placeholder="Reason for this threshold change…"
                    className="w-full rounded-xl border border-surface-border bg-surface px-4 py-2.5 text-sm text-text focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all resize-none placeholder:text-text-muted/50"
                  />
                </div>
                {thrError && (
                  <div className="flex items-start gap-2.5 bg-danger-bg border border-danger/15 rounded-xl px-4 py-3">
                    <AlertTriangle size={14} className="text-danger flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-danger font-medium">{thrError}</p>
                  </div>
                )}
                {thrDone && (
                  <div className="flex items-center gap-2.5 bg-success-bg border border-success/15 rounded-xl px-4 py-3">
                    <CheckCircle2 size={14} className="text-success-dark flex-shrink-0" />
                    <p className="text-sm text-success-dark font-medium">Submitted — awaiting facility head approval.</p>
                  </div>
                )}
                <Button onClick={() => thrMutation.mutate()} disabled={!thrValid || thrMutation.isPending} className="w-full">
                  {thrMutation.isPending ? 'Submitting…' : 'Submit for Approval'}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Right: steps card */}
        <div className="bg-surface border border-surface-border rounded-2xl p-6 flex flex-col gap-5 sticky top-[88px]">
          <p className="text-xs font-bold text-text-muted uppercase tracking-wider">How it works</p>
          {HOW_IT_WORKS.map(({ n, title, desc }) => (
            <div key={n} className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-sm font-bold text-primary flex-none">
                {n}
              </div>
              <div>
                <p className="text-sm font-semibold text-text">{title}</p>
                <p className="text-xs text-text-muted mt-0.5">{desc}</p>
              </div>
            </div>
          ))}
          <div className="border-t border-surface-border pt-4">
            <button
              onClick={() => setDrawerOpen(true)}
              className="w-full flex items-center justify-between gap-2 px-4 py-3 rounded-xl border border-surface-border bg-surface-alt hover:bg-surface-chip transition-all cursor-pointer text-sm font-semibold text-text"
            >
              <span className="flex items-center gap-2">
                <ClipboardCheck size={14} className="text-primary" />
                My Requests
              </span>
              {pending.length > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                  {pending.length} pending
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* My Requests drawer */}
      {drawerOpen && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setDrawerOpen(false)} />
          <div className="fixed top-0 right-0 bottom-0 w-[460px] bg-surface border-l border-surface-border z-50 flex flex-col shadow-2xl">
            {/* Drawer header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-surface-border flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <h2 className="text-base font-bold text-text">My Requests</h2>
                {pending.length > 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                    {pending.length}
                  </span>
                )}
              </div>
              <button
                onClick={() => setDrawerOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-text-muted hover:text-text hover:bg-surface-alt transition-all cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Pending / History tabs */}
            <div className="px-6 pt-4 flex-shrink-0">
              <div className="flex gap-1 p-1 bg-surface-chip border border-surface-border rounded-xl w-fit">
                <button
                  onClick={() => setListView('pending')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    listView === 'pending'
                      ? 'bg-surface text-primary shadow-sm border border-surface-border'
                      : 'text-text-muted hover:text-text'
                  }`}
                >
                  <Clock size={11} strokeWidth={2.5} />
                  Pending
                  {pending.length > 0 && (
                    <span className="ml-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                      {pending.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setListView('history')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    listView === 'history'
                      ? 'bg-surface text-primary shadow-sm border border-surface-border'
                      : 'text-text-muted hover:text-text'
                  }`}
                >
                  <History size={11} strokeWidth={2.5} />
                  History
                </button>
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-3">
              {isListLoading && (
                <>
                  {[1, 2].map(i => (
                    <div key={i} className="bg-surface rounded-2xl border border-surface-border p-5 animate-pulse">
                      <div className="flex gap-2 mb-3">
                        <div className="h-5 bg-surface-chip rounded-lg w-28" />
                        <div className="h-5 bg-surface-chip rounded-lg w-16" />
                      </div>
                      <div className="h-4 bg-surface-chip rounded w-36" />
                    </div>
                  ))}
                </>
              )}

              {!isListLoading && listItems.length === 0 && (
                <div className="flex flex-col items-center gap-2 py-12 border border-dashed border-surface-border rounded-2xl text-text-muted bg-surface">
                  {listView === 'pending' ? (
                    <>
                      <CheckCircle2 size={28} className="opacity-20" />
                      <p className="text-sm font-semibold text-text">No pending approvals</p>
                      <p className="text-xs">Submitted requests will appear here.</p>
                    </>
                  ) : (
                    <>
                      <History size={28} className="opacity-20" />
                      <p className="text-sm font-semibold text-text">No history yet</p>
                      <p className="text-xs">Approved and rejected requests will appear here.</p>
                    </>
                  )}
                </div>
              )}

              {!isListLoading && listItems.map(a => {
                const meta = TYPE_META[a.type] ?? { label: a.type, cls: 'bg-surface-chip text-text-muted border-surface-border', icon: ClipboardCheck }
                const MetaIcon = meta.icon
                const statusMeta = STATUS_META[a.status] ?? { label: a.status, cls: 'bg-surface-chip text-text-muted border-surface-border', icon: Clock }
                const StatusIcon = statusMeta.icon

                return (
                  <div key={a.id} className="bg-surface rounded-2xl border border-surface-border shadow-sm p-5 flex items-start justify-between gap-4">
                    <div className="flex flex-col gap-2.5 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-lg border ${meta.cls}`}>
                          <MetaIcon size={10} strokeWidth={2.5} />
                          {meta.label}
                        </span>
                        {listView === 'pending' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock size={10} /> Pending
                          </span>
                        ) : (
                          <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-lg border ${statusMeta.cls}`}>
                            <StatusIcon size={10} strokeWidth={2.5} />
                            {statusMeta.label}
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-bold text-text">{displayVaccineName(a.vaccineName)}</p>
                      {a.type === 'stock_correction' && (
                        <p className="text-xs text-text-muted">
                          New store total: <span className="font-semibold text-text">{a.payload?.storeVials} vials</span>
                        </p>
                      )}
                      {a.type === 'threshold_change' && a.payload?.thresholds && (
                        <div className="flex flex-wrap gap-1.5">
                          <span className="text-[11px] bg-danger-bg text-danger border border-danger/15 px-2 py-0.5 rounded-lg font-semibold">
                            Critical: {a.payload.thresholds.criticalDoses}d / {a.payload.thresholds.criticalVials}v
                          </span>
                          <span className="text-[11px] bg-warning-bg text-warning-dark border border-warning/15 px-2 py-0.5 rounded-lg font-semibold">
                            Low: {a.payload.thresholds.lowDoses}d / {a.payload.thresholds.lowVials}v
                          </span>
                        </div>
                      )}
                      {a.type === 'threshold_change' && !a.payload?.thresholds && (
                        <p className="text-xs text-text-muted italic">Reset to vaccine default</p>
                      )}
                      {a.note && (
                        <p className="text-xs text-text-muted italic border-l-2 border-surface-border pl-2.5">"{a.note}"</p>
                      )}
                      {listView === 'history' && a.status === 'rejected' && a.rejectionReason && (
                        <p className="text-xs text-danger italic border-l-2 border-danger/30 pl-2.5">
                          Reason: {a.rejectionReason}
                        </p>
                      )}
                    </div>
                    {listView === 'pending' && (
                      <button
                        onClick={() => cancelMutation.mutate(a.id)}
                        disabled={cancelMutation.isPending}
                        className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-text-muted hover:text-danger hover:bg-danger/5 transition-all cursor-pointer disabled:opacity-40"
                        title="Cancel approval"
                      >
                        <X size={15} />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
