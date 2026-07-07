import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle } from 'lucide-react'
import { getDashboard } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import StatCard from '../../components/shared/StatCard'
import FacilityCard from '../../components/shared/FacilityCard'

function worstStatus(statuses) {
  if (statuses.includes('red'))     return 'red'
  if (statuses.includes('amber'))   return 'amber'
  if (statuses.includes('no_data')) return 'amber'
  return 'green'
}

export default function DistrictDashboard() {
  const { user } = useAuth()
  const { data, isLoading, isError } = useQuery({
    queryKey: ['dashboard'],
    queryFn: getDashboard,
    refetchInterval: 15_000,
  })

  if (isLoading) return <p className="text-text-muted">Loading dashboard…</p>
  if (isError)   return <p className="text-danger">Failed to load dashboard.</p>

  const myRows = (data?.facilities ?? []).filter((r) => r.districtId === user.districtId)
  const districtName = myRows[0]?.districtName

  const facilityMap = new Map()
  for (const row of myRows) {
    if (!facilityMap.has(row.facilityId)) {
      facilityMap.set(row.facilityId, {
        id: row.facilityId,
        name: row.facilityName,
        statuses: [],
      })
    }
    facilityMap.get(row.facilityId).statuses.push(row.status)
  }

  const facilities = Array.from(facilityMap.values()).map((f) => ({
    ...f,
    status: worstStatus(f.statuses),
  }))

  const counts = {
    green: facilities.filter((f) => f.status === 'green').length,
    amber: facilities.filter((f) => f.status === 'amber').length,
    red:   facilities.filter((f) => f.status === 'red').length,
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-text">District Dashboard</h1>
        <p className="text-sm text-text-muted mt-0.5">
          {districtName ? districtName : 'Facilities within your district'}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="OK"        value={counts.green} icon={CheckCircle}  colorClass="text-success" />
        <StatCard label="Low Stock" value={counts.amber} icon={AlertTriangle} colorClass="text-warning" />
        <StatCard label="Critical"  value={counts.red}   icon={AlertTriangle} colorClass="text-danger"  />
      </div>

      <div>
        <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">Facilities</h2>
        {facilities.length === 0 ? (
          <p className="text-text-muted text-sm">No facilities in your district yet.</p>
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
