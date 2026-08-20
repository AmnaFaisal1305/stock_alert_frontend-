import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, Building2, AlertCircle, User, MapPin, ArrowRight } from 'lucide-react'
import { getDashboard, getDistricts } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import StatCard from '../../components/shared/StatCard'
import FacilityCard from '../../components/shared/FacilityCard'
import SkeletonCard from '../../components/shared/SkeletonCard'
import { worstStatus, facilityStatus } from '../../lib/status'

function AlertBanner({ criticalCount, lowCount }) {
  if (criticalCount > 0) {
    return (
      <div className="bg-danger-bg border border-danger/20 rounded-xl px-5 py-4 flex items-center gap-4">
        <div className="relative flex-shrink-0">
          <span className="absolute inline-flex h-5 w-5 rounded-full bg-danger/30 animate-ping" />
          <AlertCircle size={22} className="relative text-danger" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-danger">
            {criticalCount} facilit{criticalCount > 1 ? 'ies' : 'y'} critically low — immediate action required
          </p>
          <p className="text-xs text-danger/70 mt-0.5">Restock as soon as possible to avoid service interruption</p>
        </div>
        <Link to="/district/facilities" className="flex items-center gap-1 text-xs font-semibold text-danger hover:underline flex-shrink-0">
          View Facilities <ArrowRight size={12} />
        </Link>
      </div>
    )
  }
  if (lowCount > 0) {
    return (
      <div className="bg-warning-bg border border-warning/20 rounded-xl px-5 py-4 flex items-center gap-4">
        <AlertTriangle size={20} className="text-warning flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-warning-dark">
            {lowCount} facilit{lowCount > 1 ? 'ies' : 'y'} running low on stock
          </p>
          <p className="text-xs text-warning-dark/70 mt-0.5">Plan restocking before levels become critical</p>
        </div>
        <Link to="/district/facilities" className="flex items-center gap-1 text-xs font-semibold text-warning-dark hover:underline flex-shrink-0">
          View Facilities <ArrowRight size={12} />
        </Link>
      </div>
    )
  }
  return null
}

export default function DistrictDashboard() {
  const { user } = useAuth()
  const { data, isLoading, isError } = useQuery({
    queryKey: ['dashboard'],
    queryFn: getDashboard,
    refetchInterval: 15_000,
    staleTime: 10_000,
  })

  const { data: districtData } = useQuery({
    queryKey: ['districts'],
    queryFn: getDistricts,
    staleTime: 60_000,
  })

  const province     = districtData?.districts?.[0]?.province ?? null
  const districtName = districtData?.districts?.[0]?.name ?? null

  const townCount = data?.summary?.townCount ?? 0
  const ucCount   = data?.summary?.ucCount   ?? 0

  const { facilities, counts } = useMemo(() => {
    const facilities = (data?.summary?.byFacility ?? []).map((f) => ({
      id: f.facilityId, name: f.facilityName,
      status: facilityStatus(f.statusCounts), statusCounts: f.statusCounts,
    }))
    const counts = {
      critical: facilities.filter((f) => f.status === 'critical').length,
      low:      facilities.filter((f) => f.status === 'low').length,
      adequate: facilities.filter((f) => f.status === 'adequate').length,
      noData:   facilities.filter((f) => f.status === 'no_data').length,
    }
    return { facilities, counts }
  }, [data])

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 animate-pulse">
        <div className="h-6 bg-slate-100 rounded w-1/4" />
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mt-2">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-28 bg-slate-50 border border-slate-200 rounded-2xl" />)}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
          {[1, 2, 3].map((i) => <SkeletonCard key={i} lines={3} />)}
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="bg-danger-bg border border-danger/10 text-xs font-semibold text-danger rounded-xl px-4 py-3">
        Failed to load district dashboard. Please try refreshing.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-200">
      {/* Page Header */}
      <div className="bg-primary rounded-2xl px-6 py-5">
        <p className="text-sm text-white/70 font-semibold">
          District Name: <span className="text-white font-bold">{districtName ?? '—'}</span>
        </p>
        <div className="flex flex-wrap items-center gap-4 mt-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-white/80">
            <User size={12} className="opacity-70" /> {user.name}
          </span>
          {province && (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-white/80">
              <MapPin size={12} className="opacity-70" /> {province}
            </span>
          )}
        </div>
      </div>

      {/* Alert Banner */}
      <AlertBanner criticalCount={counts.critical} lowCount={counts.low} />

      {/* Stats Summary Panel */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Critical"
          value={counts.critical}
          icon={AlertCircle}
          colorClass={counts.critical > 0 ? 'text-danger' : 'text-text-muted'}
          subtitle={counts.critical > 0 ? 'Requires immediate action' : 'All clear'}
        />
        <StatCard
          label="Low Stock"
          value={counts.low}
          icon={AlertTriangle}
          colorClass={counts.low > 0 ? 'text-warning-dark' : 'text-text-muted'}
          subtitle={counts.low > 0 ? 'Action suggested' : 'Levels healthy'}
        />
        <StatCard
          label="OK"
          value={counts.adequate}
          icon={CheckCircle2}
          colorClass="text-success-dark"
          subtitle={`${counts.adequate} running stable`}
        />
        <StatCard
          label="No Data"
          value={counts.noData}
          icon={Building2}
          colorClass={counts.noData > 0 ? 'text-text-muted' : 'text-text-muted'}
          subtitle={counts.noData > 0 ? 'No stock recorded yet' : 'All facilities reporting'}
        />
      </div>

      {/* Geography Stats */}
      {(townCount > 0 || ucCount > 0) && (
        <div className="grid grid-cols-2 gap-4">
          <StatCard label="Towns" value={townCount} icon={MapPin} colorClass="text-text-muted" subtitle="Administrative towns" />
          <StatCard label="Union Councils" value={ucCount} icon={Building2} colorClass="text-text-muted" subtitle="Registered union councils" />
        </div>
      )}

      {/* Facilities Cards Section */}
      <div>
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="text-xs font-bold text-text-muted uppercase tracking-wider">Facilities &amp; Vaccine Health</h2>
          <span className="text-[10px] font-bold text-text-muted bg-white border border-surface-border px-2.5 py-1 rounded-lg">
            {facilities.length} {facilities.length === 1 ? 'facility' : 'facilities'} listed
          </span>
        </div>

        {facilities.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-surface-border bg-white rounded-2xl text-text-muted shadow-sm">
            <Building2 size={36} className="mx-auto mb-3 opacity-20" />
            <p className="font-bold text-text">No facilities listed</p>
            <p className="text-xs mt-1">Please register facilities in Facility Management to configure monitoring thresholds.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {facilities.map((f) => (
              <FacilityCard key={f.id} facility={f} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
