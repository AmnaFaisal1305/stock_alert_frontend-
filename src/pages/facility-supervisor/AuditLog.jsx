import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../context/AuthContext'
import { getAuditLog, getUsers, getVaccines } from '../../lib/api'
import {
  Clock, Package, Settings, Syringe, Tag,
  UserPlus, UserX, ClipboardList, KeyRound,
  UserCheck, Search, Shield, ArrowUp, ArrowDown, Users,
  RefreshCcw, Trash2, ChevronLeft, ChevronRight,
  CheckCircle2, XCircle, Send,
} from 'lucide-react'
import Select from '../../components/ui/Select'
import DatePicker from '../../components/ui/DatePicker'
import { displayVaccineName } from '../../lib/vaccineNames'

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
  STOCK_ENTRY:            { label: 'Stock Entry',         pill: 'bg-primary/5 text-primary border-primary/10',       icon: Package      },
  ADJUST_STOCK:           { label: 'Stock Correction',    pill: 'bg-primary/5 text-primary border-primary/10',       icon: RefreshCcw   },
  LOGOUT:                 { label: 'Logout',              pill: 'bg-slate-50 text-text-muted border-slate-200',      icon: KeyRound     },
  CREATE_VACCINE:         { label: 'Vaccine Added',       pill: 'bg-success-bg text-success-dark border-success/15', icon: Syringe      },
  EDIT_VACCINE:           { label: 'Vaccine Renamed',     pill: 'bg-slate-50 text-text-muted border-slate-200',      icon: Tag          },
  DELETE_VACCINE:         { label: 'Vaccine Deleted',     pill: 'bg-danger-bg text-danger border-danger/15',         icon: Trash2       },
  SET_THRESHOLD:          { label: 'Threshold Updated',   pill: 'bg-warning-bg text-warning-dark border-warning/15', icon: Settings     },
  CREATE_USER:            { label: 'Worker Added',        pill: 'bg-primary/5 text-primary border-primary/10',       icon: UserPlus     },
  ACTIVATE_USER:          { label: 'Worker Activated',    pill: 'bg-success-bg text-success-dark border-success/15', icon: UserCheck    },
  DEACTIVATE_USER:        { label: 'Worker Deactivated',  pill: 'bg-danger-bg text-danger border-danger/15',         icon: UserX        },
  RESET_PASSWORD:         { label: 'Password Reset',      pill: 'bg-slate-50 text-text-muted border-slate-200',      icon: KeyRound     },
  STOCK_REQUEST_CREATE:   { label: 'Stock Requested',     pill: 'bg-primary/5 text-primary border-primary/10',       icon: ClipboardList },
  STOCK_REQUEST_SENT:     { label: 'Request Sent',        pill: 'bg-primary/5 text-primary border-primary/10',       icon: Send         },
  STOCK_REQUEST_RECEIVED: { label: 'Request Received',    pill: 'bg-success-bg text-success-dark border-success/15', icon: Package      },
  STOCK_REQUEST_APPROVE:  { label: 'Request Approved',    pill: 'bg-success-bg text-success-dark border-success/15', icon: CheckCircle2 },
  STOCK_REQUEST_CANCEL:   { label: 'Request Cancelled',   pill: 'bg-slate-50 text-text-muted border-slate-200',      icon: XCircle      },
  STOCK_REQUEST_DECLINE:  { label: 'Request Declined',    pill: 'bg-danger-bg text-danger border-danger/15',         icon: XCircle      },
  APPROVAL_REQUEST:       { label: 'Approval Requested',  pill: 'bg-primary/5 text-primary border-primary/10',       icon: ClipboardList },
  APPROVAL_APPROVE:       { label: 'Approval Approved',   pill: 'bg-success-bg text-success-dark border-success/15', icon: CheckCircle2 },
  APPROVAL_DECLINE:       { label: 'Approval Declined',   pill: 'bg-danger-bg text-danger border-danger/15',         icon: XCircle      },
  APPROVAL_CANCEL:        { label: 'Approval Cancelled',  pill: 'bg-slate-50 text-text-muted border-slate-200',      icon: XCircle      },
  STOCK_ASSIGN:           { label: 'Stock Assigned',      pill: 'bg-success-bg text-success-dark border-success/15', icon: Package      },
  STOCK_RECEIVE:          { label: 'Stock Received',      pill: 'bg-success-bg text-success-dark border-success/15', icon: Package      },
  STOCK_DAY_END:          { label: 'Day End',             pill: 'bg-slate-50 text-text-muted border-slate-200',      icon: ClipboardList },
}

function parseEntry(action, details, vaccineNameById, workerNameById) {
  if (!details) return { vaccineName: null, vials: null, vialsDir: null, detail: null }
  const vn = (id) => vaccineNameById?.[id] ?? null
  const wn = (id) => workerNameById?.[id] ?? null

  switch (action) {
    case 'STOCK_ENTRY': {
      const name = details.vaccineName ? displayVaccineName(details.vaccineName) : vn(details.vaccineId)
      return {
        vaccineName: name,
        vials: details.vials ?? details.quantity ?? null,
        vialsDir: details.entryType === 'used' ? 'out' : 'in',
        detail: details.entryType ?? null,
      }
    }
    case 'ADJUST_STOCK': {
      const name = details.vaccineName ? displayVaccineName(details.vaccineName) : vn(details.vaccineId)
      const delta = details.delta ?? null
      return {
        vaccineName: name,
        vials: delta != null ? `${delta > 0 ? '+' : ''}${delta}` : null,
        vialsDir: delta > 0 ? 'in' : delta < 0 ? 'out' : 'neutral',
        detail: details.reason ?? null,
      }
    }
    case 'SET_THRESHOLD': {
      const name = details.vaccineName ? displayVaccineName(details.vaccineName) : vn(details.vaccineId)
      return {
        vaccineName: name,
        vials: details.minQuantity != null ? String(details.minQuantity) : null,
        vialsDir: 'neutral',
        detail: 'Min threshold',
      }
    }
    case 'CREATE_VACCINE':
    case 'DELETE_VACCINE':
      return { vaccineName: details.name ?? vn(details.vaccineId), vials: null, vialsDir: null, detail: null }
    case 'EDIT_VACCINE': {
      const { oldName, newName, name, vaccineId } = details
      const resolved = newName ?? name ?? vn(vaccineId)
      return {
        vaccineName: oldName && resolved ? `${oldName} → ${resolved}` : (resolved ?? null),
        vials: null, vialsDir: null, detail: null,
      }
    }
    case 'CREATE_USER':
      return { vaccineName: null, vials: null, vialsDir: null, detail: details.email ?? null }
    case 'ACTIVATE_USER':
    case 'DEACTIVATE_USER':
    case 'RESET_PASSWORD':
      return { vaccineName: null, vials: null, vialsDir: null, detail: details.email ?? details.name ?? null }
    case 'STOCK_REQUEST_CREATE':
    case 'STOCK_REQUEST_SENT':
    case 'STOCK_REQUEST_RECEIVED':
    case 'STOCK_REQUEST_APPROVE':
    case 'STOCK_REQUEST_CANCEL':
    case 'STOCK_REQUEST_DECLINE': {
      if (details.items?.length) {
        const names = details.items
          .map(item => item.vaccineName ? displayVaccineName(item.vaccineName) : vn(item.vaccineId))
          .filter(Boolean)
        const total = details.items.reduce((sum, item) =>
          sum + (item.requestedVials ?? item.sentVials ?? item.receivedVials ?? item.fulfilledVials ?? 0), 0)
        return {
          vaccineName: names.length === 1 ? names[0] : names.length > 1 ? `${names.length} vaccines` : null,
          vials: total || null,
          vialsDir: 'in',
          detail: details.note ?? null,
        }
      }
      return { vaccineName: null, vials: details.itemCount ?? null, vialsDir: null, detail: details.note ?? details.reason ?? null }
    }
    case 'APPROVAL_REQUEST':
    case 'APPROVAL_APPROVE':
    case 'APPROVAL_DECLINE':
    case 'APPROVAL_CANCEL': {
      const name = details.vaccineName ? displayVaccineName(details.vaccineName) : vn(details.vaccineId)
      // stock_correction stores vials as payload.storeVials; threshold_change has no vial count
      const payloadVials = details.payload?.storeVials ?? null
      const typeLabel = details.type ? details.type.replace(/_/g, ' ') : null
      return {
        vaccineName: name,
        vials: payloadVials,
        vialsDir: payloadVials != null ? 'neutral' : null,
        detail: details.note ?? typeLabel,
      }
    }
    case 'STOCK_ASSIGN':
    case 'STOCK_RECEIVE': {
      // items array: [{ vials, vaccineId, vaccineName }]
      const workerName = wn(details.workerId)
      if (details.items?.length) {
        const names = details.items
          .map(item => item.vaccineName ? displayVaccineName(item.vaccineName) : vn(item.vaccineId))
          .filter(Boolean)
        const total = details.items.reduce((sum, item) => sum + (item.vials ?? 0), 0)
        return {
          vaccineName: names.length === 1 ? names[0] : names.length > 1 ? `${names.length} vaccines` : null,
          vials: total || null,
          vialsDir: 'in',
          detail: workerName ? `Assigned to ${workerName}` : null,
        }
      }
      const name = details.vaccineName ? displayVaccineName(details.vaccineName) : vn(details.vaccineId)
      return { vaccineName: name, vials: details.vials ?? null, vialsDir: 'in', detail: workerName ? `Assigned to ${workerName}` : null }
    }
    case 'STOCK_DAY_END': {
      // items: [{ usedVials, vaccineId, vaccineName, wastedVials, returnedVials }]
      if (details.items?.length) {
        const names = details.items
          .map(item => item.vaccineName ? displayVaccineName(item.vaccineName) : vn(item.vaccineId))
          .filter(Boolean)
        const totalUsed = details.items.reduce((sum, item) => sum + (item.usedVials ?? 0), 0)
        return {
          vaccineName: names.length === 1 ? names[0] : names.length > 1 ? `${names.length} vaccines` : null,
          vials: totalUsed || null,
          vialsDir: 'out',
          detail: null,
        }
      }
      return { vaccineName: null, vials: null, vialsDir: null, detail: null }
    }
    default:
      return { vaccineName: null, vials: null, vialsDir: null, detail: null }
  }
}

// ─── Column Headers ───────────────────────────────────────────────────────────
function ColumnHeaders() {
  return (
    <div className="hidden sm:grid grid-cols-[160px_1fr_80px_1fr_180px] gap-3 px-5 py-3 bg-slate-50 border-b border-surface-border">
      <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Action</span>
      <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Vaccine</span>
      <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Vials</span>
      <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Details</span>
      <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Date &amp; Time</span>
    </div>
  )
}

// ─── Entry Row ────────────────────────────────────────────────────────────────
function EntryRow({ entry, vaccineNameById, workerNameById }) {
  const meta    = ACTION_META[entry.action] ?? { label: entry.action ?? '—', pill: 'bg-slate-50 text-text-muted border-slate-200', icon: ClipboardList }
  const IconCmp = meta.icon
  const { vaccineName, vials, vialsDir, detail } = parseEntry(entry.action, entry.details, vaccineNameById, workerNameById)

  const vialsColor = vialsDir === 'in'
    ? 'text-success-dark'
    : vialsDir === 'out'
      ? 'text-warning-dark'
      : 'text-text-muted'

  return (
    <div>
      {/* Mobile card */}
      <div className="sm:hidden px-4 py-3 hover:bg-slate-50/50 transition-colors">
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border w-fit ${meta.pill}`}>
            <IconCmp size={12} strokeWidth={2.2} />
            {meta.label}
          </span>
          {vials != null && (
            <div className={`flex items-center gap-1 text-xs font-bold flex-shrink-0 ${vialsColor}`}>
              {vialsDir === 'in'  && <ArrowUp size={12} strokeWidth={2.5} />}
              {vialsDir === 'out' && <ArrowDown size={12} strokeWidth={2.5} />}
              {vials}
            </div>
          )}
        </div>
        {vaccineName && <p className="text-sm font-semibold text-text">{vaccineName}</p>}
        {detail && <p className="text-xs text-text-muted mt-0.5">{detail}</p>}
        <div className="flex items-center gap-1 text-[10px] text-text-muted mt-0.5">
          <Clock size={10} className="flex-shrink-0" />
          <span>{formatFullDate(entry.createdAt)}</span>
        </div>
      </div>
      {/* Desktop row */}
      <div className="hidden sm:grid grid-cols-[160px_1fr_80px_1fr_180px] gap-3 items-center px-5 py-3 hover:bg-slate-50/50 transition-colors">
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border w-fit ${meta.pill}`}>
          <IconCmp size={12} strokeWidth={2.2} />
          {meta.label}
        </span>
        <p className="text-sm font-semibold text-text break-words" title={vaccineName ?? undefined}>
          {vaccineName ?? <span className="text-text-muted italic text-xs font-normal">—</span>}
        </p>
        <div className={`flex items-center gap-1 text-xs font-bold ${vialsColor}`}>
          {vialsDir === 'in'  && vials != null && <ArrowUp   size={12} strokeWidth={2.5} />}
          {vialsDir === 'out' && vials != null && <ArrowDown  size={12} strokeWidth={2.5} />}
          {vials != null ? vials : <span className="text-xs text-text-muted font-normal">—</span>}
        </div>
        <p className="text-xs text-text-muted break-words">
          {detail ?? <span className="opacity-40">—</span>}
        </p>
        <div className="flex items-center gap-1.5 text-xs text-text-muted font-medium">
          <Clock size={12} className="flex-shrink-0" />
          <span>{formatFullDate(entry.createdAt)}</span>
        </div>
      </div>
    </div>
  )
}

// ─── Pagination ────────────────────────────────────────────────────────────────
function Pagination({ currentPage, totalPages, onPageChange }) {
  if (totalPages <= 1) return null
  return (
    <div className="flex items-center justify-between border-t border-slate-100 bg-white px-5 py-4">
      <p className="text-xs text-text-muted font-semibold hidden sm:block">
        Page <span className="font-extrabold text-text">{currentPage}</span> of{' '}
        <span className="font-extrabold text-text">{totalPages}</span>
      </p>
      <nav className="isolate inline-flex -space-x-px rounded-xl shadow-sm border border-slate-200 bg-slate-50 p-0.5 gap-1">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="relative inline-flex items-center rounded-lg p-1.5 text-text-muted hover:bg-white disabled:opacity-40 transition-all cursor-pointer"
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
          className="relative inline-flex items-center rounded-lg p-1.5 text-text-muted hover:bg-white disabled:opacity-40 transition-all cursor-pointer"
        >
          <ChevronRight size={16} />
        </button>
      </nav>
    </div>
  )
}

// ─── Supervisor Tab Content ───────────────────────────────────────────────────
function SupervisorTab({ name, email, entries, vaccineNameById, workerNameById, currentPage, setCurrentPage }) {
  const displayName = name ?? email
  const itemsPerPage = 10
  const totalPages = Math.ceil(entries.length / itemsPerPage)
  const paginatedEntries = entries.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  return (
    <div className="bg-white rounded-2xl border border-surface-border overflow-hidden shadow-sm">
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
          <p className="text-xs">Try adjusting your filter criteria above.</p>
        </div>
      ) : (
        <>
          <ColumnHeaders />
          <div className="divide-y divide-surface-border">
            {paginatedEntries.map((entry, i) => <EntryRow key={i} entry={entry} vaccineNameById={vaccineNameById} workerNameById={workerNameById} />)}
          </div>
          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
        </>
      )}
    </div>
  )
}

// ─── Worker Card ──────────────────────────────────────────────────────────────
function WorkerCard({ worker, entries, vaccineNameById, workerNameById }) {
  const [workerPage, setWorkerPage] = useState(1)
  const workerName = worker.name ?? worker.email
  const itemsPerPage = 5
  const totalPages = Math.ceil(entries.length / itemsPerPage)
  const paginatedEntries = entries.slice((workerPage - 1) * itemsPerPage, workerPage * itemsPerPage)

  return (
    <div className="bg-white rounded-2xl border border-surface-border overflow-hidden shadow-sm">
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
            {paginatedEntries.map((entry, i) => <EntryRow key={i} entry={entry} vaccineNameById={vaccineNameById} workerNameById={workerNameById} />)}
          </div>
          <Pagination currentPage={workerPage} totalPages={totalPages} onPageChange={setWorkerPage} />
        </>
      )}
    </div>
  )
}

// ─── Workers Tab Content ──────────────────────────────────────────────────────
function WorkersTab({ workers, workerEntriesFn, search, setSearch, vaccineNameById, workerNameById }) {
  const filteredWorkers = workers.filter((w) =>
    !search || (w.name ?? w.email).toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="flex flex-col gap-4">
      {workers.length > 0 && (
        <div className="relative w-full sm:w-80">
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

      {workers.length === 0 && (
        <div className="text-center py-14 border border-dashed border-surface-border bg-white rounded-2xl text-text-muted shadow-sm">
          <Users size={36} className="mx-auto mb-3 opacity-20" />
          <p className="font-bold text-text">No workers registered</p>
          <p className="text-xs mt-1">Add workers in Worker Management to trace their logs.</p>
        </div>
      )}

      {workers.length > 0 && filteredWorkers.length === 0 && (
        <div className="text-center py-10 border border-dashed border-surface-border bg-white rounded-2xl text-text-muted shadow-sm">
          <p className="text-sm font-semibold">No workers match "{search}"</p>
          <button onClick={() => setSearch('')} className="text-xs text-primary font-bold hover:underline mt-1.5">
            Clear search
          </button>
        </div>
      )}

      {filteredWorkers.map((worker) => (
        <WorkerCard
          key={worker.id}
          worker={worker}
          entries={workerEntriesFn(worker)}
          vaccineNameById={vaccineNameById}
          workerNameById={workerNameById}
        />
      ))}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function FacilitySupervisorAuditLog() {
  const { user } = useAuth()
  const [tab, setTab]       = useState('supervisor')
  const [search, setSearch] = useState('')

  const [actionFilter, setActionFilter]       = useState('')
  const [startDateFilter, setStartDateFilter] = useState('')
  const [endDateFilter, setEndDateFilter]     = useState('')
  const [currentPage, setCurrentPage]         = useState(1)

  const { data: userData, isLoading: loadingUsers } = useQuery({ queryKey: ['users'],     queryFn: getUsers    })
  const { data: logData,  isLoading: loadingLog, isError } = useQuery({ queryKey: ['audit-log'], queryFn: getAuditLog })
  const { data: vaccineData } = useQuery({ queryKey: ['vaccines'], queryFn: getVaccines })

  const workers = (userData?.users ?? []).filter((u) => u.role === 'facility_worker')
  const logs    = logData?.auditLog ?? []
  const vaccineNameById = Object.fromEntries((vaccineData?.vaccines ?? []).map((v) => [v.id, displayVaccineName(v.name)]))
  const workerNameById  = Object.fromEntries((userData?.users ?? []).map((u) => [u.id, u.name ?? u.email]))

  const hasFilters = !!(actionFilter || startDateFilter || endDateFilter)

  function filterEntries(entriesList) {
    return entriesList.filter((entry) => {
      if (actionFilter && entry.action !== actionFilter) return false
      if (startDateFilter) {
        const entryTime = new Date(entry.createdAt).setHours(0,0,0,0)
        if (entryTime < new Date(startDateFilter).setHours(0,0,0,0)) return false
      }
      if (endDateFilter) {
        const entryTime = new Date(entry.createdAt).setHours(23,59,59,999)
        if (entryTime > new Date(endDateFilter).setHours(23,59,59,999)) return false
      }
      return true
    })
  }

  const logsByActorId = {}
  logs.forEach((log) => {
    if (!logsByActorId[log.actorId]) logsByActorId[log.actorId] = []
    logsByActorId[log.actorId].push(log)
  })

  const filteredSupervisorEntries = filterEntries(logsByActorId[user?.id] ?? [])

  function getFilteredWorkerEntries(worker) {
    return filterEntries(logsByActorId[worker.id] ?? [])
  }

  const workerTotal = workers.reduce((sum, w) => sum + getFilteredWorkerEntries(w).length, 0)
  const isLoading   = loadingUsers || loadingLog

  function resetFilters() {
    setActionFilter('')
    setStartDateFilter('')
    setEndDateFilter('')
    setCurrentPage(1)
  }

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto">

      {/* Banner — matches admin style */}
      <div className="bg-primary rounded-2xl px-4 sm:px-6 py-4 sm:py-5 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Audit Log</h1>
          <p className="text-sm text-white/70 mt-0.5">
            Actions logged by you and stock entries recorded by your workers
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-60" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
          </span>
          <span className="text-[10px] font-bold text-white/80 uppercase tracking-widest hidden sm:block">
            Live · Auto-refreshing
          </span>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 p-1 bg-slate-200/50 border border-slate-200/80 rounded-xl w-fit">
        <button
          onClick={() => { setTab('supervisor'); setCurrentPage(1) }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
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
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
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

      {/* Filter Panel */}
      <div className="bg-white rounded-2xl border border-surface-border p-5 shadow-sm flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-1 h-4 rounded-full bg-primary/40" />
            <h2 className="text-xs font-bold text-text-muted uppercase tracking-wider">Filter Logs</h2>
          </div>
          {hasFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="text-xs text-primary font-bold hover:underline transition-all"
            >
              Reset All
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Select
            id="action-filter"
            label="Action Type"
            placeholder="All Actions"
            options={[
              { value: 'STOCK_ENTRY',            label: 'Stock Entry' },
              { value: 'ADJUST_STOCK',            label: 'Stock Correction' },
              { value: 'STOCK_REQUEST_CREATE',    label: 'Stock Requested' },
              { value: 'STOCK_REQUEST_SENT',      label: 'Request Sent' },
              { value: 'STOCK_REQUEST_RECEIVED',  label: 'Request Received' },
              { value: 'STOCK_REQUEST_APPROVE',   label: 'Request Approved' },
              { value: 'STOCK_REQUEST_CANCEL',    label: 'Request Cancelled' },
              { value: 'STOCK_REQUEST_DECLINE',   label: 'Request Declined' },
              { value: 'APPROVAL_REQUEST',        label: 'Approval Requested' },
              { value: 'APPROVAL_APPROVE',        label: 'Approval Approved' },
              { value: 'APPROVAL_DECLINE',        label: 'Approval Declined' },
              { value: 'APPROVAL_CANCEL',         label: 'Approval Cancelled' },
              { value: 'STOCK_ASSIGN',            label: 'Stock Assigned' },
              { value: 'STOCK_DAY_END',           label: 'Day End' },
              { value: 'LOGOUT',                  label: 'Logout' },
            ]}
            value={actionFilter}
            onChange={(e) => { setActionFilter(e.target.value); setCurrentPage(1) }}
          />

          <DatePicker
            id="start-date"
            label="From Date"
            value={startDateFilter}
            max={endDateFilter || undefined}
            onChange={(e) => { setStartDateFilter(e.target.value); setCurrentPage(1) }}
          />

          <DatePicker
            id="end-date"
            label="To Date"
            value={endDateFilter}
            min={startDateFilter || undefined}
            onChange={(e) => { setEndDateFilter(e.target.value); setCurrentPage(1) }}
          />
        </div>
      </div>

      {/* Skeleton */}
      {isLoading && (
        <div className="flex flex-col gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-surface-border p-5 animate-pulse shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-xl bg-slate-100" />
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
              workerNameById={workerNameById}
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
              workerNameById={workerNameById}
            />
          )}
        </div>
      )}
    </div>
  )
}
