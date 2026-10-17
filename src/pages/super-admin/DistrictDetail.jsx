import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Building2 } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { getDistrict } from '../../lib/api'
import { buttonClasses } from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import PageHeader from '../../components/shared/PageHeader'
import Card from '../../components/shared/Card'
import StatusBadge from '../../components/shared/StatusBadge'
import StatCard from '../../components/shared/StatCard'
import EmptyState from '../../components/shared/EmptyState'
import ErrorState from '../../components/shared/ErrorState'
import { SkeletonRows } from '../../components/shared/SkeletonCard'
import { facilityStatus } from '../../lib/status'
import { plural } from '../../lib/format'

// district.facilities includes ucId/ucName/townId/townName (Round 23), so one call builds Town → UC → Facility.
export function groupByTownUc(facilities = []) {
  const townMap = new Map()
  for (const f of facilities) {
    const townKey = f.townId ?? '__none__'
    if (!townMap.has(townKey)) townMap.set(townKey, { id: townKey, name: f.townName ?? '—', ucs: new Map() })
    const town = townMap.get(townKey)
    const ucKey = f.ucId ?? '__none__'
    if (!town.ucs.has(ucKey)) town.ucs.set(ucKey, { id: ucKey, name: f.ucName ?? '—', facilities: [] })
    town.ucs.get(ucKey).facilities.push(f)
  }
  return Array.from(townMap.values())
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((town) => ({
      ...town,
      ucs: Array.from(town.ucs.values())
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((uc) => ({ ...uc, facilities: [...uc.facilities].sort((a, b) => a.name.localeCompare(b.name)) })),
    }))
}

function VaccineCounts({ sc = {} }) {
  const parts = [
    sc.critical > 0 && <span key="c" className="text-danger-dark">{sc.critical} critical</span>,
    sc.low > 0 && <span key="l" className="text-warning-dark">{sc.low} low</span>,
    sc.adequate > 0 && <span key="a">{sc.adequate} normal</span>,
  ].filter(Boolean)
  if (!parts.length) return <span>No vaccine data</span>
  return parts.reduce((acc, p, i) => (i ? [...acc, ' · ', p] : [p]), [])
}

// Town headings, then one hairline list per UC. Shared with the DistrictManagement expanded row.
// base defaults to '/super-admin'; pass '/district' for the district supervisor's Network page.
export function FacilityHierarchy({ towns, base = '/super-admin' }) {
  return (
    <div className="flex flex-col gap-6">
      {towns.map((town) => (
        <section key={town.id} aria-label={`Town ${town.name}`} className="flex flex-col gap-3">
          <h2 className="text-base font-semibold text-text">
            {town.name} <span className="text-sm font-normal text-text-muted">· {plural(town.ucs.length, 'UC')}</span>
          </h2>
          {town.ucs.map((uc) => (
            <Card key={uc.id} padding={false}>
              <div className="px-4 sm:px-5 py-2.5 border-b border-surface-border flex items-center justify-between gap-3 text-sm">
                {uc.id !== '__none__' && base === '/super-admin'
                  ? <Link to={`/super-admin/ucs/${uc.id}`} className="font-medium text-text hover:text-primary hover:underline">{uc.name}</Link>
                  : <span className="font-medium text-text">{uc.name}</span>}
                <span className="text-xs text-text-muted">{plural(uc.facilities.length, 'facility', 'facilities')}</span>
              </div>
              <ul className="divide-y divide-surface-border">
                {uc.facilities.map((f) => (
                  <li key={f.id}>
                    <Link to={`${base}/facilities/${f.id}`} className="px-4 sm:px-5 py-3 flex items-start justify-between gap-3 hover:bg-surface-alt">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-text truncate">{f.name}</p>
                        <p className="text-xs text-text-muted truncate tabular-nums">
                          {f.facilitySupervisorName ?? 'Unstaffed'} · <VaccineCounts sc={f.statusCounts} />
                        </p>
                      </div>
                      <StatusBadge status={facilityStatus(f.statusCounts)} />
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </section>
      ))}
    </div>
  )
}

export default function DistrictDetail() {
  const { id } = useParams()

  const { data: districtData, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['district', id],
    queryFn: () => getDistrict(id),
  })

  const district = districtData?.district
  const towns = useMemo(() => groupByTownUc(district?.facilities), [district])
  const totalUCs = towns.reduce((sum, t) => sum + t.ucs.length, 0)
  const sc = district?.statusCounts ?? {}

  return (
    <div>
      <Link to="/super-admin/districts" className={buttonClasses({ variant: 'ghost', size: 'sm', className: '-ml-3 mb-2' })}>
        <ArrowLeft size={14} strokeWidth={1.75} /> Districts
      </Link>

      {isError ? (
        <ErrorState title="Couldn’t load this district" error={error} onRetry={refetch} />
      ) : isLoading ? (
        <Card padding={false}><SkeletonRows rows={5} /></Card>
      ) : district && (
        <>
          <PageHeader
            breadcrumb="Super Admin › Network › Districts"
            title={district.name}
            subtitle={`${plural(towns.length, 'town')} · ${plural(totalUCs, 'UC')} · ${plural(district.facilityCount ?? 0, 'facility', 'facilities')}`}
            actions={<Badge type={district.isActive ? 'active' : 'inactive'} />}
          />

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
            <StatCard label="Critical" value={sc.critical ?? 0} tone={sc.critical ? 'critical' : undefined} subtitle="Restock now" />
            <StatCard label="Low" value={sc.low ?? 0} tone={sc.low ? 'low' : undefined} subtitle="Plan a delivery" />
            <StatCard label="Normal" value={sc.adequate ?? 0} subtitle="Stock is healthy" />
            <StatCard label="Not updated" value={sc.no_data ?? 0} subtitle="No stock recorded yet" />
          </div>

          {towns.length === 0
            ? <EmptyState framed icon={Building2} title="No facilities in this district" message="Add facilities under this district to start recording stock." />
            : <FacilityHierarchy towns={towns} />}
        </>
      )}
    </div>
  )
}
