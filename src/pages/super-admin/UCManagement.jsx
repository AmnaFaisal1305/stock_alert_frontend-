import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Pencil, Trash2, RefreshCcw, MapPin, Map, User, UserPlus, ChevronDown, Building2, Loader2 } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getTowns, createTown, updateTown, deleteTown, activateTown,
  getUnionCouncils, createUnionCouncil, updateUnionCouncil, deleteUnionCouncil, activateUnionCouncil,
  getDistricts, assignUcSupervisor, getUsers, getFacilities, getDashboard,
} from '../../lib/api'
import { facilityStatus, statusConfig } from '../../lib/status'
import SearchInput from '../../components/shared/SearchInput'
import StatusBadge from '../../components/shared/StatusBadge'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import Badge from '../../components/ui/Badge'
import Table from '../../components/shared/Table'

// ─── Tabs ─────────────────────────────────────────────────────────────────────
const TABS = ['Towns', 'Union Councils']

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

  if (isLoading) {
    return (
      <div className="border-t border-primary/10 bg-slate-50 px-8 py-5 flex items-center gap-2 text-text-muted text-sm">
        <Loader2 size={14} className="animate-spin flex-shrink-0" />
        Loading facilities…
      </div>
    )
  }

  const facilities = [...(facilityData?.facilities ?? [])].sort((a, b) => a.name.localeCompare(b.name))
  const byFacility = dashData?.summary?.byFacility ?? []

  if (facilities.length === 0) {
    return (
      <div className="border-t border-primary/10 bg-slate-50/80 px-8 py-5 flex items-center gap-3 text-text-muted">
        <Building2 size={16} className="opacity-30 flex-shrink-0" />
        <p className="text-sm font-medium">No facilities registered under this UC.</p>
      </div>
    )
  }

  return (
    <div className="border-t border-primary/10 bg-slate-50/80 px-6 py-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {facilities.map((f) => {
          const facDash = byFacility.find((b) => b.facilityId === f.id)
          const fStatus = facilityStatus(facDash?.statusCounts ?? f.statusCounts)
          const cfg = statusConfig(fStatus)
          const sc = facDash?.statusCounts ?? f.statusCounts ?? {}
          const hasAny = sc.critical > 0 || sc.low > 0 || sc.adequate > 0

          return (
            <Link
              key={f.id}
              to={`/super-admin/facilities/${f.id}`}
              className={`group bg-slate-50 rounded-lg border border-surface-border border-l-4 ${cfg.borderL} p-3.5 flex flex-col gap-2.5 hover:bg-white hover:shadow-md transition-all duration-200`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className={`p-1.5 rounded-md flex-shrink-0 ${cfg.bg}`}>
                    <Building2 size={13} className={cfg.text} strokeWidth={2.2} />
                  </div>
                  <p className="font-bold text-sm text-text truncate group-hover:text-primary transition-colors" title={f.name}>
                    {f.name}
                  </p>
                </div>
                <StatusBadge status={fStatus} />
              </div>

              <p className={`text-xs truncate pl-0.5 ${f.facilitySupervisorName ? 'text-text-muted font-medium' : 'text-text-muted italic'}`}>
                {f.facilitySupervisorName ?? 'Unstaffed'}
              </p>

              <div className="flex flex-wrap gap-1 pt-2 border-t border-slate-100">
                {sc.critical > 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-danger-bg text-danger border border-danger/10 tabular-nums">
                    {sc.critical} Critical
                  </span>
                )}
                {sc.low > 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-warning-bg text-warning-dark border border-warning/10 tabular-nums">
                    {sc.low} Low
                  </span>
                )}
                {sc.adequate > 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-success-bg text-success-dark border border-success/10 tabular-nums">
                    {sc.adequate} Normal
                  </span>
                )}
                {!hasAny && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-surface-alt text-text-muted border border-surface-border">
                    No Data
                  </span>
                )}
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

// ─── Towns Tab ────────────────────────────────────────────────────────────────
function TownsTab() {
  const queryClient = useQueryClient()
  const [search, setSearch]       = useState('')
  const [addOpen, setAddOpen]     = useState(false)
  const [addForm, setAddForm]     = useState({ name: '', districtId: '' })
  const [addError, setAddError]   = useState('')
  const [editing, setEditing]     = useState(null)
  const [editName, setEditName]   = useState('')
  const [editError, setEditError] = useState('')
  const [delTarget, setDelTarget] = useState(null)
  const [delError, setDelError]   = useState('')

  const { data: townsData, isLoading, isError } = useQuery({ queryKey: ['towns'], queryFn: getTowns })
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
    onSuccess: () => { inv(); setAddOpen(false); setAddForm({ name: '', districtId: '' }); setAddError('') },
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

  const columns = [
    { key: 'name', label: 'Town', render: (t) => (
      <div className="flex items-center gap-2">
        <Map size={13} className="text-primary flex-shrink-0" />
        <span className="font-semibold text-sm text-text">{t.name}</span>
      </div>
    )},
    { key: 'district', label: 'District', render: (t) => (
      <span className="text-xs text-text-muted font-semibold">{districtMap[t.districtId] ?? '—'}</span>
    )},
    { key: 'status', label: 'Status', render: (t) => (
      <Badge type={t.isActive ? 'active' : 'inactive'} />
    )},
    { key: 'actions', label: '', render: (t) => (
      <div className="flex items-center gap-1 justify-end">
        <button onClick={() => { setEditing(t); setEditName(t.name); setEditError('') }}
          title="Rename" className="p-1.5 rounded-lg text-text-muted hover:bg-slate-100 hover:text-text transition-colors">
          <Pencil size={13} />
        </button>
        {t.isActive ? (
          <button onClick={() => { setDelTarget(t); setDelError('') }}
            title="Deactivate" className="p-1.5 rounded-lg text-text-muted hover:bg-danger-bg hover:text-danger transition-colors">
            <Trash2 size={13} />
          </button>
        ) : (
          <button onClick={() => activateMutation.mutate(t.id)}
            title="Reactivate" className="p-1.5 rounded-lg text-text-muted hover:bg-success/10 hover:text-success-dark transition-colors">
            <RefreshCcw size={13} />
          </button>
        )}
      </div>
    )},
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <SearchInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search towns…" />
        <Button onClick={() => { setAddOpen(true); setAddError('') }}>
          <Plus size={15} /> Add Town
        </Button>
      </div>

      {isLoading && <div className="flex flex-col gap-3">{[1,2,3].map((i) => <div key={i} className="h-12 bg-slate-50 border border-slate-200 rounded-xl animate-pulse" />)}</div>}
      {isError && <p className="text-sm text-danger">Failed to load towns.</p>}
      {!isLoading && !isError && (
        <Table columns={columns} rows={filtered} rowKey={(t) => t.id}
          emptyMessage={search ? `No towns match "${search}".` : 'No towns yet.'}
          mobileCard={(t) => (
            <div className="px-4 py-3 hover:bg-slate-50">
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-2 min-w-0">
                  <Map size={12} className="text-primary flex-shrink-0" />
                  <span className="font-semibold text-sm text-text truncate">{t.name}</span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Badge type={t.isActive ? 'active' : 'inactive'} />
                  <button onClick={() => { setEditing(t); setEditName(t.name); setEditError('') }}
                    title="Rename" className="p-1.5 rounded-lg text-text-muted hover:bg-slate-100 hover:text-text transition-colors">
                    <Pencil size={13} />
                  </button>
                  {t.isActive ? (
                    <button onClick={() => { setDelTarget(t); setDelError('') }}
                      title="Deactivate" className="p-1.5 rounded-lg text-text-muted hover:bg-danger-bg hover:text-danger transition-colors">
                      <Trash2 size={13} />
                    </button>
                  ) : (
                    <button onClick={() => activateMutation.mutate(t.id)}
                      title="Reactivate" className="p-1.5 rounded-lg text-text-muted hover:bg-success/10 hover:text-success-dark transition-colors">
                      <RefreshCcw size={13} />
                    </button>
                  )}
                </div>
              </div>
              <p className="text-xs text-text-muted pl-5">{districtMap[t.districtId] ?? '—'}</p>
            </div>
          )}
        />
      )}

      {/* Add Modal */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add Town">
        <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); createMutation.mutate() }}>
          <Input id="tname" label="Town Name *" value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })} required />
          <Select id="tdist" label="District *" options={districtOptions} placeholder="Select district…"
            value={addForm.districtId} onChange={(e) => setAddForm({ ...addForm, districtId: e.target.value })} required />
          {addError && <p className="text-xs text-danger">{addError}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={createMutation.isPending || !addForm.name || !addForm.districtId}>
              {createMutation.isPending ? 'Adding…' : 'Add Town'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={`Rename Town — ${editing?.name ?? ''}`}>
        <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); editMutation.mutate() }}>
          <Input id="tename" label="New Name *" value={editName} onChange={(e) => { setEditName(e.target.value); setEditError('') }} required />
          {editError && <p className="text-xs text-danger">{editError}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setEditing(null)}>Cancel</Button>
            <Button type="submit" disabled={editMutation.isPending || !editName}>{editMutation.isPending ? 'Saving…' : 'Save'}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!delTarget}
        onClose={() => setDelTarget(null)}
        onConfirm={() => deleteMutation.mutate()}
        title="Deactivate Town"
        message={`Deactivate ${delTarget?.name ?? ''}? It can be reactivated later.`}
        confirmLabel="Deactivate"
        isPending={deleteMutation.isPending}
        error={delError}
      />
    </div>
  )
}

// ─── UCs Tab ──────────────────────────────────────────────────────────────────
function UCsTab() {
  const queryClient = useQueryClient()
  const [search, setSearch]           = useState('')
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

  const { data: ucsData, isLoading, isError } = useQuery({ queryKey: ['ucs'], queryFn: () => getUnionCouncils() })
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
    onSuccess: () => { inv(); setAddOpen(false); setAddForm({ name: '', townId: '' }); setAddError('') },
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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <SearchInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search UCs…" />
        <Button onClick={() => { setAddOpen(true); setAddError('') }}>
          <Plus size={15} /> Add UC
        </Button>
      </div>

      {isLoading && <div className="flex flex-col gap-3">{[1,2,3].map((i) => <div key={i} className="h-12 bg-slate-50 border border-slate-200 rounded-xl animate-pulse" />)}</div>}
      {isError && <p className="text-sm text-danger">Failed to load union councils.</p>}

      {!isLoading && !isError && (
        <div className="bg-white rounded-2xl border border-surface-border overflow-hidden shadow-sm">

          {/* Column headers — desktop only */}
          <div className="hidden sm:grid grid-cols-[2fr_1fr_1fr_2fr_240px] px-6 py-3.5 bg-slate-50 border-b border-surface-border gap-4 items-center">
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">UC Name</span>
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Town</span>
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">District</span>
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">UC Supervisor</span>
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest text-right pr-8">Actions</span>
          </div>

          {filtered.length === 0 && (
            <div className="px-6 py-10 text-center text-sm text-text-muted">
              {search ? `No UCs match "${search}".` : 'No union councils yet.'}
            </div>
          )}

          {filtered.map((uc) => {
            const isExpanded = expandedId === uc.id
            return (
              <div key={uc.id} className="border-b border-surface-border last:border-b-0">

                {/* ── Mobile card ── */}
                <div className={['sm:hidden px-4 py-3 flex flex-col gap-2 transition-colors duration-150', isExpanded ? 'bg-primary/[0.04]' : ''].join(' ')}>
                  <div className="flex items-center gap-2 min-w-0">
                    <MapPin size={12} className="text-primary flex-shrink-0" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm text-text truncate">{uc.name}</p>
                        <Badge type={uc.isActive ? 'active' : 'inactive'} />
                      </div>
                      <p className="text-[10px] text-text-muted font-medium mt-0.5">
                        {uc.townName ?? '—'} · {uc.districtName ?? '—'}
                      </p>
                    </div>
                  </div>
                  <div className="text-xs text-text-muted pl-5">
                    {uc.ucSupervisorName ? (
                      <span className="flex items-center gap-1">
                        <User size={10} className="text-primary" />
                        <span className="font-semibold text-text">{uc.ucSupervisorName}</span>
                      </span>
                    ) : (
                      <button
                        onClick={() => { setAssignTarget(uc); setAssignUserId(''); setAssignError('') }}
                        className="font-semibold text-primary hover:underline flex items-center gap-1"
                      >
                        <UserPlus size={10} /> Assign Supervisor
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-wrap pl-5 pt-0.5">
                    <button
                      onClick={() => toggleExpand(uc.id)}
                      className={['inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-lg transition-all duration-150', isExpanded ? 'bg-primary text-white' : 'text-primary hover:bg-primary/5'].join(' ')}
                    >
                      <ChevronDown size={13} strokeWidth={2.5} className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                      {isExpanded ? 'Collapse' : 'View Details'}
                    </button>
                    {uc.ucSupervisorName && (
                      <button onClick={() => { setAssignTarget(uc); setAssignUserId(''); setAssignError('') }}
                        title="Reassign Supervisor" className="p-1.5 rounded-lg text-text-muted hover:bg-slate-100 hover:text-text transition-colors">
                        <UserPlus size={13} />
                      </button>
                    )}
                    <button onClick={() => { setEditing(uc); setEditName(uc.name); setEditError('') }}
                      title="Rename" className="p-1.5 rounded-lg text-text-muted hover:bg-slate-100 hover:text-text transition-colors">
                      <Pencil size={13} />
                    </button>
                    {uc.isActive ? (
                      <button onClick={() => { setDelTarget(uc); setDelError('') }}
                        title="Deactivate" className="p-1.5 rounded-lg text-text-muted hover:bg-danger-bg hover:text-danger transition-colors">
                        <Trash2 size={13} />
                      </button>
                    ) : (
                      <button onClick={() => activateMutation.mutate(uc.id)}
                        title="Reactivate" className="p-1.5 rounded-lg text-text-muted hover:bg-success/10 hover:text-success-dark transition-colors">
                        <RefreshCcw size={13} />
                      </button>
                    )}
                  </div>
                </div>

                {/* ── Desktop row ── */}
                <div className={[
                  'hidden sm:grid grid-cols-[2fr_1fr_1fr_2fr_240px] px-6 py-4 gap-4 items-center transition-colors duration-150',
                  isExpanded ? 'bg-primary/[0.04]' : 'hover:bg-slate-50/60',
                ].join(' ')}>

                  <div className="flex items-center gap-2 min-w-0">
                    <MapPin size={13} className="text-primary flex-shrink-0" />
                    <span className="font-semibold text-sm text-text truncate">{uc.name}</span>
                    <Badge type={uc.isActive ? 'active' : 'inactive'} />
                  </div>

                  <span className="text-xs text-text-muted font-semibold truncate">{uc.townName ?? '—'}</span>

                  <span className="text-xs text-text-muted truncate">{uc.districtName ?? '—'}</span>

                  <div>
                    {uc.ucSupervisorName ? (
                      <div className="flex items-center gap-1.5">
                        <User size={12} className="text-primary flex-shrink-0" />
                        <span className="text-xs font-semibold text-text truncate">{uc.ucSupervisorName}</span>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setAssignTarget(uc); setAssignUserId(''); setAssignError('') }}
                        className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
                      >
                        <UserPlus size={11} /> Assign Supervisor
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-1 justify-end">
                    <button
                      onClick={() => toggleExpand(uc.id)}
                      className={[
                        'inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-lg transition-all duration-150',
                        isExpanded ? 'bg-primary text-white' : 'text-primary hover:bg-primary/5',
                      ].join(' ')}
                    >
                      <ChevronDown size={13} strokeWidth={2.5} className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                      {isExpanded ? 'Collapse' : 'View Details'}
                    </button>
                    {uc.ucSupervisorName && (
                      <button onClick={() => { setAssignTarget(uc); setAssignUserId(''); setAssignError('') }}
                        title="Reassign Supervisor" className="p-1.5 rounded-lg text-text-muted hover:bg-slate-100 hover:text-text transition-colors">
                        <UserPlus size={13} />
                      </button>
                    )}
                    <button onClick={() => { setEditing(uc); setEditName(uc.name); setEditError('') }}
                      title="Rename" className="p-1.5 rounded-lg text-text-muted hover:bg-slate-100 hover:text-text transition-colors">
                      <Pencil size={13} />
                    </button>
                    {uc.isActive ? (
                      <button onClick={() => { setDelTarget(uc); setDelError('') }}
                        title="Deactivate" className="p-1.5 rounded-lg text-text-muted hover:bg-danger-bg hover:text-danger transition-colors">
                        <Trash2 size={13} />
                      </button>
                    ) : (
                      <button onClick={() => activateMutation.mutate(uc.id)}
                        title="Reactivate" className="p-1.5 rounded-lg text-text-muted hover:bg-success/10 hover:text-success-dark transition-colors">
                        <RefreshCcw size={13} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Inline expanded facilities panel */}
                {isExpanded && <UCExpandedPanel ucId={uc.id} />}
              </div>
            )
          })}
        </div>
      )}

      {/* Add Modal */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add Union Council">
        <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); createMutation.mutate() }}>
          <Input id="ucname" label="UC Name *" value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })} required />
          <Select id="uctown" label="Town *" options={townOptions} placeholder="Select town…"
            value={addForm.townId} onChange={(e) => setAddForm({ ...addForm, townId: e.target.value })} required />
          {addError && <p className="text-xs text-danger">{addError}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={createMutation.isPending || !addForm.name || !addForm.townId}>
              {createMutation.isPending ? 'Adding…' : 'Add UC'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={`Rename UC — ${editing?.name ?? ''}`}>
        <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); editMutation.mutate() }}>
          <Input id="ucename" label="New Name *" value={editName} onChange={(e) => { setEditName(e.target.value); setEditError('') }} required />
          {editError && <p className="text-xs text-danger">{editError}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setEditing(null)}>Cancel</Button>
            <Button type="submit" disabled={editMutation.isPending || !editName}>{editMutation.isPending ? 'Saving…' : 'Save'}</Button>
          </div>
        </form>
      </Modal>

      {/* Assign / Reassign Supervisor Modal */}
      <Modal
        open={!!assignTarget}
        onClose={() => { setAssignTarget(null); setAssignUserId(''); setAssignError('') }}
        title={assignTarget?.ucSupervisorName ? 'Reassign UC Supervisor' : 'Assign UC Supervisor'}
      >
        <div className="flex flex-col gap-4">
          <div className="bg-slate-50 border border-surface-border rounded-xl px-4 py-3 text-sm">
            <p className="font-bold text-text">{assignTarget?.name}</p>
            <p className="text-xs text-text-muted mt-0.5">{assignTarget?.townName} · {assignTarget?.districtName}</p>
            {assignTarget?.ucSupervisorName && (
              <p className="text-xs text-text-muted mt-1.5">
                Current supervisor: <span className="font-semibold text-text">{assignTarget.ucSupervisorName}</span>
              </p>
            )}
          </div>

          {supervisorOptions.length === 0 ? (
            <p className="text-xs text-text-muted italic">No active UC supervisors found. Create a UC Supervisor user first.</p>
          ) : (
            <Select
              id="uc-assign-user"
              label="Select UC Supervisor *"
              options={supervisorOptions}
              placeholder="Choose a supervisor…"
              value={assignUserId}
              onChange={(e) => { setAssignUserId(e.target.value); setAssignError('') }}
            />
          )}

          {assignError && <p className="text-xs text-danger bg-danger-bg border border-danger/10 px-3 py-2 rounded-lg">{assignError}</p>}

          <div className="flex justify-end gap-3 pt-1">
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
        title="Deactivate UC"
        message={`Deactivate ${delTarget?.name ?? ''}? It can be reactivated later.`}
        confirmLabel="Deactivate"
        isPending={deleteMutation.isPending}
        error={delError}
      />
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function UCManagement() {
  const [tab, setTab] = useState('Towns')

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-200">

      {/* Header */}
      <div className="bg-primary rounded-2xl px-4 sm:px-6 py-4 sm:py-5">
        <h1 className="text-xl font-bold text-white tracking-tight">UC Management</h1>
        <p className="text-sm text-white/70 mt-0.5">Manage Towns and Union Councils · District → Town → UC → Facility</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
              tab === t ? 'bg-white text-text shadow-sm' : 'text-text-muted hover:text-text'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Towns' ? <TownsTab /> : <UCsTab />}
    </div>
  )
}
