import { useQuery } from '@tanstack/react-query'
import { Building2, Map as MapIcon, AlertTriangle } from 'lucide-react'
import { getDashboard, getDistricts } from '../../lib/api'
import StatCard from '../../components/shared/StatCard'
import DistrictCard from '../../components/shared/DistrictCard'
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

  if (isLoading) return <p className="text-text-muted">Loading dashboard…</p>
  if (isError)   return <p className="text-danger">Failed to load dashboard.</p>

  const districtNameById = Object.fromEntries(
    (districtData?.districts ?? []).map((d) => [d.id, d.name])
  )

  // summary.byFacility is already the (facility, statusCounts) rollup — group it up one more
  // level into districts instead of re-deriving facility/status groupings from the flat rows.
  const districtMap = new Map()
  for (const f of (data?.summary?.byFacility ?? [])) {
    if (!districtMap.has(f.districtId)) {
      districtMap.set(f.districtId, {
        id: f.districtId,
        name: districtNameById[f.districtId] ?? f.districtId,
        facilityStatuses: [],
        facilityCount: 0,
      })
    }
    const d = districtMap.get(f.districtId)
    d.facilityStatuses.push(worstStatus(f.statusCounts))
    d.facilityCount += 1
  }

  const districts = Array.from(districtMap.values()).map((d) => ({
    id: d.id,
    name: d.name,
    facilityCount: d.facilityCount,
    status: worstStatus(d.facilityStatuses),
  }))

  const counts = {
    total:    districts.length,
    adequate: districts.filter((d) => d.status === 'adequate').length,
    low:      districts.filter((d) => d.status === 'low' || d.status === 'no_data').length,
    critical: districts.filter((d) => d.status === 'critical').length,
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-text">System Dashboard</h1>
        <p className="text-sm text-text-muted mt-0.5">All districts — system-wide overview</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Districts" value={counts.total}    icon={MapIcon}       colorClass="text-primary"  />
        <StatCard label="OK"              value={counts.adequate} icon={Building2}     colorClass="text-success"  />
        <StatCard label="Low Stock"       value={counts.low}      icon={AlertTriangle} colorClass="text-warning"  />
        <StatCard label="Critical"        value={counts.critical} icon={AlertTriangle} colorClass="text-danger"   />
      </div>

      <div>
        <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">Districts</h2>
        {districts.length === 0 ? (
          <p className="text-text-muted text-sm">No districts yet.</p>
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
