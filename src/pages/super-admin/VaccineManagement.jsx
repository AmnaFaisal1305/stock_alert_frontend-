import { useState } from 'react'
import { Plus, Pencil, Trash2, Syringe, AlertCircle, X } from 'lucide-react'
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
import Badge from '../../components/ui/Badge'
import { displayVaccineName } from '../../lib/vaccineNames'
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
        id="dpv" label="Doses per Vial *" type="number" min="1" step="1"
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
      {error && <p className="text-xs text-danger bg-danger-bg rounded-lg px-3 py-2">{error}</p>}
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
        Overrides the global values for <span className="font-semibold text-text">{facilityName}</span> only.
      </p>
      <Input id="fdpv" label="Doses per Vial *" type="number" min="1" step="1"
        value={form.dosesPerVial} onChange={(e) => set('dosesPerVial', e.target.value)} required />
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
      {error && <p className="text-xs text-danger bg-danger-bg rounded-lg px-3 py-2">{error}</p>}
      <div className="flex justify-between gap-3 pt-2">
        <Button type="button" variant="ghost" disabled={isResetting} onClick={onReset}>
          {isResetting ? 'Resetting…' : 'Reset to Global'}
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

  // Facility mode modal state
  const [facilityEditing, setFacilityEditing]     = useState(null)
  const [facilityEditError, setFacilityEditError] = useState('')

  // ── Cascade data ──────────────────────────────────────────────────────────────
  const { data: districtsData } = useQuery({ queryKey: ['districts'], queryFn: getDistricts })
  const districts = districtsData?.districts ?? []

  const { data: ucsData } = useQuery({
    queryKey: ['ucs', selectedDistrict],
    queryFn: () => getUnionCouncils({ districtId: selectedDistrict }),
    enabled: !!selectedDistrict,
  })
  const ucs = ucsData?.unionCouncils ?? []

  const { data: facilitiesData } = useQuery({
    queryKey: ['facilities', selectedUc],
    queryFn: () => getFacilities({ ucId: selectedUc }),
    enabled: !!selectedUc,
  })
  const facilities = facilitiesData?.facilities ?? []

  // ── Vaccine data ──────────────────────────────────────────────────────────────
  const { data: globalData, isLoading: globalLoading, isError: globalError } = useQuery({
    queryKey: ['vaccines'],
    queryFn: getVaccines,
    enabled: !selectedFacilityId,
  })
  const globalVaccines = globalData?.vaccines ?? []

  const { data: facilityData, isLoading: facilityLoading, isError: facilityError } = useQuery({
    queryKey: ['facility', selectedFacilityId],
    queryFn: () => getFacility(selectedFacilityId),
    enabled: !!selectedFacilityId,
  })
  const facilityVaccines = facilityData?.facility?.vaccines ?? []

  const isLoading = selectedFacilityId ? facilityLoading : globalLoading
  const isError   = selectedFacilityId ? facilityError   : globalError
  const vaccines  = selectedFacilityId ? facilityVaccines : globalVaccines

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
    onSuccess: () => { invalidateGlobal(); setAddOpen(false); setAddError('') },
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
      dosesPerVial: null, criticalDoses: null, lowDoses: null, criticalVials: null, lowVials: null,
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

  return (
    <div className="flex flex-col gap-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-text">Vaccine Catalog</h1>
          <p className="text-sm text-text-muted mt-0.5">
            {isLoading
              ? 'Loading…'
              : selectedFacilityId
                ? `Showing thresholds for ${selectedFacilityName}`
                : `${vaccines.length} vaccine${vaccines.length !== 1 ? 's' : ''} · global, applies to all facilities`}
          </p>
        </div>
        {canEdit && !selectedFacilityId && (
          <Button onClick={() => { setAddOpen(true); setAddError('') }}>
            <Plus size={16} /> Add Vaccine
          </Button>
        )}
      </div>

      {/* Cascade filter */}
      <div className="flex flex-wrap items-end gap-3 bg-surface border border-surface-border rounded-2xl px-4 py-3">
        <div className="flex-1 min-w-[160px]">
          <Select
            id="flt-district"
            label="District"
            placeholder="All districts"
            value={selectedDistrict ?? ''}
            options={districts.map((d) => ({ value: d.id, label: d.name }))}
            onChange={handleDistrictChange}
          />
        </div>
        <div className="flex-1 min-w-[160px]">
          <Select
            id="flt-uc"
            label="Union Council"
            placeholder={selectedDistrict ? 'Select UC…' : 'Select district first'}
            value={selectedUc ?? ''}
            options={ucs.map((u) => ({ value: u.id, label: u.name }))}
            onChange={handleUcChange}
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
            onChange={handleFacilityChange}
            disabled={!selectedUc}
          />
        </div>
        {selectedDistrict && (
          <button
            onClick={clearFilter}
            className="flex items-center gap-1.5 text-xs font-semibold text-text-muted hover:text-danger transition-colors pb-1"
          >
            <X size={13} /> Clear
          </button>
        )}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex flex-col gap-3">
          {[1,2,3,4,5].map((i) => (
            <div key={i} className="h-14 bg-surface-alt border border-surface-border rounded-xl animate-pulse" />
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
          <p className="text-sm mt-1">
            {selectedFacilityId
              ? 'No vaccines found for this facility.'
              : 'Click "Add Vaccine" to create the first catalog entry.'}
          </p>
        </div>
      )}

      {/* Table */}
      {!isLoading && !isError && vaccines.length > 0 && (
        <div className="bg-surface rounded-2xl border border-surface-border overflow-hidden shadow-sm">
          <div className="hidden sm:grid grid-cols-[2fr_80px_90px_90px_90px_90px_100px] px-5 py-3 bg-surface-alt border-b border-surface-border gap-3 items-center">
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Vaccine</span>
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Doses/Vial</span>
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Crit. Doses</span>
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Low Doses</span>
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Crit. Vials</span>
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Low Vials</span>
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest text-right">Actions</span>
          </div>
          {vaccines.map((v) => {
            const name      = getVaccineName(v)
            const vaccineId = getVaccineId(v)
            const isCustom  = !!v.thresholdOverridden
            return (
              <div key={vaccineId} className="border-b border-surface-border last:border-b-0">
                {/* Mobile card */}
                <div className="sm:hidden px-4 py-3 hover:bg-surface-alt/60 transition-colors">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Syringe size={13} className="text-primary flex-shrink-0" />
                      <span className="font-semibold text-sm text-text truncate" dir="rtl">{displayVaccineName(name)}</span>
                      {isCustom && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 uppercase tracking-wider flex-shrink-0">Custom</span>
                      )}
                    </div>
                    {canEdit && (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {selectedFacilityId ? (
                          <button
                            onClick={() => { setFacilityEditing({ ...v, vaccineId, name }); setFacilityEditError('') }}
                            title="Edit facility values"
                            className="p-1.5 rounded-lg text-text-muted hover:bg-surface-alt hover:text-text transition-colors">
                            <Pencil size={13} />
                          </button>
                        ) : (<>
                          <button onClick={() => { setEditing(v); setEditError('') }} title="Edit"
                            className="p-1.5 rounded-lg text-text-muted hover:bg-surface-alt hover:text-text transition-colors">
                            <Pencil size={13} />
                          </button>
                          <button onClick={() => { setDeleteTarget(v); setDeleteError('') }} title="Delete"
                            className="p-1.5 rounded-lg text-text-muted hover:bg-danger-bg hover:text-danger transition-colors">
                            <Trash2 size={13} />
                          </button>
                        </>)}
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-x-3 gap-y-0.5 text-xs text-text-muted">
                    <span>Doses/Vial: <span className="font-semibold text-text">{v.dosesPerVial}</span></span>
                    <span>Crit.Doses: <span className="font-semibold text-text">{v.criticalDoses}</span></span>
                    <span>Low Doses: <span className="font-semibold text-text">{v.lowDoses}</span></span>
                    <span>Crit.Vials: <span className="font-semibold text-text">{v.criticalVials}</span></span>
                    <span>Low Vials: <span className="font-semibold text-text">{v.lowVials}</span></span>
                  </div>
                </div>
                {/* Desktop row */}
                <div className="hidden sm:grid grid-cols-[2fr_80px_90px_90px_90px_90px_100px] px-5 py-3.5 gap-3 items-center hover:bg-surface-alt/60 transition-colors">
                  <div className="flex items-center gap-2 min-w-0">
                    <Syringe size={13} className="text-primary flex-shrink-0" />
                    <span className="font-semibold text-sm text-text truncate" dir="rtl">{displayVaccineName(name)}</span>
                    {isCustom && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 uppercase tracking-wider flex-shrink-0">Custom</span>
                    )}
                  </div>
                  <span className="text-sm tabular-nums text-text">{v.dosesPerVial}</span>
                  <span className="text-sm tabular-nums text-text">{v.criticalDoses}</span>
                  <span className="text-sm tabular-nums text-text">{v.lowDoses}</span>
                  <span className="text-sm tabular-nums text-text">{v.criticalVials}</span>
                  <span className="text-sm tabular-nums text-text">{v.lowVials}</span>
                  <div className="flex items-center gap-1 justify-end">
                    {canEdit && (
                      selectedFacilityId ? (
                        <button
                          onClick={() => { setFacilityEditing({ ...v, vaccineId, name }); setFacilityEditError('') }}
                          title="Edit facility values"
                          className="p-1.5 rounded-lg text-text-muted hover:bg-surface-alt hover:text-text transition-colors">
                          <Pencil size={13} />
                        </button>
                      ) : (<>
                        <button onClick={() => { setEditing(v); setEditError('') }} title="Edit"
                          className="p-1.5 rounded-lg text-text-muted hover:bg-surface-alt hover:text-text transition-colors">
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => { setDeleteTarget(v); setDeleteError('') }} title="Delete"
                          className="p-1.5 rounded-lg text-text-muted hover:bg-danger-bg hover:text-danger transition-colors">
                          <Trash2 size={13} />
                        </button>
                      </>)
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Info note */}
      {!isLoading && vaccines.length > 0 && (
        <div className="flex items-start gap-2 text-xs text-text-muted bg-surface-alt rounded-xl px-4 py-3 border border-surface-border">
          <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
          <span>
            {selectedFacilityId
              ? 'Editing values here overrides the global defaults for this facility only. "Custom" badge marks an active override. Use "Reset to Global" to restore the global values.'
              : "Editing a vaccine's thresholds or doses-per-vial takes effect across all facilities immediately. A vaccine cannot be deleted once it has recorded stock history."}
          </span>
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

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteMutation.mutate()}
        title="Delete Vaccine"
        message={<p className="text-sm text-text">Delete <span className="font-semibold" dir="rtl">{displayVaccineName(deleteTarget?.name)}</span> from the global catalog? This cannot be undone and will remove it from every facility's dashboard.</p>}
        confirmLabel="Delete"
        isPending={deleteMutation.isPending}
        error={deleteError}
      />

      {/* ── Facility edit modal ── */}
      <Modal
        open={!!facilityEditing}
        onClose={() => setFacilityEditing(null)}
        title={`Edit — ${displayVaccineName(facilityEditing?.name ?? '')} @ ${selectedFacilityName}`}
      >
        {facilityEditing && (
          <FacilityVaccineForm
            facilityName={selectedFacilityName}
            initial={{
              dosesPerVial:  String(facilityEditing.dosesPerVial  ?? ''),
              criticalDoses: String(facilityEditing.criticalDoses ?? ''),
              lowDoses:      String(facilityEditing.lowDoses      ?? ''),
              criticalVials: String(facilityEditing.criticalVials ?? ''),
              lowVials:      String(facilityEditing.lowVials      ?? ''),
            }}
            onSubmit={(form) => facilityEditMutation.mutate({
              vaccineId: facilityEditing.vaccineId,
              payload: {
                ...(form.dosesPerVial  !== '' ? { dosesPerVial:  parseInt(form.dosesPerVial, 10)  } : {}),
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
    </div>
  )
}
