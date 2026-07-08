import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PackageCheck, CheckCircle2, ChevronRight, ChevronLeft, Minus, Plus, LayoutDashboard, Syringe } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getVaccines, getDashboard, createStockEntry } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import Select from '../../components/ui/Select'
import Input from '../../components/ui/Input'
import Button from '../../components/ui/Button'
import StatusBadge from '../../components/shared/StatusBadge'
import { gaugeHex } from '../../lib/status'

const STEP_LABELS = ['Select Vaccine', 'Enter Quantity', 'Confirm Entry']

// ─── Ring Gauge ───────────────────────────────────────────────────────────────
function RingGauge({ pct, status, size = 80 }) {
  const r = (size / 2) - 8
  const circ = 2 * Math.PI * r
  const fillColor = gaugeHex(status)
  return (
    <div className="relative flex items-center justify-center flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E2E8F0" strokeWidth={6} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={fillColor} strokeWidth={6}
          strokeDasharray={`${(pct / 100) * circ} ${circ}`} strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.5s ease' }}
        />
      </svg>
      <span className="absolute text-xs font-extrabold text-text">{pct}%</span>
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
              className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold transition-all duration-200 ${
                i + 1 < step   ? 'bg-primary text-white shadow-sm shadow-primary/20' :
                i + 1 === step ? 'bg-primary text-white ring-4 ring-primary/10 shadow-sm shadow-primary/20' :
                                 'bg-slate-50 text-text-muted border border-surface-border'
              }`}
            >
              {i + 1 < step ? <CheckCircle2 size={15} strokeWidth={2.2} /> : i + 1}
            </div>
            <span className={`text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${
              i + 1 === step ? 'text-primary' : 'text-text-muted/70'
            }`}>
              {STEP_LABELS[i]}
            </span>
          </div>
          {i < total - 1 && (
            <div className={`w-10 h-0.5 mb-5 mx-2 transition-colors duration-300 ${i + 1 < step ? 'bg-primary' : 'bg-surface-border'}`} />
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
  const status          = currentStock ? currentStock.status : null
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
      <div className="max-w-[480px] mx-auto pt-6 px-1">
        <div className="bg-white rounded-2xl border border-surface-border p-8 flex flex-col items-center gap-6 text-center shadow-xl">
          <div className="relative">
            <div className="bg-success/5 p-5 rounded-2xl text-success border border-success/10 animate-pulse">
              <CheckCircle2 size={48} strokeWidth={2.2} />
            </div>
            <span className="absolute inset-0 rounded-2xl bg-success/5 animate-ping" style={{ animationDuration: '1.8s' }} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-text tracking-tight">Delivery Stock Logged!</h2>
            <div className="bg-slate-50/70 border border-slate-100 rounded-xl px-5 py-3.5 mt-4 flex flex-col gap-1.5">
              <p className="text-sm text-text-muted">
                Received <span className="font-extrabold text-primary text-base">+{result?.addedQty} doses</span> of{' '}
                <span className="font-extrabold text-text text-base">{result?.vaccineName}</span>
              </p>
              <div className="h-px bg-slate-200/60 my-1" />
              <p className="text-xs text-text-muted font-medium">
                New Available Balance: <span className="font-extrabold text-success">{result?.newTotal} doses</span>
              </p>
            </div>
          </div>
          <div className="flex gap-3 w-full pt-2">
            <Button variant="secondary" onClick={reset} className="flex-1 py-3 text-xs font-bold uppercase tracking-wider">Record Another</Button>
            <Link
              to="/facility/dashboard"
              className="flex-1 inline-flex items-center justify-center gap-2 bg-primary text-white text-xs font-bold px-4 py-3 rounded-xl hover:bg-primary-dark transition-all shadow-sm shadow-primary/10 uppercase tracking-wider"
            >
              <LayoutDashboard size={14} /> Dashboard
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-[480px] mx-auto pt-6 px-1 flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-bold text-text tracking-tight">Record Received Delivery</h1>
        <p className="text-sm text-text-muted mt-0.5">Log new vaccine shipments received at your clinic</p>
      </div>

      <div className="bg-white rounded-2xl border border-surface-border p-6 sm:p-8 shadow-xl">
        <StepIndicator step={step} total={3} />

        {/* ── Step 1: Select vaccine ── */}
        {step === 1 && (
          <div className="flex flex-col gap-6">
            <div>
              <p className="text-sm font-bold text-text mb-1">1. Select Vaccine</p>
              <p className="text-xs text-text-muted mb-4">Choose the vaccine name from your facility list.</p>
              <Select
                id="vaccine"
                label="Vaccine type"
                options={vaccineOptions}
                placeholder="Choose vaccine from list..."
                value={vaccineId}
                onChange={(e) => setVaccineId(e.target.value)}
                required
              />
            </div>

            {vaccineId && currentStock && (
              <div className="bg-slate-50/60 rounded-xl border border-surface-border p-4.5 flex items-center gap-4 animate-in fade-in duration-200">
                <RingGauge pct={pct} status={status} size={72} />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold text-text-muted/70 uppercase tracking-widest">Current Balance</p>
                  <p className="text-2xl font-extrabold text-text mt-0.5 tracking-tight">
                    {currentQty} <span className="text-xs font-semibold text-text-muted/80">doses</span>
                  </p>
                  {currentStock.minQuantity > 0 && (
                    <p className="text-xs text-text-muted/75 font-medium mt-0.5">Threshold: {currentStock.minQuantity} doses</p>
                  )}
                </div>
                <StatusBadge status={status} />
              </div>
            )}

            <Button
              onClick={() => setStep(2)}
              disabled={!vaccineId}
              className="w-full py-3 mt-1 font-bold text-xs uppercase tracking-wider"
            >
              Continue to quantity <ChevronRight size={15} />
            </Button>
          </div>
        )}

        {/* ── Step 2: Quantity ── */}
        {step === 2 && (
          <div className="flex flex-col gap-6">
            <div className="bg-slate-50/70 rounded-xl border border-surface-border px-5 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-red-50 text-primary">
                  <Syringe size={14} />
                </div>
                <span className="text-sm font-bold text-text">{selectedVaccine?.name}</span>
              </div>
              <span className="text-xs font-semibold text-text-muted">{currentQty} in stock</span>
            </div>

            {/* Quantity input with +/- controls */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-text" htmlFor="quantity">
                Quantity Received (Doses) <span className="text-primary">*</span>
              </label>
              <div className="flex items-center gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => adjustQty(-10)}
                  className="w-11 h-11 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-text-muted hover:text-text transition-all flex items-center justify-center flex-shrink-0 font-bold text-xs active:scale-95 cursor-pointer"
                  aria-label="Decrease by 10"
                >
                  -10
                </button>
                <button
                  type="button"
                  onClick={() => adjustQty(-1)}
                  className="w-11 h-11 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-text-muted hover:text-text transition-all flex items-center justify-center flex-shrink-0 active:scale-95 cursor-pointer"
                  aria-label="Decrease by 1"
                >
                  <Minus size={14} strokeWidth={2.5} />
                </button>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  placeholder="0"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="flex-1 text-center text-xl font-extrabold text-text bg-white px-3 py-2.5"
                />
                <button
                  type="button"
                  onClick={() => adjustQty(1)}
                  className="w-11 h-11 rounded-xl border border-slate-200 bg-slate-50 hover:bg-red-50 hover:text-primary hover:border-primary/20 text-text-muted transition-all flex items-center justify-center flex-shrink-0 active:scale-95 cursor-pointer"
                  aria-label="Increase by 1"
                >
                  <Plus size={14} strokeWidth={2.5} />
                </button>
                <button
                  type="button"
                  onClick={() => adjustQty(10)}
                  className="w-11 h-11 rounded-xl border border-slate-200 bg-slate-50 hover:bg-red-50 hover:text-primary hover:border-primary/20 text-text-muted transition-all flex items-center justify-center flex-shrink-0 font-bold text-xs active:scale-95 cursor-pointer"
                  aria-label="Increase by 10"
                >
                  +10
                </button>
              </div>
            </div>

            {quantity && addQty > 0 && (
              <div className="bg-success/5 border border-success/15 rounded-xl px-5 py-3.5 text-xs text-success-dark">
                <div className="flex flex-col gap-0.5">
                  <span className="font-bold uppercase tracking-wider text-[9px] opacity-75">Calculation Check</span>
                  <p className="font-medium text-text mt-0.5">
                    Starting Stock ({currentQty}) + Added ({addQty}) ={' '}
                    <span className="font-bold text-success-dark">{newTotal} doses projected</span>
                  </p>
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button
                variant="secondary"
                onClick={() => setStep(1)}
                className="flex-1 py-3 text-xs font-bold uppercase tracking-wider"
              >
                <ChevronLeft size={15} /> Back
              </Button>
              <Button
                onClick={() => setStep(3)}
                disabled={!quantity || addQty < 1}
                className="flex-1 py-3 text-xs font-bold uppercase tracking-wider"
              >
                Review <ChevronRight size={15} />
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 3: Confirm ── */}
        {step === 3 && (
          <div className="flex flex-col gap-6">
            <div>
              <p className="text-sm font-bold text-text mb-1">3. Confirm Details</p>
              <p className="text-xs text-text-muted mb-4">Verify receiving log details before saving.</p>
            </div>

            <div className="rounded-xl border border-slate-100 overflow-hidden text-sm divide-y divide-slate-100 shadow-sm">
              <div className="flex justify-between px-4.5 py-3.5 bg-slate-50/60">
                <span className="text-text-muted">Vaccine Type</span>
                <span className="font-bold text-text">{selectedVaccine?.name}</span>
              </div>
              <div className="flex justify-between px-4.5 py-3.5 bg-slate-50/60">
                <span className="text-text-muted">Previous Balance</span>
                <span className="font-semibold text-text">{currentQty} doses</span>
              </div>
              <div className="flex justify-between px-4.5 py-3.5 bg-slate-50/60">
                <span className="text-text-muted">Doses Received</span>
                <span className="font-bold text-primary">+{addQty}</span>
              </div>
              <div className="flex justify-between px-4.5 py-3.5 bg-success/5">
                <span className="text-success-dark font-bold">New Available Balance</span>
                <span className="font-extrabold text-success-dark text-base">{newTotal} doses</span>
              </div>
            </div>

            {mutation.isError && (
              <p className="text-xs font-bold text-danger bg-danger-bg border border-danger/10 rounded-xl px-4 py-3">{mutation.error?.message}</p>
            )}

            <div className="flex gap-3 pt-2">
              <Button
                variant="secondary"
                onClick={() => setStep(2)}
                className="flex-1 py-3 text-xs font-bold uppercase tracking-wider"
                disabled={mutation.isPending}
              >
                <ChevronLeft size={15} /> Edit
              </Button>
              <Button
                onClick={() => mutation.mutate()}
                disabled={mutation.isPending}
                className="flex-1 py-3 text-xs font-bold uppercase tracking-wider"
              >
                <PackageCheck size={14} />
                {mutation.isPending ? 'Saving…' : 'Confirm & Record'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
