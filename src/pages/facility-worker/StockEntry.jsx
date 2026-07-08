import { useState } from 'react'
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, PackageMinus } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getVaccines, getDashboard, createStockEntry } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import Select from '../../components/ui/Select'
import Input from '../../components/ui/Input'
import Button from '../../components/ui/Button'
import StatusBadge from '../../components/shared/StatusBadge'
import { statusConfig } from '../../lib/status'

const STEP_LABELS = ['Select', 'Record']

function StepIndicator({ step, total }) {
  return (
    <div className="flex items-center justify-center gap-1 mb-7">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className="flex items-center gap-1">
          <div className="flex flex-col items-center gap-1.5">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-200 ${
                i + 1 < step   ? 'bg-primary text-white' :
                i + 1 === step ? 'bg-primary text-white ring-4 ring-primary/20' :
                                 'bg-surface-alt text-text-muted border border-surface-border'
              }`}
            >
              {i + 1 < step ? '✓' : i + 1}
            </div>
            <span className={`text-[10px] font-semibold uppercase tracking-wide ${i + 1 === step ? 'text-primary' : 'text-text-muted'}`}>
              {STEP_LABELS[i]}
            </span>
          </div>
          {i < total - 1 && (
            <div className={`w-10 h-0.5 mb-4 transition-colors duration-300 ${i + 1 < step ? 'bg-primary' : 'bg-surface-border'}`} />
          )}
        </div>
      ))}
    </div>
  )
}

export default function StockEntry() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const [step, setStep]           = useState(1)
  const [vaccineId, setVaccineId] = useState('')
  const [quantity, setQuantity]   = useState('')
  const [done, setDone]           = useState(false)

  const { data: vaccineData }   = useQuery({ queryKey: ['vaccines'],  queryFn: getVaccines })
  const { data: dashboardData } = useQuery({ queryKey: ['dashboard'], queryFn: getDashboard })

  const vaccineOptions = (vaccineData?.vaccines ?? []).map((v) => ({ value: v.id, label: v.name }))

  const stockByVaccineId = new Map(
    (dashboardData?.facilities ?? [])
      .filter((r) => r.facilityId === user?.facilityId)
      .map((r) => [r.vaccineId, r])
  )

  const selectedVaccine = vaccineData?.vaccines?.find((v) => v.id === vaccineId)
  const currentStock    = vaccineId ? stockByVaccineId.get(vaccineId) : null
  const currentQty      = currentStock?.quantity ?? 0
  const useQty          = parseInt(quantity, 10) || 0
  const remaining       = currentQty - useQty
  const wouldGoNegative = useQty > currentQty
  const status          = currentStock ? currentStock.status : null
  const pct             = currentStock?.minQuantity > 0
    ? Math.min(Math.round((currentQty / currentStock.minQuantity) * 100), 100)
    : 100
  const barColor = statusConfig(status).dot

  const mutation = useMutation({
    mutationFn: () => createStockEntry(vaccineId, useQty),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      setDone(true)
    },
  })

  const insufficientAvailable =
    mutation.error?.status === 400 && mutation.error?.body?.available != null
      ? mutation.error.body.available
      : null

  function reset() {
    setStep(1); setVaccineId(''); setQuantity(''); setDone(false); mutation.reset()
  }

  if (done) {
    return (
      <div className="max-w-sm mx-auto pt-4">
        <div className="bg-surface rounded-xl border border-surface-border p-8 flex flex-col items-center gap-4 text-center">
          <div className="bg-success-bg p-4 rounded-full">
            <CheckCircle2 size={44} className="text-success" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-text">Stock Recorded</h2>
            <p className="text-sm text-text-muted mt-1">
              <span className="font-semibold text-text">{useQty} doses</span> of{' '}
              <span className="font-semibold text-text">{selectedVaccine?.name}</span> recorded.
            </p>
            <p className="text-xs text-text-muted mt-1">
              Remaining stock: <span className="font-semibold text-success">{remaining} doses</span>
            </p>
          </div>
          <Button variant="secondary" onClick={reset} className="mt-1">Record Another</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-sm mx-auto pt-4 flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold text-text">Stock Entry</h1>
        <p className="text-sm text-text-muted mt-0.5">Record vaccines used at your facility</p>
      </div>

      <div className="bg-surface rounded-xl border border-surface-border p-6">
        <StepIndicator step={step} total={2} />

        {step === 1 && (
          <div className="flex flex-col gap-5">
            <div>
              <p className="text-sm font-semibold text-text mb-1">Which vaccine was used?</p>
              <p className="text-xs text-text-muted mb-4">Select the vaccine from your facility's list.</p>
              <Select id="vaccine" label="Vaccine" options={vaccineOptions}
                value={vaccineId} onChange={(e) => { setVaccineId(e.target.value); setQuantity('') }} required />
            </div>

            {vaccineId && currentStock && (
              <div className="bg-surface-alt rounded-lg px-4 py-3 border border-surface-border flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-text-muted">Current stock</p>
                    <p className="text-xl font-bold text-text">{currentQty} <span className="text-sm font-normal text-text-muted">doses</span></p>
                  </div>
                  <StatusBadge status={status} />
                </div>
                <div className="h-2 rounded-full bg-surface-border overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
                </div>
                <span className="text-xs text-text-muted">{pct}% of minimum threshold</span>
              </div>
            )}

            {status === 'critical' && (
              <div className="bg-warning-bg border border-warning/20 rounded-lg px-3 py-2.5 flex items-center gap-2">
                <AlertTriangle size={14} className="text-warning flex-shrink-0" />
                <p className="text-xs text-warning-dark font-medium">Stock is critically low — proceed carefully</p>
              </div>
            )}

            <Button onClick={() => setStep(2)} disabled={!vaccineId} className="w-full">
              Continue <ChevronRight size={16} />
            </Button>
          </div>
        )}

        {step === 2 && (
          <form className="flex flex-col gap-5" onSubmit={(e) => { e.preventDefault(); mutation.mutate() }}>
            <div className="bg-surface-alt rounded-lg px-4 py-2.5 flex items-center justify-between border border-surface-border">
              <span className="text-sm font-semibold text-text">{selectedVaccine?.name}</span>
              <span className="text-xs text-text-muted">{currentQty} in stock</span>
            </div>

            <div>
              <p className="text-sm font-semibold text-text mb-1">How many doses were used?</p>
              <p className="text-xs text-text-muted mb-4">Enter the number of doses administered or consumed.</p>
              <Input id="quantity" label="Doses Used" type="number" inputMode="numeric" min="1"
                placeholder="e.g. 10"
                value={quantity} onChange={(e) => { setQuantity(e.target.value); mutation.reset() }} required />
            </div>

            {quantity && useQty > 0 && (
              <div className={`rounded-lg px-3 py-2.5 text-xs border ${
                wouldGoNegative
                  ? 'bg-danger-bg border-danger/20'
                  : 'bg-success-bg border-success/20'
              }`}>
                {wouldGoNegative ? (
                  <span className="font-medium text-danger">Not enough stock — only {currentQty} doses available</span>
                ) : (
                  <>
                    <span className="text-text-muted">Stock after entry: </span>
                    <span className="text-text">{currentQty} − {useQty} = </span>
                    <span className="font-bold text-success">{remaining} doses remaining</span>
                  </>
                )}
              </div>
            )}

            {mutation.isError && (
              <p className="text-xs text-danger bg-danger-bg rounded-lg px-3 py-2">
                {insufficientAvailable != null
                  ? `Only ${insufficientAvailable} doses left in stock.`
                  : mutation.error?.message}
              </p>
            )}

            <div className="flex gap-3 pt-1">
              <Button variant="secondary" type="button" onClick={() => { setStep(1); mutation.reset() }} className="flex-1">
                <ChevronLeft size={16} /> Back
              </Button>
              <Button type="submit" disabled={mutation.isPending || !quantity || useQty < 1 || wouldGoNegative} className="flex-1">
                <PackageMinus size={15} />
                {mutation.isPending ? 'Saving…' : 'Record'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
