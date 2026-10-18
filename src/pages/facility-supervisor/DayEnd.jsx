import { useRef, useState, useMemo, useSyncExternalStore } from 'react'
import { ClipboardList, Check } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getVaccines, getUsers, getHoldings, recordDayEnd } from '../../lib/api'
import { enqueue, isNetworkError, subscribe, pendingCount, withQueued } from '../../lib/offlineQueue'
import Button from '../../components/ui/Button'
import DatePicker from '../../components/ui/DatePicker'
import { SkeletonRows } from '../../components/shared/SkeletonCard'
import PageHeader from '../../components/shared/PageHeader'
import Card, { CardHeader } from '../../components/shared/Card'
import EmptyState from '../../components/shared/EmptyState'
import WorkerPicker from '../../components/shared/WorkerPicker'
import ResultPanel from '../../components/shared/ResultPanel'
import ReviewDialog from '../../components/ui/ReviewDialog'
import { displayVaccineName } from '../../lib/vaccineNames'
import { localDateStr, formatDate, plural } from '../../lib/format'

const todayStr   = () => localDateStr()
const minDateStr = () => localDateStr(-3)

const ZERO = { used: '', returned: '', wasted: '' }
const FIELDS = [['used', 'Used'], ['returned', 'Returned'], ['wasted', 'Wasted']]
const num = (v) => parseInt(v || '0', 10) || 0

const cellInput = 'w-full h-11 sm:h-9 text-center border rounded-control text-base sm:text-sm bg-surface text-text focus:outline-none focus:ring-[3px] focus:ring-primary/10 focus:border-primary [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none'

export default function DayEnd() {
  const queryClient = useQueryClient()
  const clientRef   = useRef(crypto.randomUUID())

  const [workerId,     setWorkerId]     = useState('')
  const [occurredOn,   setOccurredOn]   = useState(todayStr())
  const [inputs,       setInputs]       = useState({})
  const [rowErrors,    setRowErrors]    = useState({})
  const [globalError,  setGlobalError]  = useState('')
  const [done,         setDone]         = useState(false)
  const [savedOffline, setSavedOffline] = useState(false)
  const [review,       setReview]       = useState(null)

  const { data: vaccineData, isLoading: loadingVaccines } = useQuery({ queryKey: ['vaccines'], queryFn: getVaccines })
  const { data: usersData,   isLoading: loadingUsers }   = useQuery({ queryKey: ['users'],    queryFn: getUsers })
  const { data: holdingsData }                            = useQuery({ queryKey: ['holdings'], queryFn: getHoldings })
  const queued = useSyncExternalStore(subscribe, pendingCount) // re-render when an entry is queued or sent

  const mutation = useMutation({
    mutationFn: recordDayEnd,
    onSuccess() {
      queryClient.invalidateQueries({ queryKey: ['holdings'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['audit-log'] })
      setDone(true)
    },
    onError(err, payload) {
      if (isNetworkError(err)) {
        // "online" but no signal: the reply never came, so queue it; the same clientRef makes a replay safe
        enqueue('dayend', payload)
        setSavedOffline(true)
      } else if (err.status === 400 && err.body?.vaccineId) {
        setRowErrors(prev => ({ ...prev, [err.body.vaccineId]: `Sum must equal ${err.body.remaining} remaining vials` }))
      } else {
        setGlobalError(err.message ?? 'Submission failed. Please try again.')
      }
    },
  })

  const vaccines = vaccineData?.vaccines ?? []
  const workers  = (usersData?.users ?? []).filter(u => u.role === 'facility_worker' && u.isActive)
  const selectedWorker = workers.find(w => w.id === workerId)

  const holdingsByVaccine = useMemo(() => {
    if (!workerId || !holdingsData) return {}
    return Object.fromEntries(
      withQueued(holdingsData.holdings ?? [], null)
        .filter(h => h.workerId === workerId)
        .map(h => [h.vaccineId, h])
    )
  }, [workerId, holdingsData, queued])

  const assignedVaccines = vaccines.filter(v => holdingsByVaccine[v.id] != null)

  function getRow(vaccineId) { return inputs[vaccineId] ?? ZERO }
  const rowSum = (vaccineId) => { const r = getRow(vaccineId); return num(r.used) + num(r.returned) + num(r.wasted) }

  function setField(vaccineId, field, val) {
    setInputs(prev => ({ ...prev, [vaccineId]: { ...getRow(vaccineId), [field]: val } }))
    setRowErrors(prev => { const n = { ...prev }; delete n[vaccineId]; return n })
    setGlobalError('')
  }

  function validateRows() {
    const errs = {}
    for (const v of assignedVaccines) {
      const h   = holdingsByVaccine[v.id]
      const sum = rowSum(v.id)
      if (sum !== h.remaining) errs[v.id] = `Must equal ${h.remaining} remaining (got ${sum})`
    }
    return errs
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!workerId) { setGlobalError('Please select a worker.'); return }
    if (assignedVaccines.length === 0) { setGlobalError('Selected worker has no holdings to record.'); return }
    const errs = validateRows()
    if (Object.keys(errs).length) { setRowErrors(errs); return }
    const items = assignedVaccines.map(v => {
      const row = getRow(v.id)
      return {
        vaccineId:     v.id,
        usedVials:     num(row.used),
        returnedVials: num(row.returned),
        wastedVials:   num(row.wasted),
      }
    })
    setGlobalError('')
    setReview({ clientRef: clientRef.current, occurredOn, workerId, items })
  }

  function confirmSubmit() {
    const payload = review
    setReview(null)
    if (!navigator.onLine) {
      enqueue('dayend', payload)
      setSavedOffline(true); return
    }
    mutation.mutate(payload)
  }

  function handleReset() {
    clientRef.current = crypto.randomUUID()
    setWorkerId(''); setOccurredOn(todayStr()); setInputs({})
    setRowErrors({}); setGlobalError(''); setDone(false); setSavedOffline(false)
  }

  const header = (
    <PageHeader
      breadcrumb="Facility Supervisor › Daily work"
      title="Day End"
      subtitle="Account for every vial a worker took out: used, returned or wasted"
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
      message="This day end is queued and will sync automatically when you’re back online."
      actionLabel="Record another worker"
      onAction={handleReset}
    />
  )

  if (done) return (
    <ResultPanel
      title="Day end recorded"
      message={`${selectedWorker?.name ?? 'The worker'}’s holdings are updated and today’s ledger is closed.`}
      actionLabel="Record another worker"
      onAction={handleReset}
    />
  )

  const totals = FIELDS.map(([f, label]) => [label, assignedVaccines.reduce((s, v) => s + num(getRow(v.id)[f]), 0)])
  const balanced = assignedVaccines.filter(v => rowSum(v.id) === holdingsByVaccine[v.id].remaining).length

  return (
    <div>
      {header}
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] gap-5 items-start">
          <Card className="lg:sticky lg:top-0">
            <CardHeader title="1. Worker" className="mb-3" />
            {workers.length === 0
              ? <p className="text-sm text-text-muted">No active workers.</p>
              : <WorkerPicker workers={workers} value={workerId} onChange={(id) => { setWorkerId(id); setInputs({}); setRowErrors({}); setGlobalError('') }} />}
          </Card>

          {!workerId ? (
            <Card padding={false}>
              <EmptyState
                icon={ClipboardList}
                title="Choose a worker to begin"
                message="Their vaccines appear here so you can enter used, returned and wasted vials."
              />
            </Card>
          ) : (
            <Card padding={false}>
              <div className="px-4 sm:px-5 py-4 border-b border-surface-border">
                <CardHeader
                  title={`2. Usage for ${selectedWorker?.name ?? selectedWorker?.email}`}
                  description="Each row must add up to the vials the worker held."
                />
              </div>

              {assignedVaccines.length === 0 ? (
                <EmptyState title="No vials assigned to this worker" message="Assign vials first; then come back at the end of the session." />
              ) : (
                <>
                  <div className="hidden sm:grid grid-cols-[minmax(0,1fr)_5rem_repeat(3,5.5rem)_6rem] gap-3 px-5 py-2.5 border-b border-surface-border text-xs font-medium text-text-muted">
                    <span>Vaccine</span>
                    <span className="text-right">Held</span>
                    {FIELDS.map(([, label]) => <span key={label} className="text-center">{label}</span>)}
                    <span className="text-right">Accounted</span>
                  </div>

                  <ul className="divide-y divide-surface-border">
                    {assignedVaccines.map(v => {
                      const h   = holdingsByVaccine[v.id]
                      const row = getRow(v.id)
                      const sum = rowSum(v.id)
                      const err = rowErrors[v.id]
                      const ok  = sum === h.remaining
                      const over = sum > h.remaining
                      return (
                        <li key={v.id} className={`px-4 sm:px-5 py-3 ${err ? 'bg-danger-bg/40' : ''}`}>
                          <div className="grid grid-cols-3 sm:grid-cols-[minmax(0,1fr)_5rem_repeat(3,5.5rem)_6rem] gap-x-3 gap-y-2 items-center">
                            <p className="col-span-2 sm:col-span-1 text-sm font-medium text-text">{displayVaccineName(v.name)}</p>
                            <p className="text-right text-sm tabular-nums text-text">{h.remaining}<span className="text-xs text-text-muted ml-1">held</span></p>
                            {FIELDS.map(([field, label]) => (
                              <label key={field} className="flex flex-col gap-1">
                                <span className="sm:hidden text-xs text-text-muted">{label}</span>
                                <input
                                  type="number"
                                  min="0"
                                  step="1"
                                  inputMode="numeric"
                                  placeholder="0"
                                  aria-label={`${v.name} ${label.toLowerCase()} vials`}
                                  value={row[field]}
                                  onChange={e => setField(v.id, field, e.target.value)}
                                  className={`${cellInput} ${err || over ? 'border-danger' : 'border-surface-border'}`}
                                />
                              </label>
                            ))}
                            <p className={`col-span-3 sm:col-span-1 text-right text-sm tabular-nums flex items-center justify-end gap-1 ${ok ? 'text-success-dark' : over ? 'text-danger-dark' : 'text-text-muted'}`}>
                              {ok && <Check size={14} strokeWidth={2} aria-hidden="true" />}
                              {sum} of {h.remaining}
                            </p>
                          </div>
                          {(err || over) && (
                            <p className="text-xs text-danger-dark mt-1.5">{err ?? `That’s ${sum - h.remaining} more than the ${h.remaining} vials held.`}</p>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </>
              )}
            </Card>
          )}
        </div>

        {workerId && assignedVaccines.length > 0 && (
          <div className="sticky bottom-0 z-10 mt-5 px-4 sm:px-5 py-3 bg-surface border border-surface-border rounded-card shadow-float flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-text-muted tabular-nums">
              {totals.map(([label, n]) => <span key={label} className="mr-4"><span className="font-semibold text-text">{n}</span> {label.toLowerCase()}</span>)}
              <span>{balanced} of {assignedVaccines.length} vaccines balanced</span>
            </p>
            <div className="flex items-center gap-3">
              {globalError && <p role="alert" className="text-sm text-danger-dark">{globalError}</p>}
              <Button type="submit" size="lg" disabled={mutation.isPending}>
                {mutation.isPending ? 'Recording…' : 'Record day end'}
              </Button>
            </div>
          </div>
        )}
      </form>

      {review && (
        <ReviewDialog
          open
          onClose={() => setReview(null)}
          onConfirm={confirmSubmit}
          title="Check day end before recording"
          rows={[
            { label: 'Worker', value: selectedWorker?.name ?? selectedWorker?.email },
            { label: 'Date', value: formatDate(occurredOn) },
          ]}
          items={review.items.map(it => ({
            name: displayVaccineName(vaccines.find(v => v.id === it.vaccineId)?.name),
            value: `${it.usedVials} used · ${it.returnedVials} returned · ${it.wastedVials} wasted`,
          }))}
          total={totals.map(([label, n]) => `${n} ${label.toLowerCase()}`).join(' · ')}
          warnings={[
            totals[2][1] > 0 && `${plural(totals[2][1], 'vial')} will be recorded as wasted.`,
            !navigator.onLine && 'You’re offline. This will be saved and sent when you reconnect.',
          ]}
          confirmLabel="Record day end"
        />
      )}
    </div>
  )
}
