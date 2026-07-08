import { useQuery } from '@tanstack/react-query'
import { Map as MapIcon, CheckCircle2, AlertTriangle, AlertCircle } from 'lucide-react'
import { getDashboard, getDistricts } from '../../lib/api'
import StatCard from '../../components/shared/StatCard'
import DistrictCard from '../../components/shared/DistrictCard'
import SkeletonCard from '../../components/shared/SkeletonCard'
import { worstStatus } from '../../lib/status'

export default function SuperAdminDashboard() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['dashboard'],
    queryFn: getDashboard,
    refetchInterval: 15_000,
  })
  const { data: districtData } = useQuery({
    queryKey: ['districts'],
    queryFn: getDistricts,
  })

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 animate-pulse">
        <div className="h-6 bg-slate-100 rounded w-1/4" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-2">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-28 bg-slate-50 border border-slate-200 rounded-2xl" />)}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} lines={3} />)}
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="bg-danger-bg border border-danger/10 text-xs font-semibold text-danger rounded-xl px-4 py-3">
        Failed to load system dashboard. Please try refreshing.
      </div>
    )
  }

  const districtNameById = Object.fromEntries(
    (districtData?.districts ?? []).map((d) => [d.id, d.name])
  )

  // Roll up facility counts and health status to districts level
  const districtMap = new Map()
  for (const f of (data?.summary?.byFacility ?? [])) {
    if (!districtMap.has(f.districtId)) {
      districtMap.set(f.districtId, {
        id: f.districtId,
        name: districtNameById[f.districtId] ?? f.districtId,
        facilityStatuses: [],
        facilityCount: 0,
        statusCounts: { adequate: 0, low: 0, critical: 0 }
      })
    }
    const d = districtMap.get(f.districtId)
    const fStatus = worstStatus(f.statusCounts)
    d.facilityStatuses.push(fStatus)
    d.facilityCount += 1
    
    if (fStatus === 'adequate') d.statusCounts.adequate += 1
    else if (fStatus === 'low' || fStatus === 'no_data') d.statusCounts.low += 1
    else if (fStatus === 'critical') d.statusCounts.critical += 1
  }

  const districts = Array.from(districtMap.values()).map((d) => ({
    id: d.id,
    name: d.name,
    facilityCount: d.facilityCount,
    status: worstStatus(d.facilityStatuses),
    statusCounts: d.statusCounts,
  }))

  const counts = {
    total:    districts.length,
    adequate: districts.filter((d) => d.status === 'adequate').length,
    low:      districts.filter((d) => d.status === 'low' || d.status === 'no_data').length,
    critical: districts.filter((d) => d.status === 'critical').length,
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-200">
      {/* Page Header */}
      <div>
        <h1 className="text-xl font-bold text-text tracking-tight">System Dashboard</h1>
        <p className="text-sm text-text-muted mt-0.5">All districts — system-wide clinical stock status overview</p>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Districts"
          value={counts.total}
          icon={MapIcon}
          colorClass="text-primary"
          subtitle="Managed districts"
        />
        <StatCard
          label="Adequate Level"
          value={counts.adequate}
          icon={CheckCircle2}
          colorClass="text-success-dark"
          subtitle={counts.adequate === counts.total ? 'All systems healthy' : `${counts.adequate} running stable`}
        />
        <StatCard
          label="Low Stock Warning"
          value={counts.low}
          icon={AlertTriangle}
          colorClass={counts.low > 0 ? 'text-warning-dark' : 'text-text-muted'}
          subtitle={counts.low > 0 ? 'Action suggested' : 'Levels healthy'}
        />
        <StatCard
          label="Critical Low"
          value={counts.critical}
          icon={AlertCircle}
          colorClass={counts.critical > 0 ? 'text-danger' : 'text-text-muted'}
          subtitle={counts.critical > 0 ? 'Requires immediate action' : 'All clear'}
        />
      </div>

      {/* Districts List */}
      <div>
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="text-xs font-bold text-text-muted uppercase tracking-wider">Districts Status</h2>
          <span className="text-[10px] font-bold text-text-muted bg-white border border-surface-border px-2.5 py-1 rounded-lg">
            {districts.length} {districts.length === 1 ? 'district' : 'districts'} registered
          </span>
        </div>

        {districts.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-surface-border bg-white rounded-2xl text-text-muted shadow-sm">
            <MapIcon size={36} className="mx-auto mb-3 opacity-20" />
            <p className="font-bold text-text">No districts found</p>
            <p className="text-xs mt-1">Please register districts in District Management to configure monitor channels.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {districts.map((d) => (
              <DistrictCard key={d.id} district={d} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
