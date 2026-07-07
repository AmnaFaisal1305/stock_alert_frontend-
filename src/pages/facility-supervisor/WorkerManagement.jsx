import { useState } from 'react'
import { Plus, RotateCcw, UserX, Users, UserCheck, CheckCircle2 } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getUsers, createUser, deactivateUser, resetPassword } from '../../lib/api'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import SkeletonCard from '../../components/shared/SkeletonCard'

const AVATAR_COLORS = [
  'bg-teal-500', 'bg-violet-500', 'bg-emerald-500',
  'bg-amber-500', 'bg-pink-500', 'bg-sky-500',
]

function getAvatarColor(email) {
  return AVATAR_COLORS[(email?.charCodeAt(0) ?? 0) % AVATAR_COLORS.length]
}

// ─── Worker Card ──────────────────────────────────────────────────────────────
function WorkerCard({ worker, confirmingId, onConfirmDeactivate, onCancelConfirm, onDeactivate, onResetPassword, isDeactivating }) {
  const initial = (worker.email?.[0] ?? '?').toUpperCase()
  const avatarColor = getAvatarColor(worker.email)
  const isActive = worker.isActive

  return (
    <div className={`bg-surface rounded-xl border border-surface-border p-5 flex flex-col gap-4 transition-all duration-200 hover:shadow-md ${!isActive ? 'opacity-60' : ''}`}>
      {/* Avatar + status */}
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="relative">
          <div className={`w-14 h-14 rounded-full ${avatarColor} text-white flex items-center justify-center text-xl font-bold flex-shrink-0 ${
            isActive ? 'ring-2 ring-success ring-offset-2' : 'ring-2 ring-surface-border ring-offset-2'
          }`}>
            {initial}
          </div>
          {isActive && (
            <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-success border-2 border-surface" />
          )}
        </div>

        <div className="min-w-0 w-full">
          <p className="text-sm font-semibold text-text truncate" title={worker.email}>{worker.email}</p>
          <span className={`inline-flex items-center gap-1 mt-1 text-xs font-semibold px-2.5 py-0.5 rounded-full ${
            isActive ? 'bg-success-bg text-success-dark' : 'bg-surface-alt text-text-muted'
          }`}>
            {isActive ? <UserCheck size={11} /> : <UserX size={11} />}
            {isActive ? 'Active' : 'Inactive'}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-2 pt-1 border-t border-surface-border">
        <Button
          variant="ghost" size="sm" className="w-full justify-center"
          onClick={() => onResetPassword(worker)}
        >
          <RotateCcw size={13} /> Reset Password
        </Button>

        {isActive && (
          confirmingId === worker.id ? (
            <div className="flex flex-col gap-1.5">
              <p className="text-xs text-center text-text-muted font-medium">Deactivate this worker?</p>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" className="flex-1 justify-center" onClick={onCancelConfirm}>
                  Cancel
                </Button>
                <Button
                  variant="danger" size="sm" className="flex-1 justify-center"
                  onClick={() => onDeactivate(worker.id)}
                  disabled={isDeactivating}
                >
                  {isDeactivating ? 'Deactivating…' : 'Confirm'}
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="ghost" size="sm" className="w-full justify-center text-text-muted hover:text-danger hover:bg-danger/5"
              onClick={() => onConfirmDeactivate(worker.id)}
            >
              <UserX size={13} /> Deactivate
            </Button>
          )
        )}
      </div>
    </div>
  )
}

// ─── Step Dots ────────────────────────────────────────────────────────────────
function StepDots({ step }) {
  const labels = ['Email', 'Password']
  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {[1, 2].map((n) => (
        <div key={n} className="flex items-center gap-2">
          <div className="flex flex-col items-center gap-1.5">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
              n < step   ? 'bg-primary text-white shadow-sm' :
              n === step ? 'bg-primary text-white ring-4 ring-primary/20 shadow-sm' :
                           'bg-surface-alt text-text-muted border border-surface-border'
            }`}>
              {n < step ? <CheckCircle2 size={13} /> : n}
            </div>
            <span className={`text-[10px] font-semibold uppercase tracking-wide ${n === step ? 'text-primary' : 'text-text-muted'}`}>
              {labels[n - 1]}
            </span>
          </div>
          {n < 2 && <div className={`w-10 h-0.5 mb-5 ${n < step ? 'bg-primary' : 'bg-surface-border'}`} />}
        </div>
      ))}
    </div>
  )
}

export default function WorkerManagement() {
  const queryClient = useQueryClient()

  const [createOpen, setCreateOpen] = useState(false)
  const [addStep, setAddStep]       = useState(1)
  const [form, setForm]             = useState({ email: '', password: '' })
  const [formError, setFormError]   = useState('')

  const [resetTarget, setResetTarget] = useState(null)
  const [newPassword, setNewPassword] = useState('')
  const [resetError, setResetError]   = useState('')

  const [confirmingId, setConfirmingId] = useState(null)

  const { data: userData, isLoading, isError } = useQuery({ queryKey: ['users'], queryFn: getUsers })
  const workers = userData?.users ?? []
  const activeCount   = workers.filter((w) => w.isActive).length
  const inactiveCount = workers.filter((w) => !w.isActive).length

  const createMutation = useMutation({
    mutationFn: () => createUser({ email: form.email, password: form.password, role: 'facility_worker' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setCreateOpen(false); setAddStep(1); setForm({ email: '', password: '' }); setFormError('')
    },
    onError: (err) => setFormError(err.message),
  })

  const deactivateMutation = useMutation({
    mutationFn: (id) => deactivateUser(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['users'] }); setConfirmingId(null) },
  })

  const resetMutation = useMutation({
    mutationFn: () => resetPassword(resetTarget.id, newPassword),
    onSuccess: () => { setResetTarget(null); setNewPassword(''); setResetError('') },
    onError: (err) => setResetError(err.message),
  })

  function openCreate() {
    setCreateOpen(true); setAddStep(1); setForm({ email: '', password: '' }); setFormError('')
  }

  return (
    <div className="flex flex-col gap-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-text">Worker Management</h1>
          {!isLoading && workers.length > 0 && (
            <div className="flex items-center gap-3 mt-1.5">
              <span className="flex items-center gap-1 text-xs font-semibold text-text-muted bg-surface-alt border border-surface-border px-2.5 py-1 rounded-full">
                <Users size={11} /> {workers.length} total
              </span>
              <span className="flex items-center gap-1 text-xs font-semibold text-success-dark bg-success-bg px-2.5 py-1 rounded-full">
                <UserCheck size={11} /> {activeCount} active
              </span>
              {inactiveCount > 0 && (
                <span className="flex items-center gap-1 text-xs font-semibold text-text-muted bg-surface-alt border border-surface-border px-2.5 py-1 rounded-full">
                  <UserX size={11} /> {inactiveCount} inactive
                </span>
              )}
            </div>
          )}
          {(isLoading || workers.length === 0) && (
            <p className="text-sm text-text-muted mt-0.5">Manage facility workers at your facility</p>
          )}
        </div>
        <Button onClick={openCreate}>
          <Plus size={16} /> Add Worker
        </Button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3,4].map((i) => <SkeletonCard key={i} lines={3} />)}
        </div>
      )}

      {/* Error */}
      {isError && <p className="text-sm text-danger">Failed to load workers.</p>}

      {/* Empty state */}
      {!isLoading && !isError && workers.length === 0 && (
        <div className="text-center py-16 border border-dashed border-surface-border rounded-xl text-text-muted">
          <Users size={40} className="mx-auto mb-3 opacity-20" />
          <p className="font-semibold text-text">No workers yet</p>
          <p className="text-sm mt-1">Click "Add Worker" to add the first worker to your facility.</p>
        </div>
      )}

      {/* Card grid */}
      {!isLoading && !isError && workers.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {workers.map((worker) => (
            <WorkerCard
              key={worker.id}
              worker={worker}
              confirmingId={confirmingId}
              onConfirmDeactivate={setConfirmingId}
              onCancelConfirm={() => setConfirmingId(null)}
              onDeactivate={(id) => deactivateMutation.mutate(id)}
              onResetPassword={(w) => { setResetTarget(w); setResetError('') }}
              isDeactivating={deactivateMutation.isPending}
            />
          ))}
        </div>
      )}

      {/* Add Worker Modal — 2-step */}
      <Modal open={createOpen} onClose={() => { setCreateOpen(false); setAddStep(1) }} title="Add Facility Worker">
        <StepDots step={addStep} />

        {addStep === 1 && (
          <form className="flex flex-col gap-4"
            onSubmit={(e) => { e.preventDefault(); setFormError(''); setAddStep(2) }}>
            <div>
              <p className="text-sm font-semibold text-text mb-1">Enter worker email address</p>
              <p className="text-xs text-text-muted mb-4">This will be their login email for the system.</p>
              <Input id="w-email" label="Email" type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </div>
            <div className="flex justify-end gap-3 pt-1">
              <Button variant="secondary" type="button" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={!form.email}>Next →</Button>
            </div>
          </form>
        )}

        {addStep === 2 && (
          <form className="flex flex-col gap-4"
            onSubmit={(e) => { e.preventDefault(); createMutation.mutate() }}>
            <div>
              <p className="text-sm font-semibold text-text mb-1">Set a password</p>
              <p className="text-xs text-text-muted mb-1">
                Creating account for <span className="font-semibold text-text">{form.email}</span>
              </p>
              <p className="text-xs text-text-muted mb-4">Minimum 8 characters.</p>
              <Input id="w-password" label="Password" type="password"
                value={form.password}
                onChange={(e) => { setForm({ ...form, password: e.target.value }); setFormError('') }} required />
            </div>
            {formError && <p className="text-xs text-danger bg-danger-bg rounded-lg px-3 py-2">{formError}</p>}
            <div className="flex justify-end gap-3 pt-1">
              <Button variant="secondary" type="button" onClick={() => { setAddStep(1); setFormError('') }}>← Back</Button>
              <Button type="submit" disabled={createMutation.isPending || form.password.length < 8}>
                {createMutation.isPending ? 'Creating…' : 'Create Worker'}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Reset Password Modal */}
      <Modal open={!!resetTarget} onClose={() => { setResetTarget(null); setResetError('') }}
        title={`Reset Password — ${resetTarget?.email ?? ''}`}>
        <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); resetMutation.mutate() }}>
          <Input id="reset-password" label="New Password (min 8 chars)" type="password"
            value={newPassword}
            onChange={(e) => { setNewPassword(e.target.value); setResetError('') }} required />
          {resetError && <p className="text-xs text-danger">{resetError}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setResetTarget(null)}>Cancel</Button>
            <Button type="submit" disabled={resetMutation.isPending || newPassword.length < 8}>
              {resetMutation.isPending ? 'Saving…' : 'Save Password'}
            </Button>
          </div>
        </form>
      </Modal>

    </div>
  )
}
