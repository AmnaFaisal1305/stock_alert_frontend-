import { useState } from 'react'
import { Link as RouterLink, useSearchParams } from 'react-router-dom'
import { Plus, Pencil, UserX, UserCheck, ArrowRight, Building2, AlertCircle, AlertTriangle, CheckCircle2, UserPlus } from 'lucide-react'
import PageHeader from '../../components/shared/PageHeader'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getFacilities, getDistricts, getUnionCouncils, createFacility, updateFacility, deleteFacility, activateFacility, getDashboard, createUser } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import { facilityStatus } from '../../lib/status'
import { useDebounce } from '../../hooks/useDebounce'
import Table from '../../components/shared/Table'
import SearchInput from '../../components/shared/SearchInput'
import Pagination from '../../components/shared/Pagination'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import Badge from '../../components/ui/Badge'
import Toast from '../../components/ui/Toast'

export default function SuperAdminFacilityManagement() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const [open, setOpen]             = useState(false)
  const [form, setForm]             = useState({ name: '', districtId: '', ucId: '' })
  const [formError, setFormError]   = useState('')

  const [renaming, setRenaming]         = useState(null)
  const [renameValue, setRenameValue]   = useState('')
  const [renameError, setRenameError]   = useState('')

  const [deactivateTarget, setDeactivateTarget] = useState(null)
  const [deactivateError, setDeactivateError]   = useState('')

  const [createSupTarget, setCreateSupTarget] = useState(null)
  const [createSupForm, setCreateSupForm]     = useState({ firstName: '', lastName: '', zmid: '', email: '', password: '', phone: '', cnic: '' })
  const [createSupError, setCreateSupError]   = useState('')

  const [toast, setToast]        = useState(null)
  const [searchQuery, setSearch] = useState('')
  const [currentPage, setPage]   = useState(1)
  const debouncedSearch = useDebounce(searchQuery)
  const [searchParams, setSearchParams] = useSearchParams()
  const statusFilter = searchParams.get('filter') ?? 'all'
  function setStatusFilter(val) { setSearchParams(val === 'all' ? {} : { filter: val }); setPage(1) }

  const { data, isLoading, isError } = useQuery({ queryKey: ['facilities'], queryFn: getFacilities })
  const { data: districtData }       = useQuery({ queryKey: ['districts'],  queryFn: getDistricts  })
  const { data: ucData }             = useQuery({ queryKey: ['ucs'],         queryFn: () => getUnionCouncils() })
  const { data: dashboardData }      = useQuery({ queryKey: ['dashboard'],  queryFn: getDashboard, staleTime: 15_000 })

  const facilities = data?.facilities ?? []
  const districtMap = Object.fromEntries((districtData?.districts ?? []).map((d) => [d.id, d.name]))
  const districtOptions = (districtData?.districts ?? [])
    .filter((d) => d.isActive)
    .map((d) => ({ value: d.id, label: d.name }))

  const allUCs = ucData?.unionCouncils ?? []
  const filteredUCOptions = allUCs
    .filter((uc) => uc.isActive && (!form.districtId || uc.districtId === form.districtId))
    .map((uc) => ({ value: uc.id, label: `${uc.name} (${uc.townName ?? ''})` }))

  const createMutation = useMutation({
    mutationFn: () => createFacility({
      name: form.name,
      districtId: form.districtId,
      ucId: form.ucId,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facilities'] })
      queryClient.invalidateQueries({ queryKey: ['districts'] })
      queryClient.invalidateQueries({ queryKey: ['audit-log'] })
      setOpen(false)
      setForm({ name: '', districtId: '', ucId: '' })
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

  const EMPTY_FAC_SUP_FORM = { firstName: '', lastName: '', zmid: '', email: '', password: '', phone: '', cnic: '' }

  const createSupMutation = useMutation({
    mutationFn: () => createUser({
      firstName: createSupForm.firstName, lastName: createSupForm.lastName,
      zmid: createSupForm.zmid, email: createSupForm.email, password: createSupForm.password,
      role: 'facility_supervisor', facilityId: createSupTarget.id,
      ...(createSupForm.phone.trim() ? { phone: createSupForm.phone.trim() } : {}),
      ...(createSupForm.cnic.trim() ? { cnic: createSupForm.cnic.trim() } : {}),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facilities'] })
      queryClient.invalidateQueries({ queryKey: ['users'] })
      queryClient.invalidateQueries({ queryKey: ['audit-log'] })
      setCreateSupTarget(null)
      setCreateSupForm(EMPTY_FAC_SUP_FORM)
      setCreateSupError('')
      setToast({ message: 'Facility supervisor created successfully.', type: 'success' })
    },
    onError: (err) => setCreateSupError(
      err.status === 409 && err.body?.error?.includes('ZMID')
        ? 'This ZMID is already assigned to another account.'
        : err.status === 409 && err.body?.error?.includes('active supervisor')
        ? 'This facility already has an active supervisor.'
        : err.message
    ),
  })

  const statusByFacilityId = new Map(
    (dashboardData?.summary?.byFacility ?? []).map((f) => [f.facilityId, facilityStatus(f.statusCounts)])
  )

  const statusCounts = { critical: 0, low: 0, adequate: 0, no_data: 0 }
  for (const f of facilities) {
    const s = statusByFacilityId.get(f.id) ?? 'no_data'
    if (s in statusCounts) statusCounts[s]++
  }

  const filtered = facilities.filter((f) => {
    const q = debouncedSearch.toLowerCase()
    const matchesSearch = (f.name ?? '').toLowerCase().includes(q) ||
                          (f.districtName ?? '').toLowerCase().includes(q)
    const fStatus = statusByFacilityId.get(f.id) ?? 'no_data'
    const matchesStatus = statusFilter === 'all' ? true : fStatus === statusFilter
    return matchesSearch && matchesStatus
  })

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
      label: 'District / UC',
      render: (row) => (
        <div>
          <p className="text-xs font-semibold text-text-muted">{districtMap[row.districtId] ?? '—'}</p>
          {row.ucName && <p className="text-[10px] text-text-muted/70">{row.ucName} · {row.townName ?? ''}</p>}
        </div>
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
          <span className="text-[10px] font-bold text-text-muted/70 bg-surface-alt border border-surface-border px-2 py-0.5 rounded uppercase tracking-wider">Unstaffed</span>
        )
      ),
    },
    {
      key: 'isActive',
      label: 'Status',
      render: (row) => (
        <div className="flex flex-col gap-0.5">
          <Badge type={row.isActive ? 'active' : 'inactive'} />
          {row.isActive && row.lastActivityAt && (
            <p className="text-[10px] text-text-muted">
              Last active {new Date(row.lastActivityAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
          )}
          {row.isActive && !row.lastActivityAt && (
            <p className="text-[10px] text-text-muted italic">No activity yet</p>
          )}
          {!row.isActive && row.deactivatedAt && (
            <p className="text-[10px] text-text-muted">
              Since {new Date(row.deactivatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
          )}
        </div>
      ),
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
          {user?.role !== 'observer' && (<>
            {!row.facilitySupervisorName && row.isActive && (
              <Button variant="ghost" size="sm" className="text-primary hover:bg-primary/5" onClick={() => { setCreateSupTarget(row); setCreateSupForm(EMPTY_FAC_SUP_FORM); setCreateSupError('') }}>
                <UserPlus size={12} /> Create Supervisor
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => openRename(row)}>
              <Pencil size={12} /> Rename
            </Button>
            {row.isActive ? (
              <Button variant="ghost-danger" size="sm" onClick={() => openDeactivate(row)}>
                <UserX size={12} /> Deactivate
              </Button>
            ) : (
              <Button variant="ghost" size="sm" className="text-text-muted hover:text-success-dark hover:bg-success-bg"
                onClick={() => activateMutation.mutate(row.id)} disabled={activateMutation.isPending}>
                <UserCheck size={12} /> Activate
              </Button>
            )}
          </>)}
        </div>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-200">

      <PageHeader
        breadcrumb="Super Admin › Facility Management"
        title="Facility Management"
        subtitle={!isLoading ? `${facilities.length} ${facilities.length === 1 ? 'facility' : 'facilities'} registered across all districts` : 'Loading facilities…'}
        actions={user?.role !== 'observer' && (
          <Button onClick={() => { setOpen(true); setFormError('') }}>
            <Plus size={15} strokeWidth={2.5} /> Add Facility
          </Button>
        )}
      />

      {/* Search + Filter */}
      {!isLoading && !isError && facilities.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center flex-wrap">
          <SearchInput
            value={searchQuery}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search by name or district…"
          />

          <div className="flex gap-2 flex-wrap">
            {[
              { key: 'all',      label: 'All',      count: facilities.length,         activeClass: 'bg-primary text-white border-primary',    icon: null         },
              { key: 'critical', label: 'Critical',  count: statusCounts.critical,    activeClass: 'bg-danger text-white border-danger',      icon: AlertCircle  },
              { key: 'low',      label: 'Low',       count: statusCounts.low,         activeClass: 'bg-warning text-white border-warning',    icon: AlertTriangle},
              { key: 'adequate', label: 'Normal',     count: statusCounts.adequate,   activeClass: 'bg-success text-white border-success',    icon: CheckCircle2 },
              { key: 'no_data',  label: 'No Data',   count: statusCounts.no_data,    activeClass: 'bg-surface-chip text-text-muted border-surface-border', icon: null         },
            ].map(({ key, label, count, activeClass, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setStatusFilter(key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all duration-150 ${
                  statusFilter === key
                    ? activeClass
                    : 'bg-white border-surface-border text-text-muted hover:text-text hover:border-slate-300'
                }`}
              >
                {Icon && <Icon size={11} />}
                {label}
                <span className="opacity-75">({count})</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {isLoading && (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-14 bg-surface-alt border border-surface-border rounded-xl animate-pulse" />)}
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
            mobileCard={(row) => (
              <div className="px-4 py-3 hover:bg-surface-alt">
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <RouterLink to={`/super-admin/facilities/${row.id}`} className="font-bold text-sm text-text hover:text-primary transition-colors flex items-center gap-1.5 min-w-0">
                    <Building2 size={13} className="text-text-muted/70 flex-shrink-0" />
                    <span className="truncate">{row.name}</span>
                  </RouterLink>
                  <Badge type={row.isActive ? 'active' : 'inactive'} />
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-text-muted mt-1 pl-5">
                  <span>District: {districtMap[row.districtId] ?? '—'}</span>
                  <span>UC: {row.ucName ?? '—'}</span>
                  <span>Supervisor: {row.facilitySupervisorName ?? <em>Unstaffed</em>}</span>
                </div>
                <div className="flex gap-1.5 flex-wrap mt-2 pl-5">
                  <RouterLink to={`/super-admin/facilities/${row.id}`} className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline px-2 py-1">
                    View Stock <ArrowRight size={11} />
                  </RouterLink>
                  {user?.role !== 'observer' && (<>
                    {!row.facilitySupervisorName && row.isActive && (
                      <Button variant="ghost" size="sm" className="text-primary hover:bg-primary/5" onClick={() => { setCreateSupTarget(row); setCreateSupForm(EMPTY_FAC_SUP_FORM); setCreateSupError('') }}>
                        <UserPlus size={12} /> Create Supervisor
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => openRename(row)}><Pencil size={12} /> Rename</Button>
                    {row.isActive ? (
                      <Button variant="ghost-danger" size="sm" onClick={() => openDeactivate(row)}><UserX size={12} /> Deactivate</Button>
                    ) : (
                      <Button variant="ghost" size="sm" className="text-text-muted hover:text-success-dark hover:bg-success-bg" onClick={() => activateMutation.mutate(row.id)} disabled={activateMutation.isPending}><UserCheck size={12} /> Activate</Button>
                    )}
                  </>)}
                </div>
              </div>
            )}
          />

          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setPage} />
        </div>
      )}

      {/* Create modal */}
      <Modal open={open} onClose={() => setOpen(false)} title="Create Facility">
        <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); if (/[<>]/.test(form.name)) { setFormError('Names cannot contain < or > characters.'); return } createMutation.mutate() }}>
          <Input id="fac-name" label="Facility Name" placeholder="e.g. South Health Clinic"
            value={form.name} onChange={(e) => { setForm({ ...form, name: e.target.value }); setFormError('') }} required />
          <Select id="fac-district" label="District" options={districtOptions}
            placeholder="Select a district…"
            value={form.districtId} onChange={(e) => { setForm({ ...form, districtId: e.target.value, ucId: '' }); setFormError('') }} required />
          <Select id="fac-uc" label="Union Council" options={filteredUCOptions}
            placeholder={form.districtId ? 'Select a UC…' : 'Select district first…'}
            value={form.ucId} onChange={(e) => { setForm({ ...form, ucId: e.target.value }); setFormError('') }} required />
          {formError && <p className="text-xs text-danger bg-danger-bg border border-danger/10 px-3 py-2 rounded-lg">{formError}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={createMutation.isPending || !form.ucId}>
              {createMutation.isPending ? 'Creating…' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Rename modal */}
      <Modal open={!!renaming} onClose={() => setRenaming(null)} title={`Rename — ${renaming?.name ?? ''}`}>
        <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); if (/[<>]/.test(renameValue)) { setRenameError('Names cannot contain < or > characters.'); return } renameMutation.mutate() }}>
          <Input id="rename-facility" label="Facility Name"
            value={renameValue} onChange={(e) => { setRenameValue(e.target.value); setRenameError('') }} required />
          {renameError && <p className="text-xs text-danger">{renameError}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setRenaming(null)}>Cancel</Button>
            <Button type="submit" disabled={renameMutation.isPending}>{renameMutation.isPending ? 'Saving…' : 'Save'}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deactivateTarget}
        onClose={() => setDeactivateTarget(null)}
        onConfirm={() => deactivateMutation.mutate(deactivateTarget.id)}
        title="Deactivate Facility"
        message={<p className="text-sm text-text">Deactivate <span className="font-bold">{deactivateTarget?.name}</span>? Supervisors and staff will not be able to log stock until reactivated.</p>}
        confirmLabel="Deactivate"
        isPending={deactivateMutation.isPending}
        error={deactivateError}
      />

      {/* Create Facility Supervisor modal */}
      <Modal
        open={!!createSupTarget}
        onClose={() => { setCreateSupTarget(null); setCreateSupForm(EMPTY_FAC_SUP_FORM); setCreateSupError('') }}
        title={`Create Facility Supervisor — ${createSupTarget?.name ?? ''}`}
      >
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (/[<>]/.test(createSupForm.firstName) || /[<>]/.test(createSupForm.lastName)) {
              setCreateSupError('Names cannot contain < or > characters.')
              return
            }
            createSupMutation.mutate()
          }}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input id="fsup-fn" label="First Name" placeholder="Jane"
              value={createSupForm.firstName} onChange={(e) => setCreateSupForm({ ...createSupForm, firstName: e.target.value })} required />
            <Input id="fsup-ln" label="Last Name" placeholder="Doe"
              value={createSupForm.lastName} onChange={(e) => setCreateSupForm({ ...createSupForm, lastName: e.target.value })} required />
          </div>
          <Input id="fsup-zmid" label="ZMID (Organization ID)" placeholder="e.g. Z-1001"
            value={createSupForm.zmid} onChange={(e) => setCreateSupForm({ ...createSupForm, zmid: e.target.value })} required />
          <Input id="fsup-email" label="Email" type="email" placeholder="supervisor@akuh.org"
            value={createSupForm.email} onChange={(e) => { setCreateSupForm({ ...createSupForm, email: e.target.value }); setCreateSupError('') }} required />
          <Input id="fsup-pw" label="Password (min 8 chars)" type="password" minLength={8}
            value={createSupForm.password} onChange={(e) => setCreateSupForm({ ...createSupForm, password: e.target.value })} required />
          <Input id="fsup-phone" label="Phone (optional)" placeholder="e.g. 03001234567"
            value={createSupForm.phone} onChange={(e) => setCreateSupForm({ ...createSupForm, phone: e.target.value })} />
          <Input id="fsup-cnic" label="CNIC (optional)" placeholder="e.g. 12345-1234567-1"
            value={createSupForm.cnic} onChange={(e) => setCreateSupForm({ ...createSupForm, cnic: e.target.value })} />
          {createSupError && <p className="text-xs text-danger bg-danger-bg border border-danger/10 px-3 py-2 rounded-lg">{createSupError}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => { setCreateSupTarget(null); setCreateSupForm(EMPTY_FAC_SUP_FORM) }}>Cancel</Button>
            <Button type="submit" disabled={createSupMutation.isPending}>
              {createSupMutation.isPending ? 'Creating…' : 'Create Supervisor'}
            </Button>
          </div>
        </form>
      </Modal>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
