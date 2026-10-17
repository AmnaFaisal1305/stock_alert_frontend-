import { useState } from 'react'
import { Plus, Pencil, Trash2, Syringe } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getVaccines, createVaccine, updateVaccine, deleteVaccine } from '../../lib/api'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import PageHeader from '../../components/shared/PageHeader'
import Table from '../../components/shared/Table'
import EmptyState from '../../components/shared/EmptyState'
import ErrorState from '../../components/shared/ErrorState'
import EntityCard from '../../components/shared/EntityCard'
import RowActions from '../../components/ui/RowActions'
import ViewToggle from '../../components/ui/ViewToggle'
import { SummaryDialog } from '../../components/ui/ReviewDialog'
import { useViewMode } from '../../hooks/useViewMode'
import { displayVaccineName } from '../../lib/vaccineNames'
import { useAuth } from '../../context/AuthContext'
import { plural } from '../../lib/format'

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
        id="vname" label="Vaccine name" placeholder="e.g. BCG"
        value={form.name}
        onChange={(e) => set('name', e.target.value)}
        required
      />
      <Input
        id="dpv" label="Doses per vial" type="number" min="1" step="1"
        placeholder="e.g. 10"
        value={form.dosesPerVial}
        onChange={(e) => set('dosesPerVial', e.target.value)}
        required
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input
          id="critDoses" label="Critical (doses)" type="number" min="0" step="1"
          placeholder={String(DEFAULTS.criticalDoses)}
          value={form.criticalDoses}
          onChange={(e) => set('criticalDoses', e.target.value)}
        />
        <Input
          id="lowDoses" label="Low (doses)" type="number" min="0" step="1"
          placeholder={String(DEFAULTS.lowDoses)}
          value={form.lowDoses}
          onChange={(e) => set('lowDoses', e.target.value)}
        />
        <Input
          id="critVials" label="Critical (vials)" type="number" min="0" step="1"
          placeholder={String(DEFAULTS.criticalVials)}
          value={form.criticalVials}
          onChange={(e) => set('criticalVials', e.target.value)}
        />
        <Input
          id="lowVials" label="Low (vials)" type="number" min="0" step="1"
          placeholder={String(DEFAULTS.lowVials)}
          value={form.lowVials}
          onChange={(e) => set('lowVials', e.target.value)}
        />
      </div>
      {error && <p role="alert" className="text-sm text-danger-dark bg-danger-bg rounded-control px-3.5 py-2.5">{error}</p>}
      <div className="flex justify-end gap-2 pt-1">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Saving…' : submitLabel}
        </Button>
      </div>
    </form>
  )
}

export default function VaccineManagement() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const [addOpen, setAddOpen]       = useState(false)
  const [editing, setEditing]       = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [addError, setAddError]     = useState('')
  const [editError, setEditError]   = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [created, setCreated]       = useState(null)
  const [view, setView]             = useViewMode('admin-vaccines')

  const { data, isLoading, isError, error, refetch } = useQuery({ queryKey: ['vaccines'], queryFn: getVaccines })
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
    onSuccess: (_data, form) => {
      invalidate(); setAddOpen(false); setAddError('')
      const val = (k) => (form[k] !== '' ? form[k] : `${DEFAULTS[k]} (default)`)
      setCreated([
        { label: 'Name', value: displayVaccineName(form.name.trim()) },
        { label: 'Doses per vial', value: form.dosesPerVial },
        { label: 'Critical', value: `${val('criticalDoses')} doses · ${val('criticalVials')} vials` },
        { label: 'Low', value: `${val('lowDoses')} doses · ${val('lowVials')} vials` },
      ])
    },
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

  const readOnly = user?.role === 'observer'
  const dash = (n) => <span className="tabular-nums">{n}</span>

  const actions = (v) => (
    <RowActions
      className="justify-end"
      actions={[
        { icon: Pencil, label: 'Edit', onClick: () => { setEditing(v); setEditError('') } },
        { icon: Trash2, label: 'Delete', danger: true, onClick: () => { setDeleteTarget(v); setDeleteError('') } },
      ]}
    />
  )

  const gridCard = (v) => (
    <EntityCard
      icon={Syringe}
      accent={1}
      title={<span dir="auto">{displayVaccineName(v.name)}</span>}
      subtitle={`${plural(v.dosesPerVial, 'dose')} per vial`}
      meta={[
        { label: 'Critical', value: `${v.criticalDoses} doses · ${v.criticalVials} vials` },
        { label: 'Low', value: `${v.lowDoses} doses · ${v.lowVials} vials` },
      ]}
      actions={!readOnly && actions(v)}
    />
  )

  const columns = [
    { key: 'name', label: 'Vaccine', render: (v) => <span className="font-medium whitespace-nowrap" dir="auto">{displayVaccineName(v.name)}</span> },
    { key: 'dpv', label: 'Doses / vial', align: 'right', render: (v) => dash(v.dosesPerVial) },
    { key: 'cd', label: 'Critical doses', align: 'right', render: (v) => dash(v.criticalDoses) },
    { key: 'ld', label: 'Low doses', align: 'right', render: (v) => dash(v.lowDoses) },
    { key: 'cv', label: 'Critical vials', align: 'right', render: (v) => dash(v.criticalVials) },
    { key: 'lv', label: 'Low vials', align: 'right', render: (v) => dash(v.lowVials) },
    ...(readOnly ? [] : [{ key: 'actions', label: '', align: 'right', render: actions }]),
  ]

  return (
    <div>
      <PageHeader
        breadcrumb="Super Admin › Manage"
        title="Vaccines"
        subtitle={isLoading ? undefined : `${plural(vaccines.length, 'vaccine')} · thresholds apply to every facility unless overridden`}
        actions={!readOnly && (
          <Button onClick={() => { setAddOpen(true); setAddError('') }}><Plus size={16} strokeWidth={1.75} /> Add vaccine</Button>
        )}
      />

      {isError ? (
        <ErrorState title="Couldn’t load the vaccine catalog" error={error} onRetry={refetch} />
      ) : !isLoading && vaccines.length === 0 ? (
        <EmptyState
          framed
          icon={Syringe}
          title="No vaccines yet"
          message={readOnly ? 'The catalog is empty.' : 'Add the first vaccine to start tracking stock.'}
        />
      ) : (
        <div className="flex flex-col gap-3">
          <div className="hidden sm:flex justify-end">
            <ViewToggle value={view} onChange={setView} />
          </div>
          <Table
            columns={columns}
            rows={vaccines}
            loading={isLoading}
            view={view}
            gridCard={gridCard}
            mobileCard={(v) => (
              <div className="px-4 py-3.5 flex flex-col gap-2">
                <p className="font-medium text-text" dir="auto">{displayVaccineName(v.name)}</p>
                <p className="text-xs text-text-muted tabular-nums">
                  {v.dosesPerVial} doses/vial · critical {v.criticalDoses}d / {v.criticalVials}v · low {v.lowDoses}d / {v.lowVials}v
                </p>
                {!readOnly && actions(v)}
              </div>
            )}
          />
          {vaccines.length > 0 && (
            <p className="text-xs text-text-muted">
              Changing thresholds or doses per vial applies to every facility immediately. A vaccine with recorded stock history can’t be deleted.
            </p>
          )}
        </div>
      )}

      {/* Add Modal */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add vaccine">
        <VaccineForm
          initial={emptyForm}
          onSubmit={(form) => createMutation.mutate(form)}
          isPending={createMutation.isPending}
          error={addError}
          submitLabel="Add vaccine"
        />
      </Modal>

      {/* Edit Modal */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={`Edit ${editing ? displayVaccineName(editing.name) : ''}`}>
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
            submitLabel="Save changes"
          />
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteMutation.mutate()}
        title="Delete vaccine?"
        message={<p className="text-sm text-text">Delete <span className="font-medium" dir="auto">{displayVaccineName(deleteTarget?.name)}</span> from the global catalog? This cannot be undone and will remove it from every facility's dashboard.</p>}
        confirmLabel="Delete"
        isPending={deleteMutation.isPending}
        error={deleteError}
      />

      <SummaryDialog
        open={!!created}
        onClose={() => setCreated(null)}
        title="Vaccine added"
        message="It now appears in every facility’s stock list with these thresholds."
        rows={created ?? []}
      />
    </div>
  )
}
