import { useState } from 'react'
import { Plus, Pencil, Trash2, Syringe, AlertCircle } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getVaccines, createVaccine, updateVaccine, deleteVaccine } from '../../lib/api'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Badge from '../../components/ui/Badge'
import { displayVaccineName } from '../../lib/vaccineNames'

const DEFAULTS = { criticalDoses: 30, lowDoses: 60, criticalVials: 3, lowVials: 6 }

function VaccineForm({ initial, onSubmit, isPending, error, submitLabel }) {
  const [form, setForm] = useState(initial)
  function set(k, v) { setForm((f) => ({ ...f, [k]: v })) }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => { e.preventDefault(); onSubmit(form) }}
    >
      <Input
        id="vname" label="Vaccine Name *" placeholder="e.g. BCG"
        value={form.name}
        onChange={(e) => set('name', e.target.value)}
        required
      />
      <Input
        id="dpv" label="Doses per Vial *" type="number" min="1" step="1"
        placeholder="e.g. 10"
        value={form.dosesPerVial}
        onChange={(e) => set('dosesPerVial', e.target.value)}
        required
      />
      <div className="grid grid-cols-2 gap-3">
        <Input
          id="critDoses" label="Critical Doses" type="number" min="0" step="1"
          placeholder={String(DEFAULTS.criticalDoses)}
          value={form.criticalDoses}
          onChange={(e) => set('criticalDoses', e.target.value)}
        />
        <Input
          id="lowDoses" label="Low Doses" type="number" min="0" step="1"
          placeholder={String(DEFAULTS.lowDoses)}
          value={form.lowDoses}
          onChange={(e) => set('lowDoses', e.target.value)}
        />
        <Input
          id="critVials" label="Critical Vials" type="number" min="0" step="1"
          placeholder={String(DEFAULTS.criticalVials)}
          value={form.criticalVials}
          onChange={(e) => set('criticalVials', e.target.value)}
        />
        <Input
          id="lowVials" label="Low Vials" type="number" min="0" step="1"
          placeholder={String(DEFAULTS.lowVials)}
          value={form.lowVials}
          onChange={(e) => set('lowVials', e.target.value)}
        />
      </div>
      {error && <p className="text-xs text-danger bg-danger-bg rounded-lg px-3 py-2">{error}</p>}
      <div className="flex justify-end gap-3 pt-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Saving…' : submitLabel}
        </Button>
      </div>
    </form>
  )
}

export default function VaccineManagement() {
  const queryClient = useQueryClient()

  const [addOpen, setAddOpen]       = useState(false)
  const [editing, setEditing]       = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [addError, setAddError]     = useState('')
  const [editError, setEditError]   = useState('')
  const [deleteError, setDeleteError] = useState('')

  const { data, isLoading, isError } = useQuery({ queryKey: ['vaccines'], queryFn: getVaccines })
  const vaccines = data?.vaccines ?? []

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['vaccines'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
  }

  const createMutation = useMutation({
    mutationFn: (form) => createVaccine({
      name: form.name.trim(),
      dosesPerVial: parseInt(form.dosesPerVial, 10),
      ...(form.criticalDoses !== '' ? { criticalDoses: parseInt(form.criticalDoses, 10) } : {}),
      ...(form.lowDoses      !== '' ? { lowDoses:      parseInt(form.lowDoses, 10) }      : {}),
      ...(form.criticalVials !== '' ? { criticalVials: parseInt(form.criticalVials, 10) } : {}),
      ...(form.lowVials      !== '' ? { lowVials:      parseInt(form.lowVials, 10) }      : {}),
    }),
    onSuccess: () => { invalidate(); setAddOpen(false); setAddError('') },
    onError: (err) => setAddError(err.status === 409 ? 'A vaccine with that name already exists.' : err.message),
  })

  const editMutation = useMutation({
    mutationFn: (form) => {
      const payload = {}
      if (form.name.trim() !== editing.name) payload.name = form.name.trim()
      if (form.dosesPerVial !== '' && parseInt(form.dosesPerVial, 10) !== editing.dosesPerVial)
        payload.dosesPerVial = parseInt(form.dosesPerVial, 10)
      if (form.criticalDoses !== '' && parseInt(form.criticalDoses, 10) !== editing.criticalDoses)
        payload.criticalDoses = parseInt(form.criticalDoses, 10)
      if (form.lowDoses !== '' && parseInt(form.lowDoses, 10) !== editing.lowDoses)
        payload.lowDoses = parseInt(form.lowDoses, 10)
      if (form.criticalVials !== '' && parseInt(form.criticalVials, 10) !== editing.criticalVials)
        payload.criticalVials = parseInt(form.criticalVials, 10)
      if (form.lowVials !== '' && parseInt(form.lowVials, 10) !== editing.lowVials)
        payload.lowVials = parseInt(form.lowVials, 10)
      return updateVaccine(editing.id, payload)
    },
    onSuccess: () => { invalidate(); setEditing(null); setEditError('') },
    onError: (err) => setEditError(err.status === 409 ? 'A vaccine with that name already exists.' : err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteVaccine(deleteTarget.id),
    onSuccess: () => { invalidate(); setDeleteTarget(null); setDeleteError('') },
    onError: (err) => setDeleteError(
      err.status === 409 ? 'This vaccine has recorded stock history and cannot be deleted.' : err.message
    ),
  })

  const emptyForm = { name: '', dosesPerVial: '', criticalDoses: '', lowDoses: '', criticalVials: '', lowVials: '' }

  return (
    <div className="flex flex-col gap-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-text">Vaccine Catalog</h1>
          <p className="text-sm text-text-muted mt-0.5">
            {isLoading ? 'Loading…' : `${vaccines.length} vaccine${vaccines.length !== 1 ? 's' : ''} · global, applies to all facilities`}
          </p>
        </div>
        <Button onClick={() => { setAddOpen(true); setAddError('') }}>
          <Plus size={16} /> Add Vaccine
        </Button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex flex-col gap-3">
          {[1,2,3,4,5].map((i) => (
            <div key={i} className="h-14 bg-slate-50 border border-slate-200 rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {/* Error */}
      {isError && (
        <div className="bg-danger-bg border border-danger/10 text-xs font-semibold text-danger rounded-xl px-4 py-3">
          Failed to load vaccine catalog.
        </div>
      )}

      {/* Empty */}
      {!isLoading && !isError && vaccines.length === 0 && (
        <div className="text-center py-16 border border-dashed border-surface-border rounded-xl text-text-muted">
          <Syringe size={36} className="mx-auto mb-3 opacity-20" />
          <p className="font-semibold text-text">No vaccines yet</p>
          <p className="text-sm mt-1">Click "Add Vaccine" to create the first catalog entry.</p>
        </div>
      )}

      {/* Table */}
      {!isLoading && !isError && vaccines.length > 0 && (
        <div className="bg-white rounded-2xl border border-surface-border overflow-hidden shadow-sm">
          <div className="grid grid-cols-[2fr_80px_90px_90px_90px_90px_100px] px-5 py-3 bg-slate-50 border-b border-surface-border gap-3 items-center">
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Vaccine</span>
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Doses/Vial</span>
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Crit. Doses</span>
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Low Doses</span>
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Crit. Vials</span>
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Low Vials</span>
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest text-right">Actions</span>
          </div>
          {vaccines.map((v) => (
            <div
              key={v.id}
              className="grid grid-cols-[2fr_80px_90px_90px_90px_90px_100px] px-5 py-3.5 gap-3 items-center border-b border-surface-border last:border-b-0 hover:bg-slate-50/60 transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Syringe size={13} className="text-primary flex-shrink-0" />
                <span className="font-semibold text-sm text-text truncate" dir="rtl">{displayVaccineName(v.name)}</span>
              </div>
              <span className="text-sm tabular-nums text-text">{v.dosesPerVial}</span>
              <span className="text-sm tabular-nums text-text">{v.criticalDoses}</span>
              <span className="text-sm tabular-nums text-text">{v.lowDoses}</span>
              <span className="text-sm tabular-nums text-text">{v.criticalVials}</span>
              <span className="text-sm tabular-nums text-text">{v.lowVials}</span>
              <div className="flex items-center gap-1 justify-end">
                <button
                  onClick={() => { setEditing(v); setEditError('') }}
                  title="Edit"
                  className="p-1.5 rounded-lg text-text-muted hover:bg-slate-100 hover:text-text transition-colors"
                >
                  <Pencil size={13} />
                </button>
                <button
                  onClick={() => { setDeleteTarget(v); setDeleteError('') }}
                  title="Delete"
                  className="p-1.5 rounded-lg text-text-muted hover:bg-danger-bg hover:text-danger transition-colors"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info note */}
      {!isLoading && vaccines.length > 0 && (
        <div className="flex items-start gap-2 text-xs text-text-muted bg-surface-alt rounded-xl px-4 py-3 border border-surface-border">
          <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
          <span>Editing a vaccine's thresholds or doses-per-vial takes effect across all facilities immediately. A vaccine cannot be deleted once it has recorded stock history.</span>
        </div>
      )}

      {/* Add Modal */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add Vaccine">
        <VaccineForm
          initial={emptyForm}
          onSubmit={(form) => createMutation.mutate(form)}
          isPending={createMutation.isPending}
          error={addError}
          submitLabel="Add Vaccine"
        />
      </Modal>

      {/* Edit Modal */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={`Edit — ${displayVaccineName(editing?.name) ?? ''}`}>
        {editing && (
          <VaccineForm
            initial={{
              name: editing.name,
              dosesPerVial: String(editing.dosesPerVial),
              criticalDoses: String(editing.criticalDoses),
              lowDoses: String(editing.lowDoses),
              criticalVials: String(editing.criticalVials),
              lowVials: String(editing.lowVials),
            }}
            onSubmit={(form) => editMutation.mutate(form)}
            isPending={editMutation.isPending}
            error={editError}
            submitLabel="Save Changes"
          />
        )}
      </Modal>

      {/* Delete confirm */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete vaccine" maxWidth="max-w-sm">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-text">
            Delete <span className="font-semibold" dir="rtl">{displayVaccineName(deleteTarget?.name)}</span> from the global catalog?
            This cannot be undone and will remove it from every facility's dashboard.
          </p>
          {deleteError && <p className="text-xs text-danger bg-danger-bg rounded-lg px-3 py-2">{deleteError}</p>}
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="danger" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
