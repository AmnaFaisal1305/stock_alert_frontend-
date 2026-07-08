import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PackageCheck, CheckCircle2, ChevronRight, ChevronLeft, Minus, Plus, LayoutDashboard } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getVaccines, getDashboard, createStockEntry } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import Select from '../../components/ui/Select'
import Input from '../../components/ui/Input'
import Button from '../../components/ui/Button'
import StatusBadge from '../../components/shared/StatusBadge'

const STEP_LABELS = ['Select Vaccine', 'Enter Quantity', 'Confirm Entry']

// ─── Ring Gauge ───────────────────────────────────────────────────────────────
function RingGauge({ pct, status, size = 80 }) {
  const r = (size / 2) - 8
  const circ = 2 * Math.PI * r
  const fillColor = status === 'red' ? '#DC2626' : status === 'amber' ? '#D97706' : '#16A34A'
  return (
    <div className="relative flex items-center justify-center flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E5E7EB" strokeWidth={6} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={fillColor} strokeWidth={6}
          strokeDasharray={`${(pct / 100) * circ} ${circ}`} strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.5s ease' }}
        />
      </svg>
      <span className="absolute text-xs font-bold text-text">{pct}%</span>
    </div>
  )
}

// ─── Step Indicator ───────────────────────────────────────────────────────────
function StepIndicator({ step, total }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className="flex items-center">
          <div className="flex flex-col items-center gap-1.5">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-200 ${
                i + 1 < step   ? 'bg-primary text-white shadow-sm' :
                i + 1 === step ? 'bg-primary text-white ring-4 ring-primary/20 shadow-sm' :
                                 'bg-surface-alt text-text-muted border border-surface-border'
              }`}
            >
              {i + 1 < step ? <CheckCircle2 size={14} /> : i + 1}
            </div>
            <span className={`text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap ${
              i + 1 === step ? 'text-primary' : 'text-text-muted'
            }`}>
              {STEP_LABELS[i]}
            </span>
          </div>
          {i < total - 1 && (
            <div className={`w-12 h-0.5 mb-5 mx-1 transition-colors duration-300 ${i + 1 < step ? 'bg-primary' : 'bg-surface-border'}`} />
          )}
        </div>
      ))}
    </div>
  )
}

export default function RecordStock() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const [step, setStep]           = useState(1)
  const [vaccineId, setVaccineId] = useState('')
  const [quantity, setQuantity]   = useState('')
  const [done, setDone]           = useState(false)
  const [result, setResult]       = useState(null)

  const { data: vaccineData }   = useQuery({ queryKey: ['vaccines'],  queryFn: getVaccines  })
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
  const addQty          = parseInt(quantity, 10) || 0
  const newTotal        = currentQty + addQty
  const status          = currentStock ? (currentStock.status === 'no_data' ? 'amber' : currentStock.status) : null
  const pct             = currentStock && currentStock.minQuantity > 0
    ? Math.min(Math.round((currentQty / currentStock.minQuantity) * 100), 100)
    : 100

  const mutation = useMutation({
    mutationFn: () => createStockEntry(vaccineId, parseInt(quantity, 10)),
    onSuccess: () => {
      setResult({ vaccineName: selectedVaccine?.name, addedQty: addQty, newTotal })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      setDone(true)
    },
  })

  function reset() {
    setStep(1); setVaccineId(''); setQuantity(''); setDone(false); setResult(null); mutation.reset()
  }

  function adjustQty(delta) {
    const cur = parseInt(quantity, 10) || 0
    const next = Math.max(1, cur + delta)
    setQuantity(String(next))
  }

  if (done) {
    return (
      <div className="max-w-md">
        <div className="bg-surface rounded-2xl border border-surface-border p-10 flex flex-col items-center gap-5 text-center shadow-sm">
          <div className="relative">
            <div className="bg-success-bg p-5 rounded-full">
              <CheckCircle2 size={48} className="text-success" />
            </div>
            <span className="absolute inset-0 rounded-full bg-success/10 animate-ping" style={{ animationDuration: '1.5s' }} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-text">Stock Recorded!</h2>
            <p className="text-sm text-text-muted mt-2">
              <span className="font-semibold text-text">{result?.addedQty} doses</span> of{' '}
              <span className="font-semibold text-text">{result?.vaccineName}</span> added.
            </p>
            <p className="text-sm text-text-muted mt-1">
              New total: <span className="font-bold text-success">{result?.newTotal} doses</span>
            </p>
          </div>
          <div className="flex gap-3 w-full pt-2">
            <Button variant="secondary" onClick={reset} className="flex-1">Record Another</Button>
            <Link
              to="/facility/dashboard"
              className="flex-1 inline-flex items-center justify-center gap-2 bg-primary text-white text-sm font-semibold px-4 py-2.5 rounded-lg hover:bg-primary-dark transition-colors"
            >
              <LayoutDashboard size={15} /> Dashboard
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-lg flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold text-text">Record Received Stock</h1>
        <p className="text-sm text-text-muted mt-0.5">Log vaccines received at this facility</p>
      </div>

      <div className="bg-surface rounded-2xl border border-surface-border p-6 shadow-sm">
        <StepIndicator step={step} total={3} />

        {/* ── Step 1: Select vaccine ── */}
        {step === 1 && (
          <div className="flex flex-col gap-5">
            <div>
              <p className="text-sm font-semibold text-text mb-1">Which vaccine did you receive?</p>
              <p className="text-xs text-text-muted mb-4">Select the vaccine from your facility's registered list.</p>
              <Select id="vaccine" label="Vaccine" options={vaccineOptions}
                value={vaccineId} onChange={(e) => setVaccineId(e.target.value)} required />
            </div>

            {vaccineId && currentStock && (
              <div className="bg-surface-alt rounded-xl border border-surface-border p-4 flex items-center gap-4">
                <RingGauge pct={pct} status={status} size={72} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-text-muted mb-0.5">Current stock</p>
                  <p className="text-2xl font-bold text-text">
                    {currentQty} <span className="text-sm font-normal text-text-muted">doses</span>
                  </p>
                  {currentStock.minQuantity > 0 && (
                    <p className="text-xs text-text-muted mt-0.5">Threshold: {currentStock.minQuantity} doses</p>
                  )}
                </div>
                <StatusBadge status={status} />
              </div>
            )}

            <Button onClick={() => setStep(2)} disabled={!vaccineId} className="w-full">
              Continue <ChevronRight size={16} />
            </Button>
          </div>
        )}

        {/* ── Step 2: Quantity ── */}
        {step === 2 && (
          <div className="flex flex-col gap-5">
            <div>
              <p className="text-sm font-semibold text-text mb-1">How many doses did you receive?</p>
              <p className="text-xs text-text-muted mb-4">Enter the total number of doses in this delivery.</p>
            </div>

            <div className="bg-surface-alt rounded-xl border border-surface-border px-4 py-3 flex items-center justify-between">
              <span className="text-sm font-semibold text-text">{selectedVaccine?.name}</span>
              <span className="text-xs text-text-muted">{currentQty} in stock</span>
            </div>

            {/* Quantity input with +/- controls */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-text" htmlFor="quantity">
                Quantity Received <span className="text-danger">*</span>
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => adjustQty(-10)}
                  className="w-10 h-10 rounded-lg border border-surface-border bg-surface-alt hover:bg-surface-border text-text-muted hover:text-text transition-colors flex items-center justify-center flex-shrink-0 font-bold text-xs"
                  aria-label="Decrease by 10"
                >
                  -10
                </button>
                <button
                  type="button"
                  onClick={() => adjustQty(-1)}
                  className="w-10 h-10 rounded-lg border border-surface-border bg-surface-alt hover:bg-surface-border text-text-muted hover:text-text transition-colors flex items-center justify-center flex-shrink-0"
                  aria-label="Decrease by 1"
                >
                  <Minus size={14} />
                </button>
                <input
                  id="quantity"
                  type="number"
                  min="1"
                  placeholder="0"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="flex-1 text-center text-xl font-bold text-text bg-surface border border-surface-border rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
                />
                <button
                  type="button"
                  onClick={() => adjustQty(1)}
                  className="w-10 h-10 rounded-lg border border-surface-border bg-surface-alt hover:bg-primary/10 hover:text-primary hover:border-primary/30 text-text-muted transition-colors flex items-center justify-center flex-shrink-0"
                  aria-label="Increase by 1"
                >
                  <Plus size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => adjustQty(10)}
                  className="w-10 h-10 rounded-lg border border-surface-border bg-surface-alt hover:bg-primary/10 hover:text-primary hover:border-primary/30 text-text-muted transition-colors flex items-center justify-center flex-shrink-0 font-bold text-xs"
                  aria-label="Increase by 10"
                >
                  +10
                </button>
              </div>
            </div>

            {quantity && addQty > 0 && (
              <div className="bg-success-bg border border-success/20 rounded-xl px-4 py-3 text-sm">
                <span className="text-text-muted">After recording: </span>
                <span className="text-text">{currentQty} + {addQty} = </span>
                <span className="font-bold text-success text-base">{newTotal} doses</span>
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <Button variant="secondary" onClick={() => setStep(1)} className="flex-1">
                <ChevronLeft size={16} /> Back
              </Button>
              <Button onClick={() => setStep(3)} disabled={!quantity || addQty < 1} className="flex-1">
                Review <ChevronRight size={16} />
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 3: Confirm ── */}
        {step === 3 && (
          <div className="flex flex-col gap-5">
            <div>
              <p className="text-sm font-semibold text-text mb-1">Review your entry</p>
              <p className="text-xs text-text-muted mb-4">Confirm the details below before saving.</p>
            </div>

            <div className="rounded-xl border border-surface-border overflow-hidden text-sm divide-y divide-surface-border">
              <div className="flex justify-between px-4 py-3.5 bg-surface-alt">
                <span className="text-text-muted">Vaccine</span>
                <span className="font-semibold text-text">{selectedVaccine?.name}</span>
              </div>
              <div className="flex justify-between px-4 py-3.5 bg-surface-alt">
                <span className="text-text-muted">Previous Stock</span>
                <span className="font-semibold text-text">{currentQty} doses</span>
              </div>
              <div className="flex justify-between px-4 py-3.5 bg-surface-alt">
                <span className="text-text-muted">Doses Being Added</span>
                <span className="font-semibold text-primary">+{addQty}</span>
              </div>
              <div className="flex justify-between px-4 py-3.5 bg-success-bg">
                <span className="text-success-dark font-semibold">New Total</span>
                <span className="font-bold text-success text-base">{newTotal} doses</span>
              </div>
            </div>

            {mutation.isError && (
              <p className="text-xs text-danger bg-danger-bg rounded-lg px-3 py-2">{mutation.error?.message}</p>
            )}

            <div className="flex gap-3 pt-1">
              <Button variant="secondary" onClick={() => setStep(2)} className="flex-1" disabled={mutation.isPending}>
                <ChevronLeft size={16} /> Edit
              </Button>
              <Button onClick={() => mutation.mutate()} disabled={mutation.isPending} className="flex-1">
                <PackageCheck size={16} />
                {mutation.isPending ? 'Saving…' : 'Confirm & Record'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
