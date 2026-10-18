import { useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { Plus, Pencil, UserPlus, Building2, Eye, Power, PowerOff } from 'lucide-react'
import PageHeader from '../../components/shared/PageHeader'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getFacilities, getDistricts, getUnionCouncils, createFacility, updateFacility, deleteFacility, activateFacility, getDashboard, createUser } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import { facilityStatus, statusConfig } from '../../lib/status'
import { useUrlFilters } from '../../hooks/useUrlState'
import ExportButton from '../../components/ui/ExportButton'
import { useDebounce } from '../../hooks/useDebounce'
import Table from '../../components/shared/Table'
import SearchInput from '../../components/shared/SearchInput'
import Pagination from '../../components/shared/Pagination'
import FilterChips from '../../components/shared/FilterChips'
import StatusBadge from '../../components/shared/StatusBadge'
import ErrorState from '../../components/shared/ErrorState'
import { STATUS_FILTERS } from '../../components/facilities/facilityTable'
import { formatDate, plural } from '../../lib/format'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import Badge from '../../components/ui/Badge'
import Toast from '../../components/ui/Toast'
import RowActions from '../../components/ui/RowActions'
import ViewToggle from '../../components/ui/ViewToggle'
import { SummaryDialog } from '../../components/ui/ReviewDialog'
import EntityCard from '../../components/shared/EntityCard'
import { useViewMode } from '../../hooks/useViewMode'

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
  const [created, setCreated]    = useState(null)
  const [view, setView]          = useViewMode('admin-facilities')
  const [{ q: searchQuery, status: statusFilter }, setFilters] = useUrlFilters({ q: '', status: 'all' })
  const [currentPage, setPage]   = useState(1)
  const debouncedSearch = useDebounce(searchQuery)
  function setStatusFilter(val) { setFilters({ status: val }); setPage(1) }

  const { data, isLoading, isError, error, refetch } = useQuery({ queryKey: ['facilities'], queryFn: getFacilities })
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
      setCreated({
        title: 'Facility created',
        message: <>Next, add a facility supervisor for <span className="font-medium">{form.name}</span> so stock can be recorded.</>,
        rows: [
          { label: 'Name', value: form.name },
          { label: 'District', value: districtMap[form.districtId] ?? '—' },
          { label: 'Union council', value: filteredUCOptions.find((o) => o.value === form.ucId)?.label ?? '—' },
        ],
      })
      setOpen(false)
      setForm({ name: '', districtId: '', ucId: '' })
      setFormError('')
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
      const name = `${createSupForm.firstName} ${createSupForm.lastName}`.trim()
      setCreated({
        title: 'Facility supervisor created',
        message: <>The account is active. Share the password with <span className="font-medium">{name}</span> over a secure channel.</>,
        rows: [
          { label: 'Name', value: name },
          { label: 'Email', value: createSupForm.email },
          { label: 'ZMID', value: createSupForm.zmid },
          { label: 'Facility', value: createSupTarget.name },
        ],
      })
      setCreateSupTarget(null)
      setCreateSupForm(EMPTY_FAC_SUP_FORM)
      setCreateSupError('')
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

  const ITEMS_PER_PAGE = view === 'grid' ? 12 : 10
  const totalPages  = Math.ceil(filtered.length / ITEMS_PER_PAGE)
  const paginated   = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)

  function openRename(row)     { setRenaming(row); setRenameValue(row.name); setRenameError('') }
  function openDeactivate(row) { setDeactivateTarget(row); setDeactivateError('') }

  const readOnly = user?.role === 'observer'
  const openCreateSup = (row) => { setCreateSupTarget(row); setCreateSupForm(EMPTY_FAC_SUP_FORM); setCreateSupError('') }
  const statusOf = (f) => statusByFacilityId.get(f.id) ?? 'no_data'

  const actions = (row, { withView = false } = {}) => (
    <RowActions
      className="justify-end"
      actions={[
        withView && { icon: Eye, label: 'View facility', to: `/super-admin/facilities/${row.id}` },
        !readOnly && !row.facilitySupervisorName && row.isActive && { icon: UserPlus, label: 'Add supervisor', onClick: () => openCreateSup(row) },
        !readOnly && { icon: Pencil, label: 'Rename', onClick: () => openRename(row) },
        !readOnly && (row.isActive
          ? { icon: PowerOff, label: 'Deactivate', danger: true, onClick: () => openDeactivate(row) }
          : { icon: Power, label: 'Activate', onClick: () => activateMutation.mutate(row.id), disabled: activateMutation.isPending }),
      ]}
    />
  )

  const gridCard = (row) => (
    <EntityCard
      icon={Building2}
      accent={row.isActive ? statusOf(row) : 'no_data'}
      title={row.name}
      subtitle={[districtMap[row.districtId], row.ucName].filter(Boolean).join(' · ') || undefined}
      badge={<Badge type={row.isActive ? 'active' : 'inactive'} />}
      meta={[
        { label: 'Stock', value: <StatusBadge status={statusOf(row)} /> },
        { label: 'Facility Supervisor', value: row.facilitySupervisorName ?? 'Unstaffed' },
      ]}
      footnote={activeNote(row)}
      actions={actions(row, { withView: true })}
    />
  )

  const activeNote = (row) => row.isActive
    ? (row.lastActivityAt ? `Last active ${formatDate(row.lastActivityAt)}` : 'No activity yet')
    : (row.deactivatedAt ? `Since ${formatDate(row.deactivatedAt)}` : null)

  const columns = [
    {
      key: 'name', label: 'Facility',
      render: (row) => (
        <div className={row.isActive ? '' : 'opacity-60'}>
          <RouterLink to={`/super-admin/facilities/${row.id}`} className="font-medium text-text hover:text-primary hover:underline">{row.name}</RouterLink>
          <p className="text-xs text-text-muted">{districtMap[row.districtId] ?? '—'}{row.ucName && ` · ${row.ucName}`}</p>
        </div>
      ),
    },
    { key: 'supervisor', label: 'Facility Supervisor', render: (row) => row.facilitySupervisorName ?? <span className="text-text-muted">Unstaffed</span> },
    { key: 'stock', label: 'Stock', render: (row) => <StatusBadge status={statusOf(row)} /> },
    {
      key: 'isActive', label: 'Account',
      render: (row) => (
        <div>
          <Badge type={row.isActive ? 'active' : 'inactive'} />
          {activeNote(row) && <p className="text-xs text-text-muted mt-1 whitespace-nowrap">{activeNote(row)}</p>}
        </div>
      ),
    },
    ...(readOnly ? [] : [{ key: 'actions', label: '', align: 'right', render: actions }]),
  ]

  return (
    <div>
      <PageHeader
        breadcrumb="Super Admin › Network"
        title="Facilities"
        subtitle={isLoading ? undefined : `${plural(facilities.length, 'facility', 'facilities')} across all districts`}
        actions={!readOnly && (
          <Button onClick={() => { setOpen(true); setFormError('') }}><Plus size={16} strokeWidth={1.75} /> Add facility</Button>
        )}
      />

      {isError ? (
        <ErrorState title="Couldn’t load facilities" error={error} onRetry={refetch} />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col lg:flex-row lg:items-center gap-3">
            <div className="flex items-center gap-3 lg:flex-1 min-w-0">
              <div className="flex-1 min-w-0">
                <SearchInput value={searchQuery} onChange={(e) => { setFilters({ q: e.target.value }); setPage(1) }} placeholder="Search facility or district…" />
              </div>
              <ViewToggle value={view} onChange={setView} className="lg:order-last" />
              <div className="lg:order-last">
                <ExportButton
                  name="facilities"
                  rows={filtered}
                  columns={[
                    { label: 'Facility', value: (f) => f.name },
                    { label: 'District', value: (f) => districtMap[f.districtId] ?? f.districtName },
                    { label: 'Union council', value: (f) => f.ucName },
                    { label: 'Facility Supervisor', value: (f) => f.facilitySupervisorName ?? 'Unstaffed' },
                    { label: 'Stock status', value: (f) => statusConfig(statusOf(f)).label },
                    { label: 'Account', value: (f) => (f.isActive ? 'Active' : 'Inactive') },
                    { label: 'Last activity', value: (f) => (f.lastActivityAt ? formatDate(f.lastActivityAt) : '') },
                  ]}
                />
              </div>
            </div>
            <FilterChips
              label="Stock status"
              value={statusFilter}
              onChange={setStatusFilter}
              options={STATUS_FILTERS.map((o) => ({ ...o, count: o.value === 'all' ? facilities.length : statusCounts[o.value] }))}
            />
          </div>
          <Table
            columns={columns}
            rows={paginated}
            loading={isLoading}
            view={view}
            gridCard={gridCard}
            emptyMessage={searchQuery ? `No facilities match “${searchQuery}”.` : 'No facilities in this view.'}
            mobileCard={(row) => (
              <div className="px-4 py-3.5 flex flex-col gap-2">
                <div className="flex items-start justify-between gap-3">
                  <div className={`min-w-0 ${row.isActive ? '' : 'opacity-60'}`}>
                    <RouterLink to={`/super-admin/facilities/${row.id}`} className="font-medium text-text truncate block hover:text-primary">{row.name}</RouterLink>
                    <p className="text-xs text-text-muted truncate">
                      {[districtMap[row.districtId], row.ucName, row.facilitySupervisorName ?? 'Unstaffed'].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <StatusBadge status={statusOf(row)} />
                </div>
                {!row.isActive && <div><Badge type="inactive" /></div>}
                {!readOnly && actions(row)}
              </div>
            )}
          />
          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setPage} />
        </div>
      )}

      {/* Create modal */}
      <Modal open={open} onClose={() => setOpen(false)} title="Add facility">
        <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); if (/[<>]/.test(form.name)) { setFormError('Names cannot contain < or > characters.'); return } createMutation.mutate() }}>
          <Input id="fac-name" label="Facility name" placeholder="e.g. South Health Clinic"
            value={form.name} onChange={(e) => { setForm({ ...form, name: e.target.value }); setFormError('') }} required />
          <Select id="fac-district" label="District" options={districtOptions}
            placeholder="Select a district…"
            value={form.districtId} onChange={(e) => { setForm({ ...form, districtId: e.target.value, ucId: '' }); setFormError('') }} required />
          <Select id="fac-uc" label="Union council" options={filteredUCOptions}
            placeholder={form.districtId ? 'Select a UC…' : 'Select district first…'}
            value={form.ucId} onChange={(e) => { setForm({ ...form, ucId: e.target.value }); setFormError('') }} required />
          {formError && <p role="alert" className="text-sm text-danger-dark bg-danger-bg rounded-control px-3.5 py-2.5">{formError}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" type="button" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={createMutation.isPending || !form.ucId}>
              {createMutation.isPending ? 'Creating…' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Rename modal */}
      <Modal open={!!renaming} onClose={() => setRenaming(null)} title={`Rename ${renaming?.name ?? ''}`}>
        <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); if (/[<>]/.test(renameValue)) { setRenameError('Names cannot contain < or > characters.'); return } renameMutation.mutate() }}>
          <Input id="rename-facility" label="Facility name"
            value={renameValue} onChange={(e) => { setRenameValue(e.target.value); setRenameError('') }} required />
          {renameError && <p role="alert" className="text-sm text-danger-dark bg-danger-bg rounded-control px-3.5 py-2.5">{renameError}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" type="button" onClick={() => setRenaming(null)}>Cancel</Button>
            <Button type="submit" disabled={renameMutation.isPending}>{renameMutation.isPending ? 'Saving…' : 'Save'}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deactivateTarget}
        onClose={() => setDeactivateTarget(null)}
        onConfirm={() => deactivateMutation.mutate(deactivateTarget.id)}
        title="Deactivate facility?"
        message={<p className="text-sm text-text">Deactivate <span className="font-medium">{deactivateTarget?.name}</span>? Supervisors and staff will not be able to log stock until reactivated.</p>}
        confirmLabel="Deactivate"
        isPending={deactivateMutation.isPending}
        error={deactivateError}
      />

      {/* Create Facility Supervisor modal */}
      <Modal
        open={!!createSupTarget}
        onClose={() => { setCreateSupTarget(null); setCreateSupForm(EMPTY_FAC_SUP_FORM); setCreateSupError('') }}
        title={`Add supervisor for ${createSupTarget?.name ?? ''}`}
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
            <Input id="fsup-fn" label="First name" placeholder="Jane"
              value={createSupForm.firstName} onChange={(e) => setCreateSupForm({ ...createSupForm, firstName: e.target.value })} required />
            <Input id="fsup-ln" label="Last name" placeholder="Doe"
              value={createSupForm.lastName} onChange={(e) => setCreateSupForm({ ...createSupForm, lastName: e.target.value })} required />
          </div>
          <Input id="fsup-zmid" label="ZMID (organisation ID)" placeholder="e.g. Z-1001"
            value={createSupForm.zmid} onChange={(e) => setCreateSupForm({ ...createSupForm, zmid: e.target.value })} required />
          <Input id="fsup-email" label="Email" type="email" placeholder="supervisor@akuh.org"
            value={createSupForm.email} onChange={(e) => { setCreateSupForm({ ...createSupForm, email: e.target.value }); setCreateSupError('') }} required />
          <Input id="fsup-pw" label="Password (at least 8 characters)" type="password" minLength={8}
            value={createSupForm.password} onChange={(e) => setCreateSupForm({ ...createSupForm, password: e.target.value })} required />
          <Input id="fsup-phone" label="Phone (optional)" placeholder="e.g. 03001234567"
            value={createSupForm.phone} onChange={(e) => setCreateSupForm({ ...createSupForm, phone: e.target.value })} />
          <Input id="fsup-cnic" label="CNIC (optional)" placeholder="e.g. 12345-1234567-1"
            value={createSupForm.cnic} onChange={(e) => setCreateSupForm({ ...createSupForm, cnic: e.target.value })} />
          {createSupError && <p role="alert" className="text-sm text-danger-dark bg-danger-bg rounded-control px-3.5 py-2.5">{createSupError}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" type="button" onClick={() => { setCreateSupTarget(null); setCreateSupForm(EMPTY_FAC_SUP_FORM) }}>Cancel</Button>
            <Button type="submit" disabled={createSupMutation.isPending}>
              {createSupMutation.isPending ? 'Creating…' : 'Create supervisor'}
            </Button>
          </div>
        </form>
      </Modal>

      <SummaryDialog
        open={!!created}
        onClose={() => setCreated(null)}
        title={created?.title}
        message={created?.message}
        rows={created?.rows ?? []}
      />

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
