import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../context/AuthContext'
import { getAuditLog, getUsers, getVaccines } from '../../lib/api'
import {
  Clock, Package, Settings, Syringe, Tag,
  UserPlus, UserX, ClipboardList, KeyRound,
  UserCheck, Search, Shield, ArrowUp, ArrowDown, Users,
  RefreshCcw, Trash2, ChevronLeft, ChevronRight, Calendar
} from 'lucide-react'
import Select from '../../components/ui/Select'
import Input from '../../components/ui/Input'
import Button from '../../components/ui/Button'

// ─── Helpers ──────────────────────────────────────────────────────────────────
const AVATAR_COLORS = [
  'bg-teal-500', 'bg-violet-500', 'bg-amber-500',
  'bg-sky-500',  'bg-pink-500',   'bg-emerald-500',
]
function avatarBg(key = '') {
  return AVATAR_COLORS[key ? key.charCodeAt(0) % AVATAR_COLORS.length : 0]
}

function formatFullDate(isoStr) {
  if (!isoStr) return '—'
  return new Date(isoStr).toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
  })
}

const ACTION_META = {
  STOCK_ENTRY:      { label: 'Stock Entry',       pill: 'bg-primary/5 text-primary border-primary/10',      icon: Package  },
  ADJUST_STOCK:     { label: 'Stock Correction',  pill: 'bg-primary/5 text-primary border-primary/10',      icon: RefreshCcw },
  CREATE_VACCINE:   { label: 'Vaccine Added',     pill: 'bg-success-bg text-success-dark border-success/15', icon: Syringe  },
  EDIT_VACCINE:     { label: 'Vaccine Renamed',   pill: 'bg-slate-50 text-text-muted border-slate-200',     icon: Tag      },
  DELETE_VACCINE:   { label: 'Vaccine Deleted',   pill: 'bg-danger-bg text-danger border-danger/15',        icon: Trash2   },
  SET_THRESHOLD:    { label: 'Threshold Updated', pill: 'bg-warning-bg text-warning-dark border-warning/15', icon: Settings },
  CREATE_USER:      { label: 'Worker Added',      pill: 'bg-primary/5 text-primary border-primary/10',      icon: UserPlus },
  ACTIVATE_USER:    { label: 'Worker Activated',  pill: 'bg-success-bg text-success-dark border-success/15', icon: UserCheck },
  DEACTIVATE_USER:  { label: 'Worker Deactivated', pill: 'bg-danger-bg text-danger border-danger/15',       icon: UserX    },
  RESET_PASSWORD:   { label: 'Password Reset',    pill: 'bg-slate-50 text-text-muted border-slate-200',     icon: KeyRound },
}

function parseEntry(action, details, vaccineNameById) {
  if (!details) return { subject: null, quantity: null, qtyType: null }
  const vaccineName = (id) => vaccineNameById?.[id] ?? null
  switch (action) {
    case 'STOCK_ENTRY': {
      const { vaccineId, quantity, entryType } = details
      return {
        subject:  vaccineName(vaccineId),
        quantity: quantity != null ? `${quantity} doses` : null,
        qtyType:  entryType === 'used' ? 'out' : 'in',
      }
    }
    case 'ADJUST_STOCK': {
      const { vaccineId, delta } = details
      return {
        subject:  vaccineName(vaccineId),
        quantity: delta != null ? `${delta > 0 ? '+' : ''}${delta}` : null,
        qtyType:  delta > 0 ? 'in' : delta < 0 ? 'out' : 'neutral',
      }
    }
    case 'SET_THRESHOLD': {
      const { vaccineId, minQuantity } = details
      return {
        subject:  vaccineName(vaccineId),
        quantity: minQuantity != null ? `Min: ${minQuantity}` : null,
        qtyType:  'neutral',
      }
    }
    case 'CREATE_VACCINE':
      return { subject: details.name ?? vaccineName(details.vaccineId), quantity: null, qtyType: null }
    case 'DELETE_VACCINE':
      return { subject: details.name ?? vaccineName(details.vaccineId), quantity: null, qtyType: null }
    case 'EDIT_VACCINE': {
      const { oldName, newName, name, vaccineId } = details
      const resolvedName = newName ?? name ?? vaccineName(vaccineId)
      return {
        subject:  oldName && resolvedName ? `${oldName} → ${resolvedName}` : (resolvedName ?? null),
        quantity: null, qtyType: null,
      }
    }
    case 'CREATE_USER':
      return { subject: details.email ?? null, quantity: null, qtyType: null }
    default: {
      const first = Object.entries(details).find(([k]) => !k.toLowerCase().includes('id'))
      return { subject: first ? String(first[1]) : null, quantity: null, qtyType: null }
    }
  }
}

// ─── Column Headers ───────────────────────────────────────────────────────────
function ColumnHeaders() {
  return (
    <div className="grid grid-cols-[160px_1fr_120px_200px] gap-3 px-5 py-3 bg-slate-50 border-b border-surface-border">
      <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Action</span>
      <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Vaccine / Subject</span>
      <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Doses / Detail</span>
      <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Date &amp; Time</span>
    </div>
  )
}

// ─── Entry Row ────────────────────────────────────────────────────────────────
function EntryRow({ entry, vaccineNameById }) {
  const meta    = ACTION_META[entry.action] ?? { label: entry.action ?? '—', pill: 'bg-slate-50 text-text-muted border-slate-200', icon: ClipboardList }
  const IconCmp = meta.icon
  const { subject, quantity, qtyType } = parseEntry(entry.action, entry.details, vaccineNameById)

  const qtyColor = qtyType === 'in'
    ? 'text-success-dark'
    : qtyType === 'out'
      ? 'text-warning-dark'
      : 'text-text-muted'

  return (
    <div className="grid grid-cols-[160px_1fr_120px_200px] gap-3 items-center px-5 py-3 hover:bg-slate-50/50 transition-colors">
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border w-fit ${meta.pill}`}>
        <IconCmp size={12} strokeWidth={2.2} />
        {meta.label}
      </span>

      <p className="text-sm font-semibold text-text truncate" title={subject ?? undefined}>
        {subject ?? <span className="text-text-muted italic text-xs font-normal">—</span>}
      </p>

      {quantity ? (
        <div className={`flex items-center gap-1 text-xs font-bold ${qtyColor}`}>
          {qtyType === 'in'  && <ArrowUp   size={12} strokeWidth={2.5} />}
          {qtyType === 'out' && <ArrowDown  size={12} strokeWidth={2.5} />}
          {quantity}
        </div>
      ) : (
        <span className="text-xs text-text-muted font-normal">—</span>
      )}

      <div className="flex items-center gap-1.5 text-xs text-text-muted font-medium">
        <Clock size={12} className="flex-shrink-0" />
        <span>{formatFullDate(entry.createdAt)}</span>
      </div>
    </div>
  )
}

// ─── Pagination Component ──────────────────────────────────────────────────────
function Pagination({ currentPage, totalPages, onPageChange }) {
  if (totalPages <= 1) return null

  return (
    <div className="flex items-center justify-between border-t border-slate-100 bg-white px-5 py-4 mt-2">
      <div className="flex flex-1 justify-between sm:hidden">
        <Button
          variant="secondary"
          size="sm"
          disabled={currentPage === 1}
          onClick={() => onPageChange(currentPage - 1)}
        >
          Previous
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(currentPage + 1)}
        >
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
              onClick={() => onPageChange(currentPage - 1)}
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
                  onClick={() => onPageChange(p)}
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
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="relative inline-flex items-center rounded-lg p-1.5 text-text-muted hover:bg-white disabled:opacity-55 disabled:hover:bg-transparent transition-all cursor-pointer"
            >
              <ChevronRight size={16} />
            </button>
          </nav>
        </div>
      </div>
    </div>
  )
}

// ─── Supervisor Tab Content ───────────────────────────────────────────────────
function SupervisorTab({ name, email, entries, vaccineNameById, currentPage, setCurrentPage }) {
  const displayName = name ?? email
  const itemsPerPage = 10
  const totalPages = Math.ceil(entries.length / itemsPerPage)
  const paginatedEntries = entries.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  return (
    <div className="bg-white rounded-2xl border border-surface-border overflow-hidden shadow-sm">
      {/* Header */}
      <div className="px-5 py-4 bg-slate-50 border-b border-surface-border flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-primary text-white flex items-center justify-center text-sm font-bold flex-shrink-0 shadow-sm border border-primary/20">
            {displayName ? displayName[0].toUpperCase() : 'S'}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-text truncate">{displayName ?? '—'}</p>
            <p className="text-[10px] text-primary uppercase tracking-widest font-bold mt-0.5">Facility Supervisor</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-[10px] font-bold text-text-muted bg-white border border-surface-border px-2.5 py-1 rounded-lg">
            {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-lg bg-primary/5 text-primary border border-primary/10">
            <Shield size={10} strokeWidth={2.2} /> Supervisor
          </span>
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-5 py-12 text-text-muted text-center bg-white">
          <ClipboardList size={32} className="opacity-20 flex-shrink-0" />
          <p className="text-sm font-bold text-text">No supervisor actions matched</p>
          <p className="text-xs">Try adjusting your filtration criteria above.</p>
        </div>
      ) : (
        <>
          <ColumnHeaders />
          <div className="divide-y divide-surface-border">
            {paginatedEntries.map((entry, i) => <EntryRow key={i} entry={entry} vaccineNameById={vaccineNameById} />)}
          </div>
          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
        </>
      )}
    </div>
  )
}

// ─── Worker Card (Stateful for Nested Pagination) ──────────────────────────────
function WorkerCard({ worker, entries, vaccineNameById }) {
  const [workerPage, setWorkerPage] = useState(1)
  const workerName = worker.name ?? worker.email
  const itemsPerPage = 5
  const totalPages = Math.ceil(entries.length / itemsPerPage)
  const paginatedEntries = entries.slice((workerPage - 1) * itemsPerPage, workerPage * itemsPerPage)

  return (
    <div className="bg-white rounded-2xl border border-surface-border overflow-hidden shadow-sm">
      {/* Worker header */}
      <div className="px-5 py-4 bg-slate-50 border-b border-surface-border flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-9 h-9 rounded-xl ${avatarBg(workerName)} text-white flex items-center justify-center text-sm font-bold flex-shrink-0 shadow-sm`}>
            {workerName[0].toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-text truncate">{workerName}</p>
            <p className="text-[10px] text-text-muted uppercase tracking-widest font-bold mt-0.5">Facility Worker</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {entries.length > 0 && (
            <span className="text-[10px] font-bold text-text-muted bg-white border border-surface-border px-2.5 py-1 rounded-lg">
              {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
            </span>
          )}
          <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-lg border ${
            worker.isActive
              ? 'bg-success-bg text-success-dark border-success/15'
              : 'bg-white border-surface-border text-text-muted'
          }`}>
            {worker.isActive ? <UserCheck size={10} strokeWidth={2.2} /> : <UserX size={10} strokeWidth={2.2} />}
            {worker.isActive ? 'Active' : 'Inactive'}
          </span>
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="flex items-center gap-3 px-5 py-5 text-text-muted italic text-xs">
          <ClipboardList size={14} className="opacity-30 flex-shrink-0" />
          <span>No activity matched for this worker</span>
        </div>
      ) : (
        <>
          <ColumnHeaders />
          <div className="divide-y divide-surface-border">
            {paginatedEntries.map((entry, i) => <EntryRow key={i} entry={entry} vaccineNameById={vaccineNameById} />)}
          </div>
          <Pagination currentPage={workerPage} totalPages={totalPages} onPageChange={setWorkerPage} />
        </>
      )}
    </div>
  )
}

// ─── Workers Tab Content ──────────────────────────────────────────────────────
function WorkersTab({ workers, workerEntriesFn, search, setSearch, vaccineNameById }) {
  const filteredWorkers = workers.filter((w) =>
    !search || (w.name ?? w.email).toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="flex flex-col gap-4">
      {/* Search */}
      {workers.length > 0 && (
        <div className="relative w-80">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
          <input
            type="text"
            placeholder="Search worker by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-3.5 py-2.5 text-sm border border-surface-border rounded-xl bg-white shadow-sm focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all placeholder:text-text-muted/60"
          />
        </div>
      )}

      {/* No workers */}
      {workers.length === 0 && (
        <div className="text-center py-14 border border-dashed border-surface-border bg-white rounded-2xl text-text-muted shadow-sm">
          <Users size={36} className="mx-auto mb-3 opacity-20" />
          <p className="font-bold text-text">No workers registered</p>
          <p className="text-xs mt-1">Add workers in Worker Management to trace their logs.</p>
        </div>
      )}

      {/* Search empty */}
      {workers.length > 0 && filteredWorkers.length === 0 && (
        <div className="text-center py-10 border border-dashed border-surface-border bg-white rounded-2xl text-text-muted shadow-sm">
          <p className="text-sm font-semibold">No workers match "{search}"</p>
          <button onClick={() => setSearch('')} className="text-xs text-primary font-bold hover:underline mt-1.5">Clear search criteria</button>
        </div>
      )}

      {/* Worker cards */}
      {filteredWorkers.map((worker) => {
        const entries = workerEntriesFn(worker)
        return (
          <WorkerCard
            key={worker.id}
            worker={worker}
            entries={entries}
            vaccineNameById={vaccineNameById}
          />
        )
      })}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function FacilitySupervisorAuditLog() {
  const { user } = useAuth()
  const [tab, setTab]       = useState('supervisor')
  const [search, setSearch] = useState('')

  // Filters State
  const [actionFilter, setActionFilter]       = useState('')
  const [startDateFilter, setStartDateFilter] = useState('')
  const [endDateFilter, setEndDateFilter]     = useState('')
  const [currentPage, setCurrentPage]         = useState(1)

  const { data: userData, isLoading: loadingUsers } = useQuery({ queryKey: ['users'],     queryFn: getUsers    })
  const { data: logData,  isLoading: loadingLog, isError } = useQuery({ queryKey: ['audit-log'], queryFn: getAuditLog })
  const { data: vaccineData } = useQuery({ queryKey: ['vaccines'], queryFn: getVaccines })

  const workers = (userData?.users ?? []).filter((u) => u.role === 'facility_worker')
  const logs    = logData?.auditLog ?? []
  const vaccineNameById = Object.fromEntries((vaccineData?.vaccines ?? []).map((v) => [v.id, v.name]))

  // Filtration logic helper
  const filterEntries = (entriesList) => {
    return entriesList.filter((entry) => {
      // 1. Action filter
      if (actionFilter && entry.action !== actionFilter) return false
      
      // 2. Date filter (compare date portions ignoring timezone time)
      if (startDateFilter) {
        const entryTime = new Date(entry.createdAt).setHours(0,0,0,0)
        const startTime = new Date(startDateFilter).setHours(0,0,0,0)
        if (entryTime < startTime) return false
      }
      if (endDateFilter) {
        const entryTime = new Date(entry.createdAt).setHours(23,59,59,999)
        const endTime = new Date(endDateFilter).setHours(23,59,59,999)
        if (entryTime > endTime) return false
      }
      return true
    })
  }

  const logsByActorId = {}
  logs.forEach((log) => {
    if (!logsByActorId[log.actorId]) logsByActorId[log.actorId] = []
    logsByActorId[log.actorId].push(log)
  })

  const rawSupervisorEntries = logsByActorId[user?.id] ?? []
  const filteredSupervisorEntries = filterEntries(rawSupervisorEntries)

  function getFilteredWorkerEntries(worker) {
    const entries = logsByActorId[worker.id] ?? []
    return filterEntries(entries)
  }

  const workerTotal = workers.reduce((sum, w) => sum + getFilteredWorkerEntries(w).length, 0)
  const isLoading   = loadingUsers || loadingLog

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto">
      
      {/* Page header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-text tracking-tight">Audit Log History</h1>
          <p className="text-sm text-text-muted mt-0.5">Audit actions logged by you and vaccine doses logged by clinical workers</p>
        </div>
      </div>

      {/* Filter Options Panel */}
      <div className="bg-white rounded-2xl border border-surface-border p-5 shadow-sm flex flex-col gap-4">
        <div className="flex items-center gap-2 text-text-muted">
          <Calendar size={14} className="text-primary" />
          <h2 className="text-xs font-bold uppercase tracking-wider">Filter logs catalog</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Select
            id="action-filter"
            label="Action Type"
            placeholder="All Actions"
            options={[
              { value: 'STOCK_ENTRY', label: 'Stock Entry' },
              { value: 'ADJUST_STOCK', label: 'Stock Correction' },
              { value: 'CREATE_VACCINE', label: 'Vaccine Added' },
              { value: 'EDIT_VACCINE', label: 'Vaccine Renamed' },
              { value: 'DELETE_VACCINE', label: 'Vaccine Deleted' },
              { value: 'SET_THRESHOLD', label: 'Threshold Updated' },
              { value: 'CREATE_USER', label: 'Worker Added' },
              { value: 'ACTIVATE_USER', label: 'Worker Activated' },
              { value: 'DEACTIVATE_USER', label: 'Worker Deactivated' },
              { value: 'RESET_PASSWORD', label: 'Password Reset' },
            ]}
            value={actionFilter}
            onChange={(e) => { setActionFilter(e.target.value); setCurrentPage(1) }}
          />

          <Input
            id="start-date"
            label="Start Date"
            type="date"
            value={startDateFilter}
            onChange={(e) => { setStartDateFilter(e.target.value); setCurrentPage(1) }}
          />

          <Input
            id="end-date"
            label="End Date"
            type="date"
            value={endDateFilter}
            onChange={(e) => { setEndDateFilter(e.target.value); setCurrentPage(1) }}
          />
        </div>

        {(actionFilter || startDateFilter || endDateFilter) && (
          <div className="flex justify-end border-t border-slate-50 pt-3">
            <button
              type="button"
              onClick={() => {
                setActionFilter('')
                setStartDateFilter('')
                setEndDateFilter('')
                setCurrentPage(1)
              }}
              className="text-xs text-primary font-bold hover:underline transition-all"
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 p-1 bg-slate-200/50 border border-slate-200/80 rounded-xl w-fit">
        <button
          onClick={() => { setTab('supervisor'); setCurrentPage(1) }}
          className={`flex items-center gap-2 px-4.5 py-2 rounded-lg text-sm font-semibold transition-all ${
            tab === 'supervisor'
              ? 'bg-white text-primary shadow-sm border border-slate-200'
              : 'text-text-muted hover:text-text'
          }`}
        >
          <Shield size={13} strokeWidth={2.2} />
          Supervisor Actions
          {!isLoading && (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
              tab === 'supervisor' ? 'bg-primary/10 text-primary' : 'bg-white text-text-muted border border-slate-200'
            }`}>
              {filteredSupervisorEntries.length}
            </span>
          )}
        </button>
        <button
          onClick={() => { setTab('workers'); setSearch('') }}
          className={`flex items-center gap-2 px-4.5 py-2 rounded-lg text-sm font-semibold transition-all ${
            tab === 'workers'
              ? 'bg-white text-primary shadow-sm border border-slate-200'
              : 'text-text-muted hover:text-text'
          }`}
        >
          <Users size={13} strokeWidth={2.2} />
          Worker Entries
          {!isLoading && (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
              tab === 'workers' ? 'bg-primary/10 text-primary' : 'bg-white text-text-muted border border-slate-200'
            }`}>
              {workerTotal}
            </span>
          )}
        </button>
      </div>

      {/* Skeleton */}
      {isLoading && (
        <div className="flex flex-col gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-surface-border p-5 animate-pulse shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-xl bg-slate-100" />
                <div className="h-4 bg-slate-100 rounded w-48" />
              </div>
              <div className="h-3 bg-slate-100 rounded w-full mt-2" />
              <div className="h-3 bg-slate-100 rounded w-3/4 mt-2" />
            </div>
          ))}
        </div>
      )}

      {isError && (
        <div className="bg-danger-bg border border-danger/10 text-xs font-semibold text-danger rounded-xl px-4 py-3">
          Failed to load audit logs. Please try refreshing.
        </div>
      )}

      {/* Tab content */}
      {!isLoading && !isError && (
        <div className="animate-in fade-in duration-200">
          {tab === 'supervisor' && (
            <SupervisorTab
              name={user?.name}
              email={user?.email}
              entries={filteredSupervisorEntries}
              vaccineNameById={vaccineNameById}
              currentPage={currentPage}
              setCurrentPage={setCurrentPage}
            />
          )}
          {tab === 'workers' && (
            <WorkersTab
              workers={workers}
              workerEntriesFn={getFilteredWorkerEntries}
              search={search}
              setSearch={setSearch}
              vaccineNameById={vaccineNameById}
            />
          )}
        </div>
      )}
    </div>
  )
}
