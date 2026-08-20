import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getAuditLog, getVaccines } from '../../lib/api'
import Table from '../../components/shared/Table'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import Button from '../../components/ui/Button'
import { ChevronLeft, ChevronRight, Calendar, Clock, Award, Users } from 'lucide-react'
import { displayVaccineName } from '../../lib/vaccineNames'

const ACTION_LABELS = {
  LOGOUT:        'Logout',
  STOCK_ENTRY:   'Stock Entry',
  ADJUST_STOCK:  'Stock Correction',
}

const TABS = [
  { id: 'facility_supervisor', label: 'Facility Supervisors', icon: Award },
  { id: 'facility_worker',     label: 'Workers',              icon: Users },
]

export default function UCSupervisorAuditLog() {
  const [activeTab, setActiveTab]     = useState('facility_supervisor')
  const [dateFilter, setDateFilter]   = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [currentPage, setCurrentPage] = useState(1)

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
      if (dateFilter && l.createdAt?.split('T')[0] !== dateFilter) return false
      if (actionFilter && l.action !== actionFilter) return false
      return true
    })
  }, [logs, activeTab, dateFilter, actionFilter])

  const itemsPerPage = 10
  const totalPages = Math.ceil(filtered.length / itemsPerPage)
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  const vaccineName = (id) => vaccineNameById[id] ?? (id ? `vaccine ${String(id).slice(0, 8)}…` : '—')

  function formatDetails(row) {
    const d = row.details
    if (!d) return '—'
    switch (row.action) {
      case 'STOCK_ENTRY': {
        const verb = d.entryType === 'used' ? 'used' : d.entryType === 'returned' ? 'returned' : 'received'
        const vialsStr = d.vials != null ? ` (${d.vials} vials)` : ''
        return `${d.quantity ?? d.vials ?? '?'} doses${vialsStr} ${verb} — ${vaccineName(d.vaccineId)}`
      }
      case 'ADJUST_STOCK':
        return `Corrected ${d.delta > 0 ? '+' : ''}${d.delta} (${d.previousBalance} → ${d.newBalance}) — ${vaccineName(d.vaccineId)}`
      default:
        return Object.entries(d).map(([k, v]) => `${k}: ${v}`).join(', ')
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
        <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded bg-slate-50 border border-slate-200 text-text-muted">
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

      <div className="bg-primary rounded-2xl px-6 py-5 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Audit Log</h1>
          <p className="text-sm text-white/70 mt-0.5">Activity in your union councils</p>
        </div>
      </div>

      {!isLoading && !isError && (
        <div className="flex gap-1 p-1 bg-slate-200/50 border border-slate-200/80 rounded-xl w-fit">
          {TABS.map((t) => {
            const Icon = t.icon
            const active = activeTab === t.id
            const count = logs.filter((l) => l.actorRole === t.id).length
            return (
              <button
                key={t.id}
                onClick={() => { setActiveTab(t.id); setCurrentPage(1) }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                  active ? 'bg-white text-primary shadow-sm border border-slate-200' : 'text-text-muted hover:text-text'
                }`}
              >
                <Icon size={13} strokeWidth={2.2} />
                {t.label}
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  active ? 'bg-primary/10 text-primary' : 'bg-white text-text-muted border border-slate-200'
                }`}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-surface-border p-5 shadow-sm flex flex-col gap-4">
        <div className="flex items-center gap-2 text-text-muted">
          <Calendar size={14} className="text-primary" />
          <h2 className="text-xs font-bold uppercase tracking-wider">Filter</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            id="action-filter"
            label="Filter by action"
            placeholder="All Action Types"
            options={Object.entries(ACTION_LABELS).map(([k, v]) => ({ value: k, label: v }))}
            value={actionFilter}
            onChange={(e) => { setActionFilter(e.target.value); setCurrentPage(1) }}
          />
          <Input
            id="date-filter"
            label="Filter by date"
            type="date"
            value={dateFilter}
            onChange={(e) => { setDateFilter(e.target.value); setCurrentPage(1) }}
          />
        </div>
        {(dateFilter || actionFilter) && (
          <div className="flex justify-end border-t border-slate-50 pt-3">
            <button
              onClick={() => { setDateFilter(''); setActionFilter(''); setCurrentPage(1) }}
              className="text-xs text-primary font-bold hover:underline"
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>

      {isLoading && (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-14 bg-slate-50 border border-slate-200 rounded-xl animate-pulse" />)}
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
            emptyMessage={(dateFilter || actionFilter) ? 'No entries match your filters.' : 'No activity recorded yet.'}
          />

          {totalPages > 1 && (
            <div className="flex items-center justify-between bg-white px-5 py-4 rounded-2xl border border-surface-border shadow-sm">
              <p className="text-xs text-text-muted font-semibold hidden sm:block">
                Page <span className="font-extrabold text-text">{currentPage}</span> of{' '}
                <span className="font-extrabold text-text">{totalPages}</span>
              </p>
              <nav className="isolate inline-flex -space-x-px rounded-xl shadow-sm border border-slate-200 bg-slate-50 p-0.5 gap-1">
                <button onClick={() => setCurrentPage(currentPage - 1)} disabled={currentPage === 1}
                  className="relative inline-flex items-center rounded-lg p-1.5 text-text-muted hover:bg-white disabled:opacity-40 cursor-pointer">
                  <ChevronLeft size={16} />
                </button>
                {Array.from({ length: totalPages }).map((_, i) => {
                  const p = i + 1
                  return (
                    <button key={p} onClick={() => setCurrentPage(p)}
                      className={`relative inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-bold cursor-pointer ${p === currentPage ? 'bg-primary text-white' : 'text-text-muted hover:bg-white'}`}>
                      {p}
                    </button>
                  )
                })}
                <button onClick={() => setCurrentPage(currentPage + 1)} disabled={currentPage === totalPages}
                  className="relative inline-flex items-center rounded-lg p-1.5 text-text-muted hover:bg-white disabled:opacity-40 cursor-pointer">
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
