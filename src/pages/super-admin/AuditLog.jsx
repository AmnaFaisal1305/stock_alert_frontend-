import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getAuditLog, getVaccines } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import Table from '../../components/shared/Table'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import Button from '../../components/ui/Button'
import { ChevronLeft, ChevronRight, Calendar, Shield, Clock, Users, ShieldAlert, Award } from 'lucide-react'

function humanizeKey(key) {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())
}

const ACTION_LABELS = {
  STOCK_ENTRY: 'Stock Entry',
  ADJUST_STOCK: 'Stock Correction',
  SET_THRESHOLD: 'Threshold Set',
  CREATE_VACCINE: 'Vaccine Added',
  DELETE_VACCINE: 'Vaccine Deleted',
  EDIT_VACCINE: 'Vaccine Renamed',
  CREATE_USER: 'User Created',
  ACTIVATE_USER: 'User Activated',
  DEACTIVATE_USER: 'User Deactivated',
  RESET_PASSWORD: 'Password Reset',
  CREATE_DISTRICT: 'District Created',
  EDIT_DISTRICT: 'District Renamed',
  DEACTIVATE_DISTRICT: 'District Deactivated',
  ACTIVATE_DISTRICT: 'District Activated',
  CREATE_FACILITY: 'Facility Created',
  EDIT_FACILITY: 'Facility Renamed',
  DEACTIVATE_FACILITY: 'Facility Deactivated',
  ACTIVATE_FACILITY: 'Facility Activated',
}

function formatDetails(row, vaccineNameById) {
  const d = row.details
  if (!d) return '—'

  const vaccineName = (id) => vaccineNameById[id] ?? (id ? `vaccine ${String(id).slice(0, 8)}…` : 'unknown vaccine')

  switch (row.action) {
    case 'STOCK_ENTRY': {
      const verb = d.entryType === 'used' ? 'used' : d.entryType === 'legacy' ? 'recorded (legacy)' : 'received'
      return `${d.quantity} doses ${verb} — ${vaccineName(d.vaccineId)}`
    }
    case 'ADJUST_STOCK':
      return `Stock corrected ${d.delta > 0 ? '+' : ''}${d.delta} (${d.previousBalance} → ${d.newBalance}) — ${vaccineName(d.vaccineId)}`
    case 'SET_THRESHOLD':
      return `Minimum set to ${d.minQuantity} — ${vaccineName(d.vaccineId)}`
    case 'CREATE_VACCINE':
      return `Added "${d.name ?? vaccineName(d.vaccineId)}"`
    case 'DELETE_VACCINE':
      return `Deleted "${d.name ?? vaccineName(d.vaccineId)}"`
    case 'EDIT_VACCINE': {
      const newName = d.newName ?? d.name ?? vaccineName(d.vaccineId)
      return d.oldName ? `Renamed "${d.oldName}" → "${newName}"` : `Renamed to "${newName}"`
    }
    case 'CREATE_USER':
      return `${(d.role ?? '').replace(/_/g, ' ')} — ${d.email}`
    case 'CREATE_DISTRICT':
    case 'EDIT_DISTRICT':
    case 'DEACTIVATE_DISTRICT':
    case 'ACTIVATE_DISTRICT':
    case 'CREATE_FACILITY':
    case 'EDIT_FACILITY':
    case 'DEACTIVATE_FACILITY':
    case 'ACTIVATE_FACILITY':
      return `"${d.name}"`
    default:
      return Object.entries(d).map(([k, v]) => `${humanizeKey(k)}: ${v}`).join(', ')
  }
}

export default function AuditLog({ title = 'Audit Log', subtitle = 'System-wide activity history' }) {
  const { user } = useAuth()
  
  const isDistrictSup = user?.role === 'district_supervisor'
  const defaultTab = isDistrictSup ? 'district_supervisor' : 'super_admin'
  
  const [activeTab, setActiveTab] = useState(defaultTab)
  const [dateFilter, setDateFilter]     = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [currentPage, setCurrentPage]   = useState(1)

  // Auto set tab on mount/role changes
  useEffect(() => {
    setActiveTab(isDistrictSup ? 'district_supervisor' : 'super_admin')
    setCurrentPage(1)
  }, [user?.role])

  const { data, isLoading, isError } = useQuery({
    queryKey: ['audit-log'],
    queryFn: getAuditLog,
  })
  const { data: vaccineData } = useQuery({ queryKey: ['vaccines'], queryFn: getVaccines })
  const vaccineNameById = Object.fromEntries((vaccineData?.vaccines ?? []).map((v) => [v.id, v.name]))

  const logs = data?.auditLog ?? []
  const hasFilters = !!(dateFilter || actionFilter)

  // Tabs configuration
  const tabs = isDistrictSup
    ? [
        { id: 'district_supervisor', label: 'District Supervisor', icon: Shield },
        { id: 'facility_supervisor', label: 'Facility Supervisors', icon: Award },
        { id: 'facility_worker', label: 'Workers', icon: Users },
      ]
    : [
        { id: 'super_admin', label: 'Super Admin', icon: ShieldAlert },
        { id: 'district_supervisor', label: 'District Supervisors', icon: Shield },
        { id: 'facility_supervisor', label: 'Facility Supervisors', icon: Award },
        { id: 'facility_worker', label: 'Workers', icon: Users },
      ]

  // Filter logs by active tab role type
  const tabLogs = logs.filter((l) => l.actorRole === activeTab)

  // Apply Action & Date filters
  const filtered = tabLogs.filter((l) => {
    if (dateFilter) {
      const lDate = l.createdAt?.split('T')[0]
      if (lDate !== dateFilter) return false
    }
    if (actionFilter && l.action !== actionFilter) return false
    return true
  })

  // Pagination bounds
  const itemsPerPage = 10
  const totalPages = Math.ceil(filtered.length / itemsPerPage)
  const paginatedRows = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  const columns = [
    {
      key: 'createdAt',
      label: 'Date & Time',
      render: (row) => (
        <div className="flex items-center gap-1.5 text-xs text-text font-semibold">
          <Clock size={12} className="text-text-muted flex-shrink-0" />
          <span>
            {new Date(row.createdAt).toLocaleString('en-US', {
              month: 'short', day: 'numeric', year: 'numeric',
              hour: 'numeric', minute: '2-digit', hour12: true,
            })}
          </span>
        </div>
      )
    },
    {
      key: 'actor',
      label: 'Actor',
      render: (row) => (
        <div className="flex flex-col min-w-[120px]">
          <span className="text-sm text-text font-bold">{row.actorName ?? '—'}</span>
          <span className="text-[9px] text-text-muted font-bold tracking-wider mt-0.5">{row.actorEmail}</span>
        </div>
      )
    },
    {
      key: 'action',
      label: 'Action',
      render: (row) => {
        const actionText = ACTION_LABELS[row.action] ?? row.action
        return (
          <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded bg-slate-50 border border-slate-200 text-text-muted">
            {actionText}
          </span>
        )
      }
    },
    { key: 'entityType',  label: 'Category', render: (row) => <span className="text-xs font-semibold text-text">{row.entityType}</span> },
    // Conditionally include District column if user is NOT a district supervisor
    ...(!isDistrictSup ? [{
      key: 'districtName',
      label: 'District',
      render: (row) => <span className="text-xs font-medium text-text-muted truncate max-w-[110px] inline-block">{row.districtName ?? '—'}</span>
    }] : []),
    { key: 'facilityName', label: 'Facility', render: (row) => <span className="text-xs font-medium text-text-muted truncate max-w-[110px] inline-block">{row.facilityName ?? '—'}</span> },
    {
      key: 'details',
      label: 'Details & Values',
      render: (row) => (
        <p className="text-xs text-text-muted font-medium max-w-[340px] truncate leading-normal" title={formatDetails(row, vaccineNameById)}>
          {formatDetails(row, vaccineNameById)}
        </p>
      )
    },
  ]

  // Tab counters for display badge
  const getCount = (tabId) => {
    return logs.filter((l) => l.actorRole === tabId).length
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-200">
      <div>
        <h1 className="text-xl font-bold text-text tracking-tight">{title}</h1>
        <p className="text-sm text-text-muted mt-0.5">{subtitle}</p>
      </div>

      {/* Tabs list */}
      {!isLoading && !isError && (
        <div className="flex gap-1 p-1 bg-slate-200/50 border border-slate-200/80 rounded-xl w-fit flex-wrap">
          {tabs.map((t) => {
            const Icon = t.icon
            const active = activeTab === t.id
            const count = getCount(t.id)
            return (
              <button
                key={t.id}
                onClick={() => { setActiveTab(t.id); setCurrentPage(1) }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                  active
                    ? 'bg-white text-primary shadow-sm border border-slate-200'
                    : 'text-text-muted hover:text-text'
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

      {/* Filter panel */}
      <div className="bg-white rounded-2xl border border-surface-border p-5 shadow-sm flex flex-col gap-4">
        <div className="flex items-center gap-2 text-text-muted">
          <Calendar size={14} className="text-primary" />
          <h2 className="text-xs font-bold uppercase tracking-wider">Filter tab logs</h2>
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

        {hasFilters && (
          <div className="flex justify-end border-t border-slate-50 pt-3">
            <button
              onClick={() => {
                setDateFilter('')
                setActionFilter('')
                setCurrentPage(1)
              }}
              className="text-xs text-primary font-bold hover:underline transition-all"
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
          Failed to load audit logs. Please try refreshing.
        </div>
      )}

      {!isLoading && !isError && (
        <div className="flex flex-col gap-3">
          <Table
            columns={columns}
            rows={paginatedRows}
            emptyMessage={hasFilters ? 'No log entries match your filters.' : 'No activity recorded yet.'}
          />

          {/* Pagination bar */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-100 bg-white px-5 py-4 mt-2 rounded-2xl border border-surface-border shadow-sm">
              <div className="flex flex-1 justify-between sm:hidden">
                <Button variant="secondary" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage(currentPage - 1)}>
                  Previous
                </Button>
                <Button variant="secondary" size="sm" disabled={currentPage === totalPages} onClick={() => setCurrentPage(currentPage + 1)}>
                  Next
                </Button>
              </div>
              <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs text-text-muted font-semibold">
                    Page <span className="font-extrabold text-text">{currentPage}</span> of{' '}
                    <span className="font-extrabold text-text">{totalPages}</span>
                  </p>
                </div>
                <div>
                  <nav className="isolate inline-flex -space-x-px rounded-xl shadow-sm border border-slate-200 bg-slate-50 p-0.5 gap-1" aria-label="Pagination">
                    <button
                      onClick={() => setCurrentPage(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center rounded-lg p-1.5 text-text-muted hover:bg-white disabled:opacity-55 disabled:hover:bg-transparent transition-all cursor-pointer"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    {Array.from({ length: totalPages }).map((_, i) => {
                      const p = i + 1
                      return (
                        <button
                          key={p}
                          onClick={() => setCurrentPage(p)}
                          className={`relative inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                            p === currentPage
                              ? 'bg-primary text-white shadow-sm shadow-primary/10'
                              : 'text-text-muted hover:bg-white'
                          }`}
                        >
                          {p}
                        </button>
                      )
                    })}
                    <button
                      onClick={() => setCurrentPage(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="relative inline-flex items-center rounded-lg p-1.5 text-text-muted hover:bg-white disabled:opacity-55 disabled:hover:bg-transparent transition-all cursor-pointer"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
