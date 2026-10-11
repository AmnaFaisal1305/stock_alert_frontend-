import { useRef, useState, useMemo } from 'react'
import { ClipboardList, CheckCircle2, WifiOff } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getVaccines, getUsers, getHoldings, recordDayEnd } from '../../lib/api'
import { enqueue } from '../../lib/offlineQueue'
import Select from '../../components/ui/Select'
import Input from '../../components/ui/Input'
import Button from '../../components/ui/Button'
import DatePicker from '../../components/ui/DatePicker'
import SkeletonCard from '../../components/shared/SkeletonCard'
import { displayVaccineName } from '../../lib/vaccineNames'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function minDateStr() {
  const d = new Date()
  d.setDate(d.getDate() - 3)
  return d.toISOString().slice(0, 10)
}

const ZERO = { used: '', returned: '', wasted: '' }

export default function DayEnd() {
  const queryClient = useQueryClient()
  const clientRef   = useRef(crypto.randomUUID())

  const [workerId,    setWorkerId]    = useState('')
  const [occurredOn,  setOccurredOn]  = useState(todayStr())
  const [inputs,      setInputs]      = useState({})   // vaccineId → {used,returned,wasted}
  const [rowErrors,   setRowErrors]   = useState({})
  const [globalError, setGlobalError] = useState('')
  const [done,        setDone]        = useState(false)
  const [savedOffline, setSavedOffline] = useState(false)

  const { data: vaccineData, isLoading: loadingVaccines } = useQuery({
    queryKey: ['vaccines'],
    queryFn:  getVaccines,
  })

  const { data: usersData, isLoading: loadingUsers } = useQuery({
    queryKey: ['users'],
    queryFn:  getUsers,
  })

  const { data: holdingsData } = useQuery({
    queryKey: ['holdings'],
    queryFn:  getHoldings,
  })

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
        setRowErrors((prev) => ({
          ...prev,
          [err.body.vaccineId]: `Sum must equal ${err.body.remaining} remaining vials`,
        }))
      } else {
        setGlobalError(err.message ?? 'Submission failed. Please try again.')
      }
    },
  })

  const vaccines       = vaccineData?.vaccines ?? []
  const workers        = (usersData?.users ?? []).filter((u) => u.role === 'facility_worker' && u.isActive)
  const workerOptions  = workers.map((w) => ({ value: w.id, label: w.name ?? w.email }))

  const holdingsByVaccine = useMemo(() => {
    if (!workerId || !holdingsData) return {}
    return Object.fromEntries(
      (holdingsData.holdings ?? [])
        .filter((h) => h.workerId === workerId)
        .map((h) => [h.vaccineId, h])
    )
  }, [workerId, holdingsData])

  const assignedVaccines = vaccines.filter((v) => holdingsByVaccine[v.id] != null)

  function getRow(vaccineId) {
    return inputs[vaccineId] ?? ZERO
  }

  function setField(vaccineId, field, val) {
    setInputs((prev) => ({ ...prev, [vaccineId]: { ...getRow(vaccineId), [field]: val } }))
    setRowErrors((prev) => { const n = { ...prev }; delete n[vaccineId]; return n })
    setGlobalError('')
  }

  function validateRows() {
    const errs = {}
    for (const v of assignedVaccines) {
      const h        = holdingsByVaccine[v.id]
      const row      = getRow(v.id)
      const used     = parseInt(row.used     || '0', 10)
      const returned = parseInt(row.returned || '0', 10)
      const wasted   = parseInt(row.wasted   || '0', 10)
      if (used + returned + wasted !== h.remaining) {
        errs[v.id] = `Must equal ${h.remaining} remaining (got ${used + returned + wasted})`
      }
    }
    return errs
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!workerId) { setGlobalError('Please select a worker.'); return }
    if (assignedVaccines.length === 0) { setGlobalError('Selected worker has no holdings to record.'); return }

    const errs = validateRows()
    if (Object.keys(errs).length) { setRowErrors(errs); return }

    const items = assignedVaccines.map((v) => {
      const row = getRow(v.id)
      return {
        vaccineId:    v.id,
        usedVials:    parseInt(row.used     || '0', 10),
        returnedVials: parseInt(row.returned || '0', 10),
        wastedVials:  parseInt(row.wasted   || '0', 10),
      }
    })

    setGlobalError('')

    if (!navigator.onLine) {
      enqueue('dayend', { clientRef: clientRef.current, occurredOn, workerId, items })
      setSavedOffline(true)
      return
    }

    mutation.mutate({ clientRef: clientRef.current, occurredOn, workerId, items })
  }

  function handleReset() {
    clientRef.current = crypto.randomUUID()
    setWorkerId('')
    setOccurredOn(todayStr())
    setInputs({})
    setRowErrors({})
    setGlobalError('')
    setDone(false)
    setSavedOffline(false)
  }

  if (loadingVaccines || loadingUsers) return (
    <div className="max-w-2xl mx-auto pt-6 px-1 flex flex-col gap-4">
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
        <p className="text-sm text-text-muted mt-1">
          Your day end has been queued and will sync automatically when you reconnect.
        </p>
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
        <p className="text-sm text-text-muted mt-1">
          Holdings have been updated and the ledger closed.
        </p>
      </div>
      <Button variant="outline" onClick={handleReset}>Record Another</Button>
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto pt-6 px-1 flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-text tracking-tight flex items-center gap-2">
          <ClipboardList size={20} className="text-primary" />
          Day End
        </h1>
        <p className="text-sm text-text-muted mt-0.5">Record end-of-day vial usage for a worker</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="bg-white rounded-2xl border border-surface-border shadow-sm p-5 flex flex-col gap-4">
          <Select
            id="worker"
            label="Worker"
            value={workerId}
            onChange={(e) => { setWorkerId(e.target.value); setGlobalError('') }}
            options={[{ value: '', label: 'Select worker…' }, ...workerOptions]}
          />
          <DatePicker
            id="occurredOn"
            label="Date"
            value={occurredOn}
            onChange={(e) => setOccurredOn(e.target.value)}
            min={minDateStr()}
            max={todayStr()}
          />
        </div>

        {workerId && assignedVaccines.length === 0 && (
          <p className="text-sm text-text-muted px-1">This worker has no vials assigned today.</p>
        )}

        {assignedVaccines.length > 0 && (
          <div className="bg-white rounded-2xl border border-surface-border shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-surface-border bg-surface-alt">
              <div className="grid grid-cols-[1fr_64px_64px_64px] gap-2 text-xs font-bold text-text-muted uppercase tracking-wider">
                <span>Vaccine</span>
                <span className="text-center">Used</span>
                <span className="text-center">Ret.</span>
                <span className="text-center">Wasted</span>
              </div>
            </div>

            <div className="divide-y divide-surface-border">
              {assignedVaccines.map((v) => {
                const h   = holdingsByVaccine[v.id]
                const row = getRow(v.id)
                const err = rowErrors[v.id]
                return (
                  <div key={v.id} className="px-5 py-3 flex flex-col gap-1">
                    <div className="grid grid-cols-[1fr_64px_64px_64px] gap-2 items-center">
                      <div>
                        <p className="text-sm font-semibold text-text leading-tight" dir="rtl">
                          {displayVaccineName(v.name)}
                        </p>
                        <p className="text-xs text-text-muted">Remaining: {h.remaining} vials</p>
                      </div>
                      {['used', 'returned', 'wasted'].map((field) => (
                        <Input
                          key={field}
                          type="number"
                          min="0"
                          step="1"
                          placeholder="0"
                          value={row[field]}
                          onChange={(e) => setField(v.id, field, e.target.value)}
                          className="w-full text-center px-1"
                        />
                      ))}
                    </div>
                    {err && <p className="text-xs text-danger">{err}</p>}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {globalError && (
          <p className="text-sm text-danger font-medium px-1">{globalError}</p>
        )}

        <Button
          type="submit"
          className="w-full"
          disabled={mutation.isPending || !workerId || assignedVaccines.length === 0}
        >
          {mutation.isPending ? 'Recording…' : 'Record Day End'}
        </Button>
      </form>
    </div>
  )
}
