import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle } from 'lucide-react'
import { getDashboard } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import StatCard from '../../components/shared/StatCard'
import FacilityCard from '../../components/shared/FacilityCard'
import { worstStatus } from '../../lib/status'

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

  // summary.byFacility is already scoped to this district_supervisor's own district
  const facilities = (data?.summary?.byFacility ?? []).map((f) => ({
    id: f.facilityId,
    name: f.facilityName,
    status: worstStatus(f.statusCounts),
  }))

  const counts = {
    adequate: facilities.filter((f) => f.status === 'adequate').length,
    low:      facilities.filter((f) => f.status === 'low' || f.status === 'no_data').length,
    critical: facilities.filter((f) => f.status === 'critical').length,
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
        <StatCard label="OK"        value={counts.adequate} icon={CheckCircle}   colorClass="text-success" />
        <StatCard label="Low Stock" value={counts.low}       icon={AlertTriangle} colorClass="text-warning" />
        <StatCard label="Critical"  value={counts.critical}  icon={AlertTriangle} colorClass="text-danger"  />
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
