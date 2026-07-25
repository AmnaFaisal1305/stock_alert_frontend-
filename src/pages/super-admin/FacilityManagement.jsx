import { useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { Plus, Pencil, UserX, UserCheck, ArrowRight, Search, Building2, ChevronLeft, ChevronRight } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getFacilities, getDistricts, createFacility, updateFacility, deleteFacility, activateFacility } from '../../lib/api'
import Table from '../../components/shared/Table'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import Badge from '../../components/ui/Badge'
import Toast from '../../components/ui/Toast'

export default function SuperAdminFacilityManagement() {
  const queryClient = useQueryClient()

  const [open, setOpen]             = useState(false)
  const [form, setForm]             = useState({ name: '', districtId: '', unionCouncil: '', town: '' })
  const [formError, setFormError]   = useState('')

  const [renaming, setRenaming]         = useState(null)
  const [renameValue, setRenameValue]   = useState('')
  const [renameError, setRenameError]   = useState('')

  const [deactivateTarget, setDeactivateTarget] = useState(null)
  const [deactivateError, setDeactivateError]   = useState('')

  const [toast, setToast]       = useState(null)
  const [searchQuery, setSearch] = useState('')
  const [currentPage, setPage]  = useState(1)

  const { data, isLoading, isError } = useQuery({ queryKey: ['facilities'], queryFn: getFacilities })
  const { data: districtData }       = useQuery({ queryKey: ['districts'],  queryFn: getDistricts  })

  const facilities = data?.facilities ?? []
  const districtMap = Object.fromEntries((districtData?.districts ?? []).map((d) => [d.id, d.name]))
  const districtOptions = (districtData?.districts ?? [])
    .filter((d) => d.isActive)
    .map((d) => ({ value: d.id, label: d.name }))

  const createMutation = useMutation({
    mutationFn: () => createFacility({
      name: form.name,
      districtId: form.districtId,
      ...(form.unionCouncil.trim() ? { unionCouncil: form.unionCouncil.trim() } : {}),
      ...(form.town.trim() ? { town: form.town.trim() } : {}),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facilities'] })
      queryClient.invalidateQueries({ queryKey: ['districts'] })
      queryClient.invalidateQueries({ queryKey: ['audit-log'] })
      setOpen(false)
      setForm({ name: '', districtId: '', unionCouncil: '', town: '' })
      setFormError('')
      setToast({ message: 'Facility created successfully.', type: 'success' })
    },
    onError: (err) => setFormError(err.message),
  })

  const renameMutation = useMutation({
    mutationFn: () => updateFacility(renaming.id, renameValue),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facilities'] })
      queryClient.invalidateQueries({ queryKey: ['audit-log'] })
      setRenaming(null); setRenameError('')
      setToast({ message: 'Facility renamed.', type: 'success' })
    },
    onError: (err) => setRenameError(err.message),
  })

  const deactivateMutation = useMutation({
    mutationFn: (id) => deleteFacility(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facilities'] })
      queryClient.invalidateQueries({ queryKey: ['audit-log'] })
      setToast({ message: `${deactivateTarget?.name} deactivated.`, type: 'success' })
      setDeactivateTarget(null); setDeactivateError('')
    },
    onError: (err) => setDeactivateError(err.message),
  })

  const activateMutation = useMutation({
    mutationFn: (id) => activateFacility(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['facilities'] })
      queryClient.invalidateQueries({ queryKey: ['audit-log'] })
      const target = facilities.find((f) => f.id === id)
      setToast({ message: `${target?.name ?? 'Facility'} activated.`, type: 'success' })
    },
    onError: (err) => setToast({ message: err.message, type: 'error' }),
  })

  const filtered = facilities.filter((f) =>
    (f.name ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (f.districtName ?? '').toLowerCase().includes(searchQuery.toLowerCase())
  )

  const ITEMS_PER_PAGE = 10
  const totalPages  = Math.ceil(filtered.length / ITEMS_PER_PAGE)
  const paginated   = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)

  function openRename(row)     { setRenaming(row); setRenameValue(row.name); setRenameError('') }
  function openDeactivate(row) { setDeactivateTarget(row); setDeactivateError('') }

  const columns = [
    {
      key: 'name',
      label: 'Facility Name',
      render: (row) => (
        <RouterLink to={`/super-admin/facilities/${row.id}`} className="font-bold text-text hover:text-primary transition-colors flex items-center gap-2">
          <Building2 size={14} className="text-text-muted/70 flex-shrink-0" />
          <span>{row.name}</span>
        </RouterLink>
      ),
    },
    {
      key: 'district',
      label: 'District',
      render: (row) => (
        <span className="text-xs font-semibold text-text-muted">{districtMap[row.districtId] ?? '—'}</span>
      ),
    },
    {
      key: 'supervisor',
      label: 'Supervisor',
      render: (row) => (
        row.facilitySupervisorName ? (
          <div>
            <p className="text-xs font-bold text-text">{row.facilitySupervisorName}</p>
          </div>
        ) : (
          <span className="text-[10px] font-bold text-text-muted/70 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded uppercase tracking-wider">Unstaffed</span>
        )
      ),
    },
    {
      key: 'isActive',
      label: 'Status',
      render: (row) => <Badge type={row.isActive ? 'active' : 'inactive'} />,
    },
    {
      key: 'actions',
      label: '',
      render: (row) => (
        <div className="flex gap-1.5 justify-end">
          <RouterLink
            to={`/super-admin/facilities/${row.id}`}
            className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline px-2.5 py-1.5"
          >
            View Stock <ArrowRight size={13} strokeWidth={2.2} />
          </RouterLink>
          <Button variant="ghost" size="sm" onClick={() => openRename(row)}>
            <Pencil size={12} /> Rename
          </Button>
          {row.isActive ? (
            <Button variant="ghost" size="sm" className="text-text-muted hover:text-danger hover:bg-danger/5" onClick={() => openDeactivate(row)}>
              <UserX size={12} /> Deactivate
            </Button>
          ) : (
            <Button variant="ghost" size="sm" className="text-text-muted hover:text-success-dark hover:bg-success-bg"
              onClick={() => activateMutation.mutate(row.id)} disabled={activateMutation.isPending}>
              <UserCheck size={12} /> Activate
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-200">

      {/* Header */}
      <div className="bg-primary rounded-2xl px-6 py-5 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Facility Management</h1>
          <p className="text-sm text-white/70 mt-0.5">
            {!isLoading
              ? `${facilities.length} ${facilities.length === 1 ? 'facility' : 'facilities'} registered across all districts`
              : 'Loading facilities…'}
          </p>
        </div>
        <button
          onClick={() => { setOpen(true); setFormError('') }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-primary text-sm font-bold hover:bg-white/90 transition-all flex-shrink-0 shadow-sm"
        >
          <Plus size={15} strokeWidth={2.5} /> Add Facility
        </button>
      </div>

      {/* Search */}
      {!isLoading && !isError && facilities.length > 0 && (
        <div className="relative w-80">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
          <input
            type="text"
            placeholder="Search by name or district…"
            value={searchQuery}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            className="w-full pl-10 pr-3.5 py-2.5 text-sm border border-surface-border rounded-xl bg-white shadow-sm focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all placeholder:text-text-muted/60"
          />
        </div>
      )}

      {isLoading && (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-14 bg-slate-50 border border-slate-200 rounded-xl animate-pulse" />)}
        </div>
      )}

      {isError && (
        <div className="bg-danger-bg border border-danger/10 text-xs font-semibold text-danger rounded-xl px-4 py-3">
          Failed to load facilities. Please try refreshing.
        </div>
      )}

      {!isLoading && !isError && (
        <div className="flex flex-col gap-3">
          <Table
            columns={columns}
            rows={paginated}
            emptyMessage={searchQuery ? `No facilities match "${searchQuery}".` : 'No facilities registered yet.'}
          />

          {totalPages > 1 && (
            <div className="flex items-center justify-between bg-white px-5 py-4 rounded-2xl border border-surface-border shadow-sm">
              <p className="text-xs text-text-muted font-semibold hidden sm:block">
                Page <span className="font-extrabold text-text">{currentPage}</span> of{' '}
                <span className="font-extrabold text-text">{totalPages}</span>
              </p>
              <nav className="isolate inline-flex -space-x-px rounded-xl shadow-sm border border-slate-200 bg-slate-50 p-0.5 gap-1">
                <button onClick={() => setPage(currentPage - 1)} disabled={currentPage === 1}
                  className="relative inline-flex items-center rounded-lg p-1.5 text-text-muted hover:bg-white disabled:opacity-40 transition-all cursor-pointer">
                  <ChevronLeft size={16} />
                </button>
                {Array.from({ length: totalPages }).map((_, i) => {
                  const p = i + 1
                  return (
                    <button key={p} onClick={() => setPage(p)}
                      className={`relative inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                        p === currentPage ? 'bg-primary text-white shadow-sm' : 'text-text-muted hover:bg-white'
                      }`}>{p}</button>
                  )
                })}
                <button onClick={() => setPage(currentPage + 1)} disabled={currentPage === totalPages}
                  className="relative inline-flex items-center rounded-lg p-1.5 text-text-muted hover:bg-white disabled:opacity-40 transition-all cursor-pointer">
                  <ChevronRight size={16} />
                </button>
              </nav>
            </div>
          )}
        </div>
      )}

      {/* Create modal */}
      <Modal open={open} onClose={() => setOpen(false)} title="Create Facility">
        <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); createMutation.mutate() }}>
          <Input id="fac-name" label="Facility Name" placeholder="e.g. South Health Clinic"
            value={form.name} onChange={(e) => { setForm({ ...form, name: e.target.value }); setFormError('') }} required />
          <Select id="fac-district" label="Assign to District" options={districtOptions}
            placeholder="Select a district…"
            value={form.districtId} onChange={(e) => { setForm({ ...form, districtId: e.target.value }); setFormError('') }} required />
          <Input id="fac-uc" label="Union Council (optional)" placeholder="e.g. UC 5"
            value={form.unionCouncil} onChange={(e) => setForm({ ...form, unionCouncil: e.target.value })} />
          <Input id="fac-town" label="Town (optional)" placeholder="e.g. Malir"
            value={form.town} onChange={(e) => setForm({ ...form, town: e.target.value })} />
          {formError && <p className="text-xs text-danger bg-danger-bg border border-danger/10 px-3 py-2 rounded-lg">{formError}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating…' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Rename modal */}
      <Modal open={!!renaming} onClose={() => setRenaming(null)} title={`Rename — ${renaming?.name ?? ''}`}>
        <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); renameMutation.mutate() }}>
          <Input id="rename-facility" label="Facility Name"
            value={renameValue} onChange={(e) => { setRenameValue(e.target.value); setRenameError('') }} required />
          {renameError && <p className="text-xs text-danger">{renameError}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setRenaming(null)}>Cancel</Button>
            <Button type="submit" disabled={renameMutation.isPending}>{renameMutation.isPending ? 'Saving…' : 'Save'}</Button>
          </div>
        </form>
      </Modal>

      {/* Deactivate confirmation */}
      <Modal open={!!deactivateTarget} onClose={() => setDeactivateTarget(null)} title="Deactivate Facility" maxWidth="max-w-sm">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-text">
            Deactivate <span className="font-bold">{deactivateTarget?.name}</span>? Supervisors and staff will not be able to log stock until reactivated.
          </p>
          {deactivateError && <p className="text-xs text-danger bg-danger-bg rounded-lg px-3 py-2">{deactivateError}</p>}
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setDeactivateTarget(null)}>Cancel</Button>
            <Button variant="danger" onClick={() => deactivateMutation.mutate(deactivateTarget.id)} disabled={deactivateMutation.isPending}>
              {deactivateMutation.isPending ? 'Deactivating…' : 'Deactivate'}
            </Button>
          </div>
        </div>
      </Modal>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
