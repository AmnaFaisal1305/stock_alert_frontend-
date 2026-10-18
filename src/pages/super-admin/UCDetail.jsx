import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, AlertTriangle, TrendingDown, CheckCircle2, HelpCircle, Building2, Eye } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { getUnionCouncils, getFacilities, getDashboard } from '../../lib/api'
import PageHeader from '../../components/shared/PageHeader'
import StatusBadge from '../../components/shared/StatusBadge'
import StatCard from '../../components/shared/StatCard'
import Table from '../../components/shared/Table'
import Card from '../../components/shared/Card'
import EmptyState from '../../components/shared/EmptyState'
import { SkeletonRows } from '../../components/shared/SkeletonCard'
import EntityCard from '../../components/shared/EntityCard'
import Badge from '../../components/ui/Badge'
import { buttonClasses } from '../../components/ui/Button'
import RowActions from '../../components/ui/RowActions'
import ViewToggle from '../../components/ui/ViewToggle'
import ExportButton from '../../components/ui/ExportButton'
import { useViewMode } from '../../hooks/useViewMode'
import { facilityStatus, statusConfig } from '../../lib/status'
import { plural } from '../../lib/format'

const KPIS = [
  { status: 'critical', context: 'Restock now',           icon: AlertTriangle },
  { status: 'low',      context: 'Plan a stock request',  icon: TrendingDown },
  { status: 'adequate', context: 'At or above threshold', icon: CheckCircle2 },
  { status: 'no_data',  context: 'No stock recorded yet', icon: HelpCircle },
].map((k) => ({ ...k, label: statusConfig(k.status).label }))

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
  const [view, setView] = useViewMode('admin-uc-detail')

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
    { key: 'supervisor', label: 'Facility Supervisor', render: (f) => f.facilitySupervisorName ?? <span className="text-text-muted">Unstaffed</span> },
    { key: 'vaccines', label: 'Vaccines', render: (f) => <VaccineCounts sc={f.statusCounts} /> },
    { key: 'status', label: 'Stock', render: (f) => <StatusBadge status={statusOf(f)} /> },
  ]

  const gridCard = (f) => (
    <EntityCard
      icon={Building2}
      accent={statusOf(f)}
      title={f.name}
      subtitle={f.facilitySupervisorName ?? 'Unstaffed'}
      badge={<StatusBadge status={statusOf(f)} />}
      meta={[{ label: 'Vaccines', value: <VaccineCounts sc={f.statusCounts} /> }]}
      actions={<RowActions actions={[{ icon: Eye, label: 'View facility', to: `/super-admin/facilities/${f.id}` }]} />}
    />
  )

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
            {KPIS.map(({ status, label, context, icon }) => (
              <StatCard
                key={status}
                icon={icon}
                accent={status}
                label={label}
                value={statusCounts[status]}
                unit={statusCounts[status] === 1 ? 'facility' : 'facilities'}
                tone={statusCounts[status] > 0 && status !== 'no_data' ? status : undefined}
                subtitle={context}
              />
            ))}
          </div>

          <div className="flex justify-end items-center gap-3 mb-3">
            <ViewToggle value={view} onChange={setView} />
            <ExportButton
              name={`uc-${uc.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-facilities`}
              rows={[...facilities].sort((a, b) => a.name.localeCompare(b.name))}
              columns={[
                { label: 'Facility', value: (f) => f.name },
                { label: 'Union council', value: () => uc.name },
                { label: 'Town', value: () => uc.townName },
                { label: 'District', value: () => uc.districtName },
                { label: 'Facility Supervisor', value: (f) => f.facilitySupervisorName ?? 'Unstaffed' },
                { label: 'Stock status', value: (f) => statusConfig(statusOf(f)).label },
                { label: 'Critical vaccines', value: (f) => f.statusCounts?.critical ?? 0 },
                { label: 'Low vaccines', value: (f) => f.statusCounts?.low ?? 0 },
                { label: 'Normal vaccines', value: (f) => f.statusCounts?.adequate ?? 0 },
              ]}
            />
          </div>
          <Table
            columns={columns}
            rows={[...facilities].sort((a, b) => a.name.localeCompare(b.name))}
            view={view}
            gridCard={gridCard}
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
