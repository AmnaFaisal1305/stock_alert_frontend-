import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, ChevronDown, Pencil, Power, PowerOff, UserPlus, Eye, Landmark, MapPin } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getTowns, createTown, updateTown, deleteTown, activateTown,
  getUnionCouncils, createUnionCouncil, updateUnionCouncil, deleteUnionCouncil, activateUnionCouncil,
  getDistricts, assignUcSupervisor, getUsers, getFacilities, getDashboard,
} from '../../lib/api'
import { facilityStatus } from '../../lib/status'
import { useAuth } from '../../context/AuthContext'
import SearchInput from '../../components/shared/SearchInput'
import StatusBadge from '../../components/shared/StatusBadge'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import Badge from '../../components/ui/Badge'
import Table from '../../components/shared/Table'
import PageHeader from '../../components/shared/PageHeader'
import Card from '../../components/shared/Card'
import ErrorState from '../../components/shared/ErrorState'
import { SkeletonRows } from '../../components/shared/SkeletonCard'
import EntityCard from '../../components/shared/EntityCard'
import Tabs from '../../components/ui/Tabs'
import RowActions from '../../components/ui/RowActions'
import ViewToggle from '../../components/ui/ViewToggle'
import { SummaryDialog } from '../../components/ui/ReviewDialog'
import { useViewMode } from '../../hooks/useViewMode'
import { useUrlFilters, useUrlState } from '../../hooks/useUrlState'
import ExportButton from '../../components/ui/ExportButton'

const TABS = [{ value: 'Towns', label: 'Towns' }, { value: 'Union Councils', label: 'Union councils' }]

const errorText = (msg) => msg && <p role="alert" className="text-sm text-danger-dark">{msg}</p>

// ─── UC Expanded Panel — facility cards for a single UC ──────────────────────
function UCExpandedPanel({ ucId }) {
  const { data: facilityData, isLoading } = useQuery({
    queryKey: ['facilities', { ucId }],
    queryFn: () => getFacilities({ ucId }),
  })
  const { data: dashData } = useQuery({
    queryKey: ['dashboard'],
    queryFn: getDashboard,
    staleTime: 30_000,
  })

  if (isLoading) return <div className="border-t border-surface-border"><SkeletonRows rows={2} /></div>

  const facilities = [...(facilityData?.facilities ?? [])].sort((a, b) => a.name.localeCompare(b.name))
  const byFacility = dashData?.summary?.byFacility ?? []

  if (facilities.length === 0) {
    return <p className="border-t border-surface-border bg-surface-alt px-4 sm:px-5 py-4 text-sm text-text-muted">No facilities registered under this UC.</p>
  }

  return (
    <ul className="border-t border-surface-border bg-surface-alt divide-y divide-surface-border">
      {facilities.map((f) => {
        const facDash = byFacility.find((b) => b.facilityId === f.id)
        const fStatus = facilityStatus(facDash?.statusCounts ?? f.statusCounts)
        const sc = facDash?.statusCounts ?? f.statusCounts ?? {}
        const lines = [
          sc.critical > 0 && `${sc.critical} critical`,
          sc.low > 0 && `${sc.low} low`,
          sc.adequate > 0 && `${sc.adequate} normal`,
        ].filter(Boolean)
        return (
          <li key={f.id}>
            <Link to={`/super-admin/facilities/${f.id}`} className="flex items-center justify-between gap-3 px-4 sm:px-12 py-3 hover:bg-surface">
              <div className="min-w-0">
                <p className="text-sm font-medium text-text truncate">{f.name}</p>
                <p className="text-xs text-text-muted truncate tabular-nums">
                  {f.facilitySupervisorName ?? 'Unstaffed'} · {lines.length ? lines.join(' · ') : 'stock not updated'}
                </p>
              </div>
              <StatusBadge status={fStatus} />
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

// ─── Towns Tab ────────────────────────────────────────────────────────────────
function TownsTab({ readOnly }) {
  const queryClient = useQueryClient()
  const [search, setSearch]       = useUrlState('q')
  const [addOpen, setAddOpen]     = useState(false)
  const [addForm, setAddForm]     = useState({ name: '', districtId: '' })
  const [addError, setAddError]   = useState('')
  const [editing, setEditing]     = useState(null)
  const [editName, setEditName]   = useState('')
  const [editError, setEditError] = useState('')
  const [delTarget, setDelTarget] = useState(null)
  const [delError, setDelError]   = useState('')
  const [created, setCreated]     = useState(null)
  const [view, setView]           = useViewMode('admin-towns')

  const { data: townsData, isLoading, isError, error, refetch } = useQuery({ queryKey: ['towns'], queryFn: getTowns })
  const { data: districtsData } = useQuery({ queryKey: ['districts'], queryFn: getDistricts })

  const towns    = townsData?.towns ?? []
  const districts = districtsData?.districts ?? []
  const districtOptions = districts.filter((d) => d.isActive).map((d) => ({ value: d.id, label: d.name }))
  const districtMap = Object.fromEntries(districts.map((d) => [d.id, d.name]))

  function inv() {
    queryClient.invalidateQueries({ queryKey: ['towns'] })
    queryClient.invalidateQueries({ queryKey: ['ucs'] })
  }

  const createMutation = useMutation({
    mutationFn: () => createTown({ name: addForm.name.trim(), districtId: addForm.districtId }),
    onSuccess: () => {
      inv()
      setCreated({ name: addForm.name.trim(), district: districtMap[addForm.districtId] ?? '—' })
      setAddOpen(false); setAddForm({ name: '', districtId: '' }); setAddError('')
    },
    onError: (err) => setAddError(err.status === 409 ? 'A town with that name already exists in this district.' : err.message),
  })

  const editMutation = useMutation({
    mutationFn: () => updateTown(editing.id, editName.trim()),
    onSuccess: () => { inv(); setEditing(null); setEditError('') },
    onError: (err) => setEditError(err.status === 409 ? 'A town with that name already exists in this district.' : err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteTown(delTarget.id),
    onSuccess: () => { inv(); setDelTarget(null); setDelError('') },
    onError: (err) => setDelError(err.status === 409 ? 'Deactivate all UCs in this town first.' : err.message),
  })

  const activateMutation = useMutation({
    mutationFn: (id) => activateTown(id),
    onSuccess: () => inv(),
  })

  const filtered = towns.filter((t) => {
    const q = search.toLowerCase()
    return t.name.toLowerCase().includes(q) || (districtMap[t.districtId] ?? '').toLowerCase().includes(q)
  })

  const townActions = (t) => !readOnly && (
    <RowActions
      className="justify-end"
      actions={[
        { icon: Pencil, label: 'Rename', onClick: () => { setEditing(t); setEditName(t.name); setEditError('') } },
        t.isActive
          ? { icon: PowerOff, label: 'Deactivate', danger: true, onClick: () => { setDelTarget(t); setDelError('') } }
          : { icon: Power, label: 'Reactivate', onClick: () => activateMutation.mutate(t.id), disabled: activateMutation.isPending },
      ]}
    />
  )

  const townCard = (t) => (
    <EntityCard
      icon={Landmark}
      accent={t.isActive ? 2 : 'no_data'}
      title={t.name}
      subtitle={districtMap[t.districtId] ? `${districtMap[t.districtId]} District` : undefined}
      badge={<Badge type={t.isActive ? 'active' : 'inactive'} />}
      meta={[{ label: 'District', value: districtMap[t.districtId] ?? '—' }]}
      actions={townActions(t)}
    />
  )

  const columns = [
    { key: 'name', label: 'Town', render: (t) => <span className={`font-medium ${t.isActive ? '' : 'opacity-60'}`}>{t.name}</span> },
    { key: 'district', label: 'District', render: (t) => districtMap[t.districtId] ?? <span className="text-text-muted">—</span> },
    { key: 'status', label: 'Status', render: (t) => <Badge type={t.isActive ? 'active' : 'inactive'} /> },
    ...(!readOnly ? [{ key: 'actions', label: '', align: 'right', render: townActions }] : []),
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="flex-1 min-w-0">
            <SearchInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search towns or districts…" />
          </div>
          <ViewToggle value={view} onChange={setView} />
          <ExportButton
            name="towns"
            rows={filtered}
            columns={[
              { label: 'Town', value: (t) => t.name },
              { label: 'District', value: (t) => districtMap[t.districtId] },
              { label: 'Status', value: (t) => (t.isActive ? 'Active' : 'Inactive') },
            ]}
          />
        </div>
        {!readOnly && (
          <Button onClick={() => { setAddOpen(true); setAddError('') }}>
            <Plus size={16} strokeWidth={1.75} /> Add town
          </Button>
        )}
      </div>

      {isError ? (
        <ErrorState title="Couldn’t load towns" error={error} onRetry={refetch} />
      ) : (
        <Table columns={columns} rows={filtered} rowKey={(t) => t.id} loading={isLoading} view={view} gridCard={townCard}
          emptyMessage={search ? `No towns match “${search}”.` : 'No towns yet.'}
          mobileCard={(t) => (
            <div className="px-4 py-3.5 flex flex-col gap-2">
              <div className="flex items-start justify-between gap-3">
                <div className={`min-w-0 ${t.isActive ? '' : 'opacity-60'}`}>
                  <p className="font-medium text-text truncate">{t.name}</p>
                  <p className="text-xs text-text-muted truncate">{districtMap[t.districtId] ?? '—'}</p>
                </div>
                <Badge type={t.isActive ? 'active' : 'inactive'} />
              </div>
              {townActions(t)}
            </div>
          )}
        />
      )}

      {/* Add Modal */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add town">
        <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); createMutation.mutate() }}>
          <Input id="tname" label="Town name" value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })} required />
          <Select id="tdist" label="District" options={districtOptions} placeholder="Select district…"
            value={addForm.districtId} onChange={(e) => setAddForm({ ...addForm, districtId: e.target.value })} required />
          {errorText(addError)}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" type="button" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={createMutation.isPending || !addForm.name || !addForm.districtId}>
              {createMutation.isPending ? 'Adding…' : 'Add town'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={`Rename ${editing?.name ?? 'town'}`}>
        <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); editMutation.mutate() }}>
          <Input id="tename" label="New name" value={editName} onChange={(e) => { setEditName(e.target.value); setEditError('') }} required />
          {errorText(editError)}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" type="button" onClick={() => setEditing(null)}>Cancel</Button>
            <Button type="submit" disabled={editMutation.isPending || !editName}>{editMutation.isPending ? 'Saving…' : 'Save'}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!delTarget}
        onClose={() => setDelTarget(null)}
        onConfirm={() => deleteMutation.mutate()}
        title="Deactivate town?"
        message={`Deactivate ${delTarget?.name ?? ''}? It can be reactivated later.`}
        confirmLabel="Deactivate"
        isPending={deleteMutation.isPending}
        error={delError}
      />

      <SummaryDialog
        open={!!created}
        onClose={() => setCreated(null)}
        title="Town created"
        message={<>Add union councils under <span className="font-medium">{created?.name}</span> from the Union councils tab.</>}
        rows={created ? [{ label: 'Name', value: created.name }, { label: 'District', value: created.district }] : []}
      />
    </div>
  )
}

// ─── UCs Tab ──────────────────────────────────────────────────────────────────
function UCsTab({ readOnly }) {
  const queryClient = useQueryClient()
  const [search, setSearch]           = useUrlState('q')
  const [expandedId, setExpandedId]   = useState(null)
  const [addOpen, setAddOpen]         = useState(false)
  const [addForm, setAddForm]         = useState({ name: '', townId: '' })
  const [addError, setAddError]       = useState('')
  const [editing, setEditing]         = useState(null)
  const [editName, setEditName]       = useState('')
  const [editError, setEditError]     = useState('')
  const [delTarget, setDelTarget]     = useState(null)
  const [delError, setDelError]       = useState('')
  const [assignTarget, setAssignTarget] = useState(null)
  const [assignUserId, setAssignUserId] = useState('')
  const [assignError, setAssignError]   = useState('')
  const [created, setCreated]           = useState(null)
  const [view, setView]                 = useViewMode('admin-ucs')

  const { data: ucsData, isLoading, isError, error, refetch } = useQuery({ queryKey: ['ucs'], queryFn: () => getUnionCouncils() })
  const { data: townsData } = useQuery({ queryKey: ['towns'], queryFn: getTowns })
  const { data: usersData } = useQuery({ queryKey: ['users'], queryFn: getUsers })

  const ucs     = ucsData?.unionCouncils ?? []
  const towns   = townsData?.towns ?? []
  const allUsers = usersData?.users ?? []
  const ucSupervisors = allUsers.filter((u) => u.role === 'uc_supervisor' && u.isActive)

  const townOptions = towns.filter((t) => t.isActive).map((t) => ({ value: t.id, label: `${t.name} (${t.districtName ?? ''})` }))
  const supervisorOptions = ucSupervisors.map((u) => ({ value: u.id, label: `${u.name} (${u.email})` }))

  function inv() { queryClient.invalidateQueries({ queryKey: ['ucs'] }) }

  const createMutation = useMutation({
    mutationFn: () => createUnionCouncil({ name: addForm.name.trim(), townId: addForm.townId }),
    onSuccess: () => {
      inv()
      setCreated({ name: addForm.name.trim(), town: townOptions.find((o) => o.value === addForm.townId)?.label ?? '—' })
      setAddOpen(false); setAddForm({ name: '', townId: '' }); setAddError('')
    },
    onError: (err) => setAddError(err.status === 409 ? 'A UC with that name already exists in this town.' : err.message),
  })

  const editMutation = useMutation({
    mutationFn: () => updateUnionCouncil(editing.id, editName.trim()),
    onSuccess: () => { inv(); setEditing(null); setEditError('') },
    onError: (err) => setEditError(err.status === 409 ? 'A UC with that name already exists in this town.' : err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteUnionCouncil(delTarget.id),
    onSuccess: () => { inv(); setDelTarget(null); setDelError('') },
    onError: (err) => setDelError(err.status === 409 ? 'Deactivate all facilities in this UC first.' : err.message),
  })

  const activateMutation = useMutation({
    mutationFn: (id) => activateUnionCouncil(id),
    onSuccess: () => inv(),
  })

  const assignMutation = useMutation({
    mutationFn: async () => {
      const uc = assignTarget
      const newUser = allUsers.find((u) => u.id === assignUserId)
      // Remove UC from old supervisor first to avoid 409
      if (uc.ucSupervisorId && uc.ucSupervisorId !== assignUserId) {
        const oldUser = allUsers.find((u) => u.id === uc.ucSupervisorId)
        const oldUcIds = (oldUser?.ucIds ?? []).filter((id) => id !== uc.id)
        await assignUcSupervisor(uc.ucSupervisorId, oldUcIds)
      }
      const existingUcIds = (newUser?.ucIds ?? []).filter((id) => id !== uc.id)
      return assignUcSupervisor(assignUserId, [...existingUcIds, uc.id])
    },
    onSuccess: () => {
      inv()
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setAssignTarget(null)
      setAssignUserId('')
      setAssignError('')
    },
    onError: (err) => setAssignError(err.message),
  })

  const filtered = ucs.filter((uc) => {
    const q = search.toLowerCase()
    return (
      uc.name.toLowerCase().includes(q) ||
      (uc.townName ?? '').toLowerCase().includes(q) ||
      (uc.districtName ?? '').toLowerCase().includes(q) ||
      (uc.ucSupervisorName ?? '').toLowerCase().includes(q)
    )
  })

  function toggleExpand(id) {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  const openAssign = (uc) => { setAssignTarget(uc); setAssignUserId(''); setAssignError('') }

  const ucActions = (uc, { withView = false } = {}) => (
    <RowActions
      actions={[
        withView && { icon: Eye, label: 'View union council', to: `/super-admin/ucs/${uc.id}` },
        !readOnly && { icon: UserPlus, label: uc.ucSupervisorName ? 'Reassign supervisor' : 'Assign supervisor', onClick: () => openAssign(uc) },
        !readOnly && { icon: Pencil, label: 'Rename', onClick: () => { setEditing(uc); setEditName(uc.name); setEditError('') } },
        !readOnly && (uc.isActive
          ? { icon: PowerOff, label: 'Deactivate', danger: true, onClick: () => { setDelTarget(uc); setDelError('') } }
          : { icon: Power, label: 'Reactivate', onClick: () => activateMutation.mutate(uc.id), disabled: activateMutation.isPending }),
      ]}
    />
  )

  const ucCard = (uc) => (
    <EntityCard
      icon={MapPin}
      accent={uc.isActive ? 4 : 'no_data'}
      title={uc.name}
      subtitle={[uc.townName, uc.districtName].filter(Boolean).join(' · ') || undefined}
      badge={<Badge type={uc.isActive ? 'active' : 'inactive'} />}
      meta={[
        { label: 'Town', value: uc.townName ?? '—' },
        { label: 'District', value: uc.districtName ?? '—' },
        { label: 'UC Supervisor', value: uc.ucSupervisorName ?? 'Not assigned' },
      ]}
      actions={ucActions(uc, { withView: true })}
    />
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="flex-1 min-w-0">
            <SearchInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search UC, town, district or supervisor…" />
          </div>
          <ViewToggle value={view} onChange={setView} />
          <ExportButton
            name="union-councils"
            rows={filtered}
            columns={[
              { label: 'Union council', value: (uc) => uc.name },
              { label: 'Town', value: (uc) => uc.townName },
              { label: 'District', value: (uc) => uc.districtName },
              { label: 'UC supervisor', value: (uc) => uc.ucSupervisorName ?? 'Not assigned' },
              { label: 'Status', value: (uc) => (uc.isActive ? 'Active' : 'Inactive') },
            ]}
          />
        </div>
        {!readOnly && (
          <Button onClick={() => { setAddOpen(true); setAddError('') }}>
            <Plus size={16} strokeWidth={1.75} /> Add union council
          </Button>
        )}
      </div>

      {isError ? (
        <ErrorState title="Couldn’t load union councils" error={error} onRetry={refetch} />
      ) : view === 'grid' ? (
        <Table columns={[]} rows={filtered} rowKey={(uc) => uc.id} loading={isLoading} view="grid" gridCard={ucCard}
          emptyMessage={search ? `No union councils match “${search}”.` : 'No union councils yet.'} />
      ) : (
        <Card padding={false}>
          {isLoading ? (
            <SkeletonRows rows={4} />
          ) : filtered.length === 0 ? (
            <p className="px-6 py-12 text-center text-sm text-text-muted">{search ? `No union councils match “${search}”.` : 'No union councils yet.'}</p>
          ) : (
            <ul className="divide-y divide-surface-border">
              {filtered.map((uc) => {
                const isExpanded = expandedId === uc.id
                return (
                  <li key={uc.id}>
                    <div className="px-4 sm:px-5 py-3.5 flex flex-col lg:flex-row lg:items-center gap-2 lg:gap-4">
                      <button
                        type="button"
                        onClick={() => toggleExpand(uc.id)}
                        aria-expanded={isExpanded}
                        aria-controls={`uc-${uc.id}`}
                        className="flex-1 min-w-0 flex items-center gap-3 text-left rounded-control -m-1 p-1 hover:bg-surface-alt"
                      >
                        <ChevronDown size={16} strokeWidth={1.75} className={`text-text-muted flex-shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} aria-hidden="true" />
                        <div className={`min-w-0 ${uc.isActive ? '' : 'opacity-60'}`}>
                          <p className="text-sm font-medium text-text truncate">{uc.name}</p>
                          <p className="text-xs text-text-muted truncate">
                            {[uc.townName, uc.districtName].filter(Boolean).join(' · ') || '—'}
                            {' · '}
                            {uc.ucSupervisorName ? <span className="text-text">{uc.ucSupervisorName}</span> : 'No UC supervisor'}
                          </p>
                        </div>
                      </button>
                      <div className="flex flex-wrap items-center gap-1 pl-7 lg:pl-0">
                        <Badge type={uc.isActive ? 'active' : 'inactive'} />
                        {!readOnly && ucActions(uc)}
                      </div>
                    </div>
                    {isExpanded && <div id={`uc-${uc.id}`}><UCExpandedPanel ucId={uc.id} /></div>}
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      )}

      {/* Add Modal */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add union council">
        <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); createMutation.mutate() }}>
          <Input id="ucname" label="Union council name" value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })} required />
          <Select id="uctown" label="Town" options={townOptions} placeholder="Select town…"
            value={addForm.townId} onChange={(e) => setAddForm({ ...addForm, townId: e.target.value })} required />
          {errorText(addError)}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" type="button" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={createMutation.isPending || !addForm.name || !addForm.townId}>
              {createMutation.isPending ? 'Adding…' : 'Add union council'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={`Rename ${editing?.name ?? 'union council'}`}>
        <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); editMutation.mutate() }}>
          <Input id="ucename" label="New name" value={editName} onChange={(e) => { setEditName(e.target.value); setEditError('') }} required />
          {errorText(editError)}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" type="button" onClick={() => setEditing(null)}>Cancel</Button>
            <Button type="submit" disabled={editMutation.isPending || !editName}>{editMutation.isPending ? 'Saving…' : 'Save'}</Button>
          </div>
        </form>
      </Modal>

      {/* Assign / Reassign Supervisor Modal */}
      <Modal
        open={!!assignTarget}
        onClose={() => { setAssignTarget(null); setAssignUserId(''); setAssignError('') }}
        title={assignTarget?.ucSupervisorName ? 'Reassign UC supervisor' : 'Assign UC supervisor'}
      >
        <div className="flex flex-col gap-4">
          <div className="rounded-control bg-surface-alt px-3.5 py-2.5 text-sm">
            <p className="font-medium text-text">{assignTarget?.name}</p>
            <p className="text-xs text-text-muted mt-0.5">{assignTarget?.townName} · {assignTarget?.districtName}</p>
            {assignTarget?.ucSupervisorName && (
              <p className="text-xs text-text-muted mt-1">
                Current supervisor: <span className="text-text">{assignTarget.ucSupervisorName}</span>
              </p>
            )}
          </div>

          {supervisorOptions.length === 0 ? (
            <p className="text-sm text-text-muted">No active UC supervisors yet. Create a UC supervisor under Users first.</p>
          ) : (
            <Select
              id="uc-assign-user"
              label="UC supervisor"
              options={supervisorOptions}
              placeholder="Choose a supervisor…"
              value={assignUserId}
              onChange={(e) => { setAssignUserId(e.target.value); setAssignError('') }}
            />
          )}

          {errorText(assignError)}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" type="button" onClick={() => { setAssignTarget(null); setAssignUserId('') }}>Cancel</Button>
            <Button
              disabled={!assignUserId || assignMutation.isPending}
              onClick={() => assignMutation.mutate()}
            >
              {assignMutation.isPending ? 'Saving…' : assignTarget?.ucSupervisorName ? 'Reassign' : 'Assign'}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!delTarget}
        onClose={() => setDelTarget(null)}
        onConfirm={() => deleteMutation.mutate()}
        title="Deactivate union council?"
        message={`Deactivate ${delTarget?.name ?? ''}? It can be reactivated later.`}
        confirmLabel="Deactivate"
        isPending={deleteMutation.isPending}
        error={delError}
      />

      <SummaryDialog
        open={!!created}
        onClose={() => setCreated(null)}
        title="Union council created"
        message={<>Assign a UC supervisor to <span className="font-medium">{created?.name}</span>, then add its facilities.</>}
        rows={created ? [{ label: 'Name', value: created.name }, { label: 'Town', value: created.town }] : []}
      />
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function UCManagement() {
  const { user } = useAuth()
  const readOnly = user?.role === 'observer'
  const [{ tab: tabParam }, setFilters] = useUrlFilters({ tab: 'towns' })
  const tab = tabParam === 'ucs' ? 'Union Councils' : 'Towns'
  const setTab = (t) => setFilters({ tab: t === 'Union Councils' ? 'ucs' : 'towns', q: '' })

  return (
    <div>
      <PageHeader
        breadcrumb="Super Admin › Network"
        title="Union Councils"
        subtitle="Each district has towns, each town has union councils, each union council has facilities."
      />
      <Tabs label="Network level" value={tab} onChange={setTab} tabs={TABS} className="mb-4" />
      {tab === 'Towns' ? <TownsTab readOnly={readOnly} /> : <UCsTab readOnly={readOnly} />}
    </div>
  )
}
