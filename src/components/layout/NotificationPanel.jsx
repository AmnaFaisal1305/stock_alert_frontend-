import { Bell, X, Check, BellPlus, AlertTriangle, ClipboardCheck, ClipboardX, ClipboardList, Package, Truck } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getNotifications, markNotificationRead, markAllRead, sendTestPush } from '../../lib/api'
import { isPushSupported, enablePush } from '../../lib/push'
import { useAuth } from '../../context/AuthContext'
import { linkFor } from '../../lib/navigation'
import { ACCENT } from '../shared/StatCard'
import { timeAgo, localDateStr, toLocalDateStr } from '../../lib/format'

const INVALIDATE_KEYS = [['notifications'], ['unread-count']]

// Icon and tile colour by notification type: status colours only for status outcomes.
function typeVisual(type = '') {
  if (type === 'critical_stock')     return { icon: AlertTriangle, accent: 'critical' }
  if (type === 'approval_approved')  return { icon: ClipboardCheck, accent: 'adequate' }
  if (type === 'approval_rejected')  return { icon: ClipboardX, accent: 'critical' }
  if (type.startsWith('approval_'))  return { icon: ClipboardList, accent: type === 'approval_cancelled' ? 5 : 2 }
  if (type.startsWith('stock_request')) return { icon: Truck, accent: 4 }
  if (type.startsWith('stock_'))     return { icon: Package, accent: 1 }
  return { icon: Bell, accent: 5 }
}

const isUnread = (n) => !n.readAt && !n.isRead

export default function NotificationPanel({ onClose }) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [pushState, setPushState] = useState(() => {
    if (!isPushSupported()) return 'unsupported'
    if (Notification.permission === 'granted') return 'subscribed'
    if (Notification.permission === 'denied') return 'denied'
    return 'idle'
  })
  const [pushBusy, setPushBusy] = useState(false)
  const [testMsg, setTestMsg] = useState('')

  const testMutation = useMutation({
    mutationFn: sendTestPush,
    onSuccess: (r) => setTestMsg(r?.sent ? `Sent to ${r.sent} device${r.sent === 1 ? '' : 's'}. Check your phone.` : 'No device accepted it.'),
    onError: (err) => setTestMsg(
      err.status === 404 ? 'This account has no device subscribed.'
      : err.status === 429 ? 'Limit reached: 3 test pushes per hour.'
      : err.status === 503 ? 'Push isn’t configured on this server.'
      : err.message,
    ),
  })

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
  const hasUnread = notifications.some(isUnread)
  const today = localDateStr()
  const groups = [
    { label: 'Today',   items: notifications.filter((n) => n.createdAt && toLocalDateStr(new Date(n.createdAt)) === today) },
    { label: 'Earlier', items: notifications.filter((n) => !n.createdAt || toLocalDateStr(new Date(n.createdAt)) !== today) },
  ].filter((g) => g.items.length)

  const markOneMutation = useMutation({
    mutationFn: (id) => markNotificationRead(id),
    onSuccess: () => INVALIDATE_KEYS.forEach(k => qc.invalidateQueries({ queryKey: k })),
  })

  const markAllMutation = useMutation({
    mutationFn: markAllRead,
    onSuccess: () => INVALIDATE_KEYS.forEach(k => qc.invalidateQueries({ queryKey: k })),
  })

  function handleItemClick(n) {
    if (isUnread(n)) markOneMutation.mutate(n.id)
    onClose()
    const to = linkFor(user?.role, n)
    if (to) navigate(to)
  }

  return (
    <div className="fixed inset-x-4 top-[72px] sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-[360px] bg-surface rounded-card shadow-float ring-1 ring-surface-border z-50 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border">
        <h2 className="text-sm font-semibold text-text">Notifications</h2>
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

      <div className="max-h-[400px] overflow-y-auto">
        {isLoading && (
          <p className="text-sm text-text-muted px-4 py-6 text-center">Loading…</p>
        )}
        {!isLoading && notifications.length === 0 && (
          <div className="px-5 py-8 flex flex-col items-center gap-2 text-center">
            <Bell size={20} strokeWidth={1.75} className="text-text-muted" />
            <p className="text-sm font-medium text-text">No notifications</p>
          </div>
        )}
        {groups.map((g) => (
          <section key={g.label} aria-label={g.label}>
            <h3 className="px-4 pt-3 pb-1 text-xs font-medium text-text-muted">{g.label}</h3>
            <div className="divide-y divide-surface-border">
              {g.items.map((n) => {
                const { icon: Icon, accent } = typeVisual(n.type)
                const unread = isUnread(n)
                return (
                  <button
                    key={n.id}
                    onClick={() => handleItemClick(n)}
                    className={`w-full text-left px-4 py-3 hover:bg-surface-alt transition-colors flex items-start gap-3 ${unread ? 'bg-primary-bg/60' : ''}`}
                  >
                    <span className={`w-8 h-8 rounded-control grid place-items-center flex-shrink-0 ${ACCENT[accent]}`} aria-hidden="true">
                      <Icon size={16} strokeWidth={1.75} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm text-text ${unread ? 'font-medium' : ''}`}>{n.message}</p>
                      {n.createdAt && (
                        <p className="text-xs text-text-muted mt-0.5 tabular-nums" title={new Date(n.createdAt).toLocaleString()}>
                          {timeAgo(n.createdAt)}
                        </p>
                      )}
                    </div>
                    {unread && <span className="mt-1.5 flex-shrink-0 w-2 h-2 rounded-full bg-primary" aria-label="Unread" />}
                  </button>
                )
              })}
            </div>
          </section>
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
            className="text-xs font-medium text-primary hover:underline flex-shrink-0 disabled:opacity-50"
          >
            {pushBusy ? 'Enabling…' : 'Enable'}
          </button>
        </div>
      )}
      {pushState === 'subscribed' && (
        <div className="border-t border-surface-border px-4 py-2 flex items-center justify-between gap-3 bg-surface-alt">
          <p className="text-[11px] text-text-muted min-w-0" role="status">{testMsg || 'Push alerts are on for this device'}</p>
          <button
            onClick={() => { setTestMsg(''); testMutation.mutate() }}
            disabled={testMutation.isPending}
            className="text-xs font-medium text-primary hover:underline flex-shrink-0 disabled:opacity-50"
          >
            {testMutation.isPending ? 'Sending…' : 'Send test'}
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
