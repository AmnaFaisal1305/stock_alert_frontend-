import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangle, AlertCircle, Syringe, CheckCircle2,
  RefreshCw, Users, PackagePlus, Clock, Activity,
  ArrowRight, Settings, UserCog,
  Package, Tag, UserPlus, ArrowUp, ArrowDown, UserX, UserCheck, KeyRound,
  RefreshCcw, Trash2,
} from 'lucide-react'
import { getDashboard, getUsers, getAuditLog } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import StatusBadge from '../../components/shared/StatusBadge'
import SkeletonCard from '../../components/shared/SkeletonCard'
import StatCard from '../../components/shared/StatCard'
import RingGauge from '../../components/shared/RingGauge'
import { statusConfig, STATUS_RANK } from '../../lib/status'

const AVATAR_COLORS = [
  'bg-teal-500', 'bg-violet-500', 'bg-amber-500',
  'bg-sky-500', 'bg-pink-500', 'bg-emerald-500',
]

function timeAgo(isoStr) {
  if (!isoStr) return '—'
  const diff = Date.now() - new Date(isoStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

// ─── Refresh Clock (isolated so its interval doesn't re-render the whole page) ─
function RefreshClock({ dataUpdatedAt, isFetching }) {
  const [secondsAgo, setSecondsAgo] = useState(0)
  useEffect(() => {
    if (!dataUpdatedAt) return
    const tick = () => setSecondsAgo(Math.round((Date.now() - dataUpdatedAt) / 1000))
    tick()
    const id = setInterval(tick, 5000)
    return () => clearInterval(id)
  }, [dataUpdatedAt])
  return (
    <div className="flex items-center gap-1.5 text-xs text-text-muted mt-1.5">
      <RefreshCw size={10} className={isFetching ? 'animate-spin text-primary' : ''} />
      <span>{secondsAgo < 10 ? 'Just refreshed' : `Refreshed ${secondsAgo}s ago`}</span>
    </div>
  )
}

// ─── Vaccine Card ─────────────────────────────────────────────────────────────
function StockCard({ row }) {
  const status = row.status
  const noThreshold = row.minQuantity === 0
  const hasQty = row.quantity != null
  const pct = !noThreshold
    ? Math.min(Math.round(((row.quantity ?? 0) / row.minQuantity) * 100), 100)
    : 100
  const dosesShort = !noThreshold && hasQty ? Math.max(0, row.minQuantity - row.quantity) : 0

  const cfg         = statusConfig(status)
  const borderColor = cfg.borderL
  const ringClass   = cfg.ring

  const neverRecorded = row.recordedAt === null

  return (
    <Link
      to="/facility/thresholds"
      className={`group bg-surface rounded-xl border border-surface-border border-l-4 ${borderColor} ${ringClass} p-4 flex gap-4 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200`}
    >
      {/* Ring gauge */}
      <div className="flex-shrink-0 flex flex-col items-center justify-center gap-1">
        {noThreshold ? (
          <div className="w-[72px] h-[72px] rounded-full border-4 border-dashed border-surface-border flex items-center justify-center">
            <Settings size={18} className="text-text-muted" />
          </div>
        ) : (
          <RingGauge pct={pct} status={status} size={72} />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 flex flex-col justify-between gap-2">
        {/* Title + badge */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            {status === 'critical' && (
              <div className="relative flex-shrink-0">
                <span className="absolute inline-flex h-2.5 w-2.5 rounded-full bg-danger/40 animate-ping" />
                <AlertCircle size={13} className="relative text-danger flex-shrink-0" />
              </div>
            )}
            {status === 'low' && <AlertTriangle size={12} className="flex-shrink-0 text-warning" />}
            <p className="font-semibold text-text text-base truncate">{row.vaccineName}</p>
          </div>
          <StatusBadge status={status} />
        </div>

        {/* Qty + threshold */}
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold text-text leading-none">{row.quantity ?? '—'}</span>
          <span className="text-xs text-text-muted">/ {noThreshold ? '∞' : row.minQuantity} doses</span>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 text-xs">
          {dosesShort > 0 ? (
            <span className={`font-bold ${status === 'critical' ? 'text-danger' : 'text-warning-dark'}`}>
              {dosesShort} doses short
            </span>
          ) : noThreshold ? (
            <span className="text-primary font-medium group-hover:underline">Set threshold →</span>
          ) : (
            <span />
          )}

          <span className={`flex items-center gap-1 ${neverRecorded ? 'text-warning-dark font-semibold' : 'text-text-muted'}`}>
            {neverRecorded && <AlertTriangle size={10} />}
            {neverRecorded ? 'Never recorded' : `Last recorded ${timeAgo(row.recordedAt)}`}
          </span>
        </div>
      </div>
    </Link>
  )
}

// ─── Alert Banner ─────────────────────────────────────────────────────────────
function AlertBanner({ criticalCount, lowCount, total }) {
  if (total === 0) return null
  if (criticalCount > 0) {
    return (
      <div className="bg-danger-bg border border-danger/20 rounded-xl px-5 py-4 flex items-center gap-4">
        <div className="relative flex-shrink-0">
          <span className="absolute inline-flex h-5 w-5 rounded-full bg-danger/30 animate-ping" />
          <AlertCircle size={22} className="relative text-danger" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-danger">
            {criticalCount} vaccine{criticalCount > 1 ? 's' : ''} critically low — immediate action required
          </p>
          <p className="text-xs text-danger/70 mt-0.5">Restock as soon as possible to avoid service interruption</p>
        </div>
        <Link to="/facility/thresholds" className="flex items-center gap-1 text-xs font-semibold text-danger hover:underline flex-shrink-0">
          View Details <ArrowRight size={12} />
        </Link>
      </div>
    )
  }
  if (lowCount > 0) {
    return (
      <div className="bg-warning-bg border border-warning/20 rounded-xl px-5 py-4 flex items-center gap-4">
        <AlertTriangle size={20} className="text-warning flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-bold text-warning-dark">
            {lowCount} vaccine{lowCount > 1 ? 's' : ''} running low
          </p>
          <p className="text-xs text-warning-dark/70 mt-0.5">Plan restocking before levels become critical</p>
        </div>
        <Link to="/facility/thresholds" className="flex items-center gap-1 text-xs font-semibold text-warning-dark hover:underline flex-shrink-0">
          View Details <ArrowRight size={12} />
        </Link>
      </div>
    )
  }
  return (
    <div className="bg-success-bg border border-success/20 rounded-xl px-5 py-4 flex items-center gap-4">
      <CheckCircle2 size={20} className="text-success flex-shrink-0" />
      <p className="text-sm font-bold text-success-dark">All {total} vaccines are at healthy stock levels</p>
    </div>
  )
}



// ─── Activity Feed ─────────────────────────────────────────────────────────────
const FEED_ACTION_META = {
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

function parseFeedEntry(action, details, vaccineNameById) {
  if (!details) return { subject: null, quantity: null, qtyType: null }
  const vaccineName = (id) => vaccineNameById?.[id] ?? details.vaccineName ?? null
  switch (action) {
    case 'STOCK_ENTRY': {
      const { vaccineId, quantity, entryType } = details
      return { subject: vaccineName(vaccineId), quantity: quantity != null ? `${quantity} doses` : null, qtyType: entryType === 'used' ? 'out' : 'in' }
    }
    case 'ADJUST_STOCK': {
      const { vaccineId, delta } = details
      return { subject: vaccineName(vaccineId), quantity: delta != null ? `${delta > 0 ? '+' : ''}${delta}` : null, qtyType: delta > 0 ? 'in' : delta < 0 ? 'out' : 'neutral' }
    }
    case 'SET_THRESHOLD': {
      const { vaccineId, minQuantity } = details
      return { subject: vaccineName(vaccineId), quantity: minQuantity != null ? `Min: ${minQuantity}` : null, qtyType: 'neutral' }
    }
    case 'CREATE_VACCINE':   return { subject: details.name ?? vaccineName(details.vaccineId), quantity: null, qtyType: null }
    case 'EDIT_VACCINE':     return { subject: details.oldName && (details.newName ?? details.name) ? `${details.oldName} → ${details.newName ?? details.name}` : (details.newName ?? details.name ?? vaccineName(details.vaccineId)), quantity: null, qtyType: null }
    case 'DELETE_VACCINE':   return { subject: details.name ?? vaccineName(details.vaccineId), quantity: null, qtyType: null }
    case 'CREATE_USER':      return { subject: details.email ?? null, quantity: null, qtyType: null }
    default:                 return { subject: null, quantity: null, qtyType: null }
  }
}

function ActivityFeed({ logs, vaccineNameById }) {
  const entries = logs ?? []

  return (
    <div className="bg-surface rounded-xl border border-surface-border overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-surface-border">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <Activity size={13} className="text-primary" />
          </div>
          <h2 className="text-sm font-semibold text-text">Recent Activity</h2>
        </div>
        <Link to="/facility/audit-log" className="text-xs text-primary hover:underline font-medium flex items-center gap-1">
          Full log <ArrowRight size={11} />
        </Link>
      </div>

      {entries.length === 0 ? (
        <div className="text-center py-10 text-text-muted">
          <Activity size={28} className="mx-auto mb-2 opacity-20" />
          <p className="text-sm font-medium">No activity recorded yet</p>
        </div>
      ) : (
      <>
      {/* Column headers */}
      <div className="grid grid-cols-[150px_1fr_100px_90px] gap-3 px-5 py-2 bg-surface-alt/70 border-b border-surface-border">
        <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Action</span>
        <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Vaccine / Subject</span>
        <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Doses</span>
        <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">When</span>
      </div>

      {/* Rows */}
      <div className="divide-y divide-surface-border">
        {entries.map((entry, i) => {
          const meta    = FEED_ACTION_META[entry.action] ?? { label: entry.action ?? '—', pill: 'bg-surface-alt text-text-muted', icon: Activity }
          const IconCmp = meta.icon
          const { subject, quantity, qtyType } = parseFeedEntry(entry.action, entry.details, vaccineNameById)
          const qtyColor = qtyType === 'in' ? 'text-success-dark' : qtyType === 'out' ? 'text-warning-dark' : 'text-text-muted'

          return (
            <div key={i} className="grid grid-cols-[150px_1fr_100px_90px] gap-3 items-center px-5 py-2.5 hover:bg-surface-alt/40 transition-colors">
              <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-semibold w-fit ${meta.pill}`}>
                <IconCmp size={11} />
                {meta.label}
              </span>
              <p className="text-sm font-medium text-text truncate">{subject ?? <span className="text-text-muted text-xs italic">—</span>}</p>
              {quantity ? (
                <div className={`flex items-center gap-1 text-xs font-semibold ${qtyColor}`}>
                  {qtyType === 'in'  && <ArrowUp   size={11} />}
                  {qtyType === 'out' && <ArrowDown  size={11} />}
                  {quantity}
                </div>
              ) : (
                <span className="text-xs text-text-muted">—</span>
              )}
              <div className="flex items-center gap-1 text-xs text-text-muted">
                <Clock size={10} className="flex-shrink-0" />
                {timeAgo(entry.createdAt)}
              </div>
            </div>
          )
        })}
      </div>
      </>
      )}
    </div>
  )
}

// ─── Section Heading ──────────────────────────────────────────────────────────
function SectionHeading({ icon: Icon, label, color = 'text-text-muted' }) {
  return (
    <div className="flex items-center gap-2">
      <Icon size={14} className={color} />
      <h2 className={`text-xs font-bold uppercase tracking-widest ${color}`}>{label}</h2>
      <div className="flex-1 h-px bg-surface-border" />
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function FacilityDashboard() {
  const { user } = useAuth()

  const { data, isLoading, isError, dataUpdatedAt, isFetching } = useQuery({
    queryKey: ['dashboard'],
    queryFn: getDashboard,
    refetchInterval: 15_000,
    staleTime: 10_000,
  })
  const { data: userData  } = useQuery({ queryKey: ['users'],     queryFn: getUsers    })
  const { data: auditData } = useQuery({ queryKey: ['audit-log', 5], queryFn: () => getAuditLog({ limit: 5 }) })

  const {
    rows, vaccineNameById, facilityName, districtName,
    criticalCount, lowCount, healthyCount, activeWorkers,
    urgentRows, healthyRows, allLogs,
  } = useMemo(() => {
    const rawRows       = (data?.facilities ?? []).filter((r) => r.facilityId === user.facilityId)
    const vaccineNameById = Object.fromEntries(rawRows.map((r) => [r.vaccineId, r.vaccineName]))
    const rows          = [...rawRows].sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status])
    return {
      rows,
      vaccineNameById,
      facilityName:  rows[0]?.facilityName,
      districtName:  rows[0]?.districtName,
      criticalCount: rows.filter((r) => r.status === 'critical').length,
      lowCount:      rows.filter((r) => r.status === 'low' || r.status === 'no_data').length,
      healthyCount:  rows.filter((r) => r.status === 'adequate').length,
      activeWorkers: (userData?.users ?? []).filter((u) => u.isActive).length,
      urgentRows:    rows.filter((r) => r.status === 'critical' || r.status === 'low' || r.status === 'no_data'),
      healthyRows:   rows.filter((r) => r.status === 'adequate'),
      allLogs:       auditData?.auditLog ?? [],
    }
  }, [data, userData, auditData, user.facilityId])

  return (
    <div className="flex flex-col gap-6">

      {/* ── Page Header ── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-text">
            {facilityName ?? 'Facility Dashboard'}
          </h1>
          <p className="text-sm text-text-muted mt-0.5">
            {districtName ? `${districtName} District` : 'Current vaccine stock at your facility'}
          </p>
          {!isLoading && (
            <RefreshClock dataUpdatedAt={dataUpdatedAt} isFetching={isFetching} />
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            to="/facility/workers"
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border border-surface-border bg-surface text-text-muted hover:text-warning-dark hover:border-warning/30 hover:bg-warning-bg transition-colors"
          >
            <UserCog size={13} className="text-warning-dark" /> Manage Workers
          </Link>
          <Link
            to="/facility/thresholds"
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border border-surface-border bg-surface text-text-muted hover:text-success-dark hover:border-success/30 hover:bg-success-bg transition-colors"
          >
            <Syringe size={13} className="text-success-dark" /> Manage Vaccines
          </Link>
          <Link
            to="/facility/record-stock"
            className="inline-flex items-center gap-2 bg-primary text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-primary-dark transition-colors shadow-sm"
          >
            <PackagePlus size={15} /> Record Delivery
          </Link>
        </div>
      </div>

      {/* ── Alert Banner ── */}
      {!isLoading && !isError && (
        <AlertBanner criticalCount={criticalCount} lowCount={lowCount} total={rows.length} />
      )}

      {/* ── Error ── */}
      {isError && (
        <div className="bg-danger-bg border border-danger/20 rounded-xl px-4 py-3 text-sm text-danger">
          Failed to load dashboard data. Please refresh the page.
        </div>
      )}

      {/* ── Stat Cards ── */}
      {!isLoading && !isError && rows.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard
            icon={Syringe} label="Total Vaccines" value={rows.length}
            colorClass="text-primary"
            subtitle={`${healthyCount} healthy`}
          />
          <StatCard
            icon={AlertCircle} label="Critical" value={criticalCount}
            colorClass={criticalCount > 0 ? 'text-danger' : 'text-text-muted'}
            subtitle={criticalCount > 0 ? 'Needs immediate action' : 'All clear'}
          />
          <StatCard
            icon={AlertTriangle} label="Low Stock" value={lowCount}
            colorClass={lowCount > 0 ? 'text-warning-dark' : 'text-text-muted'}
            subtitle={lowCount > 0 ? 'Plan restocking soon' : 'Levels healthy'}
          />
          <StatCard
            icon={Users} label="Active Workers" value={userData ? activeWorkers : '—'}
            colorClass="text-success-dark"
            subtitle="Currently active"
          />
        </div>
      )}

      {/* ── Skeleton ── */}
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => <SkeletonCard key={i} lines={3} />)}
        </div>
      )}

      {/* ── Needs Attention ── */}
      {!isLoading && !isError && urgentRows.length > 0 && (
        <div className="flex flex-col gap-3">
          <SectionHeading
            icon={criticalCount > 0 ? AlertCircle : AlertTriangle}
            label={`Needs Attention (${urgentRows.length})`}
            color={criticalCount > 0 ? 'text-danger' : 'text-warning-dark'}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {urgentRows.map((row) => (
              <StockCard key={`urgent-${row.facilityId}-${row.vaccineId}`} row={row} />
            ))}
          </div>
        </div>
      )}

      {/* ── Healthy Stock ── */}
      {!isLoading && !isError && healthyRows.length > 0 && (
        <div className="flex flex-col gap-3">
          <SectionHeading
            icon={urgentRows.length === 0 ? CheckCircle2 : Syringe}
            label={urgentRows.length === 0 ? `All Good — ${healthyRows.length} Vaccines` : `Healthy Stock (${healthyRows.length})`}
            color={urgentRows.length === 0 ? 'text-success-dark' : 'text-text-muted'}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {healthyRows.map((row) => (
              <StockCard key={`ok-${row.facilityId}-${row.vaccineId}`} row={row} />
            ))}
          </div>
        </div>
      )}

      {/* ── Empty State ── */}
      {!isLoading && !isError && rows.length === 0 && (
        <div className="text-center py-16 text-text-muted border border-dashed border-surface-border rounded-xl">
          <Syringe size={40} className="mx-auto mb-3 opacity-20" />
          <p className="font-semibold text-text">No vaccines configured yet</p>
          <p className="text-sm mt-1">Add vaccines in the Vaccines &amp; Thresholds screen to get started.</p>
          <Link to="/facility/thresholds" className="inline-flex items-center gap-1.5 mt-4 text-sm text-primary font-semibold hover:underline">
            <Settings size={14} /> Configure Vaccines
          </Link>
        </div>
      )}

      {/* ── Recent Activity ── */}
      {!isLoading && <ActivityFeed logs={allLogs} vaccineNameById={vaccineNameById} />}

    </div>
  )
}
