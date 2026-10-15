import { useRef, useState, useMemo } from 'react'
import { ClipboardList, CheckCircle2, WifiOff, Search } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getVaccines, getUsers, getHoldings, recordDayEnd } from '../../lib/api'
import { enqueue } from '../../lib/offlineQueue'
import Input from '../../components/ui/Input'
import Button from '../../components/ui/Button'
import DatePicker from '../../components/ui/DatePicker'
import SkeletonCard from '../../components/shared/SkeletonCard'
import PageHeader from '../../components/shared/PageHeader'
import { displayVaccineName } from '../../lib/vaccineNames'

function todayStr() { return new Date().toISOString().slice(0, 10) }
function minDateStr() {
  const d = new Date()
  d.setDate(d.getDate() - 3)
  return d.toISOString().slice(0, 10)
}

const ZERO = { used: '', returned: '', wasted: '' }

export default function DayEnd() {
  const queryClient = useQueryClient()
  const clientRef   = useRef(crypto.randomUUID())

  const [workerId,     setWorkerId]     = useState('')
  const [workerSearch, setWorkerSearch] = useState('')
  const [occurredOn,   setOccurredOn]   = useState(todayStr())
  const [inputs,       setInputs]       = useState({})
  const [rowErrors,    setRowErrors]    = useState({})
  const [globalError,  setGlobalError]  = useState('')
  const [done,         setDone]         = useState(false)
  const [savedOffline, setSavedOffline] = useState(false)

  const { data: vaccineData, isLoading: loadingVaccines } = useQuery({ queryKey: ['vaccines'], queryFn: getVaccines })
  const { data: usersData,   isLoading: loadingUsers }   = useQuery({ queryKey: ['users'],    queryFn: getUsers })
  const { data: holdingsData }                            = useQuery({ queryKey: ['holdings'], queryFn: getHoldings })

  const mutation = useMutation({
    mutationFn: recordDayEnd,
    onSuccess() {
      queryClient.invalidateQueries({ queryKey: ['holdings'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['audit-log'] })
      setDone(true)
    },
    onError(err) {
      if (err.status === 400 && err.body?.vaccineId) {
        setRowErrors(prev => ({ ...prev, [err.body.vaccineId]: `Sum must equal ${err.body.remaining} remaining vials` }))
      } else {
        setGlobalError(err.message ?? 'Submission failed. Please try again.')
      }
    },
  })

  const vaccines = vaccineData?.vaccines ?? []
  const workers  = (usersData?.users ?? []).filter(u => u.role === 'facility_worker' && u.isActive)
  const filteredWorkers = workers.filter(w =>
    (w.name ?? w.email).toLowerCase().includes(workerSearch.toLowerCase())
  )
  const selectedWorker = workers.find(w => w.id === workerId)

  const holdingsByVaccine = useMemo(() => {
    if (!workerId || !holdingsData) return {}
    return Object.fromEntries(
      (holdingsData.holdings ?? [])
        .filter(h => h.workerId === workerId)
        .map(h => [h.vaccineId, h])
    )
  }, [workerId, holdingsData])

  const assignedVaccines = vaccines.filter(v => holdingsByVaccine[v.id] != null)

  function getRow(vaccineId) { return inputs[vaccineId] ?? ZERO }

  function setField(vaccineId, field, val) {
    setInputs(prev => ({ ...prev, [vaccineId]: { ...getRow(vaccineId), [field]: val } }))
    setRowErrors(prev => { const n = { ...prev }; delete n[vaccineId]; return n })
    setGlobalError('')
  }

  function validateRows() {
    const errs = {}
    for (const v of assignedVaccines) {
      const h   = holdingsByVaccine[v.id]
      const row = getRow(v.id)
      const sum = parseInt(row.used || '0', 10) + parseInt(row.returned || '0', 10) + parseInt(row.wasted || '0', 10)
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
        usedVials:     parseInt(row.used     || '0', 10),
        returnedVials: parseInt(row.returned || '0', 10),
        wastedVials:   parseInt(row.wasted   || '0', 10),
      }
    })
    setGlobalError('')
    if (!navigator.onLine) {
      enqueue('dayend', { clientRef: clientRef.current, occurredOn, workerId, items })
      setSavedOffline(true); return
    }
    mutation.mutate({ clientRef: clientRef.current, occurredOn, workerId, items })
  }

  function handleReset() {
    clientRef.current = crypto.randomUUID()
    setWorkerId(''); setOccurredOn(todayStr()); setInputs({})
    setRowErrors({}); setGlobalError(''); setDone(false); setSavedOffline(false)
  }

  if (loadingVaccines || loadingUsers) return (
    <div className="max-w-5xl mx-auto flex flex-col gap-4">
      {[...Array(3)].map((_, i) => <SkeletonCard key={i} />)}
    </div>
  )

  if (savedOffline) return (
    <div className="max-w-2xl mx-auto pt-12 px-4 flex flex-col items-center gap-6 text-center">
      <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center">
        <WifiOff size={32} className="text-amber-500" />
      </div>
      <div>
        <h2 className="text-lg font-bold text-text">Saved Offline</h2>
        <p className="text-sm text-text-muted mt-1">Your day end has been queued and will sync automatically when you reconnect.</p>
      </div>
      <Button variant="outline" onClick={handleReset}>Record Another</Button>
    </div>
  )

  if (done) return (
    <div className="max-w-2xl mx-auto pt-12 px-4 flex flex-col items-center gap-6 text-center">
      <div className="w-16 h-16 rounded-full bg-success-bg flex items-center justify-center">
        <CheckCircle2 size={32} className="text-success" />
      </div>
      <div>
        <h2 className="text-lg font-bold text-text">Day End Recorded</h2>
        <p className="text-sm text-text-muted mt-1">Holdings have been updated and the ledger closed.</p>
      </div>
      <Button variant="outline" onClick={handleReset}>Record Another</Button>
    </div>
  )

  const totalUsed     = assignedVaccines.reduce((s, v) => s + (parseInt(getRow(v.id).used     || '0', 10)), 0)
  const totalReturned = assignedVaccines.reduce((s, v) => s + (parseInt(getRow(v.id).returned || '0', 10)), 0)
  const totalWasted   = assignedVaccines.reduce((s, v) => s + (parseInt(getRow(v.id).wasted   || '0', 10)), 0)

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-6">
      <PageHeader
        breadcrumb="Facility Supervisor"
        title="Day End"
        subtitle="Record end-of-day vial usage for a worker"
      />

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-[280px_1fr] gap-6 items-start">

          {/* Left: worker picker */}
          <div className="bg-surface border border-surface-border rounded-[18px] p-4 flex flex-col gap-3 sticky top-[88px]">
            <h3 className="text-sm font-semibold text-text">1. Select worker</h3>
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
              <input
                value={workerSearch}
                onChange={e => setWorkerSearch(e.target.value)}
                placeholder="Search workers…"
                className="w-full pl-8 pr-3 py-2.5 rounded-xl border border-surface-border bg-surface text-sm text-text focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all"
              />
            </div>
            <div className="flex flex-col gap-1">
              {filteredWorkers.length === 0 && (
                <p className="text-xs text-text-muted px-2 py-2">No workers found</p>
              )}
              {filteredWorkers.map(w => {
                const label  = w.name ?? w.email
                const active = w.id === workerId
                return (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => { setWorkerId(w.id); setInputs({}); setRowErrors({}); setGlobalError('') }}
                    className={`flex items-center gap-3 p-3 rounded-[14px] border text-left transition-all cursor-pointer ${
                      active ? 'bg-primary/5 border-primary' : 'border-transparent hover:bg-surface-alt'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center font-bold text-sm flex-none">
                      {label[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-text capitalize truncate">{label}</p>
                      <p className="text-xs text-text-muted">Facility worker</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Right: usage table */}
          {!workerId ? (
            <div className="bg-surface border border-surface-border rounded-[18px] flex flex-col items-center justify-center gap-3 py-24 text-center">
              <ClipboardList size={32} className="text-text-muted/30" />
              <p className="text-sm font-semibold text-text">Choose a worker to begin</p>
              <p className="text-xs text-text-muted">Their vaccines will appear here so you can enter used, returned and wasted vials.</p>
            </div>
          ) : (
            <div className="bg-surface border border-surface-border rounded-[18px] overflow-hidden">
              {/* Card header */}
              <div className="flex items-center justify-between gap-4 px-6 py-5 border-b border-surface-border bg-surface-alt flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center font-bold text-sm flex-none">
                    {(selectedWorker?.name ?? selectedWorker?.email ?? '?')[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="text-base font-bold text-text capitalize">{selectedWorker?.name ?? selectedWorker?.email}</p>
                    <p className="text-xs text-text-muted">2. Enter usage</p>
                  </div>
                </div>
                <DatePicker
                  id="occurredOn"
                  value={occurredOn}
                  onChange={e => setOccurredOn(e.target.value)}
                  min={minDateStr()}
                  max={todayStr()}
                  className="w-44"
                />
              </div>

              {assignedVaccines.length === 0 ? (
                <div className="px-6 py-12 text-center">
                  <p className="text-sm text-text-muted">This worker has no vials assigned today.</p>
                </div>
              ) : (
                <>
                  {/* Table header */}
                  <div className="grid grid-cols-[1fr_6rem_5rem_6rem_5rem] gap-3 px-6 py-3 bg-surface-alt border-b border-surface-border text-xs font-bold text-text-muted uppercase tracking-wider">
                    <span>Vaccine</span>
                    <span className="text-center">Held</span>
                    <span className="text-center">Used</span>
                    <span className="text-center">Returned</span>
                    <span className="text-center">Wasted</span>
                  </div>

                  <div className="divide-y divide-surface-border">
                    {assignedVaccines.map(v => {
                      const h   = holdingsByVaccine[v.id]
                      const row = getRow(v.id)
                      const sum = parseInt(row.used || '0', 10) + parseInt(row.returned || '0', 10) + parseInt(row.wasted || '0', 10)
                      const err = rowErrors[v.id]
                      return (
                        <div key={v.id} className={`flex flex-col gap-1 px-6 py-3 ${err ? 'bg-danger-bg/20' : ''}`}>
                          <div className="grid grid-cols-[1fr_6rem_5rem_6rem_5rem] gap-3 items-center">
                            <p className="text-sm font-semibold text-text leading-tight" dir="rtl">
                              {displayVaccineName(v.name)}
                            </p>
                            <div className="bg-success-bg text-success-dark rounded-lg px-2 py-1.5 text-center text-sm font-bold">
                              {h.remaining}v
                            </div>
                            {(['used', 'returned', 'wasted']).map(field => (
                              <Input
                                key={field}
                                type="number"
                                min="0"
                                step="1"
                                placeholder="0"
                                value={row[field]}
                                onChange={e => setField(v.id, field, e.target.value)}
                                className="w-full text-center px-1"
                              />
                            ))}
                          </div>
                          {err && <p className="text-xs text-danger">{err}</p>}
                          {!err && sum > h.remaining && (
                            <p className="text-xs text-danger">Total ({sum}) exceeds {h.remaining} vials held.</p>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between gap-4 px-6 py-4 bg-surface-alt border-t border-surface-border flex-wrap">
                    <div className="flex gap-6">
                      <div><span className="text-xl font-bold text-text">{totalUsed}</span><span className="text-xs text-text-muted ml-1.5">Used</span></div>
                      <div><span className="text-xl font-bold text-text">{totalReturned}</span><span className="text-xs text-text-muted ml-1.5">Returned</span></div>
                      <div><span className="text-xl font-bold text-text">{totalWasted}</span><span className="text-xs text-text-muted ml-1.5">Wasted</span></div>
                    </div>
                    <div className="flex items-center gap-3">
                      {globalError && <p className="text-sm text-danger">{globalError}</p>}
                      <Button
                        type="submit"
                        disabled={mutation.isPending || assignedVaccines.length === 0}
                      >
                        {mutation.isPending ? 'Recording…' : 'Record Day End'}
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </form>
    </div>
  )
}
