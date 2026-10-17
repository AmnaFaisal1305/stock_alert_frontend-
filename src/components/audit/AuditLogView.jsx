// The one Audit Log for every role. Tabs and the optional scope filter (facility / worker)
// come from ROLE_CONFIG; parsing and labels live in lib/auditLog.
import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { getAuditLog, getVaccines, getUsers, getFacilities } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import Select from '../ui/Select'
import DatePicker from '../ui/DatePicker'
import Button from '../ui/Button'
import Tabs from '../ui/Tabs'
import PageHeader from '../shared/PageHeader'
import Table from '../shared/Table'
import Pagination from '../shared/Pagination'
import StatusBadge from '../shared/StatusBadge'
import ErrorState from '../shared/ErrorState'
import { ROLE_LABELS } from '../../lib/navigation'
import { formatDate, formatTime, plural } from '../../lib/format'
import { actionLabel, buildContext, parseEntry, matchesFilters, isRequestEvent } from '../../lib/auditLog'

const PER_PAGE = 15

const roleTab = (role, label) => ({ value: role, label, test: (l) => l.actorRole === role })
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
    tabs: [{ value: 'all', label: 'All', test: () => true }, ...['uc_supervisor', 'facility_head', 'facility_supervisor', 'facility_worker'].map((r) => ROLE_TAB[r])],
    scope: 'facility', where: 'facility',
  },
  uc_supervisor: { tabs: [ROLE_TAB.facility_supervisor, ROLE_TAB.facility_worker], where: 'facility' },
  facility_head: {
    tabs: ['uc_supervisor', 'facility_head', 'facility_supervisor', 'facility_worker'].map((r) => ROLE_TAB[r]),
    defaultTab: 'facility_supervisor',
  },
  facility_supervisor: {
    tabs: [
      { value: 'mine', label: 'My actions', test: (l, user) => l.actorId === user.id, hideWho: true },
      { value: 'workers', label: 'Workers', test: (l) => l.actorRole === 'facility_worker' },
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
  const [tab, setTab] = useState(config.defaultTab ?? config.tabs[0].value)
  const [filters, setFilters] = useState({ action: '', from: '', to: '', entityId: '', scope: '' })
  const [page, setPage] = useState(1)
  const set = (patch) => { setFilters((f) => ({ ...f, ...patch })); setPage(1) }

  const logQ = useQuery({ queryKey: ['audit-log'], queryFn: () => getAuditLog() })
  const { data: vaccineData } = useQuery({ queryKey: ['vaccines'], queryFn: getVaccines })
  const { data: userData } = useQuery({ queryKey: ['users'], queryFn: getUsers, enabled: config.scope === 'worker' })
  const { data: facilityData } = useQuery({ queryKey: ['facilities'], queryFn: getFacilities, enabled: config.scope === 'facility', staleTime: 30_000 })

  const logs = logQ.data?.auditLog
  const ctx = useMemo(
    () => buildContext(logs ?? [], vaccineData?.vaccines, userData?.users),
    [logs, vaccineData, userData],
  )

  const activeTab = config.tabs.find((t) => t.value === tab) ?? config.tabs[0]
  const scopeOn = config.scope && (config.scope === 'worker' ? tab === 'workers' : tab === 'all')
  const scopeOptions = useMemo(() => {
    if (config.scope === 'worker') {
      return (userData?.users ?? []).filter((u) => u.role === 'facility_worker').map((u) => ({ value: u.id, label: ctx.userNameById[u.id] || u.email }))
    }
    if (config.scope === 'facility') return (facilityData?.facilities ?? []).map((f) => ({ value: f.id, label: f.name }))
    return []
  }, [config.scope, userData, facilityData, ctx])

  const tabLogs = useMemo(() => (logs ?? []).filter((l) => activeTab.test(l, user)), [logs, activeTab, user])
  const rows = useMemo(() => {
    const scopeId = scopeOn ? filters.scope : ''
    const facilityName = facilityData?.facilities?.find((x) => x.id === scopeId)?.name
    const inScope = (l) => {
      if (!scopeId) return true
      if (config.scope === 'worker') return l.actorId === scopeId
      return l.facilityId ? l.facilityId === scopeId : l.facilityName === facilityName
    }
    return tabLogs
      .filter((l) => matchesFilters(l, filters) && inScope(l))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  }, [tabLogs, filters, scopeOn, config.scope, facilityData])
  const actionOptions = useMemo(
    () => [{ value: '', label: 'All actions' }, ...[...new Set(tabLogs.map((l) => l.action))].filter(Boolean)
      .map((a) => ({ value: a, label: actionLabel(a) }))
      .sort((a, b) => a.label.localeCompare(b.label))],
    [tabLogs],
  )

  const totalPages = Math.ceil(rows.length / PER_PAGE)
  const pageRows = rows.slice((page - 1) * PER_PAGE, page * PER_PAGE)
  const hasFilters = !!(filters.action || filters.from || filters.to || filters.entityId || filters.scope)
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
            onChange={(v) => { setTab(v); setFilters({ action: '', from: '', to: '', entityId: '', scope: '' }); setPage(1) }}
            tabs={config.tabs.map((t) => ({ value: t.value, label: t.label, count: logs ? logs.filter((l) => t.test(l, user)).length : undefined }))}
            className="self-start"
          />

          <div className="flex flex-wrap items-end gap-3">
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
            {hasFilters && <Button variant="ghost" onClick={() => set({ action: '', from: '', to: '', entityId: '', scope: '' })}>Clear</Button>}
            <p className="ml-auto text-sm text-text-muted tabular-nums pb-2">{logs ? plural(rows.length, 'entry', 'entries') : ''}</p>
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
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
      )}
    </div>
  )
}
