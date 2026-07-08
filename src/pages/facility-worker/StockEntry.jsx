import { useState } from 'react'
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, PackageMinus, Syringe } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getVaccines, getDashboard, createStockEntry } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import Select from '../../components/ui/Select'
import Input from '../../components/ui/Input'
import Button from '../../components/ui/Button'
import StatusBadge from '../../components/shared/StatusBadge'
import { statusConfig } from '../../lib/status'

const STEP_LABELS = ['Select Vaccine', 'Enter Doses']

function StepIndicator({ step, total }) {
  return (
    <div className="flex items-center justify-center gap-1 mb-8">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className="flex items-center gap-1">
          <div className="flex flex-col items-center gap-1.5">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold transition-all duration-200 ${
                i + 1 < step   ? 'bg-primary text-white shadow-sm shadow-primary/20' :
                i + 1 === step ? 'bg-primary text-white ring-4 ring-primary/10 shadow-sm shadow-primary/20' :
                                 'bg-slate-50 text-text-muted border border-surface-border'
              }`}
            >
              {i + 1 < step ? '✓' : i + 1}
            </div>
            <span className={`text-[10px] font-bold uppercase tracking-wider ${i + 1 === step ? 'text-primary' : 'text-text-muted/70'}`}>
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

  const stockRows = (dashboardData?.facilities ?? []).filter((r) => r.facilityId === user?.facilityId)

  const stockByVaccineId = new Map(
    stockRows.map((r) => [r.vaccineId, r])
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

  function handleQuickAdd(val) {
    setQuantity(val.toString())
    mutation.reset()
  }

  return (
    <div className="max-w-6xl mx-auto pt-6 px-1 flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-text tracking-tight">Dose Entry Portal</h1>
        <p className="text-sm text-text-muted mt-0.5">Quickly record vaccine doses used in the clinic</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Side: Form viewport */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-surface-border p-6 sm:p-8 shadow-xl">
          {done ? (
            <div className="flex flex-col items-center gap-6 text-center">
              <div className="bg-success/5 p-5 rounded-2xl text-success border border-success/10 animate-pulse">
                <CheckCircle2 size={48} strokeWidth={2.2} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-text tracking-tight">Stock Activity Logged</h2>
                <div className="bg-slate-50/70 border border-slate-100 rounded-xl px-5 py-3.5 mt-4 flex flex-col gap-1.5">
                  <p className="text-sm text-text-muted">
                    Administered <span className="font-extrabold text-primary text-base">{useQty} doses</span> of{' '}
                    <span className="font-extrabold text-text text-base">{selectedVaccine?.name}</span>
                  </p>
                  <div className="h-px bg-slate-200/60 my-1" />
                  <p className="text-xs text-text-muted font-medium">
                    New Running Balance: <span className="font-extrabold text-success">{remaining} doses</span>
                  </p>
                </div>
              </div>
              <Button variant="secondary" onClick={reset} className="w-full mt-2 py-3 font-semibold uppercase tracking-wider text-xs">
                Record Another Entry
              </Button>
            </div>
          ) : (
            <div>
              <StepIndicator step={step} total={2} />

              {step === 1 && (
                <div className="flex flex-col gap-6">
                  <div>
                    <p className="text-sm font-bold text-text mb-1">1. Select Vaccine</p>
                    <p className="text-xs text-text-muted mb-4">Choose the vaccine name to record usage.</p>
                    <Select
                      id="vaccine"
                      label="Vaccine catalog"
                      options={vaccineOptions}
                      placeholder="Choose vaccine from list..."
                      value={vaccineId}
                      onChange={(e) => { setVaccineId(e.target.value); setQuantity('') }}
                      required
                    />
                  </div>

                  {vaccineId && currentStock && (
                    <div className="bg-slate-50/60 rounded-xl px-5 py-4 border border-surface-border flex flex-col gap-3 animate-in fade-in duration-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[10px] font-bold text-text-muted/70 uppercase tracking-widest">Current Balance</p>
                          <p className="text-2xl font-extrabold text-text mt-0.5 tracking-tight">{currentQty} <span className="text-xs font-semibold text-text-muted/80">doses</span></p>
                        </div>
                        <StatusBadge status={status} />
                      </div>
                      <div className="space-y-1 mt-1">
                        <div className="h-2 rounded-full bg-slate-200/70 overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
                        </div>
                        <div className="flex items-center justify-between text-[10px] font-semibold text-text-muted uppercase tracking-wider">
                          <span>Stock Level</span>
                          <span>{pct}% of min threshold</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {status === 'critical' && (
                    <div className="bg-danger-bg border border-danger/10 rounded-xl px-4 py-3 flex items-start gap-2.5 animate-in shake duration-300">
                      <AlertTriangle size={16} className="text-danger flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-bold text-danger">Stock Alert: Critically Low</p>
                        <p className="text-[10px] text-danger/80 mt-0.5 leading-snug">Dose counts are below threshold. Reorder action is recommended.</p>
                      </div>
                    </div>
                  )}

                  <Button
                    onClick={() => setStep(2)}
                    disabled={!vaccineId}
                    className="w-full py-3 mt-1 font-bold text-xs uppercase tracking-wider animate-in fade-in"
                  >
                    Continue to quantity <ChevronRight size={15} />
                  </Button>
                </div>
              )}

              {step === 2 && (
                <form className="flex flex-col gap-6 animate-in fade-in duration-200" onSubmit={(e) => { e.preventDefault(); mutation.mutate() }}>
                  <div className="bg-slate-50/70 rounded-xl px-5 py-3 flex items-center justify-between border border-surface-border">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-red-50 text-primary">
                        <Syringe size={14} />
                      </div>
                      <span className="text-sm font-bold text-text">{selectedVaccine?.name}</span>
                    </div>
                    <span className="text-xs font-semibold text-text-muted">{currentQty} in stock</span>
                  </div>

                  <div>
                    <p className="text-sm font-bold text-text mb-1">2. How many doses were used?</p>
                    <p className="text-xs text-text-muted mb-4">Enter exact dose count or tap quick presets below.</p>
                    
                    <Input
                      id="quantity"
                      label="Doses Used"
                      type="number"
                      inputMode="numeric"
                      min="1"
                      placeholder="e.g. 10"
                      value={quantity}
                      onChange={(e) => { setQuantity(e.target.value); mutation.reset() }}
                      required
                    />

                    {/* Quick Preset Buttons for rapid clinical input */}
                    <div className="mt-4">
                      <p className="text-[10px] font-bold text-text-muted/65 uppercase tracking-wider mb-2">Quick presets</p>
                      <div className="flex flex-wrap gap-2">
                        {[1, 5, 10, 20, 50].map((val) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => handleQuickAdd(val)}
                            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg border transition-all active:scale-95 ${
                              quantity === val.toString()
                                ? 'bg-primary text-white border-primary shadow-sm shadow-primary/10'
                                : 'bg-slate-50 border-slate-200 text-text hover:bg-red-50 hover:border-primary/20 hover:text-primary'
                            }`}
                          >
                            {val} Dose{val > 1 ? 's' : ''}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {quantity && useQty > 0 && (
                    <div className={`rounded-xl px-4 py-3 text-xs border ${
                      wouldGoNegative
                        ? 'bg-danger-bg border-danger/10 text-danger'
                        : 'bg-success-bg border-success/10 text-success-dark'
                    }`}>
                      {wouldGoNegative ? (
                        <span className="font-bold">Error: Insufficient stock. Only {currentQty} doses remain in stock.</span>
                      ) : (
                        <div className="flex flex-col gap-0.5">
                          <span className="font-bold uppercase tracking-wider text-[9px] opacity-75">Calculation Check</span>
                          <p className="font-medium text-text mt-0.5">
                            Starting Balance ({currentQty}) − Used ({useQty}) ={' '}
                            <span className="font-bold text-success-dark">{remaining} doses remaining</span>
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {mutation.isError && (
                    <p className="text-xs font-bold text-danger bg-danger-bg border border-danger/10 rounded-xl px-4 py-3">
                      {insufficientAvailable != null
                        ? `Only ${insufficientAvailable} doses left in stock.`
                        : mutation.error?.message}
                    </p>
                  )}

                  <div className="flex gap-3 pt-2">
                    <Button
                      variant="secondary"
                      type="button"
                      onClick={() => { setStep(1); mutation.reset() }}
                      className="flex-1 py-3 text-xs font-bold uppercase tracking-wider"
                    >
                      <ChevronLeft size={15} /> Back
                    </Button>
                    <Button
                      type="submit"
                      disabled={mutation.isPending || !quantity || useQty < 1 || wouldGoNegative}
                      className="flex-1 py-3 text-xs font-bold uppercase tracking-wider"
                    >
                      <PackageMinus size={14} />
                      {mutation.isPending ? 'Recording…' : 'Record'}
                    </Button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>

        {/* Right Side: Live Stock Dashboard catalog (visible on large screen resolutions) */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-text-muted/75 uppercase tracking-wider">Live Facility Stock</h2>
            <span className="text-[9px] font-extrabold bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded border border-emerald-100 tracking-wider">LIVE DATA</span>
          </div>

          {stockRows.length === 0 ? (
            <div className="text-center py-10 border border-dashed border-slate-200 bg-white rounded-2xl text-text-muted px-4">
              <Syringe size={28} className="mx-auto mb-2 text-text-muted/30" />
              <p className="font-bold text-xs">No configured stock levels</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {stockRows.map((row) => {
                const hasData     = row.quantity !== null
                const outOfStock  = row.quantity === 0
                const pct         = row.minQuantity > 0
                  ? Math.min(Math.round(((row.quantity ?? 0) / row.minQuantity) * 100), 100)
                  : (hasData ? 100 : 0)
                const cfg         = statusConfig(row.status)
                const isSelected  = row.vaccineId === vaccineId

                return (
                  <div 
                    key={row.vaccineId} 
                    className={`bg-white rounded-xl border border-surface-border border-l-4 ${cfg.borderL} p-4 flex flex-col gap-2 shadow-sm transition-all ${
                      isSelected ? 'ring-2 ring-primary/20 scale-[1.02] border-slate-400' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 min-w-0">
                      <span className="font-bold text-xs text-text truncate">{row.vaccineName}</span>
                      <StatusBadge status={row.status} />
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden mt-1">
                      {hasData ? (
                        <div className={`h-full rounded-full transition-all duration-350 ${cfg.dot}`} style={{ width: `${pct}%` }} />
                      ) : (
                        <div className="h-full rounded-full border border-dashed border-slate-200" />
                      )}
                    </div>
                    <div className="flex justify-between items-center text-[10px] pt-1 border-t border-slate-50 mt-1 font-medium text-text-muted">
                      {outOfStock ? (
                        <span className="font-bold text-danger">Out of stock</span>
                      ) : (
                        <span className="font-bold text-text-muted/95">{row.quantity ?? 0} doses</span>
                      )}
                      <span>Min: {row.minQuantity}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
