import { useState } from 'react'
import { Plus, Pencil, Trash2, Syringe, X } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getVaccines, createVaccine, updateVaccine, deleteVaccine,
  getDistricts, getUnionCouncils, getFacilities, getFacility,
  updateFacilityVaccine,
} from '../../lib/api'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import RowActions from '../../components/ui/RowActions'
import ViewToggle from '../../components/ui/ViewToggle'
import ExportButton from '../../components/ui/ExportButton'
import { SummaryDialog } from '../../components/ui/ReviewDialog'
import PageHeader from '../../components/shared/PageHeader'
import Card from '../../components/shared/Card'
import Table from '../../components/shared/Table'
import EntityCard from '../../components/shared/EntityCard'
import EmptyState from '../../components/shared/EmptyState'
import ErrorState from '../../components/shared/ErrorState'
import { useViewMode } from '../../hooks/useViewMode'
import { plural } from '../../lib/format'
import { useAuth } from '../../context/AuthContext'

const DEFAULTS = { criticalDoses: 30, lowDoses: 60, criticalVials: 3, lowVials: 6 }

function VaccineForm({ initial, onSubmit, isPending, error, submitLabel }) {
  const [form, setForm] = useState(initial)
  function set(k, v) { setForm((f) => ({ ...f, [k]: v })) }

  return (
    <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); onSubmit(form) }}>
      <Input
        id="vname" label="Vaccine Name *" placeholder="e.g. BCG"
        value={form.name} onChange={(e) => set('name', e.target.value)} required
      />
      <Input
        id="dpv" label="Doses per vial *" type="number" min="1" step="1"
        placeholder="e.g. 10" value={form.dosesPerVial}
        onChange={(e) => set('dosesPerVial', e.target.value)} required
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input id="critDoses" label="Critical Doses" type="number" min="0" step="1"
          placeholder={String(DEFAULTS.criticalDoses)} value={form.criticalDoses}
          onChange={(e) => set('criticalDoses', e.target.value)} />
        <Input id="lowDoses" label="Low Doses" type="number" min="0" step="1"
          placeholder={String(DEFAULTS.lowDoses)} value={form.lowDoses}
          onChange={(e) => set('lowDoses', e.target.value)} />
        <Input id="critVials" label="Critical Vials" type="number" min="0" step="1"
          placeholder={String(DEFAULTS.criticalVials)} value={form.criticalVials}
          onChange={(e) => set('criticalVials', e.target.value)} />
        <Input id="lowVials" label="Low Vials" type="number" min="0" step="1"
          placeholder={String(DEFAULTS.lowVials)} value={form.lowVials}
          onChange={(e) => set('lowVials', e.target.value)} />
      </div>
      {error && <p role="alert" className="text-sm text-danger-dark bg-danger-bg rounded-control px-3.5 py-2.5">{error}</p>}
      <div className="flex justify-end gap-3 pt-2">
        <Button type="submit" disabled={isPending}>{isPending ? 'Saving…' : submitLabel}</Button>
      </div>
    </form>
  )
}

function FacilityVaccineForm({ facilityName, onSubmit, onReset, isPending, isResetting, error, initial }) {
  const [form, setForm] = useState(initial)
  function set(k, v) { setForm((f) => ({ ...f, [k]: v })) }

  return (
    <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); onSubmit(form) }}>
      <p className="text-xs text-text-muted">
        Overrides the global thresholds for <span className="font-semibold text-text">{facilityName}</span> only.
      </p>
      {/* Doses per vial is global: every ledger row stores vials × dosesPerVial (Round 36). */}
      <p className="text-sm text-text">
        <span className="tabular-nums font-medium">{form.dosesPerVial ?? '—'}</span> doses per vial
        <span className="text-text-muted"> · set in the global catalog</span>
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input id="fcritDoses" label="Critical Doses" type="number" min="0" step="1"
          value={form.criticalDoses} onChange={(e) => set('criticalDoses', e.target.value)} />
        <Input id="flowDoses" label="Low Doses" type="number" min="0" step="1"
          value={form.lowDoses} onChange={(e) => set('lowDoses', e.target.value)} />
        <Input id="fcritVials" label="Critical Vials" type="number" min="0" step="1"
          value={form.criticalVials} onChange={(e) => set('criticalVials', e.target.value)} />
        <Input id="flowVials" label="Low Vials" type="number" min="0" step="1"
          value={form.lowVials} onChange={(e) => set('lowVials', e.target.value)} />
      </div>
      {error && <p role="alert" className="text-sm text-danger-dark bg-danger-bg rounded-control px-3.5 py-2.5">{error}</p>}
      <div className="flex justify-between gap-3 pt-2">
        <Button type="button" variant="ghost" disabled={isResetting} onClick={onReset}>
          {isResetting ? 'Resetting…' : 'Reset to default'}
        </Button>
        <Button type="submit" disabled={isPending}>{isPending ? 'Saving…' : 'Save'}</Button>
      </div>
    </form>
  )
}

export default function VaccineManagement() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  // Cascade filter state
  const [selectedDistrict, setSelectedDistrict]         = useState(null)
  const [selectedUc, setSelectedUc]                     = useState(null)
  const [selectedFacilityId, setSelectedFacilityId]     = useState(null)
  const [selectedFacilityName, setSelectedFacilityName] = useState('')

  // Global mode modal state
  const [addOpen, setAddOpen]           = useState(false)
  const [editing, setEditing]           = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [addError, setAddError]         = useState('')
  const [editError, setEditError]       = useState('')
  const [deleteError, setDeleteError]   = useState('')
  const [created, setCreated]           = useState(null)
  const [view, setView]                 = useViewMode('admin-vaccines')

  // Facility mode modal state
  const [facilityEditing, setFacilityEditing]     = useState(null)
  const [facilityEditError, setFacilityEditError] = useState('')

  // ── Cascade data ──────────────────────────────────────────────────────────────
  const { data: districtsData } = useQuery({ queryKey: ['districts'], queryFn: getDistricts })
  const districts = districtsData?.districts ?? []

  // GET /api/union-councils filters by townId only, so narrow to the district here.
  const { data: ucsData } = useQuery({
    queryKey: ['ucs'],
    queryFn: () => getUnionCouncils(),
    enabled: !!selectedDistrict,
  })
  const ucs = (ucsData?.unionCouncils ?? []).filter((u) => u.districtId === selectedDistrict)

  const { data: facilitiesData } = useQuery({
    queryKey: ['facilities', selectedUc],
    queryFn: () => getFacilities({ ucId: selectedUc }),
    enabled: !!selectedUc,
  })
  const facilities = facilitiesData?.facilities ?? []

  // ── Vaccine data ──────────────────────────────────────────────────────────────
  const { data: globalData, isLoading: globalLoading, isError: globalError, error: globalErr, refetch: refetchGlobal } = useQuery({
    queryKey: ['vaccines'],
    queryFn: getVaccines,
    enabled: !selectedFacilityId,
  })
  const globalVaccines = globalData?.vaccines ?? []

  const { data: facilityData, isLoading: facilityLoading, isError: facilityError, error: facilityErr, refetch: refetchFacility } = useQuery({
    queryKey: ['facility', selectedFacilityId],
    queryFn: () => getFacility(selectedFacilityId),
    enabled: !!selectedFacilityId,
  })
  const facilityVaccines = facilityData?.facility?.vaccines ?? []

  const isLoading = selectedFacilityId ? facilityLoading : globalLoading
  const isError   = selectedFacilityId ? facilityError   : globalError
  const vaccines  = selectedFacilityId ? facilityVaccines : globalVaccines
  const loadError = selectedFacilityId ? facilityErr : globalErr
  const refetch   = selectedFacilityId ? refetchFacility : refetchGlobal

  // ── Cascade helpers ───────────────────────────────────────────────────────────
  function clearFilter() {
    setSelectedDistrict(null)
    setSelectedUc(null)
    setSelectedFacilityId(null)
    setSelectedFacilityName('')
  }

  function handleDistrictChange(val) {
    setSelectedDistrict(val)
    setSelectedUc(null)
    setSelectedFacilityId(null)
    setSelectedFacilityName('')
  }

  function handleUcChange(val) {
    setSelectedUc(val)
    setSelectedFacilityId(null)
    setSelectedFacilityName('')
  }

  function handleFacilityChange(val) {
    setSelectedFacilityId(val)
    const f = facilities.find((x) => String(x.id) === String(val))
    setSelectedFacilityName(f?.name ?? '')
  }

  // ── Global mutations ──────────────────────────────────────────────────────────
  function invalidateGlobal() {
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
      invalidateGlobal(); setAddOpen(false); setAddError('')
      const val = (k) => (form[k] !== '' ? form[k] : `${DEFAULTS[k]} (default)`)
      setCreated([
        { label: 'Name', value: form.name.trim() },
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
    onSuccess: () => { invalidateGlobal(); setEditing(null); setEditError('') },
    onError: (err) => setEditError(err.status === 409 ? 'A vaccine with that name already exists.' : err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteVaccine(deleteTarget.id),
    onSuccess: () => { invalidateGlobal(); setDeleteTarget(null); setDeleteError('') },
    onError: (err) => setDeleteError(
      err.status === 409 ? 'This vaccine has recorded stock history and cannot be deleted.' : err.message
    ),
  })

  // ── Facility mutations ────────────────────────────────────────────────────────
  const facilityEditMutation = useMutation({
    mutationFn: ({ vaccineId, payload }) => updateFacilityVaccine(selectedFacilityId, vaccineId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facility', selectedFacilityId] })
      setFacilityEditing(null)
      setFacilityEditError('')
    },
    onError: (err) => setFacilityEditError(err.message),
  })

  const facilityResetMutation = useMutation({
    mutationFn: ({ vaccineId }) => updateFacilityVaccine(selectedFacilityId, vaccineId, {
      criticalDoses: null, lowDoses: null, criticalVials: null, lowVials: null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facility', selectedFacilityId] })
      setFacilityEditing(null)
      setFacilityEditError('')
    },
    onError: (err) => setFacilityEditError(err.message),
  })

  // ── Helpers ───────────────────────────────────────────────────────────────────
  const emptyForm = { name: '', dosesPerVial: '', criticalDoses: '', lowDoses: '', criticalVials: '', lowVials: '' }
  const canEdit = user?.role !== 'observer'

  function getVaccineName(v) { return selectedFacilityId ? (v.vaccineName ?? v.name) : v.name }
  function getVaccineId(v)   { return selectedFacilityId ? (v.vaccineId   ?? v.id)   : v.id  }

  const customTag = <span className="inline-flex items-center h-5 px-2 rounded-full text-[11px] font-medium bg-cat-3-bg text-cat-3 flex-shrink-0">Custom</span>
  const nameCell = (v) => (
    <span className="inline-flex items-center gap-2 min-w-0">
      <span className="font-medium whitespace-nowrap truncate" dir="auto">{(getVaccineName(v))}</span>
      {v.thresholdOverridden && customTag}
    </span>
  )

  const actions = (v) => canEdit && (
    <RowActions
      className="justify-end"
      actions={selectedFacilityId
        ? [{ icon: Pencil, label: 'Edit facility values', onClick: () => { setFacilityEditing({ ...v, vaccineId: getVaccineId(v), name: getVaccineName(v) }); setFacilityEditError('') } }]
        : [
            { icon: Pencil, label: 'Edit', onClick: () => { setEditing(v); setEditError('') } },
            { icon: Trash2, label: 'Delete', danger: true, onClick: () => { setDeleteTarget(v); setDeleteError('') } },
          ]}
    />
  )

  const num = (n) => <span className="tabular-nums">{n ?? '—'}</span>
  const columns = [
    { key: 'name', label: 'Vaccine', render: nameCell },
    { key: 'dpv', label: 'Doses per vial', align: 'right', render: (v) => num(v.dosesPerVial) },
    { key: 'cd', label: 'Critical doses', align: 'right', render: (v) => num(v.criticalDoses) },
    { key: 'ld', label: 'Low doses', align: 'right', render: (v) => num(v.lowDoses) },
    { key: 'cv', label: 'Critical vials', align: 'right', render: (v) => num(v.criticalVials) },
    { key: 'lv', label: 'Low vials', align: 'right', render: (v) => num(v.lowVials) },
    ...(canEdit ? [{ key: 'actions', label: '', align: 'right', render: actions }] : []),
  ]

  const gridCard = (v) => (
    <EntityCard
      icon={Syringe}
      accent={v.thresholdOverridden ? 3 : 1}
      title={<span dir="auto">{(getVaccineName(v))}</span>}
      subtitle={`${plural(v.dosesPerVial ?? 0, 'dose')} per vial`}
      badge={v.thresholdOverridden && customTag}
      meta={[
        { label: 'Critical', value: `${v.criticalDoses} doses · ${v.criticalVials} vials` },
        { label: 'Low', value: `${v.lowDoses} doses · ${v.lowVials} vials` },
      ]}
      actions={actions(v)}
    />
  )

  const scopeName = selectedFacilityId ? selectedFacilityName : null

  return (
    <div>
      <PageHeader
        breadcrumb="Super Admin › Manage"
        title="Vaccines"
        subtitle={isLoading ? undefined : scopeName
          ? `Thresholds at ${scopeName} · edits set custom thresholds here only`
          : `${plural(vaccines.length, 'vaccine')} · default thresholds apply to every facility unless custom`}
        actions={canEdit && !selectedFacilityId && (
          <Button onClick={() => { setAddOpen(true); setAddError('') }}><Plus size={16} strokeWidth={1.75} /> Add vaccine</Button>
        )}
      />

      <Card className="mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[160px]">
            <Select
              id="flt-district"
              label="District"
              placeholder="All districts"
              value={selectedDistrict ?? ''}
              options={districts.map((d) => ({ value: d.id, label: d.name }))}
              onChange={(e) => handleDistrictChange(e.target.value)}
            />
          </div>
          <div className="flex-1 min-w-[160px]">
            <Select
              id="flt-uc"
              label="Union council"
              placeholder={selectedDistrict ? 'Select UC…' : 'Select district first'}
              value={selectedUc ?? ''}
              options={ucs.map((u) => ({ value: u.id, label: u.name }))}
              onChange={(e) => handleUcChange(e.target.value)}
              disabled={!selectedDistrict}
            />
          </div>
          <div className="flex-1 min-w-[160px]">
            <Select
              id="flt-facility"
              label="Facility"
              placeholder={selectedUc ? 'Select facility…' : 'Select UC first'}
              value={selectedFacilityId ?? ''}
              options={facilities.map((f) => ({ value: f.id, label: f.name }))}
              onChange={(e) => handleFacilityChange(e.target.value)}
              disabled={!selectedUc}
            />
          </div>
          {selectedDistrict && (
            <Button variant="ghost" onClick={clearFilter}><X size={14} strokeWidth={1.75} /> Clear</Button>
          )}
        </div>
      </Card>

      {isError ? (
        <ErrorState title="Couldn’t load the vaccine catalog" error={loadError} onRetry={refetch} />
      ) : !isLoading && vaccines.length === 0 ? (
        <EmptyState
          framed
          icon={Syringe}
          title={selectedFacilityId ? 'No vaccines at this facility' : 'No vaccines yet'}
          message={selectedFacilityId ? 'Vaccines added to the catalog appear here.' : canEdit ? 'Add the first vaccine to start tracking stock.' : 'The catalog is empty.'}
        />
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex justify-end items-center gap-3">
            <ViewToggle value={view} onChange={setView} />
            <ExportButton
              name={scopeName ? `vaccines-${scopeName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}` : 'vaccines'}
              rows={vaccines}
              columns={[
                { label: 'Vaccine', value: (v) => (getVaccineName(v)) },
                { label: 'Doses per vial', value: (v) => v.dosesPerVial },
                { label: 'Critical doses', value: (v) => v.criticalDoses },
                { label: 'Low doses', value: (v) => v.lowDoses },
                { label: 'Critical vials', value: (v) => v.criticalVials },
                { label: 'Low vials', value: (v) => v.lowVials },
                ...(scopeName ? [{ label: 'Custom', value: (v) => (v.thresholdOverridden ? 'Yes' : 'No') }] : []),
              ]}
            />
          </div>
          <Table
            columns={columns}
            rows={vaccines}
            loading={isLoading}
            rowKey={getVaccineId}
            view={view}
            gridCard={gridCard}
            mobileCard={(v) => (
              <div className="px-4 py-3.5 flex flex-col gap-2">
                {nameCell(v)}
                <p className="text-xs text-text-muted tabular-nums">
                  {v.dosesPerVial} doses per vial · critical {v.criticalDoses}d / {v.criticalVials}v · low {v.lowDoses}d / {v.lowVials}v
                </p>
                {actions(v)}
              </div>
            )}
          />
          {vaccines.length > 0 && (
            <p className="text-xs text-text-muted">
              {selectedFacilityId
                ? 'Edits here set custom thresholds for this facility only. “Custom” marks them; use Reset to default in the edit dialog to remove them.'
                : 'Changing thresholds or doses per vial applies to every facility without custom thresholds immediately. A vaccine with recorded stock history can’t be deleted.'}
            </p>
          )}
        </div>
      )}

      {/* ── Global modals ── */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add Vaccine">
        <VaccineForm
          initial={emptyForm}
          onSubmit={(form) => createMutation.mutate(form)}
          isPending={createMutation.isPending}
          error={addError}
          submitLabel="Add Vaccine"
        />
      </Modal>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={`Edit — ${editing?.name ?? ''}`}>
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

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteMutation.mutate()}
        title="Delete Vaccine"
        message={<p className="text-sm text-text">Delete <span className="font-semibold" dir="rtl">{deleteTarget?.name}</span> from the global catalog? This cannot be undone and will remove it from every facility's dashboard.</p>}
        confirmLabel="Delete"
        isPending={deleteMutation.isPending}
        error={deleteError}
      />

      {/* ── Facility edit modal ── */}
      <Modal
        open={!!facilityEditing}
        onClose={() => setFacilityEditing(null)}
        title={`Edit — ${(facilityEditing?.name ?? '')} @ ${selectedFacilityName}`}
      >
        {facilityEditing && (
          <FacilityVaccineForm
            facilityName={selectedFacilityName}
            initial={{
              dosesPerVial:  facilityEditing.dosesPerVial,
              criticalDoses: String(facilityEditing.criticalDoses ?? ''),
              lowDoses:      String(facilityEditing.lowDoses      ?? ''),
              criticalVials: String(facilityEditing.criticalVials ?? ''),
              lowVials:      String(facilityEditing.lowVials      ?? ''),
            }}
            onSubmit={(form) => facilityEditMutation.mutate({
              vaccineId: facilityEditing.vaccineId,
              payload: {
                ...(form.criticalDoses !== '' ? { criticalDoses: parseInt(form.criticalDoses, 10) } : {}),
                ...(form.lowDoses      !== '' ? { lowDoses:      parseInt(form.lowDoses, 10)      } : {}),
                ...(form.criticalVials !== '' ? { criticalVials: parseInt(form.criticalVials, 10) } : {}),
                ...(form.lowVials      !== '' ? { lowVials:      parseInt(form.lowVials, 10)      } : {}),
              },
            })}
            onReset={() => facilityResetMutation.mutate({ vaccineId: facilityEditing.vaccineId })}
            isPending={facilityEditMutation.isPending}
            isResetting={facilityResetMutation.isPending}
            error={facilityEditError}
          />
        )}
      </Modal>

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
