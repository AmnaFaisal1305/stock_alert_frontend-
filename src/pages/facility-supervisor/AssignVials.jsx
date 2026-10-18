import { useRef, useState } from 'react'
import { Minus, Plus, PackagePlus } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getVaccines, getUsers, getHoldings, assignVials } from '../../lib/api'
import { enqueue, isNetworkError } from '../../lib/offlineQueue'
import { useAuth } from '../../context/AuthContext'
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
import { displayVaccineName } from '../../lib/vaccineNames'
import { localDateStr, plural, formatDate } from '../../lib/format'

const VACCINE_GROUPS = [
  ['Birth & Oral',  ['BCG', 'OPV (Polio)', 'Rota']],
  ['Injectables',   ['IPV', 'Pneumococcal']],
  ['Pentavalent',   ['D (Pentavalent)', 'T (Pentavalent)', 'P (Pentavalent)', 'Hep B (Pentavalent)', 'Hib (Pentavalent)']],
  ['MR',            ['Measles (MR)', 'Rubella (MR)']],
  ['Other',         ['TCV', 'T (TD)', 'D (TD)', 'HPV']],
]

const GROUP_ACCENT = { 'Birth & Oral': 1, 'Injectables': 2, 'Pentavalent': 3, 'MR': 4, 'Other': 5 }

const VACCINE_SUBTITLES = {
  'BCG':              'Tuberculosis',
  'OPV (Polio)':      'Oral polio',
  'Rota':             'Rotavirus',
  'IPV':              'Inactivated polio',
  'Pneumococcal':     'PCV',
  'D (Pentavalent)':  'Diphtheria',
  'T (Pentavalent)':  'Tetanus',
  'P (Pentavalent)':  'Pertussis',
  'Hep B (Pentavalent)': 'Hepatitis B',
  'Hib (Pentavalent)': 'Haemophilus',
  'Measles (MR)':     'Measles',
  'Rubella (MR)':     'Rubella',
  'TCV':              'Typhoid',
  'T (TD)':           'Tetanus',
  'D (TD)':           'Diphtheria',
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
const minDateStr = () => localDateStr(-3)

const stepBtn = 'w-11 h-11 rounded-control border border-surface-border bg-surface text-text hover:bg-surface-chip grid place-items-center'

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

  const { data: vaccineData, isLoading: loadingVaccines } = useQuery({ queryKey: ['vaccines'], queryFn: getVaccines })
  const { data: usersData,   isLoading: loadingUsers }   = useQuery({ queryKey: ['users'],    queryFn: getUsers })
  const { data: holdingsData }                            = useQuery({ queryKey: ['holdings'], queryFn: getHoldings })

  const mutation = useMutation({
    mutationFn: assignVials,
    onSuccess() {
      queryClient.invalidateQueries({ queryKey: ['holdings'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['audit-log'] })
      setDone(true)
    },
    onError(err, payload) {
      if (isNetworkError(err)) {
        // "online" but no signal: the reply never came, so queue it; the same clientRef makes a replay safe
        enqueue('assign', payload)
        setSavedOffline(true)
      } else if (err.status === 400 && err.body?.vaccineId) {
        setRowErrors(prev => ({ ...prev, [err.body.vaccineId]: `Only ${err.body.available} vials available` }))
      } else {
        setGlobalError(err.message ?? 'Submission failed. Please try again.')
      }
    },
  })

  const vaccines = vaccineData?.vaccines ?? []
  const workers  = (usersData?.users ?? []).filter(u => u.role === 'facility_worker' && u.isActive)
  const storeMap = new Map(
    (holdingsData?.holdings ?? [])
      .filter(h => h.facilityId === user?.facilityId && !h.workerId)
      .map(h => [h.vaccineId, h.remaining])
  )
  const selectedWorker = workers.find(w => w.id === workerId)

  function step(vaccineId, delta) {
    const cur = parseInt(vialInputs[vaccineId] ?? '0', 10) || 0
    setVialInputs(prev => ({ ...prev, [vaccineId]: String(Math.max(0, cur + delta)) }))
    setRowErrors(prev => { const n = { ...prev }; delete n[vaccineId]; return n })
    setGlobalError('')
  }

  function setVials(vaccineId, val) {
    setVialInputs(prev => ({ ...prev, [vaccineId]: val }))
    setRowErrors(prev => { const n = { ...prev }; delete n[vaccineId]; return n })
    setGlobalError('')
  }

  const totalVials = Object.values(vialInputs).reduce((s, v) => s + (parseInt(v, 10) || 0), 0)

  function handleSubmit(e) {
    e.preventDefault()
    if (!workerId) { setGlobalError('Please select a worker.'); return }
    const items = vaccines
      .map(v => ({ vaccineId: v.id, vials: parseInt(vialInputs[v.id] ?? '0', 10) || 0 }))
      .filter(i => i.vials > 0)
    if (!items.length) { setGlobalError('Enter at least one vaccine quantity.'); return }
    setGlobalError(''); setRowErrors({})
    setReview({ clientRef: clientRef.current, occurredOn, workerId, items })
  }

  function confirmSubmit() {
    const payload = review
    setReview(null)
    if (!navigator.onLine) {
      enqueue('assign', payload)
      setSavedOffline(true); return
    }
    mutation.mutate(payload)
  }

  function handleReset() {
    clientRef.current = crypto.randomUUID()
    setWorkerId(''); setOccurredOn(todayStr()); setVialInputs({})
    setRowErrors({}); setGlobalError(''); setDone(false); setSavedOffline(false)
  }

  const header = (
    <PageHeader
      breadcrumb="Facility Supervisor › Daily work"
      title="Assign Vials"
      subtitle="Give a worker the vials they take out for today’s session"
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
      actionLabel="Assign to another worker"
      onAction={handleReset}
    />
  )

  if (done) return (
    <ResultPanel
      title="Vials assigned"
      message={`${selectedWorker?.name ?? 'The worker'}’s holdings now include ${plural(totalVials, 'vial')}.`}
      actionLabel="Assign to another worker"
      onAction={handleReset}
    />
  )

  const groups = groupVaccines(vaccines)

  return (
    <div>
      {header}
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] gap-5 items-start">
          <Card className="lg:sticky lg:top-0">
            <CardHeader title="1. Worker" className="mb-3" />
            {workers.length === 0
              ? <p className="text-sm text-text-muted">No active workers. Add one under Workers first.</p>
              : <WorkerPicker workers={workers} value={workerId} onChange={(id) => { setWorkerId(id); setGlobalError('') }} />}
          </Card>

          {!workerId ? (
            <Card padding={false}>
              <EmptyState
                icon={PackagePlus}
                title="Choose a worker to begin"
                message="Then set how many vials of each vaccine they take out today."
              />
            </Card>
          ) : (
            <Card padding={false}>
              <div className="px-4 sm:px-5 py-4 border-b border-surface-border">
                <CardHeader
                  title={`2. Vials for ${selectedWorker?.name ?? selectedWorker?.email}`}
                  description="“Store” is what’s available at the facility right now."
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
                        const val       = parseInt(vialInputs[v.id] ?? '0', 10) || 0
                        const available = storeMap.get(v.id)
                        const err       = rowErrors[v.id]
                        const subtitle  = [VACCINE_SUBTITLES[v.name], available != null ? `Store ${available}` : null].filter(Boolean).join(' · ')
                        return (
                          <div
                            key={v.id}
                            className={`flex justify-between items-center gap-3 border rounded-control px-3.5 py-3 transition-colors ${
                              err ? 'border-danger bg-danger-bg/40' : val > 0 ? 'border-primary bg-primary-bg' : 'border-surface-border bg-surface'
                            }`}
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-text leading-tight">{displayVaccineName(v.name)}</p>
                              {subtitle && <p className="text-xs text-text-muted mt-0.5 tabular-nums">{subtitle}</p>}
                              {err && <p className="text-xs text-danger-dark mt-0.5">{err}</p>}
                            </div>
                            {/* Stepper: intentional raw controls — 44px touch targets inside a tight tile */}
                            <div className="flex items-center gap-1 flex-none">
                              <button type="button" onClick={() => step(v.id, -1)} aria-label={`One fewer vial of ${v.name}`} className={stepBtn}>
                                <Minus size={16} strokeWidth={1.75} />
                              </button>
                              <input
                                type="number"
                                min="0"
                                inputMode="numeric"
                                aria-label={`${v.name} vials`}
                                value={vialInputs[v.id] ?? '0'}
                                onChange={e => setVials(v.id, e.target.value)}
                                className="w-14 h-11 text-center border border-surface-border rounded-control text-base bg-surface text-text focus:outline-none focus:ring-[3px] focus:ring-primary/10 focus:border-primary [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                              />
                              <button type="button" onClick={() => step(v.id, 1)} aria-label={`One more vial of ${v.name}`} className={stepBtn}>
                                <Plus size={16} strokeWidth={1.75} />
                              </button>
                            </div>
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
              : 'Select a worker to begin'}
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
            { label: 'Worker', value: selectedWorker?.name ?? selectedWorker?.email },
            { label: 'Date', value: formatDate(occurredOn) },
          ]}
          items={review.items.map(it => ({ name: displayVaccineName(vaccines.find(v => v.id === it.vaccineId)?.name), value: plural(it.vials, 'vial') }))}
          total={plural(review.items.reduce((s, it) => s + it.vials, 0), 'vial')}
          warnings={[
            ...review.items
              .filter(it => storeMap.has(it.vaccineId) && it.vials > storeMap.get(it.vaccineId))
              .map(it => `${displayVaccineName(vaccines.find(v => v.id === it.vaccineId)?.name)}: only ${storeMap.get(it.vaccineId)} vials in store.`),
            !navigator.onLine && 'You’re offline. This will be saved and sent when you reconnect.',
          ]}
          confirmLabel="Assign vials"
        />
      )}
    </div>
  )
}
