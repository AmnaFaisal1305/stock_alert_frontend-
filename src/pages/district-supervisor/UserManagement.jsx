import { useState } from 'react'
import { Plus, RotateCcw, UserX } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getUsers, getFacilities, createUser, deactivateUser, resetPassword } from '../../lib/api'
import Table from '../../components/shared/Table'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import Badge from '../../components/ui/Badge'
import Toast from '../../components/ui/Toast'

export default function DistrictUserManagement() {
  const queryClient = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [resetTarget, setResetTarget] = useState(null)
  const [deactivateTarget, setDeactivateTarget] = useState(null)
  const [form, setForm] = useState({ email: '', password: '', facilityId: '' })
  const [newPassword, setNewPassword] = useState('')
  const [formError, setFormError] = useState('')
  const [toast, setToast] = useState(null)

  const { data: userData, isLoading, isError } = useQuery({ queryKey: ['users'], queryFn: getUsers })
  const { data: facilityData } = useQuery({ queryKey: ['facilities'], queryFn: getFacilities })

  const facilityMap = Object.fromEntries((facilityData?.facilities ?? []).map((f) => [f.id, f.name]))
  const facilityOptions = (facilityData?.facilities ?? []).map((f) => ({ value: f.id, label: f.name }))
  const users = userData?.users ?? []

  const createMutation = useMutation({
    mutationFn: () => createUser({ email: form.email, password: form.password, role: 'facility_supervisor', facilityId: form.facilityId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setCreateOpen(false)
      setForm({ email: '', password: '', facilityId: '' })
      setFormError('')
      setToast({ message: 'Facility supervisor created.', type: 'success' })
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
    { key: 'email', label: 'Email' },
    { key: 'facilityId', label: 'Facility', render: (row) => facilityMap[row.facilityId] ?? '—' },
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
          {row.isActive && (
            <Button variant="ghost" size="sm" onClick={() => setDeactivateTarget(row)}>
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
          <p className="text-sm text-text-muted mt-0.5">Facility supervisors in your district</p>
        </div>
        <Button onClick={() => { setCreateOpen(true); setFormError('') }}>
          <Plus size={16} /> Add Facility Supervisor
        </Button>
      </div>

      {isLoading && <p className="text-text-muted">Loading users…</p>}
      {isError   && <p className="text-danger">Failed to load users.</p>}
      {!isLoading && !isError && (
        <Table columns={columns} rows={users} emptyMessage="No facility supervisors yet." />
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create Facility Supervisor">
        <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); createMutation.mutate() }}>
          <Input id="fs-email" label="Email" type="email"
            value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          <Input id="fs-password" label="Password (min 8 chars)" type="password" minLength={8}
            value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
          <Select id="fs-facility" label="Assign Facility" options={facilityOptions}
            value={form.facilityId} onChange={(e) => setForm({ ...form, facilityId: e.target.value })} required />
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

      <Modal open={!!deactivateTarget} onClose={() => setDeactivateTarget(null)} title="Deactivate account" maxWidth="max-w-sm">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-text">
            Deactivate <span className="font-medium">{deactivateTarget?.email}</span>? Their session ends immediately and there is no way to reactivate from here.
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
