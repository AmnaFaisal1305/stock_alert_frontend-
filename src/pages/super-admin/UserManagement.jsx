import { useState } from 'react'
import { Plus, RotateCcw, UserX } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getUsers, getDistricts, createUser, deactivateUser, resetPassword } from '../../lib/api'
import Table from '../../components/shared/Table'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'

export default function UserManagement() {
  const queryClient = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [resetTarget, setResetTarget] = useState(null)
  const [form, setForm] = useState({ email: '', password: '', districtId: '' })
  const [newPassword, setNewPassword] = useState('')
  const [formError, setFormError] = useState('')

  const { data: userData, isLoading, isError } = useQuery({ queryKey: ['users'], queryFn: getUsers })
  const { data: districtData } = useQuery({ queryKey: ['districts'], queryFn: getDistricts })

  const districtMap = Object.fromEntries((districtData?.districts ?? []).map((d) => [d.id, d.name]))
  const districtOptions = (districtData?.districts ?? []).map((d) => ({ value: d.id, label: d.name }))
  const users = userData?.users ?? []

  const createMutation = useMutation({
    mutationFn: () => createUser({ email: form.email, password: form.password, role: 'district_supervisor', districtId: form.districtId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setCreateOpen(false)
      setForm({ email: '', password: '', districtId: '' })
      setFormError('')
    },
    onError: (err) => setFormError(err.message),
  })

  const deactivateMutation = useMutation({
    mutationFn: (id) => deactivateUser(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  })

  const resetMutation = useMutation({
    mutationFn: () => resetPassword(resetTarget.id, newPassword),
    onSuccess: () => { setResetTarget(null); setNewPassword(''); setFormError('') },
    onError: (err) => setFormError(err.message),
  })

  const columns = [
    { key: 'email', label: 'Email' },
    { key: 'districtId', label: 'District', render: (row) => districtMap[row.districtId] ?? '—' },
    {
      key: 'isActive', label: 'Status', render: (row) => (
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${row.isActive ? 'bg-success/10 text-success' : 'bg-surface-alt text-text-muted'}`}>
          {row.isActive ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      key: 'actions', label: '', render: (row) => (
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => { setResetTarget(row); setFormError('') }}>
            <RotateCcw size={13} /> Reset
          </Button>
          {row.isActive && (
            <Button variant="ghost" size="sm" onClick={() => deactivateMutation.mutate(row.id)}
              disabled={deactivateMutation.isPending}>
              <UserX size={13} /> Deactivate
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
          <Input id="sup-email" label="Email" type="email" placeholder="user@akuh.org"
            value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          <Input id="sup-password" label="Password (min 8 chars)" type="password"
            value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
          <Select id="sup-district" label="Assign District" options={districtOptions}
            value={form.districtId} onChange={(e) => setForm({ ...form, districtId: e.target.value })} />
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
          <Input id="reset-password" label="New Password (min 8 chars)" type="password"
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
    </div>
  )
}
