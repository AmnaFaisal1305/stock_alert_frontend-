import { useState } from 'react'
import { Plus, RotateCcw, UserX, UserCheck, Search, ChevronLeft, ChevronRight, User } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getUsers, getDistricts, getFacilities, getUnionCouncils, createUser, deactivateUser, activateUser, resetPassword, assignUcSupervisor } from '../../lib/api'
import Table from '../../components/shared/Table'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import Badge from '../../components/ui/Badge'
import Toast from '../../components/ui/Toast'

export default function UserManagement() {
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
  ]

  const { data: userData, isLoading, isError } = useQuery({ queryKey: ['users'], queryFn: getUsers })
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
  }

  const EMPTY_FORM = { role: 'district_supervisor', firstName: '', lastName: '', zmid: '', email: '', password: '', districtId: '', facilityId: '', ucIds: [], phone: '', cnic: '' }

  const createMutation = useMutation({
    mutationFn: () => {
      const isFacilityRole = form.role === 'facility_supervisor' || form.role === 'facility_worker'
      const isUcRole = form.role === 'uc_supervisor'
      return createUser({
        firstName: form.firstName, lastName: form.lastName, zmid: form.zmid,
        email: form.email, password: form.password, role: form.role,
        ...(isFacilityRole ? { facilityId: form.facilityId }
          : isUcRole ? { ucIds: form.ucIds }
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
    onError: (err) => setReassignError(err.message),
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

  // Filter users by name/email and role
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      (u.name ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.email ?? '').toLowerCase().includes(searchQuery.toLowerCase())
    const matchesRole = !ROLE_FILTERS[roleFilter].value || u.role === ROLE_FILTERS[roleFilter].value
    return matchesSearch && matchesRole
  })

  // Pagination logic
  const itemsPerPage = 10
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage)
  const paginatedUsers = filteredUsers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  const ROLE_LABELS = {
    district_supervisor: 'District Supervisor',
    uc_supervisor:       'UC Supervisor',
    facility_supervisor: 'Facility Supervisor',
    facility_worker:     'Facility Worker',
  }

  const activeRole = ROLE_FILTERS[roleFilter].value
  const nameColLabel       = activeRole ? `${ROLE_LABELS[activeRole] ?? activeRole} Name` : 'Name'
  const assignmentColLabel =
    activeRole === 'district_supervisor' ? 'District Name' :
    activeRole === 'uc_supervisor'       ? 'UC Assignments' :
    activeRole === 'facility_supervisor' ? 'Facility Name' :
    activeRole === 'facility_worker'     ? 'Facility Name' :
    'Assignment'

  const columns = [
    {
      key: 'name',
      label: nameColLabel,
      render: (row) => (
        <div className="flex items-center gap-2 font-bold text-text">
          <div className="w-6 h-6 rounded bg-slate-100 text-text-muted flex items-center justify-center flex-shrink-0">
            <User size={12} />
          </div>
          <div className="min-w-0">
            <p className="truncate">{row.name ?? '—'}</p>
            {!activeRole && (
              <p className="text-[10px] font-semibold text-text-muted normal-case">{ROLE_LABELS[row.role] ?? row.role}</p>
            )}
          </div>
        </div>
      )
    },
    { key: 'email', label: 'Email Address', render: (row) => <span className="text-xs text-text-muted font-medium">{row.email}</span> },
    {
      key: 'assignment',
      label: assignmentColLabel,
      render: (row) => {
        if (row.role === 'uc_supervisor') {
          const ucs = row.ucNames ?? row.ucIds ?? []
          return ucs.length > 0 ? (
            <p className="text-xs font-semibold text-text">{Array.isArray(ucs) ? ucs.join(', ') : ucs}</p>
          ) : (
            <span className="text-text-muted italic text-[11px]">No UCs assigned</span>
          )
        }
        const isFacilityRole = row.role === 'facility_supervisor' || row.role === 'facility_worker'
        const primary = isFacilityRole ? row.facilityName : row.districtName
        const sub     = isFacilityRole ? row.districtName : null
        return primary ? (
          <div>
            <p className="text-xs font-semibold text-text">{primary}</p>
            {sub && <p className="text-[10px] text-text-muted font-medium">{sub}</p>}
          </div>
        ) : (
          <span className="text-text-muted italic text-[11px]">Unassigned</span>
        )
      }
    },
    {
      key: 'isActive',
      label: 'Status',
      render: (row) => (
        <Badge type={row.isActive ? 'active' : 'inactive'} />
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (row) => (
        <div className="flex gap-1.5 justify-end flex-wrap">
          {row.role === 'uc_supervisor' && (
            <Button variant="ghost" size="sm" onClick={() => { setReassignTarget(row); setReassignUcIds(row.ucIds ?? []); setReassignError('') }}>
              Reassign UCs
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => { setResetTarget(row); setFormError('') }}>
            <RotateCcw size={12} /> Reset Password
          </Button>
          {row.isActive ? (
            <Button variant="ghost" size="sm" className="text-text-muted hover:text-danger hover:bg-danger/5" onClick={() => setDeactivateTarget(row)}>
              <UserX size={12} /> Deactivate
            </Button>
          ) : (
            <Button variant="ghost" size="sm" className="text-text-muted hover:text-success-dark hover:bg-success-bg" onClick={() => activateMutation.mutate(row.id)} disabled={activateMutation.isPending}>
              <UserCheck size={12} /> Activate
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-200">
      
      {/* ── Page Header — AKUH maroon banner ───────────────────────── */}
      <div className="bg-primary rounded-2xl px-6 py-5 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">User Management</h1>
          <p className="text-sm text-white/70 mt-0.5">
            {!isLoading && `${users.length} ${users.length === 1 ? 'user' : 'users'} registered under system`}
            {isLoading && 'Loading users…'}
          </p>
        </div>
        <button
          onClick={() => { setCreateOpen(true); setFormError('') }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-primary text-sm font-bold hover:bg-white/90 transition-all flex-shrink-0 shadow-sm"
        >
          <Plus size={15} strokeWidth={2.5} />
          Add User
        </button>
      </div>

      {/* Search + Role filters */}
      {!isLoading && !isError && users.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-80">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1) }}
              className="w-full pl-10 pr-3.5 py-2.5 text-sm border border-surface-border rounded-xl bg-white shadow-sm focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all placeholder:text-text-muted/60"
            />
          </div>
          <div className="flex items-center gap-1.5 bg-white border border-surface-border rounded-xl p-1 shadow-sm">
            {ROLE_FILTERS.map((f, i) => {
              const active = roleFilter === i
              return (
                <button
                  key={f.label}
                  onClick={() => { setRoleFilter(i); setCurrentPage(1) }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 ${
                    active ? 'bg-primary text-white' : 'text-text-muted hover:bg-slate-50'
                  }`}
                >
                  {f.label}
                  <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-md tabular-nums ${
                    active ? 'bg-white/20 text-white' : 'bg-slate-100 text-text-muted'
                  }`}>
                    {roleCounts[i]}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Loading Skeletons */}
      {isLoading && (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-14 bg-slate-50 border border-slate-200 rounded-xl animate-pulse" />)}
        </div>
      )}

      {isError && (
        <div className="bg-danger-bg border border-danger/10 text-xs font-semibold text-danger rounded-xl px-4 py-3">
          Failed to load users. Please try refreshing.
        </div>
      )}

      {/* Users Table */}
      {!isLoading && !isError && (
        <div className="flex flex-col gap-3">
          <Table
            columns={columns}
            rows={paginatedUsers}
            emptyMessage={
              searchQuery || roleFilter !== 0
                ? `No users match${searchQuery ? ` "${searchQuery}"` : ''}${roleFilter !== 0 ? ` in ${ROLE_FILTERS[roleFilter].label}` : ''}.`
                : 'No users registered yet.'
            }
          />

          {/* Pagination bar */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-100 bg-white px-5 py-4 mt-2 rounded-2xl border border-surface-border shadow-sm">
              <div className="flex flex-1 justify-between sm:hidden">
                <Button variant="secondary" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage(currentPage - 1)}>
                  Previous
                </Button>
                <Button variant="secondary" size="sm" disabled={currentPage === totalPages} onClick={() => setCurrentPage(currentPage + 1)}>
                  Next
                </Button>
              </div>
              <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs text-text-muted font-semibold">
                    Page <span className="font-extrabold text-text">{currentPage}</span> of{' '}
                    <span className="font-extrabold text-text">{totalPages}</span>
                  </p>
                </div>
                <div>
                  <nav className="isolate inline-flex -space-x-px rounded-xl shadow-sm border border-slate-200 bg-slate-50 p-0.5 gap-1" aria-label="Pagination">
                    <button
                      onClick={() => setCurrentPage(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center rounded-lg p-1.5 text-text-muted hover:bg-white disabled:opacity-55 disabled:hover:bg-transparent transition-all cursor-pointer"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    {Array.from({ length: totalPages }).map((_, i) => {
                      const p = i + 1
                      return (
                        <button
                          key={p}
                          onClick={() => setCurrentPage(p)}
                          className={`relative inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                            p === currentPage
                              ? 'bg-primary text-white shadow-sm shadow-primary/10'
                              : 'text-text-muted hover:bg-white'
                          }`}
                        >
                          {p}
                        </button>
                      )
                    })}
                    <button
                      onClick={() => setCurrentPage(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="relative inline-flex items-center rounded-lg p-1.5 text-text-muted hover:bg-white disabled:opacity-55 disabled:hover:bg-transparent transition-all cursor-pointer"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create Modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Add User">
        <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); if (/[<>]/.test(form.firstName) || /[<>]/.test(form.lastName)) { setFormError('Names cannot contain < or > characters.'); return } createMutation.mutate() }}>
          {/* Role selector */}
          <div>
            <p className="text-xs font-bold text-text-muted uppercase tracking-wider mb-2">Role</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: 'district_supervisor',  label: 'District Supervisor' },
                { value: 'uc_supervisor',        label: 'UC Supervisor' },
                { value: 'facility_supervisor',  label: 'Facility Supervisor' },
                { value: 'facility_worker',      label: 'Facility Worker' },
              ].map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, role: value, districtId: '', facilityId: '', ucIds: [] }))}
                  className={`px-3 py-2.5 rounded-xl text-xs font-bold border transition-all text-center leading-snug ${
                    form.role === value
                      ? 'bg-primary text-white border-primary shadow-sm'
                      : 'bg-white text-text-muted border-surface-border hover:border-primary/40 hover:text-text'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input id="sup-first-name" label="First Name" placeholder="Jane"
              value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required />
            <Input id="sup-last-name" label="Last Name" placeholder="Doe"
              value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required />
          </div>
          <Input id="sup-zmid" label="ZMID (Organization ID)" placeholder="e.g. Z-1001"
            value={form.zmid} onChange={(e) => setForm({ ...form, zmid: e.target.value })} required />
          <Input id="sup-email" label="Email" type="email" placeholder="user@akuh.org"
            value={form.email} onChange={(e) => { setForm({ ...form, email: e.target.value }); setFormError('') }} required />
          <Input id="sup-password" label="Password (min 8 chars)" type="password" minLength={8}
            value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />

          {/* District picker — only for district_supervisor */}
          {form.role === 'district_supervisor' && (
            <Select id="sup-district" label="Assign District" options={districtOptions}
              placeholder="Select a district…"
              value={form.districtId} onChange={(e) => setForm({ ...form, districtId: e.target.value })} required />
          )}

          {/* UC multi-select — for uc_supervisor */}
          {form.role === 'uc_supervisor' && (
            <div>
              <p className="text-xs font-bold text-text-muted uppercase tracking-wider mb-2">Assign Union Councils *</p>
              {ucOptions.length === 0 ? (
                <p className="text-xs text-text-muted italic">No active UCs available.</p>
              ) : (
                <div className="border border-surface-border rounded-xl overflow-y-auto max-h-48 divide-y divide-surface-border">
                  {ucOptions.map((uc) => {
                    const checked = form.ucIds.includes(uc.value)
                    return (
                      <label key={uc.value} className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-slate-50 transition-colors">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => setForm((f) => ({
                            ...f,
                            ucIds: checked ? f.ucIds.filter((id) => id !== uc.value) : [...f.ucIds, uc.value]
                          }))}
                          className="accent-primary"
                        />
                        <span className="text-xs font-semibold text-text">{uc.label}</span>
                      </label>
                    )
                  })}
                </div>
              )}
              {form.ucIds.length === 0 && <p className="text-[11px] text-danger mt-1">Select at least one UC.</p>}
            </div>
          )}

          {/* Facility picker — for facility_supervisor and facility_worker */}
          {(form.role === 'facility_supervisor' || form.role === 'facility_worker') && (
            <Select id="sup-facility" label="Assign Facility" options={facilityOptions}
              placeholder="Select a facility…"
              value={form.facilityId} onChange={(e) => setForm({ ...form, facilityId: e.target.value })} required />
          )}

          <Input id="sup-phone" label="Phone (optional)" placeholder="e.g. 03001234567"
            value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <Input id="sup-cnic" label="CNIC (optional)" placeholder="e.g. 12345-1234567-1"
            value={form.cnic} onChange={(e) => setForm({ ...form, cnic: e.target.value })} />
          {formError && <p className="text-xs text-danger bg-danger-bg border border-danger/10 px-3 py-2 rounded-lg">{formError}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating…' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Reset Modal */}
      <Modal open={!!resetTarget} onClose={() => setResetTarget(null)} title={`Reset Password — ${resetTarget?.email ?? ''}`}>
        <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); resetMutation.mutate() }}>
          <Input id="reset-password" label="New Password (min 8 chars)" type="password" minLength={8}
            value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
          {formError && <p className="text-xs text-danger bg-danger-bg border border-danger/10 px-3 py-2 rounded-lg">{formError}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setResetTarget(null)}>Cancel</Button>
            <Button type="submit" disabled={resetMutation.isPending || newPassword.length < 8}>
              {resetMutation.isPending ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Deactivate Modal */}
      <Modal open={!!deactivateTarget} onClose={() => setDeactivateTarget(null)} title="Deactivate Account" maxWidth="max-w-sm">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-text">
            Deactivate <span className="font-bold text-text">{deactivateTarget?.email}</span>? Their session ends immediately. You can reactivate this account later.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setDeactivateTarget(null)}>Cancel</Button>
            <Button variant="danger" onClick={() => deactivateMutation.mutate(deactivateTarget.id)} disabled={deactivateMutation.isPending}>
              {deactivateMutation.isPending ? 'Deactivating…' : 'Deactivate'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Reassign UCs Modal */}
      <Modal open={!!reassignTarget} onClose={() => setReassignTarget(null)} title={`Reassign UCs — ${reassignTarget?.name ?? ''}`}>
        <div className="flex flex-col gap-4">
          <p className="text-xs text-text-muted">Select the union councils this supervisor should oversee.</p>
          {ucOptions.length === 0 ? (
            <p className="text-xs text-text-muted italic">No active UCs available.</p>
          ) : (
            <div className="border border-surface-border rounded-xl overflow-y-auto max-h-64 divide-y divide-surface-border">
              {ucOptions.map((uc) => {
                const checked = reassignUcIds.includes(uc.value)
                return (
                  <label key={uc.value} className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-slate-50 transition-colors">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => setReassignUcIds((prev) =>
                        checked ? prev.filter((id) => id !== uc.value) : [...prev, uc.value]
                      )}
                      className="accent-primary"
                    />
                    <span className="text-xs font-semibold text-text">{uc.label}</span>
                  </label>
                )
              })}
            </div>
          )}
          {reassignError && <p className="text-xs text-danger bg-danger-bg rounded-lg px-3 py-2">{reassignError}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setReassignTarget(null)}>Cancel</Button>
            <Button onClick={() => reassignMutation.mutate()} disabled={reassignMutation.isPending || reassignUcIds.length === 0}>
              {reassignMutation.isPending ? 'Saving…' : 'Save Assignments'}
            </Button>
          </div>
        </div>
      </Modal>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
