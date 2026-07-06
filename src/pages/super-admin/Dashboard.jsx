import { useQuery } from '@tanstack/react-query'
import { Building2, Map as MapIcon, AlertTriangle } from 'lucide-react'
import { getDashboard, getDistricts } from '../../lib/api'
import StatCard from '../../components/shared/StatCard'
import DistrictCard from '../../components/shared/DistrictCard'

function worstStatus(statuses) {
  if (statuses.includes('red'))   return 'red'
  if (statuses.includes('amber')) return 'amber'
  if (statuses.includes('no_data')) return 'amber'
  return 'green'
}

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

  // Build distinct districts from flat (facility × vaccine) rows
  const districtMap = new Map()
  for (const row of (data?.facilities ?? [])) {
    if (!districtMap.has(row.districtId)) {
      districtMap.set(row.districtId, {
        id: row.districtId,
        name: districtNameById[row.districtId] ?? row.districtId,
        statuses: [],
        facilityIds: new Set(),
      })
    }
    const d = districtMap.get(row.districtId)
    d.statuses.push(row.status)
    d.facilityIds.add(row.facilityId)
  }

  const districts = Array.from(districtMap.values()).map((d) => ({
    id: d.id,
    name: d.name,
    facilityCount: d.facilityIds.size,
    status: worstStatus(d.statuses),
  }))

  const counts = {
    total: districts.length,
    green: districts.filter((d) => d.status === 'green').length,
    amber: districts.filter((d) => d.status === 'amber').length,
    red:   districts.filter((d) => d.status === 'red').length,
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-text">System Dashboard</h1>
        <p className="text-sm text-text-muted mt-0.5">All districts — system-wide overview</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Districts" value={counts.total} icon={MapIcon}        colorClass="text-primary"  />
        <StatCard label="OK"              value={counts.green} icon={Building2}      colorClass="text-success"  />
        <StatCard label="Low Stock"       value={counts.amber} icon={AlertTriangle}  colorClass="text-warning"  />
        <StatCard label="Critical"        value={counts.red}   icon={AlertTriangle}  colorClass="text-danger"   />
      </div>

      <div>
        <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">Districts</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {districts.map((d) => (
            <DistrictCard key={d.id} district={d} />
          ))}
        </div>
      </div>
    </div>
  )
}
