import { useState } from 'react'
import { Plus, RotateCcw, UserX, UserCheck, Search, ChevronLeft, ChevronRight, User } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getUsers, getDistricts, createUser, deactivateUser, activateUser, resetPassword } from '../../lib/api'
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
  const [form, setForm] = useState({ name: '', email: '', password: '', districtId: '' })
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
    { label: 'Facility Supervisor',  value: 'facility_supervisor' },
    { label: 'Facility Worker',      value: 'facility_worker' },
  ]

  const { data: userData, isLoading, isError } = useQuery({ queryKey: ['users'], queryFn: getUsers })
  const { data: districtData } = useQuery({ queryKey: ['districts'], queryFn: getDistricts })

  const districtMap = Object.fromEntries((districtData?.districts ?? []).map((d) => [d.id, d.name]))
  const districtOptions = (districtData?.districts ?? [])
    .filter((d) => d.isActive)
    .map((d) => ({ value: d.id, label: d.supervisorName ? `${d.name} (staffed)` : d.name }))
  const users = userData?.users ?? []

  const createMutation = useMutation({
    mutationFn: () => createUser({ name: form.name, email: form.email, password: form.password, role: 'district_supervisor', districtId: form.districtId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      queryClient.invalidateQueries({ queryKey: ['audit-log'] })
      setCreateOpen(false)
      setForm({ name: '', email: '', password: '', districtId: '' })
      setFormError('')
      setToast({ message: 'District supervisor created successfully.', type: 'success' })
    },
    onError: (err) => setFormError(
      err.status === 409 && err.body?.error?.includes('active supervisor')
        ? 'This district already has an active supervisor. Deactivate them first before assigning a new one.'
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
    facility_supervisor: 'Facility Supervisor',
    facility_worker:     'Facility Worker',
  }

  const activeRole = ROLE_FILTERS[roleFilter].value
  const nameColLabel       = activeRole ? `${ROLE_LABELS[activeRole]} Name` : 'Name'
  const assignmentColLabel =
    activeRole === 'district_supervisor' ? 'District Name' :
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
        <div className="flex gap-1.5 justify-end">
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
          Add District Supervisor
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
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create District Supervisor">
        <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); createMutation.mutate() }}>
          <Input id="sup-name" label="Name" placeholder="Display name"
            value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <Input id="sup-email" label="Email" type="email" placeholder="user@akuh.org"
            value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          <Input id="sup-password" label="Password (min 8 chars)" type="password" minLength={8}
            value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
          <Select id="sup-district" label="Assign District" options={districtOptions}
            value={form.districtId} onChange={(e) => setForm({ ...form, districtId: e.target.value })} required />
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

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
