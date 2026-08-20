import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CheckCircle2, PackageCheck, ChevronRight, ChevronLeft,
  Minus, Plus, LayoutDashboard, Syringe, PackagePlus, Undo2,
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getVaccines, getDashboard, createStockEntry } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import Select from '../../components/ui/Select'
import Input from '../../components/ui/Input'
import Button from '../../components/ui/Button'
import StatusBadge from '../../components/shared/StatusBadge'
import RingGauge from '../../components/shared/RingGauge'
import StepIndicator from '../../components/shared/StepIndicator'
import { displayVaccineName } from '../../lib/vaccineNames'

const STEP_LABELS = ['Select Vaccine', 'Entry Type', 'Details', 'Confirm']

export default function RecordStock() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const [step, setStep]             = useState(1)
  const [vaccineId, setVaccineId]   = useState('')
  const [entryType, setEntryType]   = useState('received')
  const [vials, setVials]           = useState('')
  const [batchNo, setBatchNo]       = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [manufacturer, setManufacturer] = useState('')
  const [remarks, setRemarks]       = useState('outreach')
  const [done, setDone]             = useState(false)
  const [result, setResult]         = useState(null)

  const { data: vaccineData }   = useQuery({ queryKey: ['vaccines'],  queryFn: getVaccines })
  const { data: dashboardData } = useQuery({ queryKey: ['dashboard'], queryFn: getDashboard })

  const vaccineOptions = (vaccineData?.vaccines ?? []).map((v) => ({ value: v.id, label: displayVaccineName(v.name) }))

  const stockByVaccineId = new Map(
    (dashboardData?.facilities ?? [])
      .filter((r) => r.facilityId === user?.facilityId)
      .map((r) => [r.vaccineId, r])
  )

  const selectedVaccine = vaccineData?.vaccines?.find((v) => v.id === vaccineId)
  const currentStock    = vaccineId ? stockByVaccineId.get(vaccineId) : null
  const currentQty      = currentStock?.quantity ?? 0
  const addVials        = parseInt(vials, 10) || 0
  const dosesPerVial    = selectedVaccine?.dosesPerVial ?? 1
  const addedDoses      = addVials * dosesPerVial
  const newTotal        = currentQty + addedDoses
  const status          = currentStock ? currentStock.status : null
  const criticalDoses   = currentStock?.criticalDoses ?? 0
  const pct             = currentStock?.quantity == null
    ? 0
    : criticalDoses > 0
      ? Math.min(Math.round((currentQty / (criticalDoses * 2)) * 100), 100)
      : 100

  const isReceivedValid = entryType === 'received'
    ? batchNo.trim() && expiryDate && manufacturer.trim() && remarks
    : true

  const mutation = useMutation({
    mutationFn: () => createStockEntry({
      vaccineId,
      vials: addVials,
      entryType,
      ...(entryType === 'received' ? {
        batchNo: batchNo.trim(),
        expiryDate,
        manufacturer: manufacturer.trim(),
        remarks,
      } : {}),
    }),
    onSuccess: (data) => {
      setResult({
        vaccineName: selectedVaccine?.name,
        addedVials: addVials,
        addedDoses: data?.entry?.quantity ?? addedDoses,
        newTotal,
        entryType,
      })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['audit-log'] })
      setDone(true)
    },
  })

  function reset() {
    setStep(1); setVaccineId(''); setEntryType('received'); setVials('')
    setBatchNo(''); setExpiryDate(''); setManufacturer('')
    setRemarks('outreach'); setDone(false); setResult(null); mutation.reset()
  }

  function adjustVials(delta) {
    const cur = parseInt(vials, 10) || 0
    setVials(String(Math.min(1_000, Math.max(1, cur + delta))))
  }

  if (done) {
    const isReturn = result?.entryType === 'returned'
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
            <h2 className="text-xl font-bold text-text tracking-tight">
              {isReturn ? 'Return Logged!' : 'Delivery Stock Logged!'}
            </h2>
            <div className="bg-slate-50/70 border border-slate-100 rounded-xl px-5 py-3.5 mt-4 flex flex-col gap-1.5">
              <p className="text-sm text-text-muted">
                {isReturn ? 'Returned' : 'Received'}{' '}
                <span className="font-extrabold text-primary text-base">+{result?.addedVials} vials</span>{' '}
                ({result?.addedDoses} doses) of{' '}
                <span className="font-extrabold text-text text-base" dir="rtl">{displayVaccineName(result?.vaccineName)}</span>
              </p>
              <div className="h-px bg-slate-200/60 my-1" />
              <p className="text-xs text-text-muted font-medium">
                New Projected Balance: <span className="font-extrabold text-success">{result?.newTotal} doses</span>
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
    <div className="max-w-[520px] mx-auto pt-6 px-1 flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-bold text-text tracking-tight">Record Stock</h1>
        <p className="text-sm text-text-muted mt-0.5">Log vaccine deliveries received or doses returned to your facility</p>
      </div>

      <div className="bg-white rounded-2xl border border-surface-border p-6 sm:p-8 shadow-xl">
        <StepIndicator step={step} labels={STEP_LABELS} />

        {/* ── Step 1: Select vaccine ── */}
        {step === 1 && (
          <div className="flex flex-col gap-6">
            <div>
              <p className="text-sm font-bold text-text mb-1">1. Select Vaccine</p>
              <p className="text-xs text-text-muted mb-4">Choose the vaccine from the catalog.</p>
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
              <div className="bg-slate-50/60 rounded-xl border border-surface-border p-4 flex items-center gap-4 animate-in fade-in duration-200">
                <RingGauge pct={pct} status={status} size={72} />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold text-text-muted/70 uppercase tracking-widest">Current Balance</p>
                  <p className="text-2xl font-extrabold text-text mt-0.5 tracking-tight">
                    {currentQty} <span className="text-xs font-semibold text-text-muted/80">doses</span>
                  </p>
                  {selectedVaccine?.dosesPerVial && (
                    <p className="text-xs text-text-muted/75 font-medium mt-0.5">{selectedVaccine.dosesPerVial} doses/vial</p>
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
              Continue <ChevronRight size={15} />
            </Button>
          </div>
        )}

        {/* ── Step 2: Entry type ── */}
        {step === 2 && (
          <div className="flex flex-col gap-6">
            <div>
              <p className="text-sm font-bold text-text mb-1">2. What are you recording?</p>
              <p className="text-xs text-text-muted mb-4">Choose whether this is a delivery received or doses returned.</p>
            </div>

            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => setEntryType('received')}
                className={`flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all duration-150 ${
                  entryType === 'received'
                    ? 'border-primary bg-primary/5'
                    : 'border-surface-border bg-slate-50/60 hover:border-primary/40'
                }`}
              >
                <div className={`p-2.5 rounded-xl flex-shrink-0 ${entryType === 'received' ? 'bg-primary text-white' : 'bg-slate-100 text-text-muted'}`}>
                  <PackagePlus size={20} />
                </div>
                <div>
                  <p className="font-bold text-text text-sm">Received from District</p>
                  <p className="text-xs text-text-muted mt-0.5">New stock arrived at your facility — requires shipment/batch details</p>
                </div>
                {entryType === 'received' && <CheckCircle2 size={18} className="ml-auto text-primary flex-shrink-0" />}
              </button>

              <button
                type="button"
                onClick={() => setEntryType('returned')}
                className={`flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all duration-150 ${
                  entryType === 'returned'
                    ? 'border-primary bg-primary/5'
                    : 'border-surface-border bg-slate-50/60 hover:border-primary/40'
                }`}
              >
                <div className={`p-2.5 rounded-xl flex-shrink-0 ${entryType === 'returned' ? 'bg-primary text-white' : 'bg-slate-100 text-text-muted'}`}>
                  <Undo2 size={20} />
                </div>
                <div>
                  <p className="font-bold text-text text-sm">Returned to Facility</p>
                  <p className="text-xs text-text-muted mt-0.5">Doses returned by field workers at end of day — no batch details required</p>
                </div>
                {entryType === 'returned' && <CheckCircle2 size={18} className="ml-auto text-primary flex-shrink-0" />}
              </button>
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="secondary" onClick={() => setStep(1)} className="flex-1 py-3 text-xs font-bold uppercase tracking-wider">
                <ChevronLeft size={15} /> Back
              </Button>
              <Button onClick={() => setStep(3)} className="flex-1 py-3 text-xs font-bold uppercase tracking-wider">
                Continue <ChevronRight size={15} />
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 3: Vials + batch details (received) or vials only (returned) ── */}
        {step === 3 && (
          <div className="flex flex-col gap-5">
            {/* Selected vaccine summary */}
            <div className="bg-slate-50/70 rounded-xl border border-surface-border px-5 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-red-50 text-primary">
                  <Syringe size={14} />
                </div>
                <span className="text-sm font-bold text-text" dir="rtl">{displayVaccineName(selectedVaccine?.name)}</span>
              </div>
              <span className="text-xs font-semibold text-text-muted capitalize">{entryType}</span>
            </div>

            {/* Vials */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-text" htmlFor="vials">
                Number of Vials <span className="text-primary">*</span>
              </label>
              <div className="flex items-center gap-2 mt-1">
                <button type="button" onClick={() => adjustVials(-10)}
                  className="w-11 h-11 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-text-muted hover:text-text transition-all flex items-center justify-center flex-shrink-0 font-bold text-xs active:scale-95 cursor-pointer"
                  aria-label="Decrease by 10">-10</button>
                <button type="button" onClick={() => adjustVials(-1)}
                  className="w-11 h-11 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-text-muted hover:text-text transition-all flex items-center justify-center flex-shrink-0 active:scale-95 cursor-pointer"
                  aria-label="Decrease by 1"><Minus size={14} strokeWidth={2.5} /></button>
                <Input id="vials" type="number" min="1" max={1_000} placeholder="0"
                  value={vials} onChange={(e) => setVials(e.target.value)}
                  className="flex-1 text-center text-xl font-extrabold text-text bg-white px-3 py-2.5" />
                <button type="button" onClick={() => adjustVials(1)}
                  className="w-11 h-11 rounded-xl border border-slate-200 bg-slate-50 hover:bg-red-50 hover:text-primary hover:border-primary/20 text-text-muted transition-all flex items-center justify-center flex-shrink-0 active:scale-95 cursor-pointer"
                  aria-label="Increase by 1"><Plus size={14} strokeWidth={2.5} /></button>
                <button type="button" onClick={() => adjustVials(10)}
                  className="w-11 h-11 rounded-xl border border-slate-200 bg-slate-50 hover:bg-red-50 hover:text-primary hover:border-primary/20 text-text-muted transition-all flex items-center justify-center flex-shrink-0 font-bold text-xs active:scale-95 cursor-pointer"
                  aria-label="Increase by 10">+10</button>
              </div>
              {selectedVaccine?.dosesPerVial && vials && addVials > 0 && (
                <p className="text-xs text-text-muted mt-1">
                  = <span className="font-bold text-text">{addedDoses} doses</span> ({selectedVaccine.dosesPerVial} doses/vial)
                </p>
              )}
            </div>

            {vials && addVials > 0 && (
              <div className="bg-success/5 border border-success/15 rounded-xl px-5 py-3 text-xs text-success-dark">
                <span className="font-bold uppercase tracking-wider text-[9px] opacity-75 block mb-0.5">Calculation Check</span>
                <p className="font-medium text-text">
                  {currentQty} + {addedDoses} doses = <span className="font-bold text-success-dark">{newTotal} doses projected</span>
                </p>
              </div>
            )}

            {addVials > 1_000 && (
              <div className="bg-danger-bg border border-danger/10 rounded-xl px-5 py-3 text-xs text-danger">
                <span className="font-bold">Maximum 1,000 vials per entry.</span>
              </div>
            )}

            {/* Batch fields — received only */}
            {entryType === 'received' && (
              <div className="flex flex-col gap-4 pt-2 border-t border-surface-border">
                <p className="text-xs font-bold text-text-muted uppercase tracking-wider">Shipment / Batch Details</p>

                <Input id="batch-no" label="Batch Number *" placeholder="e.g. B-2026-001"
                  value={batchNo} onChange={(e) => setBatchNo(e.target.value)} required />

                <Input id="expiry-date" label="Expiry Date *" type="date"
                  value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} required />

                <Input id="manufacturer" label="Manufacturer *" placeholder="e.g. Serum Institute"
                  value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} required />

                {/* Remarks toggle */}
                <div>
                  <label className="block text-sm font-bold text-text mb-2">Remarks *</label>
                  <div className="flex gap-2">
                    {['outreach', 'fixed'].map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setRemarks(opt)}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-bold border-2 transition-all capitalize ${
                          remarks === opt
                            ? 'border-primary bg-primary text-white'
                            : 'border-surface-border bg-slate-50 text-text-muted hover:border-primary/40'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button variant="secondary" onClick={() => setStep(2)} className="flex-1 py-3 text-xs font-bold uppercase tracking-wider">
                <ChevronLeft size={15} /> Back
              </Button>
              <Button
                onClick={() => setStep(4)}
                disabled={!vials || addVials < 1 || addVials > 1_000 || !isReceivedValid}
                className="flex-1 py-3 text-xs font-bold uppercase tracking-wider"
              >
                Review <ChevronRight size={15} />
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 4: Confirm ── */}
        {step === 4 && (
          <div className="flex flex-col gap-5">
            <div>
              <p className="text-sm font-bold text-text mb-1">4. Confirm Details</p>
              <p className="text-xs text-text-muted mb-4">Verify details before saving.</p>
            </div>

            <div className="rounded-xl border border-slate-100 overflow-hidden text-sm divide-y divide-slate-100 shadow-sm">
              <div className="flex justify-between px-4 py-3 bg-slate-50/60">
                <span className="text-text-muted">Vaccine</span>
                <span className="font-bold text-text" dir="rtl">{displayVaccineName(selectedVaccine?.name)}</span>
              </div>
              <div className="flex justify-between px-4 py-3 bg-slate-50/60">
                <span className="text-text-muted">Entry Type</span>
                <span className="font-bold text-text capitalize">{entryType}</span>
              </div>
              <div className="flex justify-between px-4 py-3 bg-slate-50/60">
                <span className="text-text-muted">Previous Balance</span>
                <span className="font-semibold text-text">{currentQty} doses</span>
              </div>
              <div className="flex justify-between px-4 py-3 bg-slate-50/60">
                <span className="text-text-muted">Vials</span>
                <span className="font-bold text-primary">+{addVials}</span>
              </div>
              <div className="flex justify-between px-4 py-3 bg-slate-50/60">
                <span className="text-text-muted">Doses Added</span>
                <span className="font-bold text-primary">+{addedDoses}</span>
              </div>
              {entryType === 'received' && (
                <>
                  <div className="flex justify-between px-4 py-3 bg-slate-50/60">
                    <span className="text-text-muted">Batch No.</span>
                    <span className="font-semibold text-text">{batchNo}</span>
                  </div>
                  <div className="flex justify-between px-4 py-3 bg-slate-50/60">
                    <span className="text-text-muted">Expiry Date</span>
                    <span className="font-semibold text-text">{expiryDate}</span>
                  </div>
                  <div className="flex justify-between px-4 py-3 bg-slate-50/60">
                    <span className="text-text-muted">Manufacturer</span>
                    <span className="font-semibold text-text">{manufacturer}</span>
                  </div>
                  <div className="flex justify-between px-4 py-3 bg-slate-50/60">
                    <span className="text-text-muted">Remarks</span>
                    <span className="font-semibold text-text capitalize">{remarks}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between px-4 py-3 bg-success/5">
                <span className="text-success-dark font-bold">Projected New Balance</span>
                <span className="font-extrabold text-success-dark text-base">{newTotal} doses</span>
              </div>
            </div>

            {mutation.isError && (
              <p className="text-xs font-bold text-danger bg-danger-bg border border-danger/10 rounded-xl px-4 py-3">
                {mutation.error?.message}
              </p>
            )}

            <div className="flex gap-3 pt-2">
              <Button variant="secondary" onClick={() => setStep(3)} className="flex-1 py-3 text-xs font-bold uppercase tracking-wider" disabled={mutation.isPending}>
                <ChevronLeft size={15} /> Edit
              </Button>
              <Button onClick={() => mutation.mutate()} disabled={mutation.isPending} className="flex-1 py-3 text-xs font-bold uppercase tracking-wider">
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
