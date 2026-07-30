import { useState } from 'react'
import { RotateCcw, UserX, Users, UserCheck, CheckCircle2 } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getUsers, deactivateUser, activateUser, resetPassword } from '../../lib/api'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import SkeletonCard from '../../components/shared/SkeletonCard'

const AVATAR_COLORS = [
  'bg-teal-500', 'bg-violet-500', 'bg-emerald-500',
  'bg-amber-500', 'bg-pink-500', 'bg-sky-500',
]

function getAvatarColor(key) {
  return AVATAR_COLORS[(key?.charCodeAt(0) ?? 0) % AVATAR_COLORS.length]
}

function WorkerCard({ worker, confirmingId, onConfirmDeactivate, onCancelConfirm, onDeactivate, onActivate, onResetPassword, isDeactivating, isActivating }) {
  const displayName = worker.name ?? worker.email
  const initial = (displayName?.[0] ?? '?').toUpperCase()
  const avatarColor = getAvatarColor(displayName)
  const isActive = worker.isActive

  return (
    <div className={`bg-surface rounded-xl border border-surface-border p-5 flex flex-col gap-4 transition-all duration-200 hover:shadow-md ${!isActive ? 'opacity-60' : ''}`}>
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
          <p className="text-sm font-semibold text-text truncate" title={displayName}>{displayName}</p>
          <p className="text-xs text-text-muted truncate" title={worker.email}>{worker.email}</p>
          <span className={`inline-flex items-center gap-1 mt-1 text-xs font-semibold px-2.5 py-0.5 rounded-full ${
            isActive ? 'bg-success-bg text-success-dark' : 'bg-surface-alt text-text-muted'
          }`}>
            {isActive ? <UserCheck size={11} /> : <UserX size={11} />}
            {isActive ? 'Active' : 'Inactive'}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2 pt-1 border-t border-surface-border">
        <Button
          variant="ghost" size="sm" className="w-full justify-center"
          onClick={() => onResetPassword(worker)}
        >
          <RotateCcw size={13} /> Reset Password
        </Button>

        {isActive ? (
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
        ) : (
          <Button
            variant="ghost" size="sm" className="w-full justify-center text-text-muted hover:text-success-dark hover:bg-success-bg"
            onClick={() => onActivate(worker.id)}
            disabled={isActivating}
          >
            <UserCheck size={13} /> {isActivating ? 'Activating…' : 'Activate'}
          </Button>
        )}
      </div>
    </div>
  )
}

export default function WorkerManagement() {
  const queryClient = useQueryClient()

  const [resetTarget, setResetTarget] = useState(null)
  const [newPassword, setNewPassword] = useState('')
  const [resetError, setResetError]   = useState('')
  const [confirmingId, setConfirmingId] = useState(null)

  const { data: userData, isLoading, isError } = useQuery({ queryKey: ['users'], queryFn: getUsers })
  const workers     = userData?.users ?? []
  const activeCount   = workers.filter((w) => w.isActive).length
  const inactiveCount = workers.filter((w) => !w.isActive).length

  const deactivateMutation = useMutation({
    mutationFn: (id) => deactivateUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      queryClient.invalidateQueries({ queryKey: ['audit-log'] })
      setConfirmingId(null)
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

  return (
    <div className="flex flex-col gap-6">

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-text">Users Info</h1>
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

      {/* Loading */}
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} lines={3} />)}
        </div>
      )}

      {/* Error */}
      {isError && <p className="text-sm text-danger">Failed to load workers.</p>}

      {/* Empty state */}
      {!isLoading && !isError && workers.length === 0 && (
        <div className="text-center py-16 border border-dashed border-surface-border rounded-xl text-text-muted">
          <Users size={40} className="mx-auto mb-3 opacity-20" />
          <p className="font-semibold text-text">No workers yet</p>
          <p className="text-sm mt-1">Workers assigned to your facility will appear here.</p>
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
              onActivate={(id) => activateMutation.mutate(id)}
              onResetPassword={(w) => { setResetTarget(w); setResetError('') }}
              isDeactivating={deactivateMutation.isPending}
              isActivating={activateMutation.isPending}
            />
          ))}
        </div>
      )}

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
