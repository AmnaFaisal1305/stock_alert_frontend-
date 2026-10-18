import { useState, useEffect } from 'react'
import { Plus, KeyRound, MapPin, UserX, UserCheck } from 'lucide-react'
import PageHeader from '../../components/shared/PageHeader'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getUsers, getDistricts, getFacilities, getUnionCouncils, createUser, deactivateUser, activateUser, resetPassword, assignUcSupervisor, bulkUserStatus } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import { useDebounce } from '../../hooks/useDebounce'
import Table from '../../components/shared/Table'
import SearchInput from '../../components/shared/SearchInput'
import Pagination from '../../components/shared/Pagination'
import FilterChips from '../../components/shared/FilterChips'
import ErrorState from '../../components/shared/ErrorState'
import EntityCard from '../../components/shared/EntityCard'
import RoleTag from '../../components/shared/RoleTag'
import { ROLE_LABELS, ROLE_ACCENT, ROLE_ICON } from '../../lib/navigation'
import { plural, timeAgo } from '../../lib/format'
import { useViewMode } from '../../hooks/useViewMode'
import { useUrlFilters } from '../../hooks/useUrlState'
import ExportButton from '../../components/ui/ExportButton'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { SummaryDialog } from '../../components/ui/ReviewDialog'
import RowActions from '../../components/ui/RowActions'
import ViewToggle from '../../components/ui/ViewToggle'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import Badge from '../../components/ui/Badge'
import Toast from '../../components/ui/Toast'

export default function UserManagement() {
  const { user: authUser } = useAuth()
  const queryClient = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [resetTarget, setResetTarget] = useState(null)
  const [deactivateTarget, setDeactivateTarget] = useState(null)
  const [reassignTarget, setReassignTarget] = useState(null)
  const [reassignUcIds, setReassignUcIds] = useState([])
  const [reassignError, setReassignError] = useState('')
  const [form, setForm] = useState({ role: 'district_supervisor', firstName: '', lastName: '', zmid: '', email: '', password: '', districtId: '', facilityId: '', ucIds: [], phone: '', cnic: '', pickDistrictId: '', pickUcId: '' })
  const [newPassword, setNewPassword] = useState('')
  const [formError, setFormError] = useState('')
  const [toast, setToast] = useState(null)
  const [created, setCreated] = useState(null)
  const [view, setView] = useViewMode('admin-users')
  const [selected, setSelected] = useState([])
  const [bulkDeactivateOpen, setBulkDeactivateOpen] = useState(false)

  // Filters live in the URL (?q=&role=); the page number stays local.
  const [{ q: searchQuery, role: roleParam }, setFilters] = useUrlFilters({ q: '', role: '' })
  const [currentPage, setCurrentPage] = useState(1)

  const ROLE_FILTERS = [
    { label: 'All', value: null },
    ...['district_supervisor', 'uc_supervisor', 'facility_supervisor', 'facility_worker', 'facility_head', 'observer']
      .map((r) => ({ label: ROLE_LABELS[r], value: r })),
  ]
  const roleFilter = Math.max(0, ROLE_FILTERS.findIndex((f) => (f.value ?? '') === roleParam))

  const { data: userData, isLoading, isError, error, refetch } = useQuery({ queryKey: ['users'], queryFn: getUsers })
  const { data: districtData } = useQuery({ queryKey: ['districts'], queryFn: getDistricts, staleTime: 0 })
  const { data: ucData }       = useQuery({ queryKey: ['ucs'], queryFn: () => getUnionCouncils(), staleTime: 0 })
  // Facility roles pick District → UC → Facility; only facilityId is sent.
  const { data: pickUcData } = useQuery({
    queryKey: ['ucs', form.pickDistrictId],
    queryFn:  () => getUnionCouncils({ districtId: form.pickDistrictId }),
    enabled:  !!form.pickDistrictId,
  })
  const { data: facilityData } = useQuery({
    queryKey: ['facilities', form.pickUcId],
    queryFn:  () => getFacilities({ ucId: form.pickUcId }),
    enabled:  !!form.pickUcId,
    staleTime: 0,
  })

  const districtMap = Object.fromEntries((districtData?.districts ?? []).map((d) => [d.id, d.name]))
  const districtOptions = (districtData?.districts ?? [])
    .filter((d) => d.isActive)
    .map((d) => ({ value: d.id, label: d.supervisorName ? `${d.name} (staffed)` : d.name }))
  const facilityOptions = (facilityData?.facilities ?? [])
    .filter((f) => f.isActive)
    .map((f) => ({ value: f.id, label: form.role === 'facility_supervisor' && f.facilitySupervisorName ? `${f.name} (staffed)` : f.name }))
  const pickUcOptions = (pickUcData?.unionCouncils ?? [])
    .filter((uc) => uc.isActive)
    .map((uc) => ({ value: uc.id, label: uc.townName ? `${uc.name} (${uc.townName})` : uc.name }))
  const pickDistrictOptions = (districtData?.districts ?? [])
    .filter((d) => d.isActive)
    .map((d) => ({ value: d.id, label: d.name }))
  const ucOptions = (ucData?.unionCouncils ?? [])
    .filter((uc) => uc.isActive)
    .map((uc) => ({ value: uc.id, label: `${uc.name} (${uc.townName ?? ''})` }))
  const users = userData?.users ?? []

  const EMPTY_FORM = { role: 'district_supervisor', firstName: '', lastName: '', zmid: '', email: '', password: '', districtId: '', facilityId: '', ucIds: [], phone: '', cnic: '', pickDistrictId: '', pickUcId: '' }

  const createMutation = useMutation({
    mutationFn: () => {
      const isFacilityRole = form.role === 'facility_supervisor' || form.role === 'facility_worker' || form.role === 'facility_head'
      const isUcRole = form.role === 'uc_supervisor'
      const isObserver = form.role === 'observer'
      return createUser({
        firstName: form.firstName, lastName: form.lastName, zmid: form.zmid,
        email: form.email, password: form.password, role: form.role,
        ...(isFacilityRole ? { facilityId: form.facilityId }
          : isUcRole ? { ucIds: form.ucIds }
          : isObserver ? {}
          : { districtId: form.districtId }),
        ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
        ...(form.cnic.trim() ? { cnic: form.cnic.trim() } : {}),
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      queryClient.invalidateQueries({ queryKey: ['facilities'] })
      queryClient.invalidateQueries({ queryKey: ['audit-log'] })
      const label = (opts, id) => opts.find((o) => o.value === id)?.label.replace(/ \(staffed\)$/, '')
      setCreated({
        role: ROLE_LABELS[form.role] ?? 'User',
        name: `${form.firstName} ${form.lastName}`.trim(),
        email: form.email,
        zmid: form.zmid,
        scope: form.role === 'uc_supervisor' ? form.ucIds.map((id) => label(ucOptions, id)).join(', ')
          : form.facilityId ? label(facilityOptions, form.facilityId)
          : form.districtId ? label(districtOptions, form.districtId)
          : 'All districts',
      })
      setCreateOpen(false)
      setForm(EMPTY_FORM)
      setFormError('')
    },
    onError: (err) => setFormError(
      err.status === 409 && err.body?.error?.includes('ZMID')
        ? 'This ZMID is already assigned to another account.'
        : err.status === 409 && /already has an active/i.test(err.body?.error ?? '')
        ? `${err.body.error}. Deactivate them first.`
        : err.body?.error?.includes('same district')
        ? 'All selected union councils must belong to the same district.'
        : err.message
    ),
  })

  const reassignMutation = useMutation({
    mutationFn: () => assignUcSupervisor(reassignTarget.id, reassignUcIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setReassignTarget(null)
      setReassignUcIds([])
      setReassignError('')
      setToast({ message: 'UC assignments updated.', type: 'success' })
    },
    onError: (err) => setReassignError(
      err.body?.error?.includes('same district')
        ? 'All selected union councils must belong to the same district.'
        : err.message
    ),
  })

  const deactivateMutation = useMutation({
    mutationFn: (id) => deactivateUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      queryClient.invalidateQueries({ queryKey: ['audit-log'] })
      setToast({ message: `${deactivateTarget?.email} deactivated.`, type: 'success' })
      setDeactivateTarget(null)
    },
    onError: (err) => setToast({ message: err.message, type: 'error' }),
  })

  const activateMutation = useMutation({
    mutationFn: (id) => activateUser(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      queryClient.invalidateQueries({ queryKey: ['audit-log'] })
      const target = users.find((u) => u.id === id)
      setToast({ message: `${target?.email ?? 'Account'} activated.`, type: 'success' })
    },
    onError: (err) => setToast({ message: err.message, type: 'error' }),
  })

  // Chunks of 25 (the backend's limit); one toast for the whole run.
  const bulkMutation = useMutation({
    mutationFn: async (active) => {
      let updated = 0
      const failed = []
      for (let i = 0; i < selected.length; i += 25) {
        const r = await bulkUserStatus(selected.slice(i, i + 25), active)
        updated += Array.isArray(r?.updated) ? r.updated.length : (r?.updated ?? 0)
        failed.push(...(r?.failed ?? []))
      }
      return { updated, failed, active }
    },
    onSuccess: ({ updated, failed, active }) => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      queryClient.invalidateQueries({ queryKey: ['audit-log'] })
      setSelected([])
      setBulkDeactivateOpen(false)
      setToast({
        message: `${plural(updated, 'account')} ${active ? 'activated' : 'deactivated'}.${failed.length ? ` ${failed.length} failed: ${failed[0].error}` : ''}`,
        type: failed.length ? 'error' : 'success',
      })
    },
    onError: (err) => { setBulkDeactivateOpen(false); setToast({ message: err.message, type: 'error' }) },
  })

  const resetMutation = useMutation({
    mutationFn: () => resetPassword(resetTarget.id, newPassword),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audit-log'] })
      setResetTarget(null)
      setNewPassword('')
      setFormError('')
      setToast({ message: 'Password reset successfully.', type: 'success' })
    },
    onError: (err) => setFormError(err.message),
  })

  const roleCounts = ROLE_FILTERS.map((f) =>
    f.value ? users.filter((u) => u.role === f.value).length : users.length
  )

  const debouncedSearch = useDebounce(searchQuery)

  // Filter users by name/email and role
  const filteredUsers = users.filter((u) => {
    const q = debouncedSearch.toLowerCase()
    const matchesSearch =
      (u.name ?? '').toLowerCase().includes(q) ||
      (u.email ?? '').toLowerCase().includes(q)
    const matchesRole = !ROLE_FILTERS[roleFilter].value || u.role === ROLE_FILTERS[roleFilter].value
    return matchesSearch && matchesRole
  })

  // Pagination logic
  const itemsPerPage = view === 'grid' ? 12 : 10
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage)
  const paginatedUsers = filteredUsers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  // Selection is per page and list view only; it resets whenever what's shown changes.
  useEffect(() => { setSelected([]) }, [searchQuery, roleParam, currentPage, view])
  const selectable = paginatedUsers.filter((u) => u.id !== authUser?.id)
  const allOnPage = selectable.length > 0 && selectable.every((u) => selected.includes(u.id))
  const toggle = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))

  const activeRole = ROLE_FILTERS[roleFilter].value
  const assignmentColLabel =
    activeRole === 'district_supervisor' ? 'District' :
    activeRole === 'uc_supervisor'       ? 'Union councils' :
    activeRole === 'facility_supervisor' ? 'Facility' :
    activeRole === 'facility_worker'     ? 'Facility' :
    activeRole === 'facility_head'       ? 'Facility' :
    'Assignment'

  const readOnly = authUser?.role === 'observer'
  const isFacilityRole = (role) => role === 'facility_supervisor' || role === 'facility_worker' || role === 'facility_head'

  // Where the account is scoped: UC list, facility (with district), or district.
  function assignment(row) {
    if (row.role === 'uc_supervisor') {
      const ucs = row.ucNames ?? row.ucIds ?? []
      return { primary: ucs.length ? (Array.isArray(ucs) ? ucs.join(', ') : ucs) : null, empty: 'No UCs assigned' }
    }
    return isFacilityRole(row.role)
      ? { primary: row.facilityName, sub: row.districtName, empty: 'Unassigned' }
      : { primary: row.districtName, empty: row.role === 'observer' ? 'All districts' : 'Unassigned' }
  }

  const actions = (row) => !readOnly && (
    <RowActions
      className="justify-end"
      actions={[
        row.role === 'uc_supervisor' && { icon: MapPin, label: 'Reassign UCs', onClick: () => { setReassignTarget(row); setReassignUcIds(row.ucIds ?? []); setReassignError('') } },
        { icon: KeyRound, label: 'Reset password', onClick: () => { setResetTarget(row); setFormError('') } },
        row.id === authUser?.id ? null
        : row.isActive
          ? { icon: UserX, label: 'Deactivate', danger: true, onClick: () => setDeactivateTarget(row) }
          : { icon: UserCheck, label: 'Activate', onClick: () => activateMutation.mutate(row.id), disabled: activateMutation.isPending },
      ]}
    />
  )

  const gridCard = (row) => {
    const a = assignment(row)
    return (
      <EntityCard
        icon={ROLE_ICON[row.role]}
        accent={row.isActive ? ROLE_ACCENT[row.role] : 'no_data'}
        title={row.name ?? '—'}
        subtitle={row.email}
        badge={<Badge type={row.isActive ? 'active' : 'inactive'} />}
        meta={[
          { label: 'Role', value: <RoleTag role={row.role} /> },
          { label: row.role === 'uc_supervisor' ? 'Union councils' : isFacilityRole(row.role) ? 'Facility' : 'District', value: a.primary ?? a.empty },
          a.sub && { label: 'District', value: a.sub },
          { label: 'Last login', value: row.lastLoginAt ? timeAgo(row.lastLoginAt) : 'Never' },
        ]}
        footnote={row.zmid ? `ZMID ${row.zmid}` : null}
        actions={actions(row)}
      />
    )
  }

  const selectColumn = {
    key: 'select',
    label: (
      <input type="checkbox" aria-label="Select all on this page" className="accent-primary w-4 h-4 align-middle"
        checked={allOnPage} disabled={!selectable.length}
        onChange={() => setSelected(allOnPage ? [] : selectable.map((u) => u.id))} />
    ),
    render: (row) => row.id === authUser?.id ? null : (
      <input type="checkbox" aria-label={`Select ${row.name ?? row.email}`} className="accent-primary w-4 h-4 align-middle"
        checked={selected.includes(row.id)} onChange={() => toggle(row.id)} />
    ),
  }

  const columns = [
    ...(readOnly ? [] : [selectColumn]),
    {
      key: 'name', label: 'Name',
      render: (row) => (
        <div className={row.isActive ? '' : 'opacity-60'}>
          <p className="font-medium text-text">{row.name ?? '—'}</p>
          <p className="text-xs text-text-muted">{row.email}</p>
        </div>
      ),
    },
    ...(activeRole ? [] : [{ key: 'role', label: 'Role', render: (row) => <RoleTag role={row.role} /> }]),
    {
      key: 'assignment', label: assignmentColLabel,
      render: (row) => {
        const a = assignment(row)
        return a.primary ? (
          <div>
            <p>{a.primary}</p>
            {a.sub && <p className="text-xs text-text-muted">{a.sub}</p>}
          </div>
        ) : <span className="text-text-muted">{a.empty}</span>
      },
    },
    { key: 'lastLogin', label: 'Last login', render: (row) => <span className="text-text-muted whitespace-nowrap">{row.lastLoginAt ? timeAgo(row.lastLoginAt) : 'Never'}</span> },
    { key: 'isActive', label: 'Status', render: (row) => <Badge type={row.isActive ? 'active' : 'inactive'} /> },
    ...(readOnly ? [] : [{ key: 'actions', label: '', align: 'right', render: actions }]),
  ]

  return (
    <div>
      <PageHeader
        breadcrumb="Super Admin › Manage"
        title="Users"
        subtitle={isLoading ? undefined : `${plural(users.length, 'account')} across the system`}
        actions={!readOnly && (
          <Button onClick={() => { setCreateOpen(true); setFormError('') }}><Plus size={16} strokeWidth={1.75} /> Add user</Button>
        )}
      />

      {isError ? (
        <ErrorState title="Couldn’t load users" error={error} onRetry={refetch} />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <SearchInput
                value={searchQuery}
                onChange={(e) => { setFilters({ q: e.target.value }); setCurrentPage(1) }}
                placeholder="Search name or email…"
              />
            </div>
            <ViewToggle value={view} onChange={setView} />
            <ExportButton
              name="users"
              rows={filteredUsers}
              columns={[
                { label: 'Name', value: (u) => u.name },
                { label: 'Email', value: (u) => u.email },
                { label: 'Role', value: (u) => ROLE_LABELS[u.role] ?? u.role },
                { label: 'Assignment', value: (u) => assignment(u).primary ?? assignment(u).empty },
                { label: 'District', value: (u) => assignment(u).sub ?? (isFacilityRole(u.role) ? '' : u.districtName) },
                { label: 'ZMID', value: (u) => u.zmid },
                { label: 'Last login', value: (u) => u.lastLoginAt ?? '' },
                { label: 'Status', value: (u) => (u.isActive ? 'Active' : 'Inactive') },
              ]}
            />
          </div>
          <FilterChips
            label="Role"
            value={String(roleFilter)}
            onChange={(v) => { setFilters({ role: ROLE_FILTERS[Number(v)].value ?? '' }); setCurrentPage(1) }}
            options={ROLE_FILTERS.map((f, i) => ({ value: String(i), label: f.label, count: roleCounts[i] }))}
          />
          {selected.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 rounded-card border border-surface-border bg-surface px-4 py-2.5" role="region" aria-label="Bulk actions">
              <p className="text-sm text-text font-medium tabular-nums">{selected.length} selected</p>
              <Button size="sm" variant="secondary" disabled={bulkMutation.isPending} onClick={() => bulkMutation.mutate(true)}>Activate</Button>
              <Button size="sm" variant="ghost-danger" disabled={bulkMutation.isPending} onClick={() => setBulkDeactivateOpen(true)}>Deactivate</Button>
              <Button size="sm" variant="ghost" disabled={bulkMutation.isPending} onClick={() => setSelected([])}>Clear</Button>
            </div>
          )}
          <Table
            columns={columns}
            rows={paginatedUsers}
            loading={isLoading}
            view={view}
            gridCard={gridCard}
            emptyMessage={
              searchQuery || roleFilter !== 0
                ? `No users match${searchQuery ? ` “${searchQuery}”` : ''}${roleFilter !== 0 ? ` in ${ROLE_FILTERS[roleFilter].label}` : ''}.`
                : 'No users registered yet.'
            }
            mobileCard={(row) => {
              const a = assignment(row)
              return (
                <div className="px-4 py-3.5 flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className={`min-w-0 ${row.isActive ? '' : 'opacity-60'}`}>
                      <p className="font-medium text-text truncate">{row.name ?? '—'}</p>
                      <p className="text-xs text-text-muted truncate">
                        {[ROLE_LABELS[row.role] ?? row.role, a.primary ?? a.empty].join(' · ')}
                      </p>
                      <p className="text-xs text-text-muted truncate">{row.email}</p>
                    </div>
                    <Badge type={row.isActive ? 'active' : 'inactive'} />
                  </div>
                  {actions(row)}
                </div>
              )
            }}
          />
          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
        </div>
      )}

      {/* Create Modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Add user">
        <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); if (/[<>]/.test(form.firstName) || /[<>]/.test(form.lastName)) { setFormError('Names cannot contain < or > characters.'); return } createMutation.mutate() }}>
          <Select
            id="sup-role"
            label="Role"
            options={ROLE_FILTERS.filter((f) => f.value).map((f) => ({ value: f.value, label: f.label }))}
            value={form.role}
            onChange={(e) => setForm((f) => ({ ...f, role: e.target.value, districtId: '', facilityId: '', ucIds: [], pickDistrictId: '', pickUcId: '' }))}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input id="sup-first-name" label="First name" placeholder="Jane"
              value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required />
            <Input id="sup-last-name" label="Last name" placeholder="Doe"
              value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required />
          </div>
          <Input id="sup-zmid" label="ZMID (organisation ID)" placeholder="e.g. Z-1001"
            value={form.zmid} onChange={(e) => setForm({ ...form, zmid: e.target.value })} required />
          <Input id="sup-email" label="Email" type="email" placeholder="user@akuh.org"
            value={form.email} onChange={(e) => { setForm({ ...form, email: e.target.value }); setFormError('') }} required />
          <Input id="sup-password" label="Password (at least 8 characters)" type="password" minLength={8}
            value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />

          {/* District picker — only for district_supervisor */}
          {form.role === 'district_supervisor' && (
            <Select id="sup-district" label="District" options={districtOptions}
              placeholder="Select a district…"
              value={form.districtId} onChange={(e) => setForm({ ...form, districtId: e.target.value })} required />
          )}

          {/* UC multi-select — for uc_supervisor */}
          {form.role === 'uc_supervisor' && (
            <div>
              <p className="text-sm font-medium text-text mb-1.5">Union councils</p>
              {ucOptions.length === 0 ? (
                <p className="text-sm text-text-muted">No active union councils yet.</p>
              ) : (
                <div className="border border-surface-border rounded-control overflow-y-auto max-h-48 divide-y divide-surface-border">
                  {ucOptions.map((uc) => {
                    const checked = form.ucIds.includes(uc.value)
                    return (
                      <label key={uc.value} className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-surface-alt transition-colors">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => setForm((f) => ({
                            ...f,
                            ucIds: checked ? f.ucIds.filter((id) => id !== uc.value) : [...f.ucIds, uc.value]
                          }))}
                          className="accent-primary w-4 h-4 flex-shrink-0"
                        />
                        <span className="text-sm text-text">{uc.label}</span>
                      </label>
                    )
                  })}
                </div>
              )}
              {form.ucIds.length === 0 && <p className="text-xs text-text-muted mt-1.5">Select at least one union council.</p>}
            </div>
          )}

          {/* Facility picker — for facility_supervisor, facility_worker, facility_head */}
          {(form.role === 'facility_supervisor' || form.role === 'facility_worker' || form.role === 'facility_head') && (
            <>
              <Select id="sup-pick-district" label="District" options={pickDistrictOptions}
                placeholder="Select a district…"
                value={form.pickDistrictId} onChange={(e) => setForm({ ...form, pickDistrictId: e.target.value, pickUcId: '', facilityId: '' })} required />
              <Select id="sup-pick-uc" label="Union council" options={pickUcOptions}
                placeholder={form.pickDistrictId ? 'Select a union council…' : 'Select a district first'}
                disabled={!form.pickDistrictId}
                value={form.pickUcId} onChange={(e) => setForm({ ...form, pickUcId: e.target.value, facilityId: '' })} required />
              <Select id="sup-facility" label="Facility" options={facilityOptions}
                placeholder={form.pickUcId ? 'Select a facility…' : 'Select a union council first'}
                disabled={!form.pickUcId}
                value={form.facilityId} onChange={(e) => setForm({ ...form, facilityId: e.target.value })} required />
            </>
          )}

          <Input id="sup-phone" label="Phone (optional)" placeholder="e.g. 03001234567"
            value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <Input id="sup-cnic" label="CNIC (optional)" placeholder="e.g. 12345-1234567-1"
            value={form.cnic} onChange={(e) => setForm({ ...form, cnic: e.target.value })} />
          {formError && <p role="alert" className="text-sm text-danger-dark bg-danger-bg rounded-control px-3.5 py-2.5">{formError}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" type="button" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating…' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Reset Modal */}
      <Modal open={!!resetTarget} onClose={() => setResetTarget(null)} title={`Reset password for ${resetTarget?.email ?? ''}`}>
        <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); resetMutation.mutate() }}>
          <Input id="reset-password" label="New password (at least 8 characters)" type="password" minLength={8}
            value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
          {formError && <p role="alert" className="text-sm text-danger-dark bg-danger-bg rounded-control px-3.5 py-2.5">{formError}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" type="button" onClick={() => setResetTarget(null)}>Cancel</Button>
            <Button type="submit" disabled={resetMutation.isPending || newPassword.length < 8}>
              {resetMutation.isPending ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deactivateTarget}
        onClose={() => setDeactivateTarget(null)}
        onConfirm={() => deactivateMutation.mutate(deactivateTarget.id)}
        title="Deactivate account?"
        message={<p className="text-sm text-text">Deactivate <span className="font-medium">{deactivateTarget?.email}</span>? Their session ends immediately. You can reactivate this account later.</p>}
        confirmLabel="Deactivate"
        isPending={deactivateMutation.isPending}
      />

      <ConfirmDialog
        open={bulkDeactivateOpen}
        onClose={() => setBulkDeactivateOpen(false)}
        onConfirm={() => bulkMutation.mutate(false)}
        title={`Deactivate ${plural(selected.length, 'account')}?`}
        message={<p className="text-sm text-text">Their sessions end immediately. You can reactivate them later.</p>}
        confirmLabel="Deactivate"
        isPending={bulkMutation.isPending}
      />

      {/* Reassign UCs Modal */}
      <Modal open={!!reassignTarget} onClose={() => setReassignTarget(null)} title={`Reassign UCs for ${reassignTarget?.name ?? ''}`}>
        <div className="flex flex-col gap-4">
          <p className="text-sm text-text-muted">Select the union councils this supervisor should oversee.</p>
          {ucOptions.length === 0 ? (
            <p className="text-sm text-text-muted">No active union councils yet.</p>
          ) : (
            <div className="border border-surface-border rounded-control overflow-y-auto max-h-64 divide-y divide-surface-border">
              {ucOptions.map((uc) => {
                const checked = reassignUcIds.includes(uc.value)
                return (
                  <label key={uc.value} className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-surface-alt transition-colors">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => setReassignUcIds((prev) =>
                        checked ? prev.filter((id) => id !== uc.value) : [...prev, uc.value]
                      )}
                      className="accent-primary w-4 h-4 flex-shrink-0"
                    />
                    <span className="text-sm text-text">{uc.label}</span>
                  </label>
                )
              })}
            </div>
          )}
          {reassignError && <p role="alert" className="text-sm text-danger-dark bg-danger-bg rounded-control px-3.5 py-2.5">{reassignError}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={() => setReassignTarget(null)}>Cancel</Button>
            <Button onClick={() => reassignMutation.mutate()} disabled={reassignMutation.isPending || reassignUcIds.length === 0}>
              {reassignMutation.isPending ? 'Saving…' : 'Save assignments'}
            </Button>
          </div>
        </div>
      </Modal>

      <SummaryDialog
        open={!!created}
        onClose={() => setCreated(null)}
        title={`${created?.role ?? 'User'} created`}
        message={<>The account is active. Share the password with <span className="font-medium">{created?.name}</span> over a secure channel.</>}
        rows={created ? [
          { label: 'Name', value: created.name },
          { label: 'Role', value: created.role },
          { label: 'Email', value: created.email },
          { label: 'ZMID', value: created.zmid },
          { label: 'Scope', value: created.scope || '—' },
        ] : []}
      />

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
