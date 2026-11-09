import { useRef, useState, useSyncExternalStore, useMemo } from 'react'
import { Minus, Plus, PackagePlus } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getVaccines, getUsers, getHoldings, getStoreBatches, assignVials } from '../../lib/api'
import { enqueue, isNetworkError, subscribe, pendingCount, OFFLINE_ENABLED, NO_CONNECTION } from '../../lib/offlineQueue'
import { useAuth } from '../../context/AuthContext'
import { useUnsavedGuard } from '../../hooks/useUnsavedGuard'
import Button from '../../components/ui/Button'
import DatePicker from '../../components/ui/DatePicker'
import { SkeletonRows } from '../../components/shared/SkeletonCard'
import PageHeader from '../../components/shared/PageHeader'
import Card, { CardHeader } from '../../components/shared/Card'
import EmptyState from '../../components/shared/EmptyState'
import WorkerPicker from '../../components/shared/WorkerPicker'
import { ACCENT } from '../../components/shared/StatCard'
import ResultPanel from '../../components/shared/ResultPanel'
import ReviewDialog from '../../components/ui/ReviewDialog'
import Select from '../../components/ui/Select'
import { localDateStr, plural, formatDate, batchLabel } from '../../lib/format'

// Kemari pilot catalog (backend, 2026-11-09). A vaccine whose name isn't listed falls into "Other".
const VACCINE_GROUPS = [
  ['Birth & Oral',  ['BCG', 'HBV (Birth Dose)', 'OPV (Polio)', 'Rota']],
  ['Injectables',   ['Pentavalent', 'IPV', 'Pneumococcal', 'MR', 'TCV']],
  ['Older children & women', ['TD', 'HPV']],
]

const GROUP_ACCENT = { 'Birth & Oral': 1, 'Injectables': 2, 'Older children & women': 3, 'Other': 5 }

const VACCINE_SUBTITLES = {
  'BCG':              'Tuberculosis',
  'HBV (Birth Dose)': 'Hepatitis B at birth',
  'OPV (Polio)':      'Oral polio',
  'Rota':             'Rotavirus',
  'Pentavalent':      'DTP · Hep B · Hib',
  'IPV':              'Inactivated polio',
  'Pneumococcal':     'PCV',
  'MR':               'Measles · Rubella',
  'TCV':              'Typhoid',
  'TD':               'Tetanus · Diphtheria',
  'HPV':              'Human papillomavirus',
}

function groupVaccines(vaccines) {
  const known = new Set(VACCINE_GROUPS.flatMap(([, ns]) => ns))
  const groups = VACCINE_GROUPS.map(([g, ns]) => [g, vaccines.filter(v => ns.includes(v.name))])
  const extra  = vaccines.filter(v => !known.has(v.name))
  if (extra.length) {
    const oi = groups.findIndex(([g]) => g === 'Other')
    if (oi >= 0) groups[oi][1].push(...extra)
    else groups.push(['Other', extra])
  }
  return groups.filter(([, vs]) => vs.length > 0)
}

const todayStr   = () => localDateStr()
const minDateStr = () => localDateStr(-7)

const stepBtn = 'w-11 h-11 rounded-control border border-surface-border bg-surface text-text hover:bg-surface-chip grid place-items-center disabled:opacity-40 disabled:pointer-events-none'

export default function AssignVials() {
  const { user }      = useAuth()
  const queryClient   = useQueryClient()
  const clientRef     = useRef(crypto.randomUUID())

  const [workerId,     setWorkerId]     = useState('')
  const [occurredOn,   setOccurredOn]   = useState(todayStr())
  const [vialInputs,   setVialInputs]   = useState({})
  const [rowErrors,    setRowErrors]    = useState({})
  const [globalError,  setGlobalError]  = useState('')
  const [done,         setDone]         = useState(false)
  const [savedOffline, setSavedOffline] = useState(false)
  const [review,       setReview]       = useState(null)
  const [batchPick,    setBatchPick]    = useState({}) // vaccineId -> batchId

  const { data: vaccineData, isLoading: loadingVaccines } = useQuery({ queryKey: ['vaccines'], queryFn: getVaccines })
  const { data: usersData,   isLoading: loadingUsers }   = useQuery({ queryKey: ['users'],    queryFn: getUsers })
  const { data: holdingsData }                            = useQuery({ queryKey: ['holdings'], queryFn: getHoldings })
  const { data: batchData }                               = useQuery({ queryKey: ['store-batches'], queryFn: () => getStoreBatches() })
  useSyncExternalStore(subscribe, pendingCount) // re-render when an entry is queued or sent

  const mutation = useMutation({
    mutationFn: assignVials,
    onSuccess() {
      queryClient.invalidateQueries({ queryKey: ['holdings'] })
      queryClient.invalidateQueries({ queryKey: ['store-batches'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['audit-log'] })
      setDone(true)
    },
    onError(err, payload) {
      if (isNetworkError(err) && !OFFLINE_ENABLED) {
        setGlobalError(NO_CONNECTION)
      } else if (isNetworkError(err)) {
        // "online" but no signal: the reply never came, so queue it; the same clientRef makes a replay safe
        enqueue('assign', payload)
        setSavedOffline(true)
      } else if (err.status === 400 && err.body?.vaccineId) {
        const b = batchById.get(err.body.batchId)
        const msg = err.body.available != null
          ? `Only ${plural(err.body.available, 'vial')} left${b ? ` in batch ${b.batchNo}` : ''}`
          : (err.message ?? 'Check this batch')
        setRowErrors(prev => ({ ...prev, [err.body.vaccineId]: msg }))
        queryClient.invalidateQueries({ queryKey: ['store-batches'] })
      } else {
        setGlobalError(err.message ?? 'Submission failed. Please try again.')
      }
    },
  })

  const vaccines = vaccineData?.vaccines ?? []
  const workers  = (usersData?.users ?? []).filter(u => u.role === 'facility_worker' && u.isActive)
  // Store batches with vials left, per vaccine (Round 47). The supervisor picks the batch.
  const batches = batchData?.batches ?? []
  const batchById = new Map(batches.map(b => [b.batchId, b]))
  const batchesByVaccine = new Map()
  for (const b of batches) {
    if (!batchesByVaccine.has(b.vaccineId)) batchesByVaccine.set(b.vaccineId, [])
    batchesByVaccine.get(b.vaccineId).push(b)
  }
  const pickedBatch = (vaccineId) => {
    const list = batchesByVaccine.get(vaccineId) ?? []
    return list.length === 1 ? list[0] : list.find(b => b.batchId === batchPick[vaccineId])
  }
  const storeVials = (vaccineId) => {
    if (!batchData) return null
    const picked = pickedBatch(vaccineId)
    return picked ? picked.storeVials : (batchesByVaccine.get(vaccineId) ?? []).reduce((s, b) => s + b.storeVials, 0)
  }
  const workerHoldingsMap = useMemo(() => {
    const map = new Map()
    const workerMap = new Map(workers.map(w => [w.id, w.name ?? w.email]))
    for (const h of (holdingsData?.holdings ?? [])) {
      if (h.facilityId !== user?.facilityId || !h.workerId || h.remaining <= 0) continue
      const name = workerMap.get(h.workerId) ?? 'Worker'
      if (!map.has(h.vaccineId)) map.set(h.vaccineId, [])
      map.get(h.vaccineId).push({ name, remaining: h.remaining })
    }
    return map
  }, [holdingsData, workers, user?.facilityId])

  const selectedWorker = workers.find(w => w.id === workerId)

  function step(vaccineId, delta) {
    const cur = parseInt(vialInputs[vaccineId] ?? '0', 10) || 0
    setVialInputs(prev => ({ ...prev, [vaccineId]: String(Math.max(0, cur + delta)) }))
    setRowErrors(prev => { const n = { ...prev }; delete n[vaccineId]; return n })
    setGlobalError('')
  }

  function pickBatch(vaccineId, batchId) {
    setBatchPick(prev => ({ ...prev, [vaccineId]: batchId }))
    setRowErrors(prev => { const n = { ...prev }; delete n[vaccineId]; return n })
    setGlobalError('')
  }

  function setVials(vaccineId, val) {
    setVialInputs(prev => ({ ...prev, [vaccineId]: val }))
    setRowErrors(prev => { const n = { ...prev }; delete n[vaccineId]; return n })
    setGlobalError('')
  }

  const totalVials = Object.values(vialInputs).reduce((s, v) => s + (parseInt(v, 10) || 0), 0)
  useUnsavedGuard(totalVials > 0 && !done && !savedOffline)

  function handleSubmit(e) {
    e.preventDefault()
    if (!workerId) { setGlobalError('Please select a vaccinator.'); return }
    const items = vaccines
      .map(v => ({ vaccineId: v.id, batchId: pickedBatch(v.id)?.batchId, vials: parseInt(vialInputs[v.id] ?? '0', 10) || 0 }))
      .filter(i => i.vials > 0)
    if (!items.length) { setGlobalError('Enter at least one vaccine quantity.'); return }
    const noBatch = items.filter(i => !i.batchId)
    if (noBatch.length) {
      setRowErrors(Object.fromEntries(noBatch.map(i => [i.vaccineId, 'Choose the batch these vials come from'])))
      setGlobalError('Choose a batch for every vaccine you assign.')
      return
    }
    setGlobalError(''); setRowErrors({})
    setReview({ clientRef: clientRef.current, occurredOn, workerId, items })
  }

  function confirmSubmit() {
    const payload = review
    setReview(null)
    if (!navigator.onLine && !OFFLINE_ENABLED) {
      setGlobalError(NO_CONNECTION); return
    }
    if (!navigator.onLine) {
      enqueue('assign', payload)
      setSavedOffline(true); return
    }
    mutation.mutate(payload)
  }

  function handleReset() {
    clientRef.current = crypto.randomUUID()
    setWorkerId(''); setOccurredOn(todayStr()); setVialInputs({}); setBatchPick({})
    setRowErrors({}); setGlobalError(''); setDone(false); setSavedOffline(false)
  }

  const header = (
    <PageHeader
      breadcrumb="Facility Supervisor › Daily work"
      title="Assign Vials"
      subtitle="Give a vaccinator the vials they take out for today’s session"
      actions={
        <DatePicker
          id="occurredOn"
          label="Date"
          value={occurredOn}
          onChange={e => setOccurredOn(e.target.value)}
          min={minDateStr()}
          max={todayStr()}
          className="w-44"
        />
      }
    />
  )

  if (loadingVaccines || loadingUsers) return (
    <div>{header}<Card padding={false}><SkeletonRows rows={6} /></Card></div>
  )

  if (savedOffline) return (
    <ResultPanel
      tone="offline"
      title="Saved offline"
      message="This assignment is queued and will sync automatically when you’re back online."
      actionLabel="Assign to another vaccinator"
      onAction={handleReset}
    />
  )

  if (done) return (
    <ResultPanel
      title="Vials assigned"
      message={`${selectedWorker?.name ?? 'The vaccinator'}’s holdings now include ${plural(totalVials, 'vial')}.`}
      actionLabel="Assign to another vaccinator"
      onAction={handleReset}
    />
  )

  const groups = groupVaccines(vaccines)

  return (
    <div>
      {header}
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] gap-5 items-start">
          <Card className="lg:sticky lg:top-0" data-tour="step-worker">
            <CardHeader title="1. Vaccinator" className="mb-3" />
            {workers.length === 0
              ? <p className="text-sm text-text-muted">No active vaccinators. Ask your Super Admin to add one.</p>
              : <WorkerPicker workers={workers} value={workerId} onChange={(id) => { setWorkerId(id); setGlobalError('') }} />}
          </Card>

          {!workerId ? (
            <Card padding={false} data-tour="step-vials">
              <EmptyState
                icon={PackagePlus}
                title="Choose a vaccinator to begin"
                message="Then set how many vials of each vaccine they take out today."
              />
            </Card>
          ) : (
            <Card padding={false} data-tour="step-vials">
              <div className="px-4 sm:px-5 py-4 border-b border-surface-border">
                <CardHeader
                  title={`2. Vials for ${selectedWorker?.name ?? selectedWorker?.email}`}
                  description="Pick the batch the vials come from. “Store” is what’s left in it right now."
                />
              </div>
              <div className="px-4 sm:px-5 py-5 flex flex-col gap-6">
                {groups.map(([groupName, groupVaccines]) => (
                  <section key={groupName} aria-label={groupName}>
                    <h3 className="mb-3">
                      <span className={`inline-flex items-center h-6 px-2.5 rounded-full text-xs font-semibold ${ACCENT[GROUP_ACCENT[groupName] ?? 5]}`}>{groupName}</span>
                    </h3>
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
                      {groupVaccines.map(v => {
                        const val          = parseInt(vialInputs[v.id] ?? '0', 10) || 0
                        const available    = storeVials(v.id)
                        const err          = rowErrors[v.id]
                        const subtitle     = [VACCINE_SUBTITLES[v.name], available != null ? `Store ${plural(available, 'vial')}` : null].filter(Boolean).join(' · ')
                        const workerHolders = workerHoldingsMap.get(v.id) ?? []
                        const vBatches     = batchesByVaccine.get(v.id) ?? []
                        const picked       = pickedBatch(v.id)
                        return (
                          <div
                            key={v.id}
                            className={`flex flex-col gap-2.5 border rounded-control px-3.5 py-3 transition-colors ${
                              err ? 'border-danger bg-danger-bg/40' : val > 0 ? 'border-primary bg-primary-bg' : 'border-surface-border bg-surface'
                            }`}
                          >
                            <div className="flex justify-between items-center gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-text leading-tight">{v.name}</p>
                              {subtitle && <p className="text-xs text-text-muted mt-0.5 tabular-nums">{subtitle}</p>}
                              {workerHolders.length > 0 && err && (
                                <p className="text-xs text-warning-dark mt-0.5">
                                  {workerHolders.map(e => `${e.name} (${e.remaining} vials)`).join(', ')} · No day-end recorded
                                </p>
                              )}
                              {err && <p className="text-xs text-danger-dark mt-0.5">{err}</p>}
                            </div>
                            {/* Stepper: intentional raw controls — 44px touch targets inside a tight tile */}
                            <div className="flex items-center gap-1 flex-none">
                              <button type="button" onClick={() => step(v.id, -1)} aria-label={`One fewer vial of ${v.name}`} className={stepBtn} disabled={!picked}>
                                <Minus size={16} strokeWidth={1.75} />
                              </button>
                              <input
                                type="number"
                                min="0"
                                inputMode="numeric"
                                aria-label={`${v.name} vials`}
                                value={vialInputs[v.id] ?? '0'}
                                onChange={e => setVials(v.id, e.target.value)}
                                disabled={!picked}
                                className="disabled:opacity-40 w-14 h-11 text-center border border-surface-border rounded-control text-base bg-surface text-text focus:outline-none focus:ring-[3px] focus:ring-primary/10 focus:border-primary [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                              />
                              <button type="button" onClick={() => step(v.id, 1)} aria-label={`One more vial of ${v.name}`} className={stepBtn} disabled={!picked}>
                                <Plus size={16} strokeWidth={1.75} />
                              </button>
                            </div>
                            </div>
                            {batchData && (vBatches.length === 0
                              ? <p className="text-xs text-text-muted">None in store</p>
                              : vBatches.length === 1
                                ? <p className="text-xs text-text-muted tabular-nums">Batch {batchLabel(picked)}</p>
                                : <Select
                                    id={`batch-${v.id}`}
                                    aria-label={`${v.name} batch`}
                                    placeholder="Choose batch…"
                                    value={batchPick[v.id] ?? ''}
                                    onChange={e => pickBatch(v.id, e.target.value)}
                                    options={vBatches.map(b => ({ value: b.batchId, label: `${batchLabel(b)} · ${plural(b.storeVials, 'vial')}` }))}
                                  />)}
                          </div>
                        )
                      })}
                    </div>
                  </section>
                ))}
              </div>
            </Card>
          )}
        </div>

        <div className="sticky bottom-0 z-10 mt-5 px-4 sm:px-5 py-3 bg-surface border border-surface-border rounded-card shadow-float flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-text-muted">
            {selectedWorker
              ? <>Assigning <span className="font-semibold text-text tabular-nums">{plural(totalVials, 'vial')}</span> to <span className="font-medium text-text">{selectedWorker.name ?? selectedWorker.email}</span></>
              : 'Select a vaccinator to begin'}
          </p>
          <div className="flex items-center gap-3">
            {globalError && <p role="alert" className="text-sm text-danger-dark">{globalError}</p>}
            <Button type="submit" size="lg" disabled={totalVials === 0 || mutation.isPending}>
              {mutation.isPending ? 'Assigning…' : 'Assign vials'}
            </Button>
          </div>
        </div>
      </form>

      {review && (
        <ReviewDialog
          open
          onClose={() => setReview(null)}
          onConfirm={confirmSubmit}
          title="Check before assigning"
          rows={[
            { label: 'Vaccinator', value: selectedWorker?.name ?? selectedWorker?.email },
            { label: 'Date', value: formatDate(occurredOn) },
          ]}
          items={review.items.map(it => ({ name: `${vaccines.find(v => v.id === it.vaccineId)?.name} · ${batchLabel(batchById.get(it.batchId))}`, value: plural(it.vials, 'vial') }))}
          total={plural(review.items.reduce((s, it) => s + it.vials, 0), 'vial')}
          warnings={[
            ...review.items
              .filter(it => batchById.has(it.batchId) && it.vials > batchById.get(it.batchId).storeVials)
              .map(it => `${(vaccines.find(v => v.id === it.vaccineId)?.name)}: only ${plural(batchById.get(it.batchId).storeVials, 'vial')} in batch ${batchById.get(it.batchId).batchNo}.`),
            !navigator.onLine && (OFFLINE_ENABLED ? 'You’re offline. This will be saved and sent when you reconnect.' : 'You’re offline. Connect before you confirm; nothing is saved offline.'),
          ]}
          confirmLabel="Assign vials"
        />
      )}
    </div>
  )
}
