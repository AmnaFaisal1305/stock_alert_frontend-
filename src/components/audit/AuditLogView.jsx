// The one Audit Log for every role. Tabs and the optional scope filter (facility / worker)
// come from ROLE_CONFIG; parsing and labels live in lib/auditLog. Filtering and paging run
// on the server (Round 35): tab badges come from countsByActorRole, pages from nextCursor.
import { useState, useMemo } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { getAuditLog, getVaccines, getUsers, getFacilities } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import Select from '../ui/Select'
import DatePicker from '../ui/DatePicker'
import Button from '../ui/Button'
import Tabs from '../ui/Tabs'
import ExportButton from '../ui/ExportButton'
import { useUrlFilters } from '../../hooks/useUrlState'
import { useDebounce } from '../../hooks/useDebounce'
import PageHeader from '../shared/PageHeader'
import Table from '../shared/Table'
import Pagination from '../shared/Pagination'
import SearchInput from '../shared/SearchInput'
import StatusBadge from '../shared/StatusBadge'
import ErrorState from '../shared/ErrorState'
import { ROLE_LABELS } from '../../lib/navigation'
import { formatDate, formatTime, plural } from '../../lib/format'
import { actionLabel, actionOptionsFor, buildContext, parseEntry, isRequestEvent } from '../../lib/auditLog'

const PER_PAGE = 15

// params: what the tab sends to the API; countKey: its badge in countsByActorRole (none = sum).
const roleTab = (role, label) => ({ value: role, label, params: { actorRole: role }, countKey: role })
const ROLE_TAB = {
  super_admin:         roleTab('super_admin', 'Super admin'),
  district_supervisor: roleTab('district_supervisor', 'District supervisors'),
  uc_supervisor:       roleTab('uc_supervisor', 'UC supervisors'),
  facility_head:       roleTab('facility_head', 'Facility heads'),
  facility_supervisor: roleTab('facility_supervisor', 'Facility supervisors'),
  facility_worker:     roleTab('facility_worker', 'Workers'),
}
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
      { ...roleTab('facility_worker', 'Workers'), value: 'workers' },
    ],
    scope: 'worker',
  },
}

const SUBTITLE = {
  facility_supervisor: 'What you and your workers recorded',
  facility_head: 'Activity at your facility',
  uc_supervisor: 'Activity in your union councils',
  district_supervisor: 'Activity across your district',
}

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

export default function AuditLogView() {
  const { user } = useAuth()
  const config = ROLE_CONFIG[user.role] ?? ROLE_CONFIG.super_admin
  // Tab and filters live in the URL (?tab=&q=&action=&from=&to=&request=&scope=); paging stays local.
  const [url, setUrl] = useUrlFilters({ tab: config.defaultTab ?? config.tabs[0].value, q: '', action: '', from: '', to: '', request: '', scope: '' })
  const tab = url.tab
  const filters = { action: url.action, from: url.from, to: url.to, entityId: url.request, scope: url.scope }
  // Server-side search (Round 36): actor, facility, vaccine, name or email; counted in `total`.
  const q = useDebounce(url.q).trim()
  const [page, setPage] = useState(1)
  // cursors[i] is the `before` value that loads page i + 1; only pages already reached are known.
  const [cursors, setCursors] = useState([null])
  const set = ({ entityId, ...patch }) => {
    setUrl(entityId === undefined ? patch : { ...patch, request: entityId })
    setPage(1)
    setCursors([null])
  }

  const activeTab = config.tabs.find((t) => t.value === tab) ?? config.tabs[0]
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

  const logs = logQ.data?.auditLog
  const ctx = useMemo(
    () => buildContext(logs ?? [], vaccineData?.vaccines, userData?.users),
    [logs, vaccineData, userData],
  )
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
  // Cursor paging: a page is reachable once the page before it has loaded.
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

  const columns = [
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
    { key: 'vaccine', label: 'Vaccine', render: (l) => l.$p.vaccine ?? <span className="text-text-muted">—</span> },
    { key: 'vials', label: 'Vials', align: 'right', render: (l) => <Vials p={l.$p} /> },
    { key: 'details', label: 'Details', render: (l) => <Details entry={l} p={l.$p} onRequest={onRequest} /> },
  ]

  // Parse only the visible page.
  const parsedRows = pageRows.map((l) => ({ ...l, $p: parseEntry(l, ctx) }))

  // Export: the whole filtered set (no limit), parsed with a context built from those rows.
  async function exportRows() {
    const all = (await getAuditLog(params)).auditLog ?? []
    const exportCtx = buildContext(all, vaccineData?.vaccines, userData?.users)
    return all.map((l) => ({ ...l, $p: parseEntry(l, exportCtx) }))
  }
  const exportColumns = [
    { label: 'When', value: (l) => `${formatDate(l.createdAt)} ${formatTime(l.createdAt)}` },
    { label: 'Who', value: (l) => l.actorName },
    { label: 'Role', value: (l) => ROLE_LABELS[l.actorRole] ?? l.actorRole },
    { label: 'Action', value: (l) => actionLabel(l.action) },
    { label: 'Facility', value: (l) => l.facilityName },
    { label: 'District', value: (l) => l.districtName },
    { label: 'Vaccine', value: (l) => l.$p.vaccine },
    { label: 'Vials', value: (l) => l.$p.vials },
    {
      label: 'Details',
      value: (l) => [
        l.$p.items?.map((it) => `${it.name} ${it.vials}`).join(', '),
        l.$p.detail, l.$p.warning, l.status ?? l.details?.status,
      ].filter(Boolean).join(' · '),
    },
  ]

  return (
    <div>
      <PageHeader
        breadcrumb={`${ROLE_LABELS[user.role] ?? 'Records'} › Records`}
        title="Audit Log"
        subtitle={SUBTITLE[user.role] ?? 'Everything recorded in the system, newest first'}
      />

      {logQ.isError ? (
        <ErrorState title="Couldn’t load the audit log" error={logQ.error} onRetry={logQ.refetch} />
      ) : (
        <div className="flex flex-col gap-4">
          <Tabs
            label="Who did it"
            value={tab}
            onChange={(v) => set({ tab: v, action: '', from: '', to: '', entityId: '', scope: '' })}
            tabs={config.tabs.map((t) => ({ value: t.value, label: t.label, count: tabCount(t) }))}
            className="self-start"
          />

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
                  label={config.scope === 'worker' ? 'Worker' : 'Facility'}
                  options={[{ value: '', label: config.scope === 'worker' ? 'All workers' : 'All facilities' }, ...scopeOptions]}
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
            {hasFilters && <Button variant="ghost" onClick={() => set({ q: '', action: '', from: '', to: '', entityId: '', scope: '' })}>Clear</Button>}
            <p className="ml-auto text-sm text-text-muted tabular-nums pb-2">{logs ? plural(total, 'entry', 'entries') : ''}</p>
            <ExportButton name="audit-log" columns={exportColumns} getRows={exportRows} disabled={!total} />
          </div>

          <Table
            columns={columns}
            rows={parsedRows}
            loading={logQ.isLoading}
            rowKey={(l) => l.id ?? `${l.createdAt}-${l.action}-${l.actorId}`}
            emptyMessage={hasFilters ? 'No entries match these filters.' : 'No activity recorded yet.'}
            mobileCard={(l) => (
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
            )}
          />
          <Pagination currentPage={page} totalPages={totalPages} maxPage={maxPage} onPageChange={goTo} />
        </div>
      )}
    </div>
  )
}
