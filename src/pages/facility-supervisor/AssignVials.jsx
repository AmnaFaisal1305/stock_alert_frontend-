import { useRef, useState } from 'react'
import { CheckCircle2, WifiOff, Search, PackagePlus } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getVaccines, getUsers, getHoldings, assignVials } from '../../lib/api'
import { enqueue } from '../../lib/offlineQueue'
import { useAuth } from '../../context/AuthContext'
import Button from '../../components/ui/Button'
import DatePicker from '../../components/ui/DatePicker'
import SkeletonCard from '../../components/shared/SkeletonCard'
import PageHeader from '../../components/shared/PageHeader'
import { displayVaccineName } from '../../lib/vaccineNames'

const VACCINE_GROUPS = [
  ['Birth & Oral',  ['BCG', 'OPV (Polio)', 'Rota']],
  ['Injectables',   ['IPV', 'Pneumococcal']],
  ['Pentavalent',   ['D (Pentavalent)', 'T (Pentavalent)', 'P (Pentavalent)', 'Hep B (Pentavalent)', 'Hib (Pentavalent)']],
  ['MR',            ['Measles (MR)', 'Rubella (MR)']],
  ['Other',         ['TCV', 'T (TD)', 'D (TD)', 'HPV']],
]

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

function todayStr() { return new Date().toISOString().slice(0, 10) }
function minDateStr() {
  const d = new Date()
  d.setDate(d.getDate() - 3)
  return d.toISOString().slice(0, 10)
}

export default function AssignVials() {
  const { user }      = useAuth()
  const queryClient   = useQueryClient()
  const clientRef     = useRef(crypto.randomUUID())

  const [workerId,     setWorkerId]     = useState('')
  const [workerSearch, setWorkerSearch] = useState('')
  const [occurredOn,   setOccurredOn]   = useState(todayStr())
  const [vialInputs,   setVialInputs]   = useState({})
  const [rowErrors,    setRowErrors]    = useState({})
  const [globalError,  setGlobalError]  = useState('')
  const [done,         setDone]         = useState(false)
  const [savedOffline, setSavedOffline] = useState(false)

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
    onError(err) {
      if (err.status === 400 && err.body?.vaccineId) {
        setRowErrors(prev => ({ ...prev, [err.body.vaccineId]: `Only ${err.body.available} vials available` }))
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

  const totalVials   = Object.values(vialInputs).reduce((s, v) => s + (parseInt(v, 10) || 0), 0)
  const summaryChips = vaccines
    .filter(v => (parseInt(vialInputs[v.id], 10) || 0) > 0)
    .map(v => ({ name: displayVaccineName(v.name), count: parseInt(vialInputs[v.id], 10) }))

  function handleSubmit(e) {
    e.preventDefault()
    if (!workerId) { setGlobalError('Please select a worker.'); return }
    const items = vaccines
      .map(v => ({ vaccineId: v.id, vials: parseInt(vialInputs[v.id] ?? '0', 10) || 0 }))
      .filter(i => i.vials > 0)
    if (!items.length) { setGlobalError('Enter at least one vaccine quantity.'); return }
    setGlobalError(''); setRowErrors({})
    if (!navigator.onLine) {
      enqueue('assign', { clientRef: clientRef.current, occurredOn, workerId, items })
      setSavedOffline(true); return
    }
    mutation.mutate({ clientRef: clientRef.current, occurredOn, workerId, items })
  }

  function handleReset() {
    clientRef.current = crypto.randomUUID()
    setWorkerId(''); setOccurredOn(todayStr()); setVialInputs({})
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
        <p className="text-sm text-text-muted mt-1">Your assignment has been queued and will sync automatically when you reconnect.</p>
      </div>
      <Button variant="outline" onClick={handleReset}>Assign Again</Button>
    </div>
  )

  if (done) return (
    <div className="max-w-2xl mx-auto pt-12 px-4 flex flex-col items-center gap-6 text-center">
      <div className="w-16 h-16 rounded-full bg-success-bg flex items-center justify-center">
        <CheckCircle2 size={32} className="text-success" />
      </div>
      <div>
        <h2 className="text-lg font-bold text-text">Vials Assigned</h2>
        <p className="text-sm text-text-muted mt-1">The worker's holdings have been updated.</p>
      </div>
      <Button variant="outline" onClick={handleReset}>Assign Again</Button>
    </div>
  )

  const groups = groupVaccines(vaccines)

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-6">
      <PageHeader
        breadcrumb="Facility Supervisor"
        title="Assign Vials"
        subtitle="Assign morning vials to a facility worker"
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
                    onClick={() => { setWorkerId(w.id); setGlobalError('') }}
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

          {/* Right: vaccine assignment */}
          {!workerId ? (
            <div className="bg-surface border border-surface-border rounded-[18px] flex flex-col items-center justify-center gap-3 py-24 text-center">
              <PackagePlus size={32} className="text-text-muted/30" />
              <p className="text-sm font-semibold text-text">Choose a worker to begin</p>
              <p className="text-xs text-text-muted">Then set how many vials of each vaccine they take out today.</p>
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
                    <p className="text-xs text-text-muted">2. Set vial quantities</p>
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

              {/* Vaccine groups */}
              {groups.map(([groupName, groupVaccines]) => (
                <div key={groupName} className="px-6 py-5 border-b border-surface-border">
                  <p className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3">{groupName}</p>
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3">
                    {groupVaccines.map(v => {
                      const val       = parseInt(vialInputs[v.id] ?? '0', 10) || 0
                      const available = storeMap.get(v.id)
                      const err       = rowErrors[v.id]
                      const active    = val > 0
                      return (
                        <div
                          key={v.id}
                          className={`border rounded-[14px] p-3 flex flex-col gap-2.5 transition-all ${
                            active ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'border-surface-border'
                          }`}
                        >
                          <p className="text-sm font-semibold text-text leading-tight" dir="rtl">
                            {displayVaccineName(v.name)}
                          </p>
                          {available != null && (
                            <p className="text-xs text-text-muted">Store: {available} vials</p>
                          )}
                          {err && <p className="text-xs text-danger">{err}</p>}
                          <div className="grid grid-cols-[36px_1fr_36px] gap-1.5">
                            <button
                              type="button"
                              onClick={() => step(v.id, -1)}
                              className="border border-surface-border bg-surface rounded-[10px] text-lg font-medium text-text hover:bg-surface-chip transition-all cursor-pointer"
                            >−</button>
                            <input
                              type="number"
                              min="0"
                              value={vialInputs[v.id] ?? '0'}
                              onChange={e => setVials(v.id, e.target.value)}
                              className="text-center border border-surface-border rounded-xl px-1 py-2 text-sm bg-surface text-text focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all"
                            />
                            <button
                              type="button"
                              onClick={() => step(v.id, 1)}
                              className="border border-surface-border bg-surface rounded-[10px] text-lg font-medium text-text hover:bg-surface-chip transition-all cursor-pointer"
                            >+</button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}

              {/* Footer */}
              <div className="flex items-center justify-between gap-4 px-6 py-4 bg-surface-alt flex-wrap">
                <div className="flex items-center gap-5">
                  <div>
                    <span className="text-xl font-bold text-text">{totalVials}</span>
                    <span className="text-xs text-text-muted ml-1.5">Total vials</span>
                  </div>
                  <div className="flex gap-1.5 flex-wrap max-w-xs">
                    {summaryChips.map(c => (
                      <span key={c.name} className="bg-surface border border-surface-border rounded-full px-2.5 py-1 text-xs text-text" dir="rtl">
                        {c.name}: {c.count}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {globalError && <p className="text-sm text-danger">{globalError}</p>}
                  <Button type="submit" disabled={totalVials === 0 || mutation.isPending}>
                    {mutation.isPending ? 'Assigning…' : 'Assign Vials'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </form>
    </div>
  )
}
