// Facility rows shared by the UC dashboard and the UC Facilities page.
import { Link } from 'react-router-dom'
import StatusBadge from '../../components/shared/StatusBadge'
import { facilityStatus, STATUS_RANK } from '../../lib/status'
import { timeAgo } from '../../lib/format'

export const STATUS_FILTERS = [
  { value: 'all',      label: 'All' },
  { value: 'critical', label: 'Critical', status: 'critical' },
  { value: 'low',      label: 'Low',      status: 'low' },
  { value: 'adequate', label: 'Normal',   status: 'adequate' },
  { value: 'no_data',  label: 'Not updated', status: 'no_data' },
]

// facilityId → critical | low | adequate | no_data, from GET /api/dashboard.
export function facilityStatusMap(dashboard) {
  return new Map((dashboard?.summary?.byFacility ?? []).map((f) => [f.facilityId, facilityStatus(f.statusCounts)]))
}

export function countByStatus(facilities, statusOf) {
  const counts = { all: facilities.length, critical: 0, low: 0, adequate: 0, no_data: 0 }
  facilities.forEach((f) => { counts[statusOf(f)]++ })
  return counts
}

export const worstFirst = (statusOf) => (a, b) =>
  (STATUS_RANK[statusOf(a)] - STATUS_RANK[statusOf(b)]) || a.name.localeCompare(b.name)

const muted = (v) => v ?? <span className="text-text-muted">—</span>

export function facilityColumns(statusOf) {
  return [
    {
      key: 'name', label: 'Facility',
      render: (f) => <Link to={`/uc/facilities/${f.id}`} className="font-medium text-text hover:text-primary hover:underline">{f.name}</Link>,
    },
    {
      key: 'uc', label: 'Union council',
      render: (f) => (
        <div>
          <p>{muted(f.ucName)}</p>
          {f.townName && <p className="text-xs text-text-muted">{f.townName}</p>}
        </div>
      ),
    },
    { key: 'supervisor', label: 'Supervisor', render: (f) => f.facilitySupervisorName ?? <span className="text-text-muted">Unstaffed</span> },
    { key: 'activity', label: 'Last activity', render: (f) => <span className="text-text-muted whitespace-nowrap">{f.lastActivityAt ? timeAgo(f.lastActivityAt) : 'Never'}</span> },
    { key: 'status', label: 'Stock', render: (f) => <StatusBadge status={statusOf(f)} /> },
  ]
}

export function FacilityMobileCard({ f, status }) {
  return (
    <Link to={`/uc/facilities/${f.id}`} className="block px-4 py-3.5 hover:bg-surface-alt">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-text truncate">{f.name}</p>
          <p className="text-xs text-text-muted truncate">
            {[f.ucName, f.facilitySupervisorName ?? 'Unstaffed', f.lastActivityAt && timeAgo(f.lastActivityAt)].filter(Boolean).join(' · ')}
          </p>
        </div>
        <StatusBadge status={status} />
      </div>
    </Link>
  )
}
