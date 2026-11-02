import { useRef, useState, useMemo, useSyncExternalStore } from 'react'
import { ClipboardList, Check } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getVaccines, getUsers, getHoldings, recordDayEnd } from '../../lib/api'
import { enqueue, isNetworkError, subscribe, pendingCount, withQueued, OFFLINE_ENABLED, NO_CONNECTION } from '../../lib/offlineQueue'
import { useUnsavedGuard } from '../../hooks/useUnsavedGuard'
import Button from '../../components/ui/Button'
import DatePicker from '../../components/ui/DatePicker'
import { SkeletonRows } from '../../components/shared/SkeletonCard'
import PageHeader from '../../components/shared/PageHeader'
import Card, { CardHeader } from '../../components/shared/Card'
import EmptyState from '../../components/shared/EmptyState'
import WorkerPicker from '../../components/shared/WorkerPicker'
import ResultPanel from '../../components/shared/ResultPanel'
import ReviewDialog from '../../components/ui/ReviewDialog'
import { localDateStr, formatDate, plural, batchLabel } from '../../lib/format'

const todayStr   = () => localDateStr()
const minDateStr = () => localDateStr(-7)

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
        enqueue('dayend', payload)
        setSavedOffline(true)
      } else if (err.status === 400 && err.body?.vaccineId) {
        // The server names the vaccine, not the batch: mark that vaccine's rows.
        const msg = err.body.remaining != null ? `Sum must equal ${err.body.remaining} remaining vials` : (err.message ?? 'Check this batch')
        setRowErrors(prev => ({ ...prev, ...Object.fromEntries(heldRows.filter(h => h.vaccineId === err.body.vaccineId).map(h => [h.key, msg])) }))
        setGlobalError(err.message ?? 'Check the highlighted rows.')
        queryClient.invalidateQueries({ queryKey: ['holdings'] })
      } else {
        setGlobalError(err.message ?? 'Submission failed. Please try again.')
      }
    },
  })

  const vaccines = vaccineData?.vaccines ?? []
  const workers  = (usersData?.users ?? []).filter(u => u.role === 'facility_worker' && u.isActive)
  const selectedWorker = workers.find(w => w.id === workerId)

  // One row per batch the vaccinator holds (Round 47), keyed vaccine:batch.
  const heldRows = useMemo(() => {
    if (!workerId || !holdingsData) return []
    const names = new Map(vaccines.map(v => [v.id, v.name]))
    return withQueued(holdingsData.holdings ?? [], null)
      .filter(h => h.workerId === workerId && h.remaining > 0)
      .map(h => ({ ...h, key: `${h.vaccineId}:${h.batchId ?? 'none'}`, name: names.get(h.vaccineId) ?? h.vaccineName }))
      .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '') || (a.expiryDate ?? '').localeCompare(b.expiryDate ?? ''))
  }, [workerId, holdingsData, queued, vaccines])

  useUnsavedGuard(!done && !savedOffline && Object.values(inputs).some((r) => r.used || r.returned || r.wasted))

  function getRow(key) { return inputs[key] ?? ZERO }
  const rowSum = (key) => { const r = getRow(key); return num(r.used) + num(r.returned) + num(r.wasted) }

  function setField(key, field, val) {
    setInputs(prev => ({ ...prev, [key]: { ...getRow(key), [field]: val } }))
    setRowErrors(prev => { const n = { ...prev }; delete n[key]; return n })
    setGlobalError('')
  }

  function validateRows() {
    const errs = {}
    for (const h of heldRows) {
      const sum = rowSum(h.key)
      if (sum !== h.remaining) errs[h.key] = `Must equal ${h.remaining} remaining (got ${sum})`
    }
    return errs
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!workerId) { setGlobalError('Please select a vaccinator.'); return }
    if (heldRows.length === 0) { setGlobalError('Selected vaccinator has no holdings to record.'); return }
    const errs = validateRows()
    if (Object.keys(errs).length) { setRowErrors(errs); return }
    const items = heldRows.map(h => {
      const row = getRow(h.key)
      return {
        vaccineId:     h.vaccineId,
        batchId:       h.batchId ?? null,
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
    if (!navigator.onLine && !OFFLINE_ENABLED) {
      setGlobalError(NO_CONNECTION); return
    }
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
      subtitle="Account for every vial a vaccinator took out: used, returned or wasted"
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
      actionLabel="Record another vaccinator"
      onAction={handleReset}
    />
  )

  if (done) return (
    <ResultPanel
      title="Day end recorded"
      message={`${selectedWorker?.name ?? 'The vaccinator'}’s holdings are updated and today’s ledger is closed.`}
      actionLabel="Record another vaccinator"
      onAction={handleReset}
    />
  )

  const totals = FIELDS.map(([f, label]) => [label, heldRows.reduce((s, h) => s + num(getRow(h.key)[f]), 0)])
  const balanced = heldRows.filter(h => rowSum(h.key) === h.remaining).length

  return (
    <div>
      {header}
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] gap-5 items-start">
          <Card className="lg:sticky lg:top-0" data-tour="step-worker">
            <CardHeader title="1. Vaccinator" className="mb-3" />
            {workers.length === 0
              ? <p className="text-sm text-text-muted">No active vaccinators.</p>
              : <WorkerPicker workers={workers} value={workerId} onChange={(id) => { setWorkerId(id); setInputs({}); setRowErrors({}); setGlobalError('') }} />}
          </Card>

          {!workerId ? (
            <Card padding={false} data-tour="step-vials">
              <EmptyState
                icon={ClipboardList}
                title="Choose a vaccinator to begin"
                message="Their vaccines appear here so you can enter used, returned and wasted vials."
              />
            </Card>
          ) : (
            <Card padding={false} data-tour="step-vials">
              <div className="px-4 sm:px-5 py-4 border-b border-surface-border">
                <CardHeader
                  title={`2. Usage for ${selectedWorker?.name ?? selectedWorker?.email}`}
                  description="Each row must add up to the vials the vaccinator held."
                />
              </div>

              {heldRows.length === 0 ? (
                <EmptyState title="No vaccines assigned yet" message="Assign vials first; then come back at the end of the session." />
              ) : (
                <>
                  <div className="hidden sm:grid grid-cols-[minmax(0,1fr)_5rem_repeat(3,5.5rem)_6rem] gap-3 px-5 py-2.5 border-b border-surface-border text-xs font-medium text-text-muted">
                    <span>Vaccine</span>
                    <span className="text-right">Held</span>
                    {FIELDS.map(([, label]) => <span key={label} className="text-center">{label}</span>)}
                    <span className="text-right">Accounted</span>
                  </div>

                  <ul className="divide-y divide-surface-border">
                    {heldRows.map(h => {
                      const v   = { id: h.key, name: h.name }
                      const row = getRow(h.key)
                      const sum = rowSum(h.key)
                      const err = rowErrors[h.key]
                      const ok  = sum === h.remaining
                      const over = sum > h.remaining
                      return (
                        <li key={h.key} className={`px-4 sm:px-5 py-3 ${err ? 'bg-danger-bg/40' : ''}`}>
                          <div className="grid grid-cols-3 sm:grid-cols-[minmax(0,1fr)_5rem_repeat(3,5.5rem)_6rem] gap-x-3 gap-y-2 items-center">
                            <div className="col-span-2 sm:col-span-1 min-w-0">
                              <p className="text-sm font-medium text-text">{h.name}</p>
                              <p className="text-xs text-text-muted tabular-nums">{h.batchNo ? `Batch ${batchLabel(h)}` : batchLabel(h)}</p>
                            </div>
                            <p className="text-right text-sm tabular-nums text-text">{h.remaining > 0 ? <>{h.remaining}<span className="text-xs text-text-muted ml-1">held</span></> : <span className="text-text-muted">—</span>}</p>
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

        {workerId && heldRows.length > 0 && (
          <div className="sticky bottom-0 z-10 mt-5 px-4 sm:px-5 py-3 bg-surface border border-surface-border rounded-card shadow-float flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-text-muted tabular-nums">
              {totals.map(([label, n]) => <span key={label} className="mr-4"><span className="font-semibold text-text">{n}</span> {label.toLowerCase()}</span>)}
              <span>{balanced} of {plural(heldRows.length, 'row')} balanced</span>
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
            { label: 'Vaccinator', value: selectedWorker?.name ?? selectedWorker?.email },
            { label: 'Date', value: formatDate(occurredOn) },
          ]}
          items={review.items.map((it, i) => ({
            name: `${vaccines.find(v => v.id === it.vaccineId)?.name} · ${batchLabel(heldRows[i])}`,
            value: `${it.usedVials} used · ${it.returnedVials} returned · ${it.wastedVials} wasted`,
          }))}
          total={totals.map(([label, n]) => `${n} ${label.toLowerCase()}`).join(' · ')}
          warnings={[
            totals[2][1] > 0 && `${plural(totals[2][1], 'vial')} will be recorded as wasted.`,
            !navigator.onLine && (OFFLINE_ENABLED ? 'You’re offline. This will be saved and sent when you reconnect.' : 'You’re offline. Connect before you confirm; nothing is saved offline.'),
          ]}
          confirmLabel="Record day end"
        />
      )}
    </div>
  )
}
