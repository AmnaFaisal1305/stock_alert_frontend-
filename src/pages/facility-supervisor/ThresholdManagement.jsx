import { useState } from 'react'
import { Pencil, Plus, Tag, Syringe, AlertCircle, CheckCircle2, AlertTriangle, Trash2, RefreshCcw, LayoutGrid, List } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getDashboard, updateThreshold, createVaccine, updateVaccine, deleteVaccine, updateVaccineStock } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import StatusBadge from '../../components/shared/StatusBadge'
import SkeletonCard from '../../components/shared/SkeletonCard'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import { statusConfig } from '../../lib/status'
import { displayVaccineName } from '../../lib/vaccineNames'
import RingGauge from '../../components/shared/RingGauge'

const DEFAULT_VACCINE_NAMES = [
  'Vaccine 01', 'Vaccine 02', 'Vaccine 03', 'Vaccine 04', 'Vaccine 05',
  'Vaccine 06', 'Vaccine 07', 'Vaccine 08', 'Vaccine 09', 'Vaccine 10',
  'Vaccine 11', 'Vaccine 12', 'Vaccine 13',
]

// ─── Vaccine Card ─────────────────────────────────────────────────────────────
function VaccineCard({ row, onEdit, onRename, onDelete, onCorrectStock }) {
  const status      = row.status
  const canDelete   = row.recordedAt == null
  const noThreshold = row.minQuantity == null
  const pct         = row.quantity == null
    ? 0
    : noThreshold
      ? 100
      : Math.min(Math.round((row.quantity / row.minQuantity) * 100), 100)
  const dosesShort  = !noThreshold ? Math.max(0, row.minQuantity - (row.quantity ?? 0)) : 0

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
          {noThreshold ? (
            <p className="text-[11px] text-text-muted mt-1.5 bg-surface-alt rounded px-2 py-0.5 inline-block">No threshold set</p>
          ) : (
            <div className="mt-1.5 space-y-0.5">
              <p className="text-xs text-text-muted">Min: <span className="font-semibold text-text">{row.minQuantity}</span></p>
              {dosesShort > 0 && (
                <p className={`text-xs font-bold ${status === 'critical' ? 'text-danger' : 'text-warning-dark'}`}>
                  {dosesShort} doses short
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1 border-t border-surface-border flex-wrap">
        <Button
          variant="ghost" size="sm" className="flex-1 justify-center"
          onClick={() => onRename(row)}
        >
          <Tag size={13} /> Rename
        </Button>
        <Button
          variant="ghost" size="sm" className="flex-1 justify-center"
          onClick={() => onEdit(row)}
        >
          <Pencil size={13} /> Edit Threshold
        </Button>
        <Button
          variant="ghost" size="sm" className="flex-1 justify-center"
          onClick={() => onCorrectStock(row)}
        >
          <RefreshCcw size={13} /> Correct Stock
        </Button>
        {canDelete && (
          <Button
            variant="ghost" size="sm" className="flex-1 justify-center text-danger hover:bg-danger-bg"
            onClick={() => onDelete(row)}
          >
            <Trash2 size={13} /> Delete
          </Button>
        )}
      </div>
    </div>
  )
}

function duplicateNameMessage(err) {
  return err.status === 409 ? 'A vaccine with that name already exists at your facility.' : err.message
}

const FILTERS = [
  { label: 'All',     match: () => true },
  { label: 'Critical',match: (s) => s === 'critical' },
  { label: 'Low',     match: (s) => s === 'low' },
  { label: 'OK',      match: (s) => s === 'adequate' },
  { label: 'No Data', match: (s) => s === 'no_data' },
]
const filterMatch = Object.fromEntries(FILTERS.map((f) => [f.label, f.match]))

export default function ThresholdManagement() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const [view, setView]             = useState('cards') // 'cards' | 'table'
  const [filter, setFilter]         = useState('All')
  const [editing, setEditing]       = useState(null)
  const [minQty, setMinQty]         = useState('')
  const [formError, setFormError]   = useState('')

  const [renaming, setRenaming]       = useState(null)
  const [renameValue, setRenameValue] = useState('')
  const [renameError, setRenameError] = useState('')

  const [addOpen, setAddOpen]       = useState(false)
  const [newVaccine, setNewVaccine] = useState({ name: '', minQuantity: '' })
  const [addError, setAddError]     = useState('')

  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleteError, setDeleteError]   = useState('')

  const [correcting, setCorrecting]         = useState(null)
  const [correctQty, setCorrectQty]         = useState('')
  const [correctError, setCorrectError]     = useState('')
  const [correctResult, setCorrectResult]   = useState(null)

  const { data, isLoading, isError } = useQuery({ queryKey: ['dashboard'], queryFn: getDashboard })

  const mutation = useMutation({
    mutationFn: () => updateThreshold(editing.thresholdId, parseInt(minQty, 10)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['audit-log'] })
      setEditing(null); setFormError('')
    },
    onError: (err) => setFormError(err.message),
  })

  const renameMutation = useMutation({
    mutationFn: () => updateVaccine(renaming.vaccineId, renameValue),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vaccines'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['audit-log'] })
      setRenaming(null); setRenameError('')
    },
    onError: (err) => setRenameError(duplicateNameMessage(err)),
  })

  const createVaccineMutation = useMutation({
    mutationFn: () => createVaccine({
      name: newVaccine.name,
      ...(newVaccine.minQuantity ? { minQuantity: parseInt(newVaccine.minQuantity, 10) } : {}),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vaccines'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['audit-log'] })
      setAddOpen(false); setNewVaccine({ name: '', minQuantity: '' }); setAddError('')
    },
    onError: (err) => setAddError(duplicateNameMessage(err)),
  })

  const deleteMutation = useMutation({
    mutationFn: (vaccineId) => deleteVaccine(vaccineId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vaccines'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['audit-log'] })
      setDeleteTarget(null)
      setDeleteError('')
    },
    onError: (err) => setDeleteError(
      err.status === 409 ? 'This vaccine has recorded stock history and can no longer be deleted.' : err.message
    ),
  })

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
  const existingNames = new Set(allRows.map((r) => r.vaccineName))

  // Names available to add (all 13 defaults minus what the facility already has)
  const addableNames = DEFAULT_VACCINE_NAMES
    .filter((n) => !existingNames.has(n))
    .map((n) => ({ value: n, label: displayVaccineName(n) }))

  const criticalCount = allRows.filter((r) => r.status === 'critical').length
  const lowCount      = allRows.filter((r) => r.status === 'low').length
  const noDataCount   = allRows.filter((r) => r.status === 'no_data').length
  const healthyCount  = allRows.filter((r) => r.status === 'adequate').length

  const filteredRows = allRows.filter((r) => filterMatch[filter]?.(r.status))

  const filterCount = { All: allRows.length, Critical: criticalCount, Low: lowCount, 'No Data': noDataCount, OK: healthyCount }

  function openEdit(row) { setEditing(row); setMinQty(String(row.minQuantity ?? '')); setFormError('') }
  function openRename(row) { setRenaming(row); setRenameValue(row.vaccineName); setRenameError('') }
  function openDelete(row) { setDeleteTarget(row); setDeleteError('') }
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
          <h1 className="text-xl font-bold text-text">Vaccines &amp; Thresholds</h1>
          {!isLoading && !isError && allRows.length > 0 && (
            <p className="text-sm text-text-muted mt-0.5">
              {allRows.length} vaccine{allRows.length !== 1 ? 's' : ''}
              {criticalCount > 0 && <span className="text-danger font-semibold"> · {criticalCount} critical</span>}
              {lowCount > 0 && <span className="text-warning-dark font-semibold"> · {lowCount} low</span>}
              {noDataCount > 0 && <span className="text-text-muted font-semibold"> · {noDataCount} no data</span>}
              {healthyCount > 0 && <span className="text-success-dark"> · {healthyCount} healthy</span>}
            </p>
          )}
          {(isLoading || allRows.length === 0) && (
            <p className="text-sm text-text-muted mt-0.5">Manage your facility's vaccines and minimum stock levels</p>
          )}
        </div>
        <Button onClick={() => { setAddOpen(true); setAddError('') }}>
          <Plus size={16} /> Add Vaccine
        </Button>
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
                  : label === 'OK'       ? 'bg-success text-white border-success'
                  : 'bg-primary text-white border-primary'
                  : 'bg-surface border-surface-border text-text-muted hover:border-primary/40 hover:text-primary'
              }`}
            >
              {label === 'Critical' && <AlertCircle size={11} />}
              {label === 'Low'      && <AlertTriangle size={11} />}
              {label === 'OK'       && <CheckCircle2 size={11} />}
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
              <p className="text-sm mt-1">Click "Add Vaccine" to get started.</p>
            </div>
          ) : view === 'cards' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredRows.map((row) => (
                <VaccineCard
                  key={`${row.facilityId}-${row.vaccineId}`}
                  row={row}
                  onEdit={openEdit}
                  onRename={openRename}
                  onDelete={openDelete}
                  onCorrectStock={openCorrectStock}
                />
              ))}
            </div>
          ) : (
            /* ── Table view ──────────────────────────────────────────── */
            <div className="bg-white rounded-2xl border border-surface-border overflow-hidden shadow-sm">
              {/* Column headers */}
              <div className="grid grid-cols-[2fr_1fr_1fr_1fr_2fr_140px] px-5 py-3 bg-slate-50 border-b border-surface-border gap-4 items-center">
                <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Vaccine</span>
                <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Status</span>
                <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Stock</span>
                <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Threshold</span>
                <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Level</span>
                <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest text-right">Actions</span>
              </div>

              {filteredRows.map((row) => {
                const noThreshold = row.minQuantity == null
                const pct = row.quantity == null
                  ? 0
                  : noThreshold
                    ? 100
                    : Math.min(Math.round((row.quantity / row.minQuantity) * 100), 100)
                const cfg      = statusConfig(row.status)
                const canDelete = row.recordedAt == null

                return (
                  <div
                    key={`${row.facilityId}-${row.vaccineId}`}
                    className="grid grid-cols-[2fr_1fr_1fr_1fr_2fr_140px] px-5 py-3.5 gap-4 items-center border-b border-surface-border last:border-b-0 hover:bg-slate-50/60 transition-colors"
                  >
                    {/* Name */}
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-1 h-7 rounded-full flex-shrink-0 ${cfg.dot}`} />
                      <p className="font-semibold text-sm text-text truncate" dir="rtl">{displayVaccineName(row.vaccineName)}</p>
                    </div>

                    {/* Status */}
                    <div><StatusBadge status={row.status} /></div>

                    {/* Stock */}
                    <p className="text-sm font-bold text-text tabular-nums">
                      {row.quantity ?? '—'}
                      <span className="text-[10px] text-text-muted font-normal ml-1">doses</span>
                    </p>

                    {/* Threshold */}
                    {noThreshold
                      ? <span className="text-xs text-text-muted italic">Not set</span>
                      : <p className="text-sm text-text tabular-nums">{row.minQuantity} <span className="text-[10px] text-text-muted">doses</span></p>
                    }

                    {/* Level bar */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${cfg.dot}`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[11px] font-bold text-text-muted tabular-nums w-8 text-right">{pct}%</span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => openRename(row)} title="Rename" className="p-1.5 rounded-lg text-text-muted hover:bg-slate-100 hover:text-text transition-colors">
                        <Tag size={13} />
                      </button>
                      <button onClick={() => openEdit(row)} title="Edit Threshold" className="p-1.5 rounded-lg text-text-muted hover:bg-slate-100 hover:text-text transition-colors">
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => openCorrectStock(row)} title="Correct Stock" className="p-1.5 rounded-lg text-text-muted hover:bg-slate-100 hover:text-text transition-colors">
                        <RefreshCcw size={13} />
                      </button>
                      {canDelete && (
                        <button onClick={() => openDelete(row)} title="Delete" className="p-1.5 rounded-lg text-text-muted hover:bg-danger-bg hover:text-danger transition-colors">
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* Edit Threshold Modal */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={`Edit Threshold — ${displayVaccineName(editing?.vaccineName) ?? ''}`}>
        <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); mutation.mutate() }}>
          <Input id="min-qty" label="Minimum Quantity (doses)" type="number" min="0" step="1"
            value={minQty} onChange={(e) => { setMinQty(e.target.value); setFormError('') }} required />
          {formError && <p className="text-xs text-danger">{formError}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setEditing(null)}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Saving…' : 'Save'}</Button>
          </div>
        </form>
      </Modal>

      {/* Rename Modal */}
      <Modal open={!!renaming} onClose={() => setRenaming(null)} title={`Rename — ${displayVaccineName(renaming?.vaccineName) ?? ''}`}>
        <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); renameMutation.mutate() }}>
          <p className="text-xs text-text-muted bg-surface-alt rounded-lg px-3 py-2.5 leading-relaxed">
            Names must be from the standard vaccine list.
          </p>
          <Select
            id="rename-vaccine"
            label="New Vaccine Name"
            options={DEFAULT_VACCINE_NAMES
              .filter((n) => n === renaming?.vaccineName || !existingNames.has(n))
              .map((n) => ({ value: n, label: displayVaccineName(n) }))}
            value={renameValue}
            onChange={(e) => { setRenameValue(e.target.value); setRenameError('') }}
            required
          />
          {renameError && <p className="text-xs text-danger">{renameError}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setRenaming(null)}>Cancel</Button>
            <Button type="submit" disabled={renameMutation.isPending || !renameValue}>{renameMutation.isPending ? 'Saving…' : 'Save'}</Button>
          </div>
        </form>
      </Modal>

      {/* Add Vaccine Modal */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add Vaccine">
        <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); createVaccineMutation.mutate() }}>
          {addableNames.length === 0 ? (
            <p className="text-sm text-text-muted text-center py-4">
              All 13 default vaccines are already configured for this facility.
            </p>
          ) : (
            <>
              <p className="text-xs text-text-muted bg-surface-alt rounded-lg px-3 py-2.5 leading-relaxed">
                Re-add a previously deleted vaccine. Names must be from the standard list.
              </p>
              <Select
                id="new-vaccine-name"
                label="Vaccine Name"
                options={addableNames}
                placeholder="Select a vaccine name..."
                value={newVaccine.name}
                onChange={(e) => { setNewVaccine({ ...newVaccine, name: e.target.value }); setAddError('') }}
                required
              />
              <Input id="new-vaccine-min" label="Minimum Quantity (doses, optional)" type="number" min="0" placeholder="Leave blank to set later"
                value={newVaccine.minQuantity}
                onChange={(e) => setNewVaccine({ ...newVaccine, minQuantity: e.target.value })} />
              {addError && <p className="text-xs text-danger">{addError}</p>}
            </>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setAddOpen(false)}>Cancel</Button>
            {addableNames.length > 0 && (
              <Button type="submit" disabled={createVaccineMutation.isPending || !newVaccine.name}>
                {createVaccineMutation.isPending ? 'Adding…' : 'Add Vaccine'}
              </Button>
            )}
          </div>
        </form>
      </Modal>

      {/* Delete confirmation */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete vaccine" maxWidth="max-w-sm">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-text">
            Permanently delete <span className="font-medium" dir="rtl">{displayVaccineName(deleteTarget?.vaccineName)}</span>? This cannot be undone.
          </p>
          {deleteError && <p className="text-xs text-danger bg-danger-bg rounded-lg px-3 py-2">{deleteError}</p>}
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="danger" onClick={() => deleteMutation.mutate(deleteTarget.vaccineId)} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Correct Stock Modal */}
      <Modal open={!!correcting} onClose={closeCorrectStock} title={`Correct Stock — ${displayVaccineName(correcting?.vaccineName) ?? ''}`}>
        <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); correctStockMutation.mutate() }}>
          <p className="text-xs text-text-muted bg-surface-alt rounded-lg px-3 py-2.5 leading-relaxed">
            Enter the actual current stock count. This records a correction against the difference from what's currently tracked ({correcting?.quantity ?? 0} doses).
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
