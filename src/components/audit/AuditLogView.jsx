// The one Audit Log for every role. Tabs and the optional scope filter (facility / worker)
// come from ROLE_CONFIG; parsing and labels live in lib/auditLog. Filtering and paging run
// on the server (Round 35): tab badges come from countsByActorRole, pages from nextCursor.
// Rich view (category chip, summary, worker, store impact, flags, day groups, thread modal)
// activates on any tab whose actorRole is 'facility_supervisor'.
import { useState, useMemo } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { X, AlertTriangle } from 'lucide-react'
import { getAuditLog, getVaccines, getUsers, getFacilities } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import Select from '../ui/Select'
import DatePicker from '../ui/DatePicker'
import Button from '../ui/Button'
import Tabs from '../ui/Tabs'
import ExportButton from '../ui/ExportButton'
import Modal from '../ui/Modal'
import { useUrlFilters } from '../../hooks/useUrlState'
import { useDebounce } from '../../hooks/useDebounce'
import { useAllAuditPages } from '../../hooks/useAllAuditPages'
import PageHeader from '../shared/PageHeader'
import Table from '../shared/Table'
import Pagination from '../shared/Pagination'
import SearchInput from '../shared/SearchInput'
import StatusBadge from '../shared/StatusBadge'
import FilterChips from '../shared/FilterChips'
import ErrorState from '../shared/ErrorState'
import { ROLE_LABELS, ROLE_LABELS_PLURAL } from '../../lib/navigation'
import { formatDate, formatTime, plural } from '../../lib/format'
import { workflowStatusConfig } from '../../lib/status'
import {
  actionLabel, actionOptionsFor, buildContext, parseEntry, isRequestEvent,
  formatAuditEntry, getCategory, computeFlags,
} from '../../lib/auditLog'

const PER_PAGE = 15

// params: what the tab sends to the API; countKey: its badge in countsByActorRole (none = sum).
const roleTab = (role, label = ROLE_LABELS_PLURAL[role]) => ({ value: role, label, params: { actorRole: role }, countKey: role })
const ROLE_TAB = Object.fromEntries(
  ['super_admin', 'district_supervisor', 'uc_supervisor', 'facility_head', 'facility_supervisor', 'facility_worker'].map((r) => [r, roleTab(r)]),
)
const ADMIN_TABS = ['super_admin', 'district_supervisor', 'uc_supervisor', 'facility_head', 'facility_supervisor', 'facility_worker'].map((r) => ROLE_TAB[r])

// tabs: what each role can browse; scope: an extra Select shown on the listed tabs;
// where: show the facility/district column (multi-facility roles only).
const ROLE_CONFIG = {
  super_admin: { tabs: ADMIN_TABS, where: 'district' },
  observer:    { tabs: ADMIN_TABS, where: 'district' },
  district_supervisor: {
    tabs: [{ value: 'all', label: 'All', params: {} }, ...['uc_supervisor', 'facility_head', 'facility_supervisor', 'facility_worker'].map((r) => ROLE_TAB[r])],
    scope: 'facility', where: 'facility',
  },
  uc_supervisor: { tabs: [ROLE_TAB.facility_supervisor, ROLE_TAB.facility_worker], where: 'facility' },
  facility_head: {
    tabs: ['uc_supervisor', 'facility_head', 'facility_supervisor', 'facility_worker'].map((r) => ROLE_TAB[r]),
    defaultTab: 'facility_supervisor',
  },
  facility_supervisor: {
    tabs: [
      // A supervisor's scope holds only their own rows and their workers', so the role filter
      // equals "mine" and keeps both badges correct (countsByActorRole ignores actorRole only).
      { ...roleTab('facility_supervisor', 'My actions'), value: 'mine', hideWho: true },
      { ...roleTab('facility_worker'), value: 'workers' },
    ],
    scope: 'worker',
  },
}

const SUBTITLE = {
  facility_supervisor: 'What you and your vaccinators recorded',
  facility_head: 'Activity at your facility',
  uc_supervisor: 'Activity in your union councils',
  district_supervisor: 'Activity across your district',
}

// Category chip styles for the rich view
const CATEGORY_STYLE = {
  'Stock movement': 'bg-info-bg text-info-dark',
  'Request':        'bg-surface-chip text-text',
  'Approval':       'bg-warning-bg text-warning-dark',
  'Day end':        'bg-success-bg text-success-dark',
  'Forms':          'bg-surface-chip text-text',
  'Session':        'bg-surface-chip text-text-muted',
}
const CATEGORY_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'Stock movement', label: 'Stock movement' },
  { value: 'Request', label: 'Request' },
  { value: 'Approval', label: 'Approval' },
  { value: 'Day end', label: 'Day end' },
  { value: 'Forms', label: 'Forms' },
  { value: 'Session', label: 'Session' },
]
const TONE_CLASSES = {
  neutral: 'bg-surface-chip text-text-muted',
  warning: 'bg-warning-bg text-warning-dark',
  danger:  'bg-danger-bg text-danger-dark',
  success: 'bg-success-bg text-success-dark',
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function Vials({ p }) {
  if (p.vials == null) return <span className="text-text-muted">—</span>
  const signed = typeof p.vials === 'string' ? p.vials : p.dir === 'in' ? `+${p.vials}` : p.dir === 'out' ? `−${p.vials}` : p.vials
  return <span className={`tabular-nums font-medium ${p.dir === 'in' ? 'text-success-dark' : 'text-text'}`}>{signed}</span>
}

function Details({ entry, p, onRequest, compact = false }) {
  const status = entry.status ?? entry.details?.status
  const showStatus = status && (entry.entityType === 'stock_request' || entry.entityType === 'approval' || entry.action?.startsWith('STOCK_REQUEST'))
  const empty = !p.items && !p.detail && !p.warning && !showStatus && !isRequestEvent(entry)
  if (empty) return compact ? null : <span className="text-text-muted">—</span>
  return (
    <div className="flex flex-col gap-1 min-w-[12rem] max-w-md text-sm">
      {p.items && <p className="text-text">{p.items.map((it) => `${it.name} ${it.vials}`).join(', ')}</p>}
      {p.detail && <p className="text-text-muted break-words first-letter:uppercase">{p.detail}</p>}
      {p.warning && <p className="text-warning-dark">{p.warning}</p>}
      {(showStatus || isRequestEvent(entry)) && (
        <div className="flex items-center gap-2 flex-wrap">
          {showStatus && <StatusBadge kind="workflow" status={status} />}
          {isRequestEvent(entry) && onRequest && (
            <button type="button" onClick={() => onRequest(entry.entityId)} className="text-xs text-text-muted hover:text-primary hover:underline tabular-nums" title="Show every event for this request">
              Request #{entry.entityId.slice(0, 8)}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// Expanded row detail panel (rich view only)
function ExpandedPanel({ row }) {
  const d = row.details ?? {}
  return (
    <div className="grid sm:grid-cols-2 gap-x-8 gap-y-2 text-xs text-text-muted">
      {d.batchNo      && <span><span className="font-medium text-text">Batch</span> {d.batchNo}</span>}
      {d.manufacturer && <span><span className="font-medium text-text">Manufacturer</span> {d.manufacturer}</span>}
      {d.expiryDate   && <span><span className="font-medium text-text">Expiry</span> {d.expiryDate}</span>}
      {(d.note || d.reason) && (
        <span className="sm:col-span-2">
          <span className="font-medium text-text">{d.note ? 'Note' : 'Reason'}</span> "{d.note ?? d.reason}"
        </span>
      )}
      {d.occurredOn && d.occurredOn !== row.createdAt?.split('T')[0] && (
        <span>
          <span className="font-medium text-text">Occurred on</span> {d.occurredOn}{' '}
          <span className="text-warning-dark">(backdated)</span>
        </span>
      )}
      {d.payload?.thresholds && (
        <div className="sm:col-span-2">
          <span className="font-medium text-text">Requested thresholds</span>
          <span className="ml-2">
            Low: {d.payload.thresholds.lowDoses ?? '—'} doses / {d.payload.thresholds.lowVials ?? '—'} vials ·{' '}
            Critical: {d.payload.thresholds.criticalDoses ?? '—'} doses / {d.payload.thresholds.criticalVials ?? '—'} vials
          </span>
        </div>
      )}
      {d.payload?.storeVials != null && (
        <span><span className="font-medium text-text">Requested store vials</span> {d.payload.storeVials}</span>
      )}
      <span className="sm:col-span-2 pt-2 border-t border-surface-border font-mono break-all text-text-muted">
        <span className="font-medium text-text not-italic mr-1">ID</span>
        {row.entityId ?? row.id}
      </span>
    </div>
  )
}

// Request thread timeline modal (rich view)
function RequestThreadModal({ entityId, onClose }) {
  const { data: entries = [], isLoading } = useAllAuditPages(
    { entityId },
    { enabled: !!entityId, cap: 5 },
  )
  const sorted = useMemo(() => [...entries].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)), [entries])
  const threadCtx = useMemo(() => buildContext(sorted), [sorted])

  return (
    <Modal open={!!entityId} onClose={onClose} title={`Request #${entityId?.slice(0, 8) ?? ''}`} maxWidth="max-w-xl">
      {isLoading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-12 rounded bg-surface-chip animate-pulse motion-reduce:animate-none" />)}
        </div>
      ) : sorted.length === 0 ? (
        <p className="text-sm text-text-muted">No events found for this request.</p>
      ) : (
        <ol className="relative pl-6 border-l-2 border-surface-border flex flex-col gap-5">
          {sorted.map((e, i) => {
            const f = formatAuditEntry(e, threadCtx)
            const wf = e.status ? workflowStatusConfig(e.status) : null
            return (
              <li key={e.id ?? i} className="relative">
                <span className="absolute -left-[1.125rem] top-1 w-3 h-3 rounded-full bg-surface border-2 border-surface-border" />
                <p className="text-sm font-medium text-text">{f.actionLabel}</p>
                {f.summary && <p className="text-sm text-text-muted mt-0.5">{f.summary}</p>}
                <p className="text-xs text-text-muted mt-1">{formatDate(e.createdAt)} · {formatTime(e.createdAt)}</p>
                {wf && (
                  <span className={`mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${wf.bg} ${wf.text}`}>
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${wf.dot}`} />
                    {wf.label}
                  </span>
                )}
              </li>
            )
          })}
        </ol>
      )}
    </Modal>
  )
}

// Attention strip specific to the audit log (flags, not route links)
function AuditAttentionStrip({ items, onFilter }) {
  if (!items?.length) return null
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-card px-4 py-3 bg-warning-bg text-warning-dark text-sm mb-1">
      <AlertTriangle size={15} strokeWidth={1.75} className="flex-shrink-0" aria-hidden="true" />
      {items.map(({ count, label, category }) => (
        <button key={label} type="button" onClick={() => onFilter(category)} className="underline hover:no-underline">
          {count} {label}
        </button>
      ))}
      <span className="text-xs opacity-70">· Click to filter</span>
    </div>
  )
}

// ─── Main view ───────────────────────────────────────────────────────────────

export default function AuditLogView() {
  const { user } = useAuth()
  const config = ROLE_CONFIG[user.role] ?? ROLE_CONFIG.super_admin
  // Tab and filters live in the URL; paging stays local.
  // category and hideSession are rich-view extras (client-side only).
  const [url, setUrl] = useUrlFilters({
    tab: config.defaultTab ?? config.tabs[0].value,
    q: '', action: '', from: '', to: '', request: '', scope: '',
    category: '', hideSession: '1',
  })
  const tab = url.tab
  const filters = { action: url.action, from: url.from, to: url.to, entityId: url.request, scope: url.scope }
  const q = useDebounce(url.q).trim()
  const [page, setPage] = useState(1)
  const [cursors, setCursors] = useState([null])
  const [expandedIds, setExpandedIds] = useState(new Set())
  const [threadId, setThreadId] = useState(null)

  const set = ({ entityId, category: cat, ...patch }) => {
    const update = { ...patch }
    if (entityId !== undefined) update.request = entityId
    if (cat !== undefined) update.category = cat
    setUrl(update)
    setPage(1)
    setCursors([null])
    setExpandedIds(new Set())
  }

  const activeTab = config.tabs.find((t) => t.value === tab) ?? config.tabs[0]
  // Rich view: any tab that shows facility supervisor entries
  const isRichView = activeTab.params?.actorRole === 'facility_supervisor'

  const scopeOn = config.scope && (config.scope === 'worker' ? tab === 'workers' : tab === 'all')
  const scopeId = scopeOn ? filters.scope : ''
  const params = {
    ...activeTab.params,
    q, action: filters.action, from: filters.from, to: filters.to, entityId: filters.entityId,
    ...(scopeId ? (config.scope === 'worker' ? { actorId: scopeId } : { facilityId: scopeId }) : {}),
  }
  const before = cursors[page - 1]

  const logQ = useQuery({
    queryKey: ['audit-log', params, before],
    queryFn: () => getAuditLog({ ...params, limit: PER_PAGE, before, counts: true }),
    placeholderData: keepPreviousData,
  })
  const { data: vaccineData } = useQuery({ queryKey: ['vaccines'], queryFn: getVaccines })
  const { data: userData } = useQuery({ queryKey: ['users'], queryFn: getUsers, enabled: config.scope === 'worker' })
  const { data: facilityData } = useQuery({ queryKey: ['facilities'], queryFn: getFacilities, enabled: config.scope === 'facility', staleTime: 30_000 })

  // Full-set fetch for flags + attention strip + thread modal (rich view only)
  const allPagesQ = useAllAuditPages(params, { enabled: isRichView })

  const logs = logQ.data?.auditLog
  // Current-page context (always available)
  const ctx = useMemo(
    () => buildContext(logs ?? [], vaccineData?.vaccines, userData?.users),
    [logs, vaccineData, userData],
  )
  // Full-set context: has cross-page data needed for post_dayend_assign and awaiting_received flags.
  const allCtx = useMemo(
    () => isRichView ? buildContext(allPagesQ.data ?? [], vaccineData?.vaccines, userData?.users) : null,
    [isRichView, allPagesQ.data, vaccineData, userData],
  )
  const effectiveCtx = allCtx ?? ctx

  const scopeOptions = useMemo(() => {
    if (config.scope === 'worker') {
      return (userData?.users ?? []).filter((u) => u.role === 'facility_worker').map((u) => ({ value: u.id, label: ctx.userNameById[u.id] || u.email }))
    }
    if (config.scope === 'facility') return (facilityData?.facilities ?? []).map((f) => ({ value: f.id, label: f.name }))
    return []
  }, [config.scope, userData, facilityData, ctx])

  const actionOptions = useMemo(() => [{ value: '', label: 'All actions' }, ...actionOptionsFor(user.role)], [user.role])

  const counts = logQ.data?.countsByActorRole
  const tabCount = (t) => (counts ? (t.countKey ? counts[t.countKey] ?? 0 : Object.values(counts).reduce((s, n) => s + n, 0)) : undefined)
  const total = logQ.data?.total ?? 0
  const totalPages = Math.ceil(total / PER_PAGE)
  const nextCursor = logQ.isPlaceholderData ? null : logQ.data?.nextCursor
  const maxPage = Math.min(totalPages, cursors.length + (page === cursors.length && nextCursor ? 1 : 0))
  const goTo = (p) => {
    if (p > maxPage) return
    if (p === cursors.length + 1) setCursors((c) => [...c, nextCursor])
    setPage(p)
  }

  const pageRows = logs ?? []
  const hasFilters = !!(url.q || filters.action || filters.from || filters.to || filters.entityId || filters.scope)
  const showWho = !activeTab.hideWho
  const onRequest = (id) => set({ entityId: id, action: '' })

  // Parse all rows; enrich with formatAuditEntry on the rich tab
  const parsedRows = useMemo(
    () => pageRows.map((l) => {
      const $f = isRichView ? formatAuditEntry(l, effectiveCtx) : null
      const $p = $f?.parsed ?? parseEntry(l, ctx)
      return { ...l, $p, $f }
    }),
    [pageRows, isRichView, effectiveCtx, ctx],
  )

  // Client-side filters applied to the current page (rich view only)
  const visibleRows = useMemo(() => {
    if (!isRichView) return parsedRows
    return parsedRows.filter((l) => {
      if (url.category && l.$f?.category !== url.category) return false
      if (url.hideSession === '1' && l.action === 'LOGOUT') return false
      return true
    })
  }, [parsedRows, isRichView, url.category, url.hideSession])

  const hiddenCount = isRichView && url.hideSession === '1' ? parsedRows.filter((l) => l.action === 'LOGOUT').length : 0

  // Day groups for the rich table
  const dayGroups = useMemo(() => {
    if (!isRichView) return null
    const grouped = {}
    const order = []
    for (const row of visibleRows) {
      const date = row.createdAt.split('T')[0]
      if (!grouped[date]) { grouped[date] = []; order.push(date) }
      grouped[date].push(row)
    }
    return order.map((date) => {
      const g = grouped[date]
      const label = formatDate(date + 'T12:00:00', { withYear: false })
      const totalAssigned = g.filter((r) => r.action === 'STOCK_ASSIGN').reduce((s, r) => s + (r.$f?.storeImpact?.value ?? 0), 0)
      const reqCount = g.filter((r) => r.action === 'STOCK_REQUEST_CREATE').length
      const recCount = g.filter((r) => r.action === 'STOCK_REQUEST_RECEIVED').length
      const parts = []
      if (totalAssigned) parts.push(`${totalAssigned} vials assigned`)
      if (reqCount) parts.push(plural(reqCount, 'request'))
      if (recCount) parts.push(`${recCount} received`)
      return { label, summary: parts.join(' · '), rows: g }
    })
  }, [isRichView, visibleRows])

  // Expandable row state
  const toggleExpand = (row) => {
    const key = row.id ?? `${row.createdAt}-${row.action}`
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }
  const isRowExpanded = (row) => expandedIds.has(row.id ?? `${row.createdAt}-${row.action}`)

  // Attention strip: flag counts from the full loaded set
  const attentionItems = useMemo(() => {
    if (!isRichView || !allCtx || !allPagesQ.data?.length) return []
    const counts = {}
    for (const log of allPagesQ.data) {
      for (const f of computeFlags(log, allCtx)) {
        counts[f.type] = (counts[f.type] ?? 0) + 1
      }
    }
    return [
      counts.short_delivery     > 0 && { count: counts.short_delivery,     label: 'short deliveries',                    category: 'Stock movement' },
      counts.pending_stale      > 0 && { count: counts.pending_stale,      label: 'pending approvals',                   category: 'Approval' },
      counts.awaiting_received  > 0 && { count: counts.awaiting_received,  label: 'received but awaiting both approvals', category: 'Request' },
      counts.post_dayend_assign > 0 && { count: counts.post_dayend_assign, label: 'possible post-day-end assignments',   category: 'Stock movement' },
    ].filter(Boolean)
  }, [isRichView, allCtx, allPagesQ.data])

  // ─── Columns ─────────────────────────────────────────────────────────────

  const richColumns = useMemo(() => [
    {
      key: 'when', label: 'When',
      render: (l) => (
        <span className="whitespace-nowrap">
          {formatDate(l.createdAt, { withYear: false })}
          <span className="block text-xs text-text-muted">{formatTime(l.createdAt)}</span>
          {l.$f?.backdatedFor && <span className="block text-xs text-warning-dark">For {l.$f.backdatedFor}</span>}
        </span>
      ),
    },
    ...(showWho ? [{
      key: 'who', label: 'Who',
      render: (l) => <p className="font-medium whitespace-nowrap min-w-[7rem]">{l.actorName ?? '—'}</p>,
    }] : []),
    {
      key: 'action', label: 'Action',
      render: (l) => {
        const cat = l.$f?.category
        return (
          <div className="flex flex-col gap-1 min-w-[8rem]">
            <span className="font-medium whitespace-nowrap">{l.$f?.actionLabel ?? actionLabel(l.action)}</span>
            {cat && (
              <span className={`self-start inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${CATEGORY_STYLE[cat] ?? 'bg-surface-chip text-text-muted'}`}>
                {cat}
              </span>
            )}
          </div>
        )
      },
    },
    ...(config.where ? [{
      key: 'where', label: config.where === 'district' ? 'Where' : 'Facility',
      render: (l) => {
        const parts = config.where === 'district' ? [l.facilityName, l.districtName] : [l.facilityName]
        const text = parts.filter(Boolean).join(' · ')
        return text ? <span className="text-text-muted">{text}</span> : <span className="text-text-muted">—</span>
      },
    }] : []),
    {
      key: 'summary', label: 'Summary',
      render: (l) => {
        const f = l.$f
        return (
          <div className="min-w-[14rem] max-w-sm">
            {f?.summary ? <p className="text-sm text-text">{f.summary}</p> : <span className="text-text-muted">—</span>}
            {f?.flags?.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {f.flags.map((flag) => (
                  <span
                    key={`${flag.type}-${flag.label}`}
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs ${TONE_CLASSES[flag.tone] ?? TONE_CLASSES.neutral}`}
                  >
                    ⚠ {flag.label}
                  </span>
                ))}
              </div>
            )}
          </div>
        )
      },
    },
    {
      key: 'worker', label: 'Worker',
      render: (l) => {
        const w = l.$f?.workerName
        return w ? <span className="text-text-muted whitespace-nowrap">{w}</span> : <span className="text-text-muted">—</span>
      },
    },
    {
      key: 'impact', label: 'Store impact', align: 'right',
      render: (l) => {
        const imp = l.$f?.storeImpact
        if (!imp) return <span className="text-text-muted">—</span>
        return (
          <span className={`tabular-nums font-medium whitespace-nowrap ${imp.sign === '+' ? 'text-success-dark' : 'text-danger-dark'}`}>
            {imp.sign}{imp.value}
          </span>
        )
      },
    },
    {
      key: 'status', label: 'Status',
      render: (l) => {
        const f = l.$f
        if (!f?.statusLabel) return <span className="text-text-muted">—</span>
        const cls = TONE_CLASSES[f.statusTone] ?? TONE_CLASSES.neutral
        const wf = f.showCurrentStatus && f.currentStatus ? workflowStatusConfig(f.currentStatus) : null
        return (
          <div className="flex flex-col gap-1">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${cls}`}>
              {f.statusLabel}
            </span>
            {wf && (
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs whitespace-nowrap ${wf.bg} ${wf.text}`}>
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${wf.dot}`} />
                Now: {wf.label}
              </span>
            )}
          </div>
        )
      },
    },
    {
      key: 'ref', label: 'Ref',
      render: (l) => {
        const ref = l.$f?.ref
        if (!ref) return <span className="text-text-muted">—</span>
        return (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setThreadId(l.entityId) }}
            className="font-mono text-xs text-text-muted hover:text-primary hover:underline tabular-nums"
            title="Show full request thread"
          >
            #{ref}
          </button>
        )
      },
    },
  ], [showWho, config.where, setThreadId])

  const standardColumns = [
    {
      key: 'when', label: 'When',
      render: (l) => <span className="whitespace-nowrap">{formatDate(l.createdAt)}<span className="block text-xs text-text-muted">{formatTime(l.createdAt)}</span></span>,
    },
    ...(showWho ? [{
      key: 'who', label: 'Who',
      render: (l) => <div className="min-w-[8rem]"><p className="font-medium">{l.actorName ?? '—'}</p>{tab === 'all' && <p className="text-xs text-text-muted">{ROLE_LABELS[l.actorRole] ?? l.actorRole}</p>}</div>,
    }] : []),
    {
      key: 'action', label: 'Action',
      render: (l) => <span className="whitespace-nowrap">{actionLabel(l.action)}</span>,
    },
    ...(config.where ? [{
      key: 'where', label: config.where === 'district' ? 'Where' : 'Facility',
      render: (l) => {
        const parts = config.where === 'district' ? [l.facilityName, l.districtName] : [l.facilityName]
        const text = parts.filter(Boolean).join(' · ')
        return text ? <span className="text-text-muted">{text}</span> : <span className="text-text-muted">—</span>
      },
    }] : []),
    ...(['district_supervisor', 'facility_worker', 'workers'].includes(activeTab.value) ? [] : [
      { key: 'vaccine', label: 'Vaccine', render: (l) => l.$p.vaccine ?? <span className="text-text-muted">—</span> },
      { key: 'vials', label: 'Vials', align: 'right', render: (l) => <Vials p={l.$p} /> },
      { key: 'details', label: 'Details', render: (l) => <Details entry={l} p={l.$p} onRequest={onRequest} /> },
    ]),
  ]

  const columns = isRichView ? richColumns : standardColumns

  // ─── Export ───────────────────────────────────────────────────────────────

  const richExportColumns = [
    { label: 'Timestamp',      value: (l) => `${formatDate(l.createdAt)} ${formatTime(l.createdAt)}` },
    { label: 'Actor',          value: (l) => l.actorName ?? '' },
    { label: 'Role',           value: (l) => ROLE_LABELS[l.actorRole] ?? l.actorRole ?? '' },
    { label: 'Facility',       value: (l) => l.facilityName ?? '' },
    { label: 'District',       value: (l) => l.districtName ?? '' },
    { label: 'Category',       value: (l) => l.$f?.category ?? '' },
    { label: 'Action',         value: (l) => l.$f?.actionLabel ?? actionLabel(l.action) },
    { label: 'Ref',            value: (l) => l.$f?.ref ?? '' },
    { label: 'Worker',         value: (l) => l.$f?.workerName ?? '' },
    { label: 'Vaccine',        value: (l) => l._item?.name ?? l.$f?.vaccineLabel ?? '' },
    { label: 'Quantity',       value: (l) => l._item?.vials ?? '' },
    { label: 'Batch',          value: (l) => l.details?.batchNo ?? '' },
    { label: 'Manufacturer',   value: (l) => l.details?.manufacturer ?? '' },
    { label: 'Expiry',         value: (l) => l.details?.expiryDate ?? '' },
    { label: 'Summary',        value: (l) => l.$f?.summary ?? '' },
    { label: 'Event status',   value: (l) => l.$f?.statusLabel ?? '' },
    { label: 'Current status', value: (l) => l.status ?? '' },
    { label: 'Note',           value: (l) => l.details?.note ?? l.details?.reason ?? '' },
  ]

  const standardExportColumns = [
    { label: 'When',     value: (l) => `${formatDate(l.createdAt)} ${formatTime(l.createdAt)}` },
    { label: 'Who',      value: (l) => l.actorName },
    { label: 'Role',     value: (l) => ROLE_LABELS[l.actorRole] ?? l.actorRole },
    { label: 'Action',   value: (l) => actionLabel(l.action) },
    { label: 'Facility', value: (l) => l.facilityName },
    { label: 'District', value: (l) => l.districtName },
    { label: 'Vaccine',  value: (l) => l.$p.vaccine },
    { label: 'Vials',    value: (l) => l.$p.vials },
    {
      label: 'Details',
      value: (l) => [l.$p.items?.map((it) => `${it.name} ${it.vials}`).join(', '), l.$p.detail, l.$p.warning, l.status ?? l.details?.status].filter(Boolean).join(' · '),
    },
  ]

  // Rich export: expands multi-vaccine rows into one row per vaccine item.
  function richExportRows() {
    const exportCtx = allCtx ?? ctx
    const all = allPagesQ.data?.length ? allPagesQ.data : pageRows
    const expanded = []
    for (const l of all) {
      const $f = formatAuditEntry(l, exportCtx)
      const items = $f.parsed?.items
      if (items?.length > 1) {
        for (const item of items) expanded.push({ ...l, $f, _item: item })
      } else {
        expanded.push({ ...l, $f, _item: items?.[0] ?? { name: $f.vaccineLabel, vials: $f.parsed?.vials } })
      }
    }
    return expanded
  }

  async function standardExportRows() {
    const all = (await getAuditLog(params)).auditLog ?? []
    const exportCtx = buildContext(all, vaccineData?.vaccines, userData?.users)
    return all.map((l) => ({ ...l, $p: parseEntry(l, exportCtx) }))
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div>
      <PageHeader
        breadcrumb={`${ROLE_LABELS[user.role] ?? 'Records'} › Records`}
        title="Audit Log"
        subtitle={SUBTITLE[user.role] ?? 'Everything recorded in the system, newest first'}
      />

      {logQ.isError ? (
        <ErrorState title="Couldn't load the audit log" error={logQ.error} onRetry={logQ.refetch} />
      ) : (
        <div className="flex flex-col gap-4">
          <Tabs
            label="Who did it"
            value={tab}
            onChange={(v) => set({ tab: v, q: '', action: '', from: '', to: '', entityId: '', scope: '', category: '' })}
            tabs={config.tabs.map((t) => ({ value: t.value, label: t.label, count: tabCount(t) }))}
            className="self-start"
          />

          {/* Rich-view: category chips + hide-session toggle */}
          {isRichView && (
            <div className="flex flex-wrap items-center gap-3">
              <FilterChips
                options={CATEGORY_OPTIONS}
                value={url.category}
                onChange={(v) => set({ category: v })}
              />
              <button
                type="button"
                onClick={() => set({ hideSession: url.hideSession === '1' ? '0' : '1' })}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${url.hideSession === '1' ? 'border-surface-border bg-surface-chip text-text-muted' : 'border-primary text-primary'}`}
              >
                {url.hideSession === '1' ? 'Session events hidden' : 'Show session events'}
              </button>
            </div>
          )}

          {/* Attention strip (rich view, populated once full pages load) */}
          {isRichView && (
            <AuditAttentionStrip
              items={attentionItems}
              onFilter={(category) => set({ category })}
            />
          )}

          <div className="flex flex-wrap items-end gap-3">
            <SearchInput
              value={url.q}
              onChange={(e) => set({ q: e.target.value })}
              placeholder="Search name, facility, vaccine…"
              className="sm:w-64"
            />
            {scopeOn && (
              <div className="w-full sm:w-56">
                <Select
                  id="audit-scope"
                  label={config.scope === 'worker' ? 'Vaccinator' : 'Facility'}
                  options={[{ value: '', label: config.scope === 'worker' ? 'All vaccinators' : 'All facilities' }, ...scopeOptions]}
                  value={filters.scope}
                  onChange={(e) => set({ scope: e.target.value })}
                />
              </div>
            )}
            <div className="w-full sm:w-56">
              <Select id="audit-action" label="Action" options={actionOptions} value={filters.action} onChange={(e) => set({ action: e.target.value })} />
            </div>
            <div className="w-[calc(50%-0.375rem)] sm:w-44">
              <DatePicker id="audit-from" label="From" value={filters.from} max={filters.to || undefined} onChange={(e) => set({ from: e.target.value })} />
            </div>
            <div className="w-[calc(50%-0.375rem)] sm:w-44">
              <DatePicker id="audit-to" label="To" value={filters.to} min={filters.from || undefined} onChange={(e) => set({ to: e.target.value })} />
            </div>
            {filters.entityId && (
              <span className="inline-flex items-center gap-1.5 h-9 pl-3 pr-1.5 rounded-control bg-surface-chip text-sm text-text tabular-nums">
                Request #{filters.entityId.slice(0, 8)}
                <button type="button" onClick={() => set({ entityId: '' })} aria-label="Stop filtering by this request" className="p-1 rounded hover:bg-surface text-text-muted hover:text-text">
                  <X size={14} strokeWidth={1.75} />
                </button>
              </span>
            )}
            {(hasFilters || url.category) && (
              <Button variant="ghost" onClick={() => set({ q: '', action: '', from: '', to: '', entityId: '', scope: '', category: '' })}>Clear</Button>
            )}
            <p className="ml-auto text-sm text-text-muted tabular-nums pb-2">
              {logs ? plural(total, 'entry', 'entries') : ''}
              {hiddenCount > 0 && <span className="ml-1 opacity-60">({hiddenCount} session hidden)</span>}
            </p>
            <ExportButton
              name="audit-log"
              columns={isRichView ? richExportColumns : standardExportColumns}
              getRows={isRichView ? richExportRows : standardExportRows}
              disabled={!total}
            />
          </div>

          <Table
            columns={columns}
            rows={isRichView ? visibleRows : parsedRows}
            groups={dayGroups ?? undefined}
            loading={logQ.isLoading}
            rowKey={(l) => l.id ?? `${l.createdAt}-${l.action}-${l.actorId}`}
            emptyMessage={hasFilters || url.category ? 'No entries match these filters.' : 'No activity recorded yet.'}
            onRowClick={isRichView ? toggleExpand : undefined}
            expandedRow={isRichView ? (l) => <ExpandedPanel row={l} /> : undefined}
            isExpanded={isRichView ? isRowExpanded : undefined}
            mobileCard={isRichView
              ? (l) => (
                  <div className="px-4 py-3.5 flex flex-col gap-1.5">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm text-text">{l.$f?.summary ?? actionLabel(l.action)}</p>
                      {l.$f?.storeImpact && (
                        <span className={`flex-shrink-0 tabular-nums font-medium text-sm ${l.$f.storeImpact.sign === '+' ? 'text-success-dark' : 'text-danger-dark'}`}>
                          {l.$f.storeImpact.sign}{l.$f.storeImpact.value}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-text-muted">
                      {formatDate(l.createdAt, { withYear: false })} · {formatTime(l.createdAt)}
                      {showWho && l.actorName ? ` · ${l.actorName}` : ''}
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {l.$f?.statusLabel && (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${TONE_CLASSES[l.$f.statusTone] ?? TONE_CLASSES.neutral}`}>
                          {l.$f.statusLabel}
                        </span>
                      )}
                      {l.$f?.ref && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setThreadId(l.entityId) }}
                          className="font-mono text-xs text-text-muted hover:text-primary"
                        >
                          #{l.$f.ref}
                        </button>
                      )}
                      {l.$f?.flags?.map((flag) => (
                        <span key={flag.type} className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs ${TONE_CLASSES[flag.tone] ?? TONE_CLASSES.neutral}`}>
                          ⚠ {flag.label}
                        </span>
                      ))}
                    </div>
                  </div>
                )
              : (l) => (
                  <div className="px-4 py-3.5 flex flex-col gap-1">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-medium text-text">{actionLabel(l.action)}{l.$p.vaccine && <span className="font-normal text-text-muted"> · {l.$p.vaccine}</span>}</p>
                      {l.$p.vials != null && <Vials p={l.$p} />}
                    </div>
                    <p className="text-xs text-text-muted">
                      {[formatDate(l.createdAt, { withYear: false }) + ' ' + formatTime(l.createdAt), showWho && l.actorName, config.where && l.facilityName].filter(Boolean).join(' · ')}
                    </p>
                    <Details entry={l} p={l.$p} onRequest={onRequest} compact />
                  </div>
                )
            }
          />
          <Pagination currentPage={page} totalPages={totalPages} maxPage={maxPage} onPageChange={goTo} />
        </div>
      )}

      {/* Request thread modal (rich view) */}
      {isRichView && threadId && (
        <RequestThreadModal entityId={threadId} onClose={() => setThreadId(null)} />
      )}
    </div>
  )
}
