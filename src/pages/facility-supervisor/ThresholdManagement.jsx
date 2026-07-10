import { useState } from 'react'
import { Pencil, Plus, Tag, Syringe, AlertCircle, CheckCircle2, AlertTriangle, Trash2, RefreshCcw } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getDashboard, updateThreshold, createVaccine, updateVaccine, deleteVaccine, updateVaccineStock } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import StatusBadge from '../../components/shared/StatusBadge'
import SkeletonCard from '../../components/shared/SkeletonCard'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import { statusConfig, FILTERS as STATUS_FILTERS } from '../../lib/status'
import RingGauge from '../../components/shared/RingGauge'

// ─── Vaccine Card ─────────────────────────────────────────────────────────────
function VaccineCard({ row, onEdit, onRename, onDelete, onCorrectStock }) {
  const status      = row.status
  const canDelete   = row.recordedAt == null
  const noThreshold = row.minQuantity === 0
  const pct         = noThreshold
    ? 100
    : Math.min(Math.round(((row.quantity ?? 0) / row.minQuantity) * 100), 100)
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
          <p className="font-bold text-text text-base truncate">{row.vaccineName}</p>
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

const FILTERS = STATUS_FILTERS.map((f) => f.label)
const filterMatch = Object.fromEntries(STATUS_FILTERS.map((f) => [f.label, f.match]))

export default function ThresholdManagement() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

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
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['dashboard'] }); setEditing(null); setFormError('') },
    onError: (err) => setFormError(err.message),
  })

  const renameMutation = useMutation({
    mutationFn: () => updateVaccine(renaming.vaccineId, renameValue),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vaccines'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
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
      setAddOpen(false); setNewVaccine({ name: '', minQuantity: '' }); setAddError('')
    },
    onError: (err) => setAddError(duplicateNameMessage(err)),
  })

  const deleteMutation = useMutation({
    mutationFn: (vaccineId) => deleteVaccine(vaccineId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vaccines'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
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
      setCorrectResult(result)
      setCorrectError('')
    },
    onError: (err) => setCorrectError(err.message),
  })

  const allRows     = (data?.facilities ?? []).filter((r) => r.facilityId === user.facilityId)
  const criticalCount = allRows.filter((r) => filterMatch.Critical(r.status)).length
  const lowCount      = allRows.filter((r) => filterMatch.Low(r.status)).length
  const healthyCount  = allRows.filter((r) => filterMatch.OK(r.status)).length

  const filteredRows = allRows.filter((r) => filterMatch[filter](r.status))

  const filterCount = { All: allRows.length, Critical: criticalCount, Low: lowCount, OK: healthyCount }

  function openEdit(row) { setEditing(row); setMinQty(String(row.minQuantity)); setFormError('') }
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

      {/* Filter pills */}
      {!isLoading && !isError && allRows.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all duration-150 ${
                filter === f
                  ? f === 'Critical' ? 'bg-danger text-white border-danger'
                  : f === 'Low'      ? 'bg-warning text-white border-warning'
                  : f === 'OK'       ? 'bg-success text-white border-success'
                  : 'bg-primary text-white border-primary'
                  : 'bg-surface border-surface-border text-text-muted hover:border-primary/40 hover:text-primary'
              }`}
            >
              {f === 'Critical' && <AlertCircle size={11} />}
              {f === 'Low'      && <AlertTriangle size={11} />}
              {f === 'OK'       && <CheckCircle2 size={11} />}
              {f === 'All'      && <Syringe size={11} />}
              {f}
              <span className="opacity-70">({filterCount[f]})</span>
            </button>
          ))}
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

      {/* Card grid */}
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
          ) : (
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
          )}
        </>
      )}

      {/* Edit Threshold Modal */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={`Edit Threshold — ${editing?.vaccineName ?? ''}`}>
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
      <Modal open={!!renaming} onClose={() => setRenaming(null)} title={`Rename — ${renaming?.vaccineName ?? ''}`}>
        <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); renameMutation.mutate() }}>
          <Input id="rename-vaccine" label="Vaccine Name"
            value={renameValue} onChange={(e) => { setRenameValue(e.target.value); setRenameError('') }} required />
          {renameError && <p className="text-xs text-danger">{renameError}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setRenaming(null)}>Cancel</Button>
            <Button type="submit" disabled={renameMutation.isPending}>{renameMutation.isPending ? 'Saving…' : 'Save'}</Button>
          </div>
        </form>
      </Modal>

      {/* Add Vaccine Modal */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add New Vaccine">
        <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); createVaccineMutation.mutate() }}>
          <p className="text-xs text-text-muted bg-surface-alt rounded-lg px-3 py-2.5 leading-relaxed">
            New vaccines start with zero stock. Set a minimum threshold so alerts trigger automatically when stock runs low.
          </p>
          <Input id="new-vaccine-name" label="Vaccine Name"
            value={newVaccine.name}
            onChange={(e) => { setNewVaccine({ ...newVaccine, name: e.target.value }); setAddError('') }} required />
          <Input id="new-vaccine-min" label="Minimum Quantity (doses, optional)" type="number" min="0" placeholder="Defaults to 0"
            value={newVaccine.minQuantity}
            onChange={(e) => setNewVaccine({ ...newVaccine, minQuantity: e.target.value })} />
          {addError && <p className="text-xs text-danger">{addError}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={createVaccineMutation.isPending}>
              {createVaccineMutation.isPending ? 'Adding…' : 'Add Vaccine'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete confirmation */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete vaccine" maxWidth="max-w-sm">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-text">
            Permanently delete <span className="font-medium">{deleteTarget?.vaccineName}</span>? This cannot be undone.
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
      <Modal open={!!correcting} onClose={closeCorrectStock} title={`Correct Stock — ${correcting?.vaccineName ?? ''}`}>
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
