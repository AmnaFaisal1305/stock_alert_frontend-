import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, AlertTriangle } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { getAuditLog, getUsers } from '../../lib/api'
import { buildContext, formatAuditEntry, computeFlags } from '../../lib/auditLog'
import { timeAgo } from '../../lib/format'
import { SkeletonRows } from '../shared/SkeletonCard'

const TONE_CLS = {
  warning: 'text-warning-dark',
  danger:  'text-danger-dark',
  neutral: 'text-text-muted',
  success: 'text-success-dark',
}

export default function AuditLogWidget({ auditLogPath = '/facility/audit-log', showHeadAlerts = false }) {
  const { data, isLoading } = useQuery({
    queryKey: ['audit-log', { actorRole: 'facility_supervisor', limit: 15 }],
    queryFn: () => getAuditLog({ actorRole: 'facility_supervisor', limit: 15 }),
    staleTime: 60_000,
    refetchInterval: 120_000,
  })

  // Without the user list, every vaccinator in a summary reads "Unknown vaccinator".
  const { data: userData } = useQuery({ queryKey: ['users'], queryFn: getUsers, staleTime: 60_000 })

  const { data: headData } = useQuery({
    queryKey: ['audit-log', { actorRole: 'facility_head', limit: 30 }],
    queryFn: () => getAuditLog({ actorRole: 'facility_head', limit: 30 }),
    enabled: showHeadAlerts,
    staleTime: 60_000,
  })

  const logs = data?.auditLog ?? []
  const ctx = useMemo(() => buildContext(logs, [], userData?.users), [logs, userData])

  // Enrich, filter session events, take last 5
  const events = useMemo(() => {
    return logs
      .filter((l) => l.action !== 'LOGOUT')
      .slice(0, 5)
      .map((l) => ({ ...l, $f: formatAuditEntry(l, ctx) }))
  }, [logs, ctx])

  // Top 3 distinct flag types (across all loaded supervisor entries)
  const flagItems = useMemo(() => {
    const seen = new Map()
    for (const l of logs) {
      for (const f of computeFlags(l, ctx)) {
        if (!seen.has(f.type)) seen.set(f.type, { ...f, count: 0 })
        seen.get(f.type).count++
      }
    }
    return [...seen.values()].slice(0, 3)
  }, [logs, ctx])

  // Open shortfalls from head entries (shown above the supervisor feed when showHeadAlerts)
  const headOpenShortfalls = useMemo(() => {
    if (!showHeadAlerts || !headData?.auditLog?.length) return []
    const headLogs = headData.auditLog
    const headCtx = buildContext(headLogs)
    return headLogs.filter((l) =>
      l.action === 'STOCK_REQUEST_APPROVE' &&
      computeFlags(l, headCtx).some((f) => f.type === 'open_shortfall')
    ).slice(0, 3).map((l) => ({ ...l, $f: formatAuditEntry(l, headCtx) }))
  }, [showHeadAlerts, headData])

  return (
    <section aria-labelledby="audit-widget-heading" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 id="audit-widget-heading" className="text-base font-semibold text-text">Recent activity</h2>
        <Link to={auditLogPath} className="flex items-center gap-1 text-sm text-text-muted hover:text-text">
          View all <ArrowRight size={14} strokeWidth={1.75} />
        </Link>
      </div>

      {headOpenShortfalls.length > 0 && (
        <div className="flex flex-col gap-1 px-3 py-2.5 rounded-card bg-warning-bg text-sm">
          <div className="flex items-center gap-2 text-warning-dark font-medium">
            <AlertTriangle size={14} strokeWidth={1.75} className="flex-shrink-0" aria-hidden="true" />
            {headOpenShortfalls.length} open {headOpenShortfalls.length === 1 ? 'shortfall' : 'shortfalls'} not yet resolved
          </div>
          {headOpenShortfalls.map((l) => (
            <p key={l.id} className="text-xs text-warning-dark pl-5 truncate">{l.$f?.summary ?? l.$f?.actionLabel}</p>
          ))}
        </div>
      )}

      {flagItems.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm px-3 py-2.5 rounded-card bg-warning-bg">
          <AlertTriangle size={14} strokeWidth={1.75} className="flex-shrink-0 text-warning-dark" aria-hidden="true" />
          {flagItems.map((f) => (
            <Link
              key={f.type}
              to={`${auditLogPath}?tab=mine`}
              className="text-warning-dark underline hover:no-underline"
            >
              {f.count} {f.label}
            </Link>
          ))}
        </div>
      )}

      <div className="rounded-card border border-surface-border bg-surface overflow-hidden">
        {isLoading ? (
          <SkeletonRows rows={4} />
        ) : events.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-text-muted">No activity recorded yet.</p>
        ) : (
          <ul className="divide-y divide-surface-border">
            {events.map((l) => {
              const f = l.$f
              const firstFlag = f?.flags?.[0]
              return (
                <li key={l.id ?? l.createdAt} className="px-4 py-3 flex items-start justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <p className="text-text truncate">{f?.summary ?? f?.actionLabel ?? l.action}</p>
                    <p className="text-xs text-text-muted mt-0.5">{timeAgo(l.createdAt)}</p>
                    {firstFlag && (
                      <span className={`text-xs ${TONE_CLS[firstFlag.tone] ?? TONE_CLS.neutral}`}>⚠ {firstFlag.label}</span>
                    )}
                  </div>
                  {f?.storeImpact && (
                    <span className={`flex-shrink-0 tabular-nums font-medium text-sm ${f.storeImpact.sign === '+' ? 'text-success-dark' : 'text-danger-dark'}`}>
                      {f.storeImpact.sign}{f.storeImpact.value}
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}
