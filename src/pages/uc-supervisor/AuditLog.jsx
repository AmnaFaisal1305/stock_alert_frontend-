import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getAuditLog, getVaccines } from '../../lib/api'
import Table from '../../components/shared/Table'
import DatePicker from '../../components/ui/DatePicker'
import Button from '../../components/ui/Button'
import PageHeader from '../../components/shared/PageHeader'
import { ChevronLeft, ChevronRight, Clock, Award, Users } from 'lucide-react'
import { displayVaccineName } from '../../lib/vaccineNames'

const ACTION_LABELS = {
  LOGOUT:                    'Logout',
  STOCK_ENTRY:               'Stock Entry',
  ADJUST_STOCK:              'Stock Correction',
  STOCK_ASSIGN:              'Vials Assigned',
  STOCK_DAY_END:             'Day End Recorded',
  STOCK_REQUEST_CREATE:      'Stock Requested',
  STOCK_REQUEST_SENT:        'Request Sent',
  STOCK_REQUEST_RECEIVED:    'Stock Received',
  STOCK_REQUEST_APPROVE:     'Request Approved',
  STOCK_REQUEST_CANCEL:      'Request Cancelled',
  STOCK_REQUEST_CLOSE_SHORT: 'Request Closed Short',
  STOCK_REQUEST_DECLINE:     'Request Declined',
}

const TABS = [
  { id: 'facility_supervisor', label: 'Facility Supervisors', icon: Award },
  { id: 'facility_worker',     label: 'Workers',              icon: Users },
]

export default function UCSupervisorAuditLog() {
  const [activeTab, setActiveTab]       = useState('facility_supervisor')
  const [dateFrom, setDateFrom]         = useState('')
  const [dateTo, setDateTo]             = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [currentPage, setCurrentPage]   = useState(1)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['audit-log'],
    queryFn: getAuditLog,
  })
  const { data: vaccineData } = useQuery({ queryKey: ['vaccines'], queryFn: getVaccines })

  const vaccineNameById = useMemo(
    () => Object.fromEntries((vaccineData?.vaccines ?? []).map((v) => [v.id, displayVaccineName(v.name)])),
    [vaccineData]
  )

  const logs = data?.auditLog ?? []

  const filtered = useMemo(() => {
    return logs.filter((l) => {
      if (l.actorRole !== activeTab) return false
      if (dateFrom && l.createdAt?.split('T')[0] < dateFrom) return false
      if (dateTo   && l.createdAt?.split('T')[0] > dateTo)   return false
      if (actionFilter && l.action !== actionFilter) return false
      return true
    })
  }, [logs, activeTab, dateFrom, dateTo, actionFilter])

  const itemsPerPage = 10
  const totalPages = Math.ceil(filtered.length / itemsPerPage)
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  const vaccineName = (id) => vaccineNameById[id] ?? (id ? `vaccine ${String(id).slice(0, 8)}…` : '—')

  function formatDetails(row) {
    const d = row.details
    if (!d) return '—'
    switch (row.action) {
      case 'STOCK_ENTRY': {
        const verb = d.entryType === 'used' ? 'used' : d.entryType === 'returned' ? 'returned' : d.entryType === 'opening' ? 'opening balance' : 'received'
        const vialsStr = d.vials != null ? ` (${d.vials} vials)` : ''
        return `${d.quantity ?? d.vials ?? '?'} doses${vialsStr} ${verb} — ${vaccineName(d.vaccineId)}`
      }
      case 'ADJUST_STOCK':
        return `Corrected ${d.delta > 0 ? '+' : ''}${d.delta} (${d.previousBalance} → ${d.newBalance}) — ${vaccineName(d.vaccineId)}`
      case 'STOCK_ASSIGN': {
        const items = d.items ?? []
        return `${items.length} vaccine${items.length !== 1 ? 's' : ''} assigned to ${d.workerEmail ?? d.workerId ?? 'worker'}`
      }
      case 'STOCK_DAY_END': {
        const items = d.items ?? []
        return `Day-end recorded for ${items.length} vaccine${items.length !== 1 ? 's' : ''} — ${d.workerEmail ?? d.workerId ?? 'worker'}`
      }
      default:
        return Object.entries(d)
          .map(([k, v]) => `${k}: ${v && typeof v === 'object' ? JSON.stringify(v) : v}`)
          .join(', ')
    }
  }

  const columns = [
    {
      key: 'createdAt',
      label: 'Date & Time',
      render: (row) => (
        <div className="flex items-center gap-1.5 text-xs text-text font-semibold">
          <Clock size={12} className="text-text-muted flex-shrink-0" />
          {new Date(row.createdAt).toLocaleString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric',
            hour: 'numeric', minute: '2-digit', hour12: true,
          })}
        </div>
      )
    },
    {
      key: 'actor',
      label: 'Actor',
      render: (row) => (
        <div>
          <p className="text-sm font-bold text-text">{row.actorName ?? '—'}</p>
          <p className="text-[9px] font-bold text-text-muted tracking-wider mt-0.5">
            {row.actorRole?.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
          </p>
        </div>
      )
    },
    {
      key: 'action',
      label: 'Action',
      render: (row) => (
        <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded bg-surface-alt border border-surface-border text-text-muted">
          {ACTION_LABELS[row.action] ?? row.action}
        </span>
      )
    },
    { key: 'facilityName', label: 'Facility', render: (row) => <span className="text-xs font-medium text-text-muted">{row.facilityName ?? '—'}</span> },
    {
      key: 'details',
      label: 'Details',
      render: (row) => (
        <p className="text-xs text-text-muted font-medium max-w-[320px] truncate" title={formatDetails(row)}>
          {formatDetails(row)}
        </p>
      )
    },
  ]

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-200">

      <PageHeader
        breadcrumb="UC Supervisor"
        title="Audit Log"
        subtitle="Activity in your union councils"
      />

      {!isLoading && !isError && (
        <div className="flex gap-1 p-1 bg-surface-chip border border-surface-border rounded-xl w-fit">
          {TABS.map((t) => {
            const Icon = t.icon
            const active = activeTab === t.id
            const count = logs.filter((l) => l.actorRole === t.id).length
            return (
              <button
                key={t.id}
                onClick={() => { setActiveTab(t.id); setCurrentPage(1) }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                  active ? 'bg-surface text-primary shadow-sm border border-surface-border' : 'text-text-muted hover:text-text'
                }`}
              >
                <Icon size={13} strokeWidth={2.2} />
                {t.label}
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  active ? 'bg-primary/10 text-primary' : 'bg-surface-chip text-text-muted border border-surface-border'
                }`}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      )}

      <div className="bg-surface rounded-2xl border border-surface-border px-4 py-3 shadow-sm flex flex-wrap items-center gap-3">
        <select
          value={actionFilter}
          onChange={(e) => { setActionFilter(e.target.value); setCurrentPage(1) }}
          className="bg-surface border border-surface-border rounded-xl px-3 py-2 text-sm text-text font-medium focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer"
        >
          <option value="">All action types</option>
          {Object.entries(ACTION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-text-muted">From</span>
          <DatePicker id="date-from" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setCurrentPage(1) }} />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-text-muted">To</span>
          <DatePicker id="date-to" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setCurrentPage(1) }} />
        </div>

        {(dateFrom || dateTo || actionFilter) && (
          <Button variant="secondary" size="sm" onClick={() => { setDateFrom(''); setDateTo(''); setActionFilter(''); setCurrentPage(1) }}>
            Clear
          </Button>
        )}

        <span className="ml-auto text-xs font-bold text-text-muted tabular-nums">
          {filtered.length} {filtered.length === 1 ? 'entry' : 'entries'}
        </span>
      </div>

      {isLoading && (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-14 bg-surface-alt border border-surface-border rounded-xl animate-pulse" />)}
        </div>
      )}

      {isError && (
        <div className="bg-danger-bg border border-danger/10 text-xs font-semibold text-danger rounded-xl px-4 py-3">
          Failed to load audit logs.
        </div>
      )}

      {!isLoading && !isError && (
        <div className="flex flex-col gap-3">
          <Table
            columns={columns}
            rows={paginated}
            emptyMessage={(dateFrom || dateTo || actionFilter) ? 'No entries match your filters.' : 'No activity recorded yet.'}
            mobileCard={(row) => (
              <div className="px-4 py-3 hover:bg-surface-alt/50 transition-colors">
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded bg-surface-alt border border-surface-border text-text-muted">
                    {ACTION_LABELS[row.action] ?? row.action}
                  </span>
                  <div className="flex items-center gap-1 text-[10px] text-text-muted flex-shrink-0">
                    <Clock size={10} />
                    <span>{new Date(row.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}</span>
                  </div>
                </div>
                <p className="font-bold text-sm text-text">{row.actorName ?? '—'}</p>
                {row.facilityName && <p className="text-xs text-text-muted">{row.facilityName}</p>}
                <p className="text-xs text-text-muted mt-0.5 font-medium">{formatDetails(row)}</p>
              </div>
            )}
          />

          {totalPages > 1 && (
            <div className="flex items-center justify-between bg-surface px-5 py-4 rounded-2xl border border-surface-border shadow-sm">
              <p className="text-xs text-text-muted font-semibold hidden sm:block">
                Page <span className="font-extrabold text-text">{currentPage}</span> of{' '}
                <span className="font-extrabold text-text">{totalPages}</span>
              </p>
              <nav className="isolate inline-flex -space-x-px rounded-xl shadow-sm border border-surface-border bg-surface-chip p-0.5 gap-1">
                <button onClick={() => setCurrentPage(currentPage - 1)} disabled={currentPage === 1}
                  className="relative inline-flex items-center rounded-lg p-1.5 text-text-muted hover:bg-surface disabled:opacity-40 cursor-pointer">
                  <ChevronLeft size={16} />
                </button>
                {Array.from({ length: totalPages }).map((_, i) => {
                  const p = i + 1
                  return (
                    <button key={p} onClick={() => setCurrentPage(p)}
                      className={`relative inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-bold cursor-pointer ${p === currentPage ? 'bg-primary text-white' : 'text-text-muted hover:bg-surface'}`}>
                      {p}
                    </button>
                  )
                })}
                <button onClick={() => setCurrentPage(currentPage + 1)} disabled={currentPage === totalPages}
                  className="relative inline-flex items-center rounded-lg p-1.5 text-text-muted hover:bg-surface disabled:opacity-40 cursor-pointer">
                  <ChevronRight size={16} />
                </button>
              </nav>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
