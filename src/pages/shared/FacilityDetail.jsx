import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Syringe } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { getFacility } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import PageHeader from '../../components/shared/PageHeader'
import StatCard from '../../components/shared/StatCard'
import StatusBadge from '../../components/shared/StatusBadge'
import Table from '../../components/shared/Table'
import SearchInput from '../../components/shared/SearchInput'
import FilterChips from '../../components/shared/FilterChips'
import Card from '../../components/shared/Card'
import EmptyState from '../../components/shared/EmptyState'
import ErrorState from '../../components/shared/ErrorState'
import { SkeletonRows } from '../../components/shared/SkeletonCard'
import { ROLE_LABELS } from '../../lib/navigation'
import { displayVaccineName } from '../../lib/vaccineNames'
import { formatDate } from '../../lib/format'

const KPIS = [
  { key: 'critical', label: 'Critical' },
  { key: 'low',      label: 'Low' },
  { key: 'adequate', label: 'Normal' },
  { key: 'no_data',  label: 'Not updated' },
]

const muted = (text) => <span className="text-text-muted">{text}</span>

// Threshold the status is judged against: low first, then critical (legacy minQuantity fallback).
function threshold(v) {
  const doses = v.lowDoses ?? v.criticalDoses ?? v.minQuantity ?? 0
  return { doses, vials: v.lowVials ?? v.criticalVials ?? null }
}

const columns = [
  { key: 'vaccine', label: 'Vaccine', render: (v) => <span className="font-medium whitespace-nowrap" dir="auto">{displayVaccineName(v.vaccineName)}</span> },
  { key: 'status', label: 'Status', render: (v) => <StatusBadge status={v.status} /> },
  {
    key: 'stock', label: 'In stock', align: 'right',
    render: (v) => v.quantity == null ? muted('—') : <span className="tabular-nums whitespace-nowrap">{v.quantity} <span className="text-xs text-text-muted">doses</span></span>,
  },
  {
    key: 'threshold', label: 'Low threshold', align: 'right',
    render: (v) => {
      const t = threshold(v)
      if (!(t.doses > 0)) return muted('Not set')
      return (
        <span className="tabular-nums whitespace-nowrap">
          {t.doses} <span className="text-xs text-text-muted">doses</span>
          {t.vials != null && <span className="block text-xs text-text-muted">{t.vials} vials</span>}
          {v.thresholdOverridden && <span className="block text-xs text-text-muted">Facility override</span>}
        </span>
      )
    },
  },
  {
    key: 'recorded', label: 'Last recorded', align: 'right',
    render: (v) => v.recordedAt ? <span className="text-text-muted whitespace-nowrap">{formatDate(v.recordedAt)}</span> : <span className="text-warning-dark">Never</span>,
  },
]

export default function FacilityDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['facility', id],
    queryFn: () => getFacility(id),
  })

  const facility = data?.facility
  const counts = facility?.statusCounts ?? {}
  const allVaccines = facility?.vaccines ?? []

  const q = searchQuery.trim().toLowerCase()
  const filteredVaccines = allVaccines.filter((v) =>
    displayVaccineName(v.vaccineName).toLowerCase().includes(q) &&
    (statusFilter === 'all' || v.status === statusFilter))

  const chipOptions = [
    { value: 'all', label: 'All', count: allVaccines.length },
    ...KPIS.map((k) => ({ value: k.key, label: k.label, status: k.key, count: counts[k.key] ?? 0 })),
  ]

  return (
    <div>
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-3 -ml-2">
        <ArrowLeft size={14} strokeWidth={1.75} /> Back
      </Button>

      {isError ? (
        <ErrorState title="Couldn’t load this facility" error={error} onRetry={refetch} />
      ) : isLoading ? (
        <Card padding={false}><SkeletonRows rows={6} /></Card>
      ) : facility && (
        <>
          <PageHeader
            size="display"
            breadcrumb={`${ROLE_LABELS[user?.role] ?? 'Facility'} › Facilities`}
            title={facility.name}
            subtitle={`${facility.districtName} District${facility.facilitySupervisorName ? ` · ${facility.facilitySupervisorName}` : ''}`}
            actions={<Badge type={facility.isActive ? 'active' : 'inactive'} />}
          />

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-5">
            {KPIS.map(({ key, label }) => {
              const value = counts[key] ?? 0
              return (
                <StatCard
                  key={key}
                  label={label}
                  value={value}
                  unit={value === 1 ? 'vaccine' : 'vaccines'}
                  tone={value > 0 && key !== 'no_data' ? key : undefined}
                  onClick={() => setStatusFilter(statusFilter === key ? 'all' : key)}
                  active={statusFilter === key}
                />
              )
            })}
          </div>

          <section aria-labelledby="inventory-heading">
            <h2 id="inventory-heading" className="text-base font-semibold text-text mb-3">
              Vaccine stock
              <span className="ml-2 text-sm font-normal text-text-muted tabular-nums">{filteredVaccines.length} of {allVaccines.length}</span>
            </h2>

            {allVaccines.length === 0 ? (
              <EmptyState framed icon={Syringe} title="No vaccines configured" message="No vaccine records have been set up for this facility yet." />
            ) : (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col lg:flex-row lg:items-center gap-3">
                  <SearchInput value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search vaccine…" />
                  <FilterChips label="Stock status" value={statusFilter} onChange={setStatusFilter} options={chipOptions} />
                </div>
                <Table
                  columns={columns}
                  rows={filteredVaccines}
                  rowKey={(v) => v.vaccineId}
                  emptyMessage="No vaccines match the search or status filter."
                  mobileCard={(v) => (
                    <div className="px-4 py-3.5 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-text truncate" dir="auto">{displayVaccineName(v.vaccineName)}</p>
                        <p className="text-xs text-text-muted tabular-nums">
                          {v.quantity ?? '—'} doses · {v.recordedAt ? formatDate(v.recordedAt) : 'never recorded'}
                        </p>
                      </div>
                      <StatusBadge status={v.status} />
                    </div>
                  )}
                />
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
