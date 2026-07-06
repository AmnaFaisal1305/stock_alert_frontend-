import { useState } from 'react'
import { Plus, RotateCcw, UserX } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getUsers, createUser, deactivateUser, resetPassword } from '../../lib/api'
import Table from '../../components/shared/Table'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'

export default function WorkerManagement() {
  const queryClient = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [resetTarget, setResetTarget] = useState(null)
  const [form, setForm] = useState({ email: '', password: '' })
  const [newPassword, setNewPassword] = useState('')
  const [formError, setFormError] = useState('')

  const { data: userData, isLoading, isError } = useQuery({ queryKey: ['users'], queryFn: getUsers })
  const workers = userData?.users ?? []

  const createMutation = useMutation({
    mutationFn: () => createUser({ email: form.email, password: form.password, role: 'facility_worker' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setCreateOpen(false)
      setForm({ email: '', password: '' })
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
          <h1 className="text-xl font-bold text-text">Worker Management</h1>
          <p className="text-sm text-text-muted mt-0.5">Facility workers at your facility</p>
        </div>
        <Button onClick={() => { setCreateOpen(true); setFormError('') }}>
          <Plus size={16} /> Add Worker
        </Button>
      </div>

      {isLoading && <p className="text-text-muted">Loading workers…</p>}
      {isError   && <p className="text-danger">Failed to load workers.</p>}
      {!isLoading && !isError && (
        <Table columns={columns} rows={workers} emptyMessage="No workers yet." />
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create Facility Worker">
        <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); createMutation.mutate() }}>
          <Input id="w-email" label="Email" type="email"
            value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          <Input id="w-password" label="Password (min 8 chars)" type="password"
            value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
          {formError && <p className="text-xs text-danger">{formError}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating…' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>

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
