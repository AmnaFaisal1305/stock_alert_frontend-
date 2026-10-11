import { useRef, useState } from 'react'
import { PackagePlus, CheckCircle2 } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getVaccines, getUsers, getHoldings, assignVials } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
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

export default function AssignVials() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const clientRef = useRef(crypto.randomUUID())

  const [workerId,    setWorkerId]    = useState('')
  const [occurredOn,  setOccurredOn]  = useState(todayStr())
  const [vialInputs,  setVialInputs]  = useState({})   // vaccineId → string
  const [rowErrors,   setRowErrors]   = useState({})   // vaccineId → string
  const [globalError, setGlobalError] = useState('')
  const [done,        setDone]        = useState(false)

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
    mutationFn: assignVials,
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
          [err.body.vaccineId]: `Only ${err.body.available} vials available`,
        }))
      } else {
        setGlobalError(err.message ?? 'Submission failed. Please try again.')
      }
    },
  })

  const vaccines   = vaccineData?.vaccines ?? []
  const workers    = (usersData?.users ?? []).filter((u) => u.role === 'facility_worker' && u.isActive)
  const storeMap   = new Map(
    (holdingsData?.holdings ?? [])
      .filter((h) => h.facilityId === user?.facilityId && !h.workerId)
      .map((h) => [h.vaccineId, h.remaining])
  )

  const workerOptions = workers.map((w) => ({ value: w.id, label: w.name ?? w.email }))

  function setVials(vaccineId, val) {
    setVialInputs((prev) => ({ ...prev, [vaccineId]: val }))
    setRowErrors((prev) => { const n = { ...prev }; delete n[vaccineId]; return n })
    setGlobalError('')
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!workerId) { setGlobalError('Please select a worker.'); return }

    const items = vaccines
      .map((v) => ({ vaccineId: v.id, vials: parseInt(vialInputs[v.id] ?? '0', 10) || 0 }))
      .filter((i) => i.vials > 0)

    if (items.length === 0) { setGlobalError('Enter at least one vaccine quantity.'); return }

    setGlobalError('')
    setRowErrors({})
    mutation.mutate({ clientRef: clientRef.current, occurredOn, workerId, items })
  }

  function handleReset() {
    clientRef.current = crypto.randomUUID()
    setWorkerId('')
    setOccurredOn(todayStr())
    setVialInputs({})
    setRowErrors({})
    setGlobalError('')
    setDone(false)
  }

  if (loadingVaccines || loadingUsers) return (
    <div className="max-w-2xl mx-auto pt-6 px-1 flex flex-col gap-4">
      {[...Array(3)].map((_, i) => <SkeletonCard key={i} />)}
    </div>
  )

  if (done) return (
    <div className="max-w-2xl mx-auto pt-12 px-4 flex flex-col items-center gap-6 text-center">
      <div className="w-16 h-16 rounded-full bg-success-bg flex items-center justify-center">
        <CheckCircle2 size={32} className="text-success" />
      </div>
      <div>
        <h2 className="text-lg font-bold text-text">Vials Assigned</h2>
        <p className="text-sm text-text-muted mt-1">
          The worker's holdings have been updated.
        </p>
      </div>
      <Button variant="outline" onClick={handleReset}>Assign Again</Button>
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto pt-6 px-1 flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-text tracking-tight flex items-center gap-2">
          <PackagePlus size={20} className="text-primary" />
          Assign Vials
        </h1>
        <p className="text-sm text-text-muted mt-0.5">Assign morning vials to a facility worker</p>
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

        <div className="bg-white rounded-2xl border border-surface-border shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-surface-border bg-surface-alt">
            <p className="text-xs font-bold text-text-muted uppercase tracking-wider">Vaccine Quantities (vials)</p>
          </div>

          <div className="divide-y divide-surface-border">
            {vaccines.map((v) => {
              const available = storeMap.get(v.id)
              const err       = rowErrors[v.id]
              return (
                <div key={v.id} className="px-5 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-text leading-tight" dir="rtl">
                      {displayVaccineName(v.name)}
                    </p>
                    {available != null && (
                      <p className="text-xs text-text-muted mt-0.5">Store: {available} vials</p>
                    )}
                    {err && <p className="text-xs text-danger mt-0.5">{err}</p>}
                  </div>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="0"
                    value={vialInputs[v.id] ?? ''}
                    onChange={(e) => setVials(v.id, e.target.value)}
                    className="w-20 text-center"
                  />
                </div>
              )
            })}
          </div>
        </div>

        {globalError && (
          <p className="text-sm text-danger font-medium px-1">{globalError}</p>
        )}

        <Button
          type="submit"
          className="w-full"
          disabled={mutation.isPending}
        >
          {mutation.isPending ? 'Assigning…' : 'Assign Vials'}
        </Button>
      </form>
    </div>
  )
}
