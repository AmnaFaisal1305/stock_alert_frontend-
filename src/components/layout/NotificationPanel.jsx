import { Bell, X, Check, BellPlus } from 'lucide-react'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getNotifications, markNotificationRead, markAllRead } from '../../lib/api'
import { isPushSupported, enablePush } from '../../lib/push'

const INVALIDATE_KEYS = [['notifications'], ['unread-count']]

export default function NotificationPanel({ onClose }) {
  const qc = useQueryClient()
  const [pushState, setPushState] = useState(() => {
    if (!isPushSupported()) return 'unsupported'
    if (Notification.permission === 'granted') return 'subscribed'
    if (Notification.permission === 'denied') return 'denied'
    return 'idle'
  })
  const [pushBusy, setPushBusy] = useState(false)

  async function handleEnablePush() {
    setPushBusy(true)
    try {
      const result = await enablePush()
      setPushState(result === 'ok' ? 'subscribed' : result === 'denied' ? 'denied' : 'unsupported')
    } catch {
      setPushState('idle') // let them try again
    } finally {
      setPushBusy(false)
    }
  }

  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => getNotifications({ limit: 50 }),
    staleTime: 0,
  })

  const notifications = data?.notifications ?? []
  const hasUnread = notifications.some(n => !n.isRead)

  const markOneMutation = useMutation({
    mutationFn: (id) => markNotificationRead(id),
    onSuccess: () => INVALIDATE_KEYS.forEach(k => qc.invalidateQueries({ queryKey: k })),
  })

  const markAllMutation = useMutation({
    mutationFn: markAllRead,
    onSuccess: () => INVALIDATE_KEYS.forEach(k => qc.invalidateQueries({ queryKey: k })),
  })

  function handleItemClick(n) {
    if (!n.isRead) markOneMutation.mutate(n.id)
    onClose()
  }

  return (
    <div className="fixed inset-x-4 top-[72px] sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-[340px] bg-surface rounded-2xl border border-surface-border shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border">
        <p className="text-xs font-bold text-text uppercase tracking-wider">Notifications</p>
        <div className="flex items-center gap-2">
          {hasUnread && (
            <button
              onClick={() => markAllMutation.mutate()}
              disabled={markAllMutation.isPending}
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              <Check size={11} /> Mark all read
            </button>
          )}
          <button onClick={onClose} className="text-text-muted hover:text-text transition-colors p-0.5 rounded" aria-label="Close">
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="max-h-[360px] overflow-y-auto divide-y divide-surface-border">
        {isLoading && (
          <p className="text-sm text-text-muted px-4 py-6 text-center">Loading…</p>
        )}
        {!isLoading && notifications.length === 0 && (
          <div className="px-5 py-8 flex flex-col items-center gap-2 text-center">
            <Bell size={28} className="text-text-muted/30" />
            <p className="text-sm font-semibold text-text">No notifications</p>
          </div>
        )}
        {notifications.map(n => (
          <button
            key={n.id}
            onClick={() => handleItemClick(n)}
            className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors flex items-start gap-3 ${!n.isRead ? 'bg-primary/5' : ''}`}
          >
            {!n.isRead && <span className="mt-1.5 flex-shrink-0 w-2 h-2 rounded-full bg-primary" />}
            {n.isRead && <span className="mt-1.5 flex-shrink-0 w-2 h-2" />}
            <div className="min-w-0 flex-1">
              <p className="text-sm text-text">{n.message}</p>
              {n.createdAt && (
                <p className="text-[11px] text-text-muted mt-0.5">
                  {new Date(n.createdAt).toLocaleString()}
                </p>
              )}
            </div>
          </button>
        ))}
      </div>

      {/* Push notifications opt-in */}
      {pushState === 'idle' && (
        <div className="border-t border-surface-border px-4 py-3 flex items-center justify-between gap-3 bg-surface-alt">
          <div className="flex items-center gap-2 min-w-0">
            <BellPlus size={14} className="text-primary flex-shrink-0" />
            <p className="text-xs text-text-muted truncate">Enable push notifications</p>
          </div>
          <button
            onClick={handleEnablePush}
            disabled={pushBusy}
            className="text-xs font-semibold text-primary hover:underline flex-shrink-0 disabled:opacity-50"
          >
            {pushBusy ? 'Enabling…' : 'Enable'}
          </button>
        </div>
      )}
      {pushState === 'denied' && (
        <div className="border-t border-surface-border px-4 py-2 text-[11px] text-text-muted text-center">
          Notifications blocked — allow them in browser settings
        </div>
      )}
    </div>
  )
}
