import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Syringe, AlertCircle, AlertTriangle, CheckCircle2, HelpCircle, Calendar, Building2 } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { getFacility } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import StatusBadge from '../../components/shared/StatusBadge'
import SkeletonCard from '../../components/shared/SkeletonCard'
import { statusConfig, worstStatus } from '../../lib/status'

function VaccineCard({ v }) {
  const cfg        = statusConfig(v.status)
  const qty        = v.quantity ?? 0
  const minQty     = v.minQuantity ?? 0
  const fillPct    = minQty > 0 ? Math.min((qty / minQty) * 100, 100) : 100
  const hasMin     = minQty > 0

  const barColor =
    v.status === 'critical' ? 'bg-danger' :
    v.status === 'low'      ? 'bg-warning' :
    v.status === 'adequate' ? 'bg-success' :
    'bg-secondary'

  const accentBar =
    v.status === 'critical' ? 'bg-danger' :
    v.status === 'low'      ? 'bg-warning' :
    v.status === 'adequate' ? 'bg-success' :
    'bg-secondary/40'

  const borderColor =
    v.status === 'critical' ? 'border-danger/20' :
    v.status === 'low'      ? 'border-warning/20' :
    'border-surface-border'

  return (
    <div className={`bg-white rounded-2xl border overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 ${borderColor}`}>

      {/* Status accent bar */}
      <div className={`h-1 ${accentBar}`} />

      <div className="p-5 flex flex-col gap-4">

        {/* Header: icon + name + badge */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5 min-w-0">
            <div className={`p-2 rounded-lg flex-shrink-0 mt-0.5 ${cfg.bg}`}>
              <Syringe size={14} className={cfg.text} strokeWidth={2.2} />
            </div>
            <h3
              className="font-bold text-text text-sm leading-tight pt-1 truncate"
              title={v.vaccineName}
            >
              {v.vaccineName}
            </h3>
          </div>
          <div className="flex-shrink-0">
            <StatusBadge status={v.status} />
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-slate-100" />

        {/* Stock figures */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-0.5">
            <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">
              Current Stock
            </p>
            <p className="text-2xl font-extrabold text-text tabular-nums leading-none">
              {v.quantity ?? '—'}
            </p>
            <p className="text-[10px] text-text-muted font-medium mt-0.5">doses</p>
          </div>

          <div className="flex flex-col gap-0.5">
            <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">
              Min. Threshold
            </p>
            <p className={`text-2xl font-extrabold tabular-nums leading-none ${hasMin ? 'text-text' : 'text-text-muted/40'}`}>
              {hasMin ? minQty : '—'}
            </p>
            <p className="text-[10px] text-text-muted font-medium mt-0.5">
              {hasMin ? 'minimum doses' : 'not set'}
            </p>
          </div>
        </div>

        {/* Last recorded */}
        <div className="flex items-center gap-1.5 pt-1 border-t border-slate-50">
          <Calendar size={11} className="text-text-muted/50 flex-shrink-0" />
          <p className="text-[10px] font-semibold text-text-muted/70 uppercase tracking-wider">
            {v.recordedAt
              ? `Last recorded ${new Date(v.recordedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
              : 'Never recorded'}
          </p>
        </div>
      </div>
    </div>
  )
}

export default function FacilityDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const { data, isLoading, isError } = useQuery({
    queryKey: ['facility', id],
    queryFn: () => getFacility(id),
  })

  const facility = data?.facility
  const backTo   = user?.role === 'super_admin' ? '/super-admin/districts' : '/district/facilities'

  const counts = facility?.statusCounts ?? {}

  const statRows = [
    { label: 'Critical',  value: counts.critical ?? 0, icon: AlertCircle,   color: 'text-danger',      bg: 'bg-danger-bg',   bar: 'bg-danger'   },
    { label: 'Low Stock', value: counts.low ?? 0,      icon: AlertTriangle, color: 'text-warning-dark', bg: 'bg-warning-bg',  bar: 'bg-warning'  },
    { label: 'OK',        value: counts.adequate ?? 0, icon: CheckCircle2,  color: 'text-success-dark', bg: 'bg-success-bg',  bar: 'bg-success'  },
    { label: 'No Data',   value: counts.no_data ?? 0,  icon: HelpCircle,    color: 'text-text-muted',   bg: 'bg-surface-alt', bar: 'bg-secondary'},
  ]

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-200">

      {/* Back link */}
      <Link
        to={backTo}
        className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-primary w-fit font-semibold transition-colors"
      >
        <ArrowLeft size={14} /> Back
      </Link>

      {isLoading && (
        <div className="flex flex-col gap-6 animate-pulse">
          <div className="h-[88px] bg-slate-100 rounded-2xl" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1,2,3,4].map((i) => <div key={i} className="h-24 bg-slate-50 border border-slate-200 rounded-2xl" />)}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1,2,3,4,5,6].map((i) => <SkeletonCard key={i} lines={3} />)}
          </div>
        </div>
      )}

      {isError && (
        <div className="bg-danger-bg border border-danger/10 text-xs font-semibold text-danger rounded-xl px-4 py-3">
          Failed to load facility. Please try refreshing.
        </div>
      )}

      {!isLoading && !isError && facility && (
        <>
          {/* ── Page Header — AKUH maroon banner ─────────────────────── */}
          <div className="bg-primary rounded-2xl px-6 py-5 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl font-bold text-white tracking-tight">{facility.name}</h1>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  facility.isActive
                    ? 'bg-white/20 text-white border border-white/30'
                    : 'bg-white/10 text-white/60 border border-white/20'
                }`}>
                  {facility.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              <p className="text-sm text-white/70 mt-0.5">
                {facility.districtName} District
                {facility.facilitySupervisorName ? ` · ${facility.facilitySupervisorName}` : ''}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-white/10 flex-shrink-0">
              <Building2 size={20} className="text-white/80" strokeWidth={2} />
            </div>
          </div>

          {/* ── Status Summary Cards ─────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {statRows.map(({ label, value, icon: Icon, color, bg, bar }) => (
              <div key={label} className="bg-white rounded-2xl border border-surface-border overflow-hidden shadow-sm">
                <div className={`h-1 ${bar}`} />
                <div className="px-5 py-4 flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl flex-shrink-0 ${bg}`}>
                    <Icon size={16} className={color} strokeWidth={2.2} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">{label}</p>
                    <p className={`text-2xl font-extrabold tabular-nums leading-none mt-0.5 ${value > 0 && label === 'Critical' ? 'text-danger' : value > 0 && label === 'Low Stock' ? 'text-warning-dark' : 'text-text'}`}>
                      {value}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* ── Vaccines Grid ────────────────────────────────────────── */}
          <div>
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="text-xs font-bold text-text-muted uppercase tracking-wider">
                Vaccine Inventory
              </h2>
              <span className="text-[10px] font-bold text-text-muted bg-white border border-surface-border px-2.5 py-1 rounded-lg tabular-nums">
                {(facility.vaccines ?? []).length} vaccines tracked
              </span>
            </div>

            {(facility.vaccines ?? []).length === 0 ? (
              <div className="text-center py-16 border border-dashed border-surface-border bg-white rounded-2xl text-text-muted shadow-sm">
                <Syringe size={36} className="mx-auto mb-3 opacity-20" />
                <p className="font-bold text-text">No vaccines configured</p>
                <p className="text-xs mt-1">No vaccine records have been set up for this facility yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {facility.vaccines.map((v) => (
                  <VaccineCard key={v.vaccineId} v={v} />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
