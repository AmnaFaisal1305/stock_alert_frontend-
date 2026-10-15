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

  const totalVials = Object.values(vialInputs).reduce((s, v) => s + (parseInt(v, 10) || 0), 0)

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
    <div className="h-full flex flex-col">

      {/* Header row: title left, date right */}
      <div className="flex items-end justify-between gap-4 mb-6 flex-none flex-wrap">
        <PageHeader
          breadcrumb="Facility Supervisor"
          title="Assign Vials"
          subtitle="Assign morning vials to a facility worker"
        />
        <DatePicker
          id="occurredOn"
          value={occurredOn}
          onChange={e => setOccurredOn(e.target.value)}
          min={minDateStr()}
          max={todayStr()}
          className="w-44"
        />
      </div>

      <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col">
        <div className="grid grid-cols-[300px_1fr] gap-6 flex-1 min-h-0 items-stretch">

          {/* Worker picker */}
          <div className="bg-surface border border-surface-border rounded-[18px] p-5 flex flex-col gap-3 self-start">
            <p className="text-xs font-bold tracking-widest uppercase text-text-muted">1 · Select worker</p>
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
                    className={`flex items-center gap-3 p-3 rounded-[14px] border-2 text-left transition-all cursor-pointer ${
                      active ? 'bg-primary/5 border-primary' : 'border-transparent hover:bg-surface-alt'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-xl bg-epi-dark text-white flex items-center justify-center font-bold text-sm flex-none">
                      {label[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-text capitalize truncate">{label}</p>
                      <p className="text-xs text-text-muted">Facility worker</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Vaccine panel */}
          {!workerId ? (
            <div className="bg-surface border border-surface-border rounded-[18px] flex flex-col items-center justify-center gap-3 text-center">
              <PackagePlus size={32} className="text-text-muted/30" />
              <p className="text-sm font-semibold text-text">Choose a worker to begin</p>
              <p className="text-xs text-text-muted">Then set how many vials of each vaccine they take out today.</p>
            </div>
          ) : (
            <div className="bg-surface border border-surface-border rounded-[18px] flex flex-col min-h-0">
              {/* Worker header */}
              <div className="flex items-center gap-3 px-5 py-4 border-b border-surface-border flex-none">
                <div className="w-10 h-10 rounded-xl bg-epi-dark text-white flex items-center justify-center font-bold text-sm flex-none">
                  {(selectedWorker?.name ?? selectedWorker?.email ?? '?')[0].toUpperCase()}
                </div>
                <div>
                  <p className="text-base font-bold text-text capitalize">{selectedWorker?.name ?? selectedWorker?.email}</p>
                  <p className="text-xs text-text-muted">2 · Set vial quantities</p>
                </div>
              </div>

              {/* Scrollable vaccine groups */}
              <div className="flex-1 overflow-y-auto px-5 py-5">
                {groups.map(([groupName, groupVaccines]) => (
                  <div key={groupName} className="mb-6 last:mb-0">
                    <p className="text-xs font-bold text-text-muted uppercase tracking-widest mb-3">{groupName}</p>
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(270px,1fr))] gap-3">
                      {groupVaccines.map(v => {
                        const val       = parseInt(vialInputs[v.id] ?? '0', 10) || 0
                        const available = storeMap.get(v.id)
                        const err       = rowErrors[v.id]
                        const active    = val > 0
                        return (
                          <div
                            key={v.id}
                            className={`flex justify-between items-center gap-3 border rounded-[14px] px-3.5 py-3 transition-all ${
                              active ? 'border-primary bg-primary/5' : 'border-surface-border bg-surface-alt'
                            }`}
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-text leading-tight">{displayVaccineName(v.name)}</p>
                              {VACCINE_SUBTITLES[v.name] && (
                                <p className="text-xs text-text-muted">{VACCINE_SUBTITLES[v.name]}</p>
                              )}
                              {available != null && (
                                <p className="text-xs text-text-muted">Store: {available} vials</p>
                              )}
                              {err && <p className="text-xs text-danger">{err}</p>}
                            </div>
                            <div className="flex items-center gap-1.5 flex-none">
                              <button
                                type="button"
                                onClick={() => step(v.id, -1)}
                                className="w-11 h-11 rounded-xl border border-surface-border bg-surface text-xl text-text hover:bg-epi-mint transition-all cursor-pointer flex items-center justify-center"
                              >−</button>
                              <input
                                type="number"
                                min="0"
                                value={vialInputs[v.id] ?? '0'}
                                onChange={e => setVials(v.id, e.target.value)}
                                className="w-14 h-11 text-center border border-surface-border rounded-xl font-bold text-base bg-surface text-text focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                              />
                              <button
                                type="button"
                                onClick={() => step(v.id, 1)}
                                className="w-11 h-11 rounded-xl border border-surface-border bg-surface text-xl text-text hover:bg-epi-mint transition-all cursor-pointer flex items-center justify-center"
                              >+</button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Bottom submit bar */}
        <div className="bg-epi-dark rounded-[18px] flex justify-between items-center px-6 py-[15px] mt-4 flex-none gap-4">
          <span className="text-sm" style={{ color: '#b7c6bd' }}>
            {selectedWorker
              ? <>Assigning to <strong className="text-white">{selectedWorker.name ?? selectedWorker.email}</strong> · <strong className="text-white">{totalVials}</strong> vials total</>
              : <span className="text-white/40">Select a worker to begin</span>
            }
          </span>
          <div className="flex items-center gap-3">
            {globalError && <p className="text-sm text-amber-300">{globalError}</p>}
            <button
              type="submit"
              disabled={totalVials === 0 || mutation.isPending}
              className="bg-[#6fcf97] text-[#0e2218] font-bold text-sm px-7 py-3 rounded-xl min-h-[44px] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
            >
              {mutation.isPending ? 'Assigning…' : 'Assign vials'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
