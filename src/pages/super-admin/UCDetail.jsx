import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { getUnionCouncils, getFacilities, getDashboard } from '../../lib/api'
import PageHeader from '../../components/shared/PageHeader'
import StatusBadge from '../../components/shared/StatusBadge'
import StatCard from '../../components/shared/StatCard'
import Table from '../../components/shared/Table'
import Card from '../../components/shared/Card'
import EmptyState from '../../components/shared/EmptyState'
import { SkeletonRows } from '../../components/shared/SkeletonCard'
import Badge from '../../components/ui/Badge'
import { buttonClasses } from '../../components/ui/Button'
import { facilityStatus } from '../../lib/status'
import { plural } from '../../lib/format'

const KPIS = [
  { status: 'critical', label: 'Critical',    context: 'Restock now' },
  { status: 'low',      label: 'Low',         context: 'Plan a delivery' },
  { status: 'adequate', label: 'Normal',      context: 'Stock is healthy' },
  { status: 'no_data',  label: 'Not updated', context: 'No stock recorded yet' },
]

// Per-facility vaccine-line counts, e.g. "2 critical · 1 low · 9 normal".
function VaccineCounts({ sc = {} }) {
  const parts = [
    sc.critical > 0 && <span key="c" className="text-danger-dark">{sc.critical} critical</span>,
    sc.low > 0 && <span key="l" className="text-warning-dark">{sc.low} low</span>,
    sc.adequate > 0 && <span key="a">{sc.adequate} normal</span>,
  ].filter(Boolean)
  if (!parts.length) return <span className="text-text-muted">—</span>
  return <span className="tabular-nums">{parts.reduce((acc, p, i) => (i ? [...acc, ' · ', p] : [p]), [])}</span>
}

export default function UCDetail() {
  const { id } = useParams()

  const { data: ucsData, isLoading: ucLoading } = useQuery({
    queryKey: ['ucs'],
    queryFn: () => getUnionCouncils(),
    staleTime: 30_000,
  })

  const { data: facilityData, isLoading: facLoading } = useQuery({
    queryKey: ['facilities', { ucId: id }],
    queryFn: () => getFacilities({ ucId: id }),
    staleTime: 30_000,
  })

  const { data: dashData } = useQuery({
    queryKey: ['dashboard'],
    queryFn: getDashboard,
    staleTime: 30_000,
  })

  const uc = useMemo(
    () => (ucsData?.unionCouncils ?? []).find((u) => u.id === id),
    [ucsData, id]
  )

  const facilities = facilityData?.facilities ?? []

  const statusByFacilityId = useMemo(
    () => new Map(
      (dashData?.summary?.byFacility ?? []).map((f) => [f.facilityId, facilityStatus(f.statusCounts)])
    ),
    [dashData]
  )

  const statusCounts = useMemo(() => {
    const counts = { critical: 0, low: 0, adequate: 0, no_data: 0 }
    for (const f of facilities) {
      const s = statusByFacilityId.get(f.id) ?? 'no_data'
      counts[s] = (counts[s] ?? 0) + 1
    }
    return counts
  }, [facilities, statusByFacilityId])

  const isLoading = ucLoading || facLoading
  const statusOf = (f) => statusByFacilityId.get(f.id) ?? 'no_data'

  const columns = [
    {
      key: 'name', label: 'Facility',
      render: (f) => <Link to={`/super-admin/facilities/${f.id}`} className="font-medium text-text hover:text-primary hover:underline">{f.name}</Link>,
    },
    { key: 'supervisor', label: 'Supervisor', render: (f) => f.facilitySupervisorName ?? <span className="text-text-muted">Unstaffed</span> },
    { key: 'vaccines', label: 'Vaccines', render: (f) => <VaccineCounts sc={f.statusCounts} /> },
    { key: 'status', label: 'Stock', render: (f) => <StatusBadge status={statusOf(f)} /> },
  ]

  return (
    <div>
      <Link to="/super-admin/ucs" className={buttonClasses({ variant: 'ghost', size: 'sm', className: '-ml-3 mb-3' })}>
        <ArrowLeft size={14} strokeWidth={1.75} /> Union Councils
      </Link>

      {isLoading ? (
        <Card padding={false}><SkeletonRows rows={5} /></Card>
      ) : !uc ? (
        <EmptyState framed title="Union council not found" message="It may have been removed or you no longer have access." />
      ) : (
        <>
          <PageHeader
            breadcrumb="Super Admin › Network › Union Councils"
            title={uc.name}
            subtitle={[uc.townName, uc.districtName, plural(facilities.length, 'facility', 'facilities'), uc.ucSupervisorName ? `Supervisor: ${uc.ucSupervisorName}` : 'No UC supervisor'].filter(Boolean).join(' · ')}
            actions={<Badge type={uc.isActive ? 'active' : 'inactive'} />}
          />

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-5">
            {KPIS.map(({ status, label, context }) => (
              <StatCard
                key={status}
                label={label}
                value={statusCounts[status]}
                unit={statusCounts[status] === 1 ? 'facility' : 'facilities'}
                tone={statusCounts[status] > 0 && status !== 'no_data' ? status : undefined}
                subtitle={context}
              />
            ))}
          </div>

          <Table
            columns={columns}
            rows={[...facilities].sort((a, b) => a.name.localeCompare(b.name))}
            emptyMessage="No facilities under this union council yet. Add one to start recording stock."
            mobileCard={(f) => (
              <Link to={`/super-admin/facilities/${f.id}`} className="block px-4 py-3.5 hover:bg-surface-alt">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-text truncate">{f.name}</p>
                    <p className="text-xs text-text-muted truncate">{f.facilitySupervisorName ?? 'Unstaffed'}</p>
                  </div>
                  <StatusBadge status={statusOf(f)} />
                </div>
              </Link>
            )}
          />
        </>
      )}
    </div>
  )
}
