import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Settings, ArrowUp, Syringe } from 'lucide-react'
import { getVaccines, getDashboard, updateVaccineStock } from '../../lib/api'
import { statusConfig } from '../../lib/status'
import RingGauge from '../../components/shared/RingGauge'
import StatusBadge from '../../components/shared/StatusBadge'
import Modal from '../../components/ui/Modal'
import Input from '../../components/ui/Input'
import Button from '../../components/ui/Button'
import { displayVaccineName } from '../../lib/vaccineNames'

const FILTERS = [
  { key: 'all',      label: 'All'     },
  { key: 'critical', label: 'Critical' },
  { key: 'low',      label: 'Low'     },
  { key: 'adequate', label: 'Normal'  },
  { key: 'no_data',  label: 'No Data' },
]

const FILTER_ACTIVE_COLOR = {
  all:      'bg-slate-700 text-white border-slate-700',
  critical: 'bg-danger text-white border-danger',
  low:      'bg-warning text-white border-warning',
  adequate: 'bg-success text-white border-success',
  no_data:  'bg-secondary text-white border-secondary',
}

// ─── Correct Stock Modal ───────────────────────────────────────────────────────
function CorrectStockModal({ vaccine, stock, onClose }) {
  const queryClient = useQueryClient()
  const currentQty  = stock?.quantity ?? null
  const [value, setValue]   = useState(currentQty != null ? String(currentQty) : '')
  const [error, setError]   = useState('')

  const { mutate, isPending } = useMutation({
    mutationFn: (qty) => updateVaccineStock(vaccine.id, qty),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      onClose()
    },
    onError: (err) => setError(err.message ?? 'Failed to save correction'),
  })

  function handleSubmit(e) {
    e.preventDefault()
    const qty = parseInt(value, 10)
    if (isNaN(qty) || qty < 0) { setError('Please enter a valid non-negative number'); return }
    setError('')
    mutate(qty)
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Correct Stock — ${displayVaccineName(vaccine.name)}`}
      maxWidth="max-w-md"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <p className="text-sm text-text-muted leading-relaxed">
          Enter the actual current stock in doses. This records a correction against
          the difference from what&apos;s currently tracked
          {currentQty != null
            ? <> (<span className="font-semibold text-text">{currentQty} doses</span>)</>
            : ' (no stock recorded yet)'}.
        </p>

        <Input
          id="correct-stock"
          label="Actual Current Stock (doses)"
          type="number"
          min="0"
          step="1"
          placeholder="e.g. 120"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          required
        />

        {error && (
          <p className="text-xs text-danger font-semibold">{error}</p>
        )}

        <div className="flex items-center justify-end gap-3 pt-1">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={isPending}>
            {isPending ? 'Saving…' : 'Save Correction'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Vaccine Card ─────────────────────────────────────────────────────────────
function VaccineCard({ vaccine, stock, onCorrect }) {
  const status       = stock?.status ?? 'no_data'
  const quantity     = stock?.quantity ?? null
  const hasThreshold = vaccine.criticalDoses != null || vaccine.lowDoses != null
  const ref          = vaccine.lowDoses ?? vaccine.criticalDoses ?? 1
  const pct          = quantity == null ? 0 : hasThreshold ? Math.min(Math.round((quantity / ref) * 100), 100) : 100
  const cfg          = statusConfig(status)

  return (
    <div className={`bg-white rounded-2xl border border-surface-border border-l-4 ${cfg.borderL} shadow-sm overflow-hidden flex flex-col`}>
      {/* Card body */}
      <div className="flex flex-1">
        {/* Left — gauge */}
        <div className="w-[88px] flex-shrink-0 bg-slate-50 flex flex-col items-center justify-center py-5 border-r border-surface-border">
          {!hasThreshold ? (
            <div className="w-[72px] h-[72px] rounded-full border-4 border-dashed border-surface-border flex items-center justify-center">
              <Settings size={18} className="text-text-muted" />
            </div>
          ) : (
            <RingGauge pct={pct} status={status} size={72} />
          )}
        </div>

        {/* Right — details */}
        <div className="flex-1 min-w-0 px-4 py-4 flex flex-col gap-2">
          {/* Name + badge */}
          <div className="flex items-start justify-between gap-2">
            <p className="font-bold text-text text-sm leading-tight truncate" dir="rtl">
              {displayVaccineName(vaccine.name)}
            </p>
            <StatusBadge status={status} />
          </div>

          {/* Stock quantity */}
          <p className="text-xs text-text-muted">
            <span className="font-bold text-base text-text">
              {quantity != null ? quantity : '—'}
            </span>{' '}
            doses in stock
          </p>

          {/* Thresholds */}
          <div className="flex flex-col gap-0.5 text-[11px] text-text-muted mt-0.5">
            <span>
              <span className="font-semibold text-danger">Critical:</span>{' '}
              {vaccine.criticalDoses ?? '—'} doses / {vaccine.criticalVials ?? '—'} vials
            </span>
            <span>
              <span className="font-semibold text-warning-dark">Low:</span>{' '}
              {vaccine.lowDoses ?? '—'} doses / {vaccine.lowVials ?? '—'} vials
            </span>
          </div>
        </div>
      </div>

      {/* Connect Stock button */}
      <button
        type="button"
        onClick={() => onCorrect(vaccine, stock)}
        className="flex items-center justify-center gap-1.5 w-full py-2.5 text-xs font-bold text-primary border-t border-surface-border hover:bg-primary hover:text-white transition-colors"
      >
        <ArrowUp size={11} /> Connect Stock
      </button>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function VaccinesList() {
  const [activeFilter, setActiveFilter]   = useState('all')
  const [correcting, setCorrecting]       = useState(null) // { vaccine, stock }

  const { data: vaccineData, isLoading: loadingV, isError: errV } = useQuery({
    queryKey: ['vaccines'],
    queryFn: getVaccines,
  })
  const { data: dashData, isLoading: loadingD, isError: errD } = useQuery({
    queryKey: ['dashboard'],
    queryFn: getDashboard,
  })

  const isLoading = loadingV || loadingD
  const isError   = errV || errD

  const { vaccines, stockMap, counts } = useMemo(() => {
    const vaccines  = vaccineData?.vaccines ?? []
    const stockRows = dashData?.vaccines    ?? []
    const stockMap  = new Map(stockRows.map((r) => [r.vaccineId, r]))

    const counts = { all: vaccines.length, critical: 0, low: 0, adequate: 0, no_data: 0 }
    for (const v of vaccines) {
      const s = stockMap.get(v.id)?.status ?? 'no_data'
      counts[s] = (counts[s] ?? 0) + 1
    }

    return { vaccines, stockMap, counts }
  }, [vaccineData, dashData])

  const filtered = useMemo(() => {
    if (activeFilter === 'all') return vaccines
    return vaccines.filter((v) => (stockMap.get(v.id)?.status ?? 'no_data') === activeFilter)
  }, [vaccines, stockMap, activeFilter])

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-200">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-text">Vaccines &amp; Thresholds</h1>
        {!isLoading && (
          <p className="text-sm text-text-muted mt-0.5">
            {counts.all} vaccine{counts.all !== 1 ? 's' : ''}
            {counts.no_data > 0 ? `, ${counts.no_data} not updated` : ''}
            {counts.adequate > 0 ? `, ${counts.adequate} normal` : ''}
          </p>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setActiveFilter(f.key)}
            className={[
              'inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all',
              activeFilter === f.key
                ? FILTER_ACTIVE_COLOR[f.key]
                : 'bg-white border-surface-border text-text-muted hover:border-slate-300',
            ].join(' ')}
          >
            {f.label}
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${activeFilter === f.key ? 'bg-white/20' : 'bg-slate-100'}`}>
              {counts[f.key] ?? 0}
            </span>
          </button>
        ))}
      </div>

      {/* Error */}
      {isError && (
        <div className="bg-danger-bg border border-danger/10 text-xs font-semibold text-danger rounded-xl px-4 py-3">
          Failed to load vaccines. Please refresh.
        </div>
      )}

      {/* Skeleton */}
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-[160px] bg-slate-50 border border-surface-border rounded-2xl animate-pulse" />
          ))}
        </div>
      )}

      {/* Grid */}
      {!isLoading && !isError && filtered.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((v) => (
            <VaccineCard
              key={v.id}
              vaccine={v}
              stock={stockMap.get(v.id)}
              onCorrect={(vaccine, stock) => setCorrecting({ vaccine, stock })}
            />
          ))}
        </div>
      )}

      {/* Empty — no vaccines at all */}
      {!isLoading && !isError && vaccines.length === 0 && (
        <div className="text-center py-16 border border-dashed border-surface-border bg-white rounded-2xl text-text-muted shadow-sm">
          <Syringe size={36} className="mx-auto mb-3 opacity-20" />
          <p className="font-bold text-text">No vaccines configured</p>
          <p className="text-xs mt-1">Contact your system administrator to add vaccines.</p>
        </div>
      )}

      {/* Empty — filter has no results */}
      {!isLoading && !isError && filtered.length === 0 && vaccines.length > 0 && (
        <div className="text-center py-12 border border-dashed border-surface-border bg-white rounded-2xl text-text-muted">
          <p className="font-semibold text-text">No vaccines match this filter</p>
        </div>
      )}

      {/* Correct Stock Modal */}
      {correcting && (
        <CorrectStockModal
          vaccine={correcting.vaccine}
          stock={correcting.stock}
          onClose={() => setCorrecting(null)}
        />
      )}
    </div>
  )
}
