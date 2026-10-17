import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getUsers, deactivateUser, activateUser, resetPassword, createUser } from '../../lib/api'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Badge from '../../components/ui/Badge'
import PageHeader from '../../components/shared/PageHeader'
import Table from '../../components/shared/Table'
import ErrorState from '../../components/shared/ErrorState'
import { plural } from '../../lib/format'

const EMPTY_FORM = { firstName: '', lastName: '', zmid: '', email: '', password: '', phone: '', cnic: '' }

export default function WorkerManagement() {
  const queryClient = useQueryClient()

  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState(EMPTY_FORM)
  const [createError, setCreateError] = useState('')

  const [resetTarget, setResetTarget] = useState(null)
  const [newPassword, setNewPassword] = useState('')
  const [resetError, setResetError]   = useState('')
  const [deactivateTarget, setDeactivateTarget] = useState(null)

  const { data: userData, isLoading, isError, error, refetch } = useQuery({ queryKey: ['users'], queryFn: getUsers })
  const workers     = userData?.users ?? []
  const activeCount = workers.filter((w) => w.isActive).length

  const deactivateMutation = useMutation({
    mutationFn: (id) => deactivateUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      queryClient.invalidateQueries({ queryKey: ['audit-log'] })
      setDeactivateTarget(null)
    },
  })

  const activateMutation = useMutation({
    mutationFn: (id) => activateUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      queryClient.invalidateQueries({ queryKey: ['audit-log'] })
    },
  })

  const resetMutation = useMutation({
    mutationFn: () => resetPassword(resetTarget.id, newPassword),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audit-log'] })
      setResetTarget(null); setNewPassword(''); setResetError('')
    },
    onError: (err) => setResetError(err.message),
  })

  const createMutation = useMutation({
    mutationFn: () => {
      const payload = { ...createForm, role: 'facility_worker' }
      if (!payload.phone) delete payload.phone
      if (!payload.cnic)  delete payload.cnic
      return createUser(payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      queryClient.invalidateQueries({ queryKey: ['audit-log'] })
      setCreateOpen(false)
      setCreateForm(EMPTY_FORM)
      setCreateError('')
    },
    onError: (err) => setCreateError(
      err.status === 409 && err.body?.error?.toLowerCase().includes('zmid')
        ? 'That ZMID is already in use.'
        : err.status === 409
        ? 'That email is already in use.'
        : (err.message ?? 'Failed to create worker.')
    ),
  })

  const field = (key) => ({ value: createForm[key], onChange: (e) => setCreateForm((f) => ({ ...f, [key]: e.target.value })) })

  const actions = (w) => (
    <div className="flex items-center justify-end gap-1">
      <Button variant="ghost" size="sm" onClick={() => { setResetTarget(w); setResetError('') }}>Reset password</Button>
      {w.isActive ? (
        <Button variant="ghost" size="sm" className="text-text-muted hover:text-danger-dark hover:bg-danger-bg" onClick={() => setDeactivateTarget(w)}>Deactivate</Button>
      ) : (
        <Button variant="ghost" size="sm" onClick={() => activateMutation.mutate(w.id)} disabled={activateMutation.isPending}>Activate</Button>
      )}
    </div>
  )

  const columns = [
    {
      key: 'name', label: 'Worker',
      render: (w) => (
        <div className={w.isActive ? '' : 'opacity-60'}>
          <p className="font-medium text-text">{w.name ?? w.email}</p>
          <p className="text-xs text-text-muted">{w.email}</p>
        </div>
      ),
    },
    { key: 'zmid', label: 'ZMID', render: (w) => w.zmid ?? <span className="text-text-muted">—</span> },
    { key: 'phone', label: 'Phone', render: (w) => w.phone ?? <span className="text-text-muted">—</span> },
    { key: 'cnic', label: 'CNIC', render: (w) => w.cnic ?? <span className="text-text-muted">—</span> },
    { key: 'status', label: 'Status', render: (w) => <Badge type={w.isActive ? 'active' : 'inactive'} /> },
    { key: 'actions', label: '', align: 'right', render: actions },
  ]

  return (
    <div>
      <PageHeader
        breadcrumb="Facility Supervisor › Team"
        title="Workers"
        subtitle={workers.length ? `${plural(workers.length, 'worker')} · ${activeCount} active` : 'Vaccinators at your facility'}
        actions={<Button onClick={() => { setCreateOpen(true); setCreateError('') }}><Plus size={16} strokeWidth={1.75} /> Add worker</Button>}
      />

      {isError ? (
        <ErrorState title="Couldn’t load workers" error={error} onRetry={refetch} />
      ) : (
        <Table
          columns={columns}
          rows={workers}
          loading={isLoading}
          emptyMessage="No workers yet. Add your first vaccinator to start assigning vials."
          mobileCard={(w) => (
            <div className="px-4 py-3.5 flex flex-col gap-2">
              <div className="flex items-start justify-between gap-3">
                <div className={`min-w-0 ${w.isActive ? '' : 'opacity-60'}`}>
                  <p className="font-medium text-text truncate">{w.name ?? w.email}</p>
                  <p className="text-xs text-text-muted truncate">{[w.zmid, w.phone].filter(Boolean).join(' · ') || w.email}</p>
                </div>
                <Badge type={w.isActive ? 'active' : 'inactive'} />
              </div>
              {actions(w)}
            </div>
          )}
        />
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Add worker">
        <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); createMutation.mutate() }}>
          <div className="grid grid-cols-2 gap-3">
            <Input id="firstName" label="First name" required {...field('firstName')} />
            <Input id="lastName" label="Last name" required {...field('lastName')} />
          </div>
          <Input id="zmid" label="ZMID" placeholder="e.g. ZM001" required {...field('zmid')} />
          <Input id="email" label="Email" type="email" required {...field('email')} />
          <Input id="password" label="Password (at least 8 characters)" type="password" required {...field('password')} />
          <div className="grid grid-cols-2 gap-3">
            <Input id="phone" label="Phone (optional)" inputMode="tel" {...field('phone')} />
            <Input id="cnic" label="CNIC (optional)" {...field('cnic')} />
          </div>
          {createError && <p role="alert" className="text-sm text-danger-dark">{createError}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={createMutation.isPending || createForm.password.length < 8}>
              {createMutation.isPending ? 'Creating…' : 'Create worker'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!resetTarget} onClose={() => { setResetTarget(null); setResetError('') }} title={`Reset password for ${resetTarget?.name ?? resetTarget?.email ?? ''}`}>
        <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); resetMutation.mutate() }}>
          <Input id="reset-password" label="New password (at least 8 characters)" type="password"
            value={newPassword}
            onChange={(e) => { setNewPassword(e.target.value); setResetError('') }} required />
          {resetError && <p role="alert" className="text-sm text-danger-dark">{resetError}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={() => setResetTarget(null)}>Cancel</Button>
            <Button type="submit" disabled={resetMutation.isPending || newPassword.length < 8}>
              {resetMutation.isPending ? 'Saving…' : 'Save password'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deactivateTarget}
        onClose={() => setDeactivateTarget(null)}
        onConfirm={() => deactivateMutation.mutate(deactivateTarget.id)}
        title="Deactivate worker?"
        message={`${deactivateTarget?.name ?? deactivateTarget?.email ?? 'This worker'} won’t be able to sign in or receive vials until you activate them again.`}
        confirmLabel="Deactivate"
        isPending={deactivateMutation.isPending}
        error={deactivateMutation.error?.message}
      />
    </div>
  )
}
