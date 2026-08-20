import { useState } from 'react'
import { RefreshCcw, Syringe, AlertCircle, AlertTriangle, CheckCircle2, LayoutGrid, List } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getDashboard, updateVaccineStock } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import StatusBadge from '../../components/shared/StatusBadge'
import SkeletonCard from '../../components/shared/SkeletonCard'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import { statusConfig } from '../../lib/status'
import { displayVaccineName } from '../../lib/vaccineNames'
import RingGauge from '../../components/shared/RingGauge'

// ─── Vaccine Card ─────────────────────────────────────────────────────────────
function VaccineCard({ row, onCorrectStock }) {
  const status      = row.status
  const pct         = row.quantity == null
    ? 0
    : row.lowDoses > 0
      ? Math.min(Math.round((row.quantity / row.lowDoses) * 100), 100)
      : 100

  const cfg         = statusConfig(status)
  const borderColor = cfg.borderL
  const ringClass    = cfg.ring

  return (
    <div className={`bg-surface rounded-xl border border-surface-border border-l-4 ${borderColor} ${ringClass} p-4 flex flex-col gap-3 hover:shadow-md transition-shadow duration-200`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {status === 'critical' && (
            <div className="relative flex-shrink-0">
              <span className="absolute inline-flex h-2.5 w-2.5 rounded-full bg-danger/40 animate-ping" />
              <AlertCircle size={13} className="relative text-danger flex-shrink-0" />
            </div>
          )}
          {status === 'low' && <AlertTriangle size={12} className="flex-shrink-0 text-warning" />}
          <p className="font-bold text-text text-base truncate" dir="rtl">{displayVaccineName(row.vaccineName)}</p>
        </div>
        <StatusBadge status={status} />
      </div>

      {/* Ring gauge + quantities */}
      <div className="flex items-center gap-3">
        <RingGauge pct={pct} status={status} size={68} />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-text leading-none">{row.quantity ?? '—'}</span>
            <span className="text-xs text-text-muted">doses in stock</span>
          </div>
          <div className="mt-1.5 space-y-0.5">
            <p className="text-xs text-text-muted">
              Critical: <span className="font-semibold text-text">{row.criticalDoses ?? '—'}</span> doses / <span className="font-semibold text-text">{row.criticalVials ?? '—'}</span> vials
            </p>
            <p className="text-xs text-text-muted">
              Low: <span className="font-semibold text-text">{row.lowDoses ?? '—'}</span> doses / <span className="font-semibold text-text">{row.lowVials ?? '—'}</span> vials
            </p>
            {row.dosesPerVial && (
              <p className="text-xs text-text-muted">{row.dosesPerVial} doses/vial</p>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1 border-t border-surface-border">
        <Button
          variant="ghost" size="sm" className="flex-1 justify-center"
          onClick={() => onCorrectStock(row)}
        >
          <RefreshCcw size={13} /> Correct Stock
        </Button>
      </div>
    </div>
  )
}

const FILTERS = [
  { label: 'All',     match: () => true },
  { label: 'Critical',match: (s) => s === 'critical' },
  { label: 'Low',     match: (s) => s === 'low' },
  { label: 'Normal',  match: (s) => s === 'adequate' },
  { label: 'No Data', match: (s) => s === 'no_data' },
]
const filterMatch = Object.fromEntries(FILTERS.map((f) => [f.label, f.match]))

export default function ThresholdManagement() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const [view, setView]   = useState('cards')
  const [filter, setFilter] = useState('All')

  const [correcting, setCorrecting]       = useState(null)
  const [correctQty, setCorrectQty]       = useState('')
  const [correctError, setCorrectError]   = useState('')
  const [correctResult, setCorrectResult] = useState(null)

  const { data, isLoading, isError } = useQuery({ queryKey: ['dashboard'], queryFn: getDashboard })

  const correctStockMutation = useMutation({
    mutationFn: () => updateVaccineStock(correcting.vaccineId, parseInt(correctQty, 10)),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['audit-log'] })
      setCorrectResult(result)
      setCorrectError('')
    },
    onError: (err) => setCorrectError(err.message),
  })

  const allRows     = (data?.facilities ?? []).filter((r) => r.facilityId === user.facilityId)

  const criticalCount = allRows.filter((r) => r.status === 'critical').length
  const lowCount      = allRows.filter((r) => r.status === 'low').length
  const noDataCount   = allRows.filter((r) => r.status === 'no_data').length
  const healthyCount  = allRows.filter((r) => r.status === 'adequate').length

  const filteredRows = allRows.filter((r) => filterMatch[filter]?.(r.status))

  const filterCount = { All: allRows.length, Critical: criticalCount, Low: lowCount, 'No Data': noDataCount, Normal: healthyCount }

  function openCorrectStock(row) {
    setCorrecting(row); setCorrectQty(String(row.quantity ?? 0)); setCorrectError(''); setCorrectResult(null)
  }
  function closeCorrectStock() {
    setCorrecting(null); setCorrectQty(''); setCorrectError(''); setCorrectResult(null); correctStockMutation.reset()
  }

  return (
    <div className="flex flex-col gap-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-text">Vaccines</h1>
          {!isLoading && !isError && allRows.length > 0 && (
            <p className="text-sm text-text-muted mt-0.5">
              {allRows.length} vaccine{allRows.length !== 1 ? 's' : ''}
              {criticalCount > 0 && <span className="text-danger font-semibold"> · {criticalCount} critical</span>}
              {lowCount > 0 && <span className="text-warning-dark font-semibold"> · {lowCount} low</span>}
              {noDataCount > 0 && <span className="text-text-muted font-semibold"> · {noDataCount} not updated</span>}
              {healthyCount > 0 && <span className="text-success-dark"> · {healthyCount} normal</span>}
            </p>
          )}
          {(isLoading || allRows.length === 0) && (
            <p className="text-sm text-text-muted mt-0.5">Global vaccine catalog for your facility</p>
          )}
        </div>
      </div>

      {/* Filter pills + view toggle */}
      {!isLoading && !isError && allRows.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {FILTERS.map(({ label }) => (
            <button
              key={label}
              onClick={() => setFilter(label)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all duration-150 ${
                filter === label
                  ? label === 'Critical' ? 'bg-danger text-white border-danger'
                  : label === 'Low'      ? 'bg-warning text-white border-warning'
                  : label === 'No Data'  ? 'bg-slate-500 text-white border-slate-500'
                  : label === 'Normal'   ? 'bg-success text-white border-success'
                  : 'bg-primary text-white border-primary'
                  : 'bg-surface border-surface-border text-text-muted hover:border-primary/40 hover:text-primary'
              }`}
            >
              {label === 'Critical' && <AlertCircle size={11} />}
              {label === 'Low'      && <AlertTriangle size={11} />}
              {label === 'Normal'   && <CheckCircle2 size={11} />}
              {label === 'All'      && <Syringe size={11} />}
              {label}
              <span className="opacity-70">({filterCount[label]})</span>
            </button>
          ))}

          {/* View toggle */}
          <div className="flex items-center gap-0.5 bg-white border border-surface-border rounded-xl p-1 shadow-sm ml-auto">
            <button
              onClick={() => setView('cards')}
              title="Card view"
              className={`p-1.5 rounded-lg transition-all ${view === 'cards' ? 'bg-primary text-white shadow-sm' : 'text-text-muted hover:bg-slate-50 hover:text-text'}`}
            >
              <LayoutGrid size={14} />
            </button>
            <button
              onClick={() => setView('table')}
              title="Table view"
              className={`p-1.5 rounded-lg transition-all ${view === 'table' ? 'bg-primary text-white shadow-sm' : 'text-text-muted hover:bg-slate-50 hover:text-text'}`}
            >
              <List size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3,4,5,6].map((i) => <SkeletonCard key={i} lines={3} />)}
        </div>
      )}

      {/* Error */}
      {isError && <p className="text-sm text-danger">Failed to load data.</p>}

      {/* Card / Table view */}
      {!isLoading && !isError && (
        <>
          {filteredRows.length === 0 && allRows.length > 0 ? (
            <div className="text-center py-14 border border-dashed border-surface-border rounded-xl text-text-muted">
              <CheckCircle2 size={36} className="mx-auto mb-3 opacity-20" />
              <p className="font-semibold text-text">No vaccines in this category</p>
              <button onClick={() => setFilter('All')} className="text-sm text-primary hover:underline mt-2">
                Show all vaccines
              </button>
            </div>
          ) : allRows.length === 0 ? (
            <div className="text-center py-14 border border-dashed border-surface-border rounded-xl text-text-muted">
              <Syringe size={40} className="mx-auto mb-3 opacity-20" />
              <p className="font-semibold text-text">No vaccines configured yet</p>
              <p className="text-sm mt-1">Contact a Super Admin to add vaccines to the catalog.</p>
            </div>
          ) : view === 'cards' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredRows.map((row) => (
                <VaccineCard
                  key={`${row.facilityId}-${row.vaccineId}`}
                  row={row}
                  onCorrectStock={openCorrectStock}
                />
              ))}
            </div>
          ) : (
            /* ── Table view ──────────────────────────────────────────── */
            <div className="bg-white rounded-2xl border border-surface-border overflow-hidden shadow-sm">
              <div className="grid grid-cols-[2fr_1fr_1fr_1fr_2fr_100px] px-5 py-3 bg-slate-50 border-b border-surface-border gap-4 items-center">
                <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Vaccine</span>
                <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Status</span>
                <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Stock</span>
                <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Critical</span>
                <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Level</span>
                <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest text-right">Action</span>
              </div>

              {filteredRows.map((row) => {
                const pct = row.quantity == null
                  ? 0
                  : row.lowDoses > 0
                    ? Math.min(Math.round((row.quantity / row.lowDoses) * 100), 100)
                    : 100
                const cfg = statusConfig(row.status)

                return (
                  <div
                    key={`${row.facilityId}-${row.vaccineId}`}
                    className="grid grid-cols-[2fr_1fr_1fr_1fr_2fr_100px] px-5 py-3.5 gap-4 items-center border-b border-surface-border last:border-b-0 hover:bg-slate-50/60 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-1 h-7 rounded-full flex-shrink-0 ${cfg.dot}`} />
                      <p className="font-semibold text-sm text-text truncate" dir="rtl">{displayVaccineName(row.vaccineName)}</p>
                    </div>
                    <div><StatusBadge status={row.status} /></div>
                    <p className="text-sm font-bold text-text tabular-nums">
                      {row.quantity ?? '—'}
                      <span className="text-[10px] text-text-muted font-normal ml-1">doses</span>
                    </p>
                    <p className="text-sm text-text tabular-nums">
                      {row.criticalDoses ?? '—'} <span className="text-[10px] text-text-muted">doses</span>
                    </p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${cfg.dot}`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[11px] font-bold text-text-muted tabular-nums w-8 text-right">{pct}%</span>
                    </div>
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => openCorrectStock(row)} title="Correct Stock" className="p-1.5 rounded-lg text-text-muted hover:bg-slate-100 hover:text-text transition-colors">
                        <RefreshCcw size={13} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* Correct Stock Modal */}
      <Modal open={!!correcting} onClose={closeCorrectStock} title={`Correct Stock — ${displayVaccineName(correcting?.vaccineName) ?? ''}`}>
        <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); correctStockMutation.mutate() }}>
          <p className="text-xs text-text-muted bg-surface-alt rounded-lg px-3 py-2.5 leading-relaxed">
            Enter the actual current stock count in doses. This records a correction against the difference from what's currently tracked ({correcting?.quantity ?? 0} doses).
          </p>
          <Input id="correct-qty" label="Actual Current Stock (doses)" type="number" min="0" step="1"
            value={correctQty} onChange={(e) => { setCorrectQty(e.target.value); setCorrectError(''); setCorrectResult(null) }} required />
          {correctError && <p className="text-xs text-danger">{correctError}</p>}
          {correctResult && !correctResult.entry && (
            <p className="text-xs text-success-dark bg-success-bg rounded-lg px-3 py-2">No change — stock already matched.</p>
          )}
          {correctResult?.entry && (
            <p className="text-xs text-success-dark bg-success-bg rounded-lg px-3 py-2">
              Correction recorded: new balance {correctResult.balance} doses.
            </p>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={closeCorrectStock}>
              {correctResult ? 'Close' : 'Cancel'}
            </Button>
            {!correctResult && (
              <Button type="submit" disabled={correctStockMutation.isPending}>
                {correctStockMutation.isPending ? 'Saving…' : 'Save Correction'}
              </Button>
            )}
          </div>
        </form>
      </Modal>
    </div>
  )
}
