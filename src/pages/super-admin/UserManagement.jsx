import { useState } from 'react'
import { Plus, RotateCcw, UserX, UserCheck } from 'lucide-react'
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

  const { data: userData, isLoading, isError } = useQuery({ queryKey: ['users'], queryFn: getUsers })
  const { data: districtData } = useQuery({ queryKey: ['districts'], queryFn: getDistricts })

  const districtMap = Object.fromEntries((districtData?.districts ?? []).map((d) => [d.id, d.name]))
  const districtOptions = (districtData?.districts ?? []).map((d) => ({ value: d.id, label: d.name }))
  const users = userData?.users ?? []

  const createMutation = useMutation({
    mutationFn: () => createUser({ name: form.name, email: form.email, password: form.password, role: 'district_supervisor', districtId: form.districtId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setCreateOpen(false)
      setForm({ name: '', email: '', password: '', districtId: '' })
      setFormError('')
      setToast({ message: 'District supervisor created.', type: 'success' })
    },
    onError: (err) => setFormError(err.message),
  })

  const deactivateMutation = useMutation({
    mutationFn: (id) => deactivateUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setToast({ message: `${deactivateTarget?.email} deactivated.`, type: 'success' })
      setDeactivateTarget(null)
    },
    onError: (err) => setToast({ message: err.message, type: 'error' }),
  })

  const activateMutation = useMutation({
    mutationFn: (id) => activateUser(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      const target = users.find((u) => u.id === id)
      setToast({ message: `${target?.email ?? 'Account'} activated.`, type: 'success' })
    },
    onError: (err) => setToast({ message: err.message, type: 'error' }),
  })

  const resetMutation = useMutation({
    mutationFn: () => resetPassword(resetTarget.id, newPassword),
    onSuccess: () => {
      setResetTarget(null)
      setNewPassword('')
      setFormError('')
      setToast({ message: 'Password reset.', type: 'success' })
    },
    onError: (err) => setFormError(err.message),
  })

  const columns = [
    { key: 'name', label: 'Name', render: (row) => row.name ?? '—' },
    { key: 'email', label: 'Email' },
    { key: 'districtId', label: 'District', render: (row) => districtMap[row.districtId] ?? '—' },
    {
      key: 'isActive', label: 'Status', render: (row) => (
        <Badge type={row.isActive ? 'active' : 'inactive'} />
      ),
    },
    {
      key: 'actions', label: '', render: (row) => (
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => { setResetTarget(row); setFormError('') }}>
            <RotateCcw size={13} /> Reset
          </Button>
          {row.isActive ? (
            <Button variant="ghost" size="sm" onClick={() => setDeactivateTarget(row)}>
              <UserX size={13} /> Deactivate
            </Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => activateMutation.mutate(row.id)} disabled={activateMutation.isPending}>
              <UserCheck size={13} /> Activate
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text">User Management</h1>
          <p className="text-sm text-text-muted mt-0.5">District supervisors</p>
        </div>
        <Button onClick={() => { setCreateOpen(true); setFormError('') }}>
          <Plus size={16} /> Add District Supervisor
        </Button>
      </div>

      {isLoading && <p className="text-text-muted">Loading users…</p>}
      {isError   && <p className="text-danger">Failed to load users.</p>}
      {!isLoading && !isError && (
        <Table columns={columns} rows={users} emptyMessage="No district supervisors yet." />
      )}

      {/* Create modal */}
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
          {formError && <p className="text-xs text-danger">{formError}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating…' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Reset password modal */}
      <Modal open={!!resetTarget} onClose={() => setResetTarget(null)} title={`Reset Password — ${resetTarget?.email ?? ''}`}>
        <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); resetMutation.mutate() }}>
          <Input id="reset-password" label="New Password (min 8 chars)" type="password" minLength={8}
            value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
          {formError && <p className="text-xs text-danger">{formError}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setResetTarget(null)}>Cancel</Button>
            <Button type="submit" disabled={resetMutation.isPending}>
              {resetMutation.isPending ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Deactivate confirmation */}
      <Modal open={!!deactivateTarget} onClose={() => setDeactivateTarget(null)} title="Deactivate account" maxWidth="max-w-sm">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-text">
            Deactivate <span className="font-medium">{deactivateTarget?.email}</span>? Their session ends immediately. You can reactivate this account later.
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
