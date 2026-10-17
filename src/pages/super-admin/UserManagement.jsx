import { useState } from 'react'
import { Plus, KeyRound } from 'lucide-react'
import PageHeader from '../../components/shared/PageHeader'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getUsers, getDistricts, getFacilities, getUnionCouncils, createUser, deactivateUser, activateUser, resetPassword, assignUcSupervisor } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import { useDebounce } from '../../hooks/useDebounce'
import Table from '../../components/shared/Table'
import SearchInput from '../../components/shared/SearchInput'
import Pagination from '../../components/shared/Pagination'
import FilterChips from '../../components/shared/FilterChips'
import ErrorState from '../../components/shared/ErrorState'
import { ROLE_LABELS } from '../../lib/navigation'
import { plural } from '../../lib/format'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
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
  const [form, setForm] = useState({ role: 'district_supervisor', firstName: '', lastName: '', zmid: '', email: '', password: '', districtId: '', facilityId: '', ucIds: [], phone: '', cnic: '' })
  const [newPassword, setNewPassword] = useState('')
  const [formError, setFormError] = useState('')
  const [toast, setToast] = useState(null)

  // Filters & Pagination State
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)

  const ROLE_FILTERS = [
    { label: 'All',                  value: null },
    { label: 'District Supervisor',  value: 'district_supervisor' },
    { label: 'UC Supervisor',        value: 'uc_supervisor' },
    { label: 'Facility Supervisor',  value: 'facility_supervisor' },
    { label: 'Facility Worker',      value: 'facility_worker' },
    { label: 'Facility Head',        value: 'facility_head' },
    { label: 'Observer',            value: 'observer' },
  ]

  const { data: userData, isLoading, isError, error, refetch } = useQuery({ queryKey: ['users'], queryFn: getUsers })
  const { data: districtData } = useQuery({ queryKey: ['districts'], queryFn: getDistricts, staleTime: 0 })
  const { data: facilityData } = useQuery({ queryKey: ['facilities'], queryFn: getFacilities, staleTime: 0 })
  const { data: ucData }       = useQuery({ queryKey: ['ucs'], queryFn: () => getUnionCouncils(), staleTime: 0 })

  const districtMap = Object.fromEntries((districtData?.districts ?? []).map((d) => [d.id, d.name]))
  const districtOptions = (districtData?.districts ?? [])
    .filter((d) => d.isActive)
    .map((d) => ({ value: d.id, label: d.supervisorName ? `${d.name} (staffed)` : d.name }))
  const facilityOptions = (facilityData?.facilities ?? [])
    .filter((f) => f.isActive)
    .map((f) => ({ value: f.id, label: f.facilitySupervisorName ? `${f.name} (staffed)` : f.name }))
  const ucOptions = (ucData?.unionCouncils ?? [])
    .filter((uc) => uc.isActive)
    .map((uc) => ({ value: uc.id, label: `${uc.name} (${uc.townName ?? ''})` }))
  const users = userData?.users ?? []

  const ROLE_SUCCESS_LABELS = {
    district_supervisor: 'District supervisor',
    uc_supervisor:       'UC supervisor',
    facility_supervisor: 'Facility supervisor',
    facility_worker:     'Facility worker',
    facility_head:       'Facility head',
    observer:            'Observer',
  }

  const EMPTY_FORM = { role: 'district_supervisor', firstName: '', lastName: '', zmid: '', email: '', password: '', districtId: '', facilityId: '', ucIds: [], phone: '', cnic: '' }

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
      setCreateOpen(false)
      setForm(EMPTY_FORM)
      setFormError('')
      setToast({ message: `${ROLE_SUCCESS_LABELS[form.role] ?? 'User'} created successfully.`, type: 'success' })
    },
    onError: (err) => setFormError(
      err.status === 409 && err.body?.error?.includes('ZMID')
        ? 'This ZMID is already assigned to another account.'
        : err.status === 409 && err.body?.error?.includes('active supervisor')
        ? 'This district/facility already has an active supervisor. Deactivate them first.'
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
  const itemsPerPage = 10
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage)
  const paginatedUsers = filteredUsers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

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
    <div className="flex flex-wrap items-center justify-end gap-1">
      {row.role === 'uc_supervisor' && (
        <Button variant="ghost" size="sm" onClick={() => { setReassignTarget(row); setReassignUcIds(row.ucIds ?? []); setReassignError('') }}>Reassign UCs</Button>
      )}
      <Button variant="ghost" size="sm" onClick={() => { setResetTarget(row); setFormError('') }}><KeyRound size={14} strokeWidth={1.75} /> Reset password</Button>
      {row.isActive ? (
        <Button variant="ghost-danger" size="sm" onClick={() => setDeactivateTarget(row)}>Deactivate</Button>
      ) : (
        <Button variant="ghost" size="sm" onClick={() => activateMutation.mutate(row.id)} disabled={activateMutation.isPending}>Activate</Button>
      )}
    </div>
  )

  const columns = [
    {
      key: 'name', label: 'Name',
      render: (row) => (
        <div className={row.isActive ? '' : 'opacity-60'}>
          <p className="font-medium text-text">{row.name ?? '—'}</p>
          <p className="text-xs text-text-muted">{row.email}</p>
        </div>
      ),
    },
    ...(activeRole ? [] : [{ key: 'role', label: 'Role', render: (row) => <span className="whitespace-nowrap">{ROLE_LABELS[row.role] ?? row.role}</span> }]),
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
          <SearchInput
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1) }}
            placeholder="Search name or email…"
          />
          <FilterChips
            label="Role"
            value={String(roleFilter)}
            onChange={(v) => { setRoleFilter(Number(v)); setCurrentPage(1) }}
            options={ROLE_FILTERS.map((f, i) => ({ value: String(i), label: f.label, count: roleCounts[i] }))}
          />
          <Table
            columns={columns}
            rows={paginatedUsers}
            loading={isLoading}
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
            onChange={(e) => setForm((f) => ({ ...f, role: e.target.value, districtId: '', facilityId: '', ucIds: [] }))}
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
            <Select id="sup-facility" label="Facility" options={facilityOptions}
              placeholder="Select a facility…"
              value={form.facilityId} onChange={(e) => setForm({ ...form, facilityId: e.target.value })} required />
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

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
