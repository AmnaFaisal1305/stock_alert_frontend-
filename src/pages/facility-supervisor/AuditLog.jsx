import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../context/AuthContext'
import { getAuditLog, getUsers, getVaccines } from '../../lib/api'
import {
  Clock, Package, Settings, Syringe, Tag,
  UserPlus, UserX, ClipboardList, KeyRound,
  UserCheck, Search, Shield, ArrowUp, ArrowDown, Users,
  RefreshCcw, Trash2,
} from 'lucide-react'

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
  STOCK_ENTRY:      { label: 'Stock Entry',       pill: 'bg-primary/10 text-primary',      icon: Package  },
  ADJUST_STOCK:     { label: 'Stock Correction',  pill: 'bg-primary/10 text-primary',      icon: RefreshCcw },
  CREATE_VACCINE:   { label: 'Vaccine Added',     pill: 'bg-success-bg text-success-dark', icon: Syringe  },
  EDIT_VACCINE:     { label: 'Vaccine Renamed',   pill: 'bg-surface-alt text-text-muted',  icon: Tag      },
  DELETE_VACCINE:   { label: 'Vaccine Deleted',   pill: 'bg-danger-bg text-danger',        icon: Trash2   },
  SET_THRESHOLD:    { label: 'Threshold Updated', pill: 'bg-warning-bg text-warning-dark', icon: Settings },
  CREATE_USER:      { label: 'Worker Added',      pill: 'bg-primary/10 text-primary',      icon: UserPlus },
  ACTIVATE_USER:    { label: 'Worker Activated',  pill: 'bg-success-bg text-success-dark', icon: UserCheck },
  DEACTIVATE_USER:  { label: 'Worker Deactivated', pill: 'bg-danger-bg text-danger',       icon: UserX    },
  RESET_PASSWORD:   { label: 'Password Reset',    pill: 'bg-surface-alt text-text-muted',  icon: KeyRound },
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
    <div className="grid grid-cols-[160px_1fr_110px_200px] gap-3 px-5 py-2 bg-surface-alt/80 border-b border-surface-border">
      <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Action</span>
      <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Vaccine / Subject</span>
      <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Doses / Detail</span>
      <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Date &amp; Time</span>
    </div>
  )
}

// ─── Entry Row ────────────────────────────────────────────────────────────────
function EntryRow({ entry, vaccineNameById }) {
  const meta    = ACTION_META[entry.action] ?? { label: entry.action ?? '—', pill: 'bg-surface-alt text-text-muted', icon: ClipboardList }
  const IconCmp = meta.icon
  const { subject, quantity, qtyType } = parseEntry(entry.action, entry.details, vaccineNameById)

  const qtyColor = qtyType === 'in'
    ? 'text-success-dark'
    : qtyType === 'out'
      ? 'text-warning-dark'
      : 'text-text-muted'

  return (
    <div className="grid grid-cols-[160px_1fr_110px_200px] gap-3 items-center px-5 py-2.5 hover:bg-surface-alt/40 transition-colors">
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold w-fit ${meta.pill}`}>
        <IconCmp size={11} />
        {meta.label}
      </span>

      <p className="text-sm font-medium text-text truncate" title={subject ?? undefined}>
        {subject ?? <span className="text-text-muted italic text-xs">—</span>}
      </p>

      {quantity ? (
        <div className={`flex items-center gap-1 text-xs font-semibold ${qtyColor}`}>
          {qtyType === 'in'  && <ArrowUp   size={11} />}
          {qtyType === 'out' && <ArrowDown  size={11} />}
          {quantity}
        </div>
      ) : (
        <span className="text-xs text-text-muted">—</span>
      )}

      <div className="flex items-center gap-1.5 text-xs text-text-muted">
        <Clock size={11} className="flex-shrink-0" />
        <span>{formatFullDate(entry.createdAt)}</span>
      </div>
    </div>
  )
}

// ─── Supervisor Tab Content ───────────────────────────────────────────────────
function SupervisorTab({ name, email, entries, vaccineNameById }) {
  const displayName = name ?? email
  return (
    <div className="bg-surface rounded-xl border border-primary/20 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-primary/5 border-b border-primary/15 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
            {displayName ? displayName[0].toUpperCase() : 'S'}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-text truncate">{displayName ?? '—'}</p>
            <p className="text-[10px] text-primary uppercase tracking-widest font-semibold mt-0.5">Facility Supervisor</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-[10px] font-semibold text-text-muted bg-surface border border-surface-border px-2 py-0.5 rounded-full">
            {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-full bg-primary/10 text-primary">
            <Shield size={10} /> Supervisor
          </span>
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="flex items-center gap-3 px-5 py-6 text-text-muted">
          <ClipboardList size={16} className="opacity-30 flex-shrink-0" />
          <p className="text-sm italic">No supervisor actions recorded yet</p>
        </div>
      ) : (
        <>
          <ColumnHeaders />
          <div className="divide-y divide-surface-border">
            {entries.map((entry, i) => <EntryRow key={i} entry={entry} vaccineNameById={vaccineNameById} />)}
          </div>
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
    <div className="flex flex-col gap-3">
      {/* Search */}
      {workers.length > 0 && (
        <div className="relative w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
          <input
            type="text"
            placeholder="Search worker name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-surface-border rounded-lg bg-surface focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors placeholder:text-text-muted"
          />
        </div>
      )}

      {/* No workers */}
      {workers.length === 0 && (
        <div className="text-center py-14 border border-dashed border-surface-border rounded-xl text-text-muted">
          <Users size={36} className="mx-auto mb-3 opacity-20" />
          <p className="font-semibold text-text">No workers yet</p>
          <p className="text-sm mt-1">Add workers in Worker Management to see their activity here.</p>
        </div>
      )}

      {/* Search empty */}
      {workers.length > 0 && filteredWorkers.length === 0 && (
        <div className="text-center py-10 border border-dashed border-surface-border rounded-xl text-text-muted">
          <p className="text-sm">No workers match "<span className="font-semibold">{search}</span>"</p>
          <button onClick={() => setSearch('')} className="text-xs text-primary hover:underline mt-1.5">Clear search</button>
        </div>
      )}

      {/* Worker cards */}
      {filteredWorkers.map((worker) => {
        const entries = workerEntriesFn(worker)
        const workerName = worker.name ?? worker.email
        return (
          <div key={worker.id} className="bg-surface rounded-xl border border-surface-border overflow-hidden">
            {/* Worker header */}
            <div className="px-4 py-3 bg-surface-alt border-b border-surface-border flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-8 h-8 rounded-full ${avatarBg(workerName)} text-white flex items-center justify-center text-sm font-bold flex-shrink-0`}>
                  {workerName[0].toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-text truncate">{workerName}</p>
                  <p className="text-[10px] text-text-muted uppercase tracking-widest mt-0.5">Facility Worker</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {entries.length > 0 && (
                  <span className="text-[10px] font-semibold text-text-muted bg-surface border border-surface-border px-2 py-0.5 rounded-full">
                    {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
                  </span>
                )}
                <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-full ${
                  worker.isActive
                    ? 'bg-success-bg text-success-dark'
                    : 'bg-surface border border-surface-border text-text-muted'
                }`}>
                  {worker.isActive ? <UserCheck size={10} /> : <UserX size={10} />}
                  {worker.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>

            {entries.length === 0 ? (
              <div className="flex items-center gap-3 px-5 py-4 text-text-muted">
                <ClipboardList size={16} className="opacity-30 flex-shrink-0" />
                <p className="text-sm italic">No activity recorded yet</p>
              </div>
            ) : (
              <>
                <ColumnHeaders />
                <div className="divide-y divide-surface-border">
                  {entries.map((entry, i) => <EntryRow key={i} entry={entry} vaccineNameById={vaccineNameById} />)}
                </div>
              </>
            )}
          </div>
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

  const { data: userData, isLoading: loadingUsers } = useQuery({ queryKey: ['users'],     queryFn: getUsers    })
  const { data: logData,  isLoading: loadingLog, isError } = useQuery({ queryKey: ['audit-log'], queryFn: getAuditLog })
  const { data: vaccineData } = useQuery({ queryKey: ['vaccines'], queryFn: getVaccines })

  const workers = (userData?.users ?? []).filter((u) => u.role === 'facility_worker')
  const logs    = logData?.auditLog ?? []
  const vaccineNameById = Object.fromEntries((vaccineData?.vaccines ?? []).map((v) => [v.id, v.name]))

  const logsByActorId = {}
  logs.forEach((log) => {
    if (!logsByActorId[log.actorId]) logsByActorId[log.actorId] = []
    logsByActorId[log.actorId].push(log)
  })

  const supervisorEntries = logsByActorId[user?.id] ?? []

  function workerEntries(worker) {
    return logsByActorId[worker.id] ?? []
  }

  const workerTotal = workers.reduce((sum, w) => sum + workerEntries(w).length, 0)
  const isLoading   = loadingUsers || loadingLog

  return (
    <div className="flex flex-col gap-5">

      {/* Page header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-text">Activity Log</h1>
          <p className="text-sm text-text-muted mt-0.5">Your actions and your workers' stock entries</p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 p-1 bg-surface-alt border border-surface-border rounded-xl w-fit">
        <button
          onClick={() => setTab('supervisor')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            tab === 'supervisor'
              ? 'bg-surface text-primary shadow-sm border border-primary/15'
              : 'text-text-muted hover:text-text'
          }`}
        >
          <Shield size={13} />
          Supervisor
          {!isLoading && (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
              tab === 'supervisor' ? 'bg-primary/10 text-primary' : 'bg-surface text-text-muted'
            }`}>
              {supervisorEntries.length}
            </span>
          )}
        </button>
        <button
          onClick={() => { setTab('workers'); setSearch('') }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            tab === 'workers'
              ? 'bg-surface text-primary shadow-sm border border-primary/15'
              : 'text-text-muted hover:text-text'
          }`}
        >
          <Users size={13} />
          Workers
          {!isLoading && (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
              tab === 'workers' ? 'bg-primary/10 text-primary' : 'bg-surface text-text-muted'
            }`}>
              {workerTotal}
            </span>
          )}
        </button>
      </div>

      {/* Skeleton */}
      {isLoading && (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-surface rounded-xl border border-surface-border p-4 animate-pulse">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-full bg-surface-alt" />
                <div className="h-3.5 bg-surface-alt rounded w-48" />
              </div>
              <div className="h-2.5 bg-surface-alt rounded w-full mt-2" />
              <div className="h-2.5 bg-surface-alt rounded w-3/4 mt-2" />
            </div>
          ))}
        </div>
      )}

      {isError && <p className="text-sm text-danger">Failed to load activity log.</p>}

      {/* Tab content */}
      {!isLoading && !isError && (
        <>
          {tab === 'supervisor' && (
            <SupervisorTab name={user?.name} email={user?.email} entries={supervisorEntries} vaccineNameById={vaccineNameById} />
          )}
          {tab === 'workers' && (
            <WorkersTab
              workers={workers}
              workerEntriesFn={workerEntries}
              search={search}
              setSearch={setSearch}
              vaccineNameById={vaccineNameById}
            />
          )}
        </>
      )}
    </div>
  )
}
