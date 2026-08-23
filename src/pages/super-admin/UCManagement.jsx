import { useState } from 'react'
import { Plus, Pencil, Trash2, RefreshCcw, MapPin, Map, Search, ChevronDown, ChevronRight, User } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getTowns, createTown, updateTown, deleteTown, activateTown,
  getUnionCouncils, createUnionCouncil, updateUnionCouncil, deleteUnionCouncil, activateUnionCouncil,
  getDistricts,
} from '../../lib/api'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import Badge from '../../components/ui/Badge'
import Table from '../../components/shared/Table'

// ─── Tabs ─────────────────────────────────────────────────────────────────────
const TABS = ['Towns', 'Union Councils']

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
        <div className="relative w-72">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
          <input type="text" placeholder="Search towns…" value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-3.5 py-2.5 text-sm border border-surface-border rounded-xl bg-white shadow-sm focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all placeholder:text-text-muted/60" />
        </div>
        <Button onClick={() => { setAddOpen(true); setAddError('') }}>
          <Plus size={15} /> Add Town
        </Button>
      </div>

      {isLoading && <div className="flex flex-col gap-3">{[1,2,3].map((i) => <div key={i} className="h-12 bg-slate-50 border border-slate-200 rounded-xl animate-pulse" />)}</div>}
      {isError && <p className="text-sm text-danger">Failed to load towns.</p>}
      {!isLoading && !isError && (
        <Table columns={columns} rows={filtered} rowKey={(t) => t.id}
          emptyMessage={search ? `No towns match "${search}".` : 'No towns yet.'} />
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

      {/* Delete confirm */}
      <Modal open={!!delTarget} onClose={() => setDelTarget(null)} title="Deactivate Town" maxWidth="max-w-sm">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-text">Deactivate <span className="font-semibold">{delTarget?.name}</span>? It can be reactivated later.</p>
          {delError && <p className="text-xs text-danger bg-danger-bg rounded-lg px-3 py-2">{delError}</p>}
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setDelTarget(null)}>Cancel</Button>
            <Button variant="danger" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? 'Deactivating…' : 'Deactivate'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ─── UCs Tab ──────────────────────────────────────────────────────────────────
function UCsTab() {
  const queryClient = useQueryClient()
  const [search, setSearch]       = useState('')
  const [addOpen, setAddOpen]     = useState(false)
  const [addForm, setAddForm]     = useState({ name: '', townId: '' })
  const [addError, setAddError]   = useState('')
  const [editing, setEditing]     = useState(null)
  const [editName, setEditName]   = useState('')
  const [editError, setEditError] = useState('')
  const [delTarget, setDelTarget] = useState(null)
  const [delError, setDelError]   = useState('')

  const { data: ucsData, isLoading, isError } = useQuery({ queryKey: ['ucs'], queryFn: () => getUnionCouncils() })
  const { data: townsData } = useQuery({ queryKey: ['towns'], queryFn: getTowns })

  const ucs     = ucsData?.unionCouncils ?? []
  const towns   = townsData?.towns ?? []
  const townOptions = towns.filter((t) => t.isActive).map((t) => ({ value: t.id, label: `${t.name} (${t.districtName ?? ''})` }))

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

  const filtered = ucs.filter((uc) => {
    const q = search.toLowerCase()
    return (
      uc.name.toLowerCase().includes(q) ||
      (uc.townName ?? '').toLowerCase().includes(q) ||
      (uc.districtName ?? '').toLowerCase().includes(q) ||
      (uc.ucSupervisorName ?? '').toLowerCase().includes(q)
    )
  })

  const columns = [
    { key: 'name', label: 'UC Name', render: (uc) => (
      <div className="flex items-center gap-2">
        <MapPin size={13} className="text-primary flex-shrink-0" />
        <span className="font-semibold text-sm text-text">{uc.name}</span>
      </div>
    )},
    { key: 'town', label: 'Town', render: (uc) => <span className="text-xs text-text-muted font-semibold">{uc.townName ?? '—'}</span> },
    { key: 'district', label: 'District', render: (uc) => <span className="text-xs text-text-muted">{uc.districtName ?? '—'}</span> },
    { key: 'supervisor', label: 'UC Supervisor', render: (uc) => (
      uc.ucSupervisorName ? (
        <div className="flex items-center gap-1.5">
          <User size={12} className="text-primary flex-shrink-0" />
          <span className="text-xs font-semibold text-text">{uc.ucSupervisorName}</span>
        </div>
      ) : (
        <span className="text-xs italic text-text-muted/60">Unassigned</span>
      )
    )},
    { key: 'status', label: 'Status', render: (uc) => <Badge type={uc.isActive ? 'active' : 'inactive'} /> },
    { key: 'actions', label: '', render: (uc) => (
      <div className="flex items-center gap-1 justify-end">
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
    )},
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <div className="relative w-72">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
          <input type="text" placeholder="Search UCs…" value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-3.5 py-2.5 text-sm border border-surface-border rounded-xl bg-white shadow-sm focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all placeholder:text-text-muted/60" />
        </div>
        <Button onClick={() => { setAddOpen(true); setAddError('') }}>
          <Plus size={15} /> Add UC
        </Button>
      </div>

      {isLoading && <div className="flex flex-col gap-3">{[1,2,3].map((i) => <div key={i} className="h-12 bg-slate-50 border border-slate-200 rounded-xl animate-pulse" />)}</div>}
      {isError && <p className="text-sm text-danger">Failed to load union councils.</p>}
      {!isLoading && !isError && (
        <Table columns={columns} rows={filtered} rowKey={(uc) => uc.id}
          emptyMessage={search ? `No UCs match "${search}".` : 'No union councils yet.'} />
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

      {/* Delete confirm */}
      <Modal open={!!delTarget} onClose={() => setDelTarget(null)} title="Deactivate UC" maxWidth="max-w-sm">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-text">Deactivate <span className="font-semibold">{delTarget?.name}</span>? It can be reactivated later.</p>
          {delError && <p className="text-xs text-danger bg-danger-bg rounded-lg px-3 py-2">{delError}</p>}
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setDelTarget(null)}>Cancel</Button>
            <Button variant="danger" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? 'Deactivating…' : 'Deactivate'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function UCManagement() {
  const [tab, setTab] = useState('Towns')

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-200">

      {/* Header */}
      <div className="bg-primary rounded-2xl px-6 py-5">
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
