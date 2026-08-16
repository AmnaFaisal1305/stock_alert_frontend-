import { useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { Search, MapPin, Building2, ArrowRight } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { getFacilities, getDistricts } from '../../lib/api'
import Table from '../../components/shared/Table'
import Badge from '../../components/ui/Badge'

export default function UCManagement() {
  const [searchQuery, setSearch] = useState('')

  const { data: facilityData, isLoading, isError } = useQuery({ queryKey: ['facilities'], queryFn: getFacilities })
  const { data: districtData }                      = useQuery({ queryKey: ['districts'],  queryFn: getDistricts  })

  const facilities  = facilityData?.facilities ?? []
  const districtMap = Object.fromEntries((districtData?.districts ?? []).map((d) => [d.id, d.name]))

  // Group facilities by unionCouncil
  const ucMap = {}
  for (const f of facilities) {
    if (!f.unionCouncil?.trim()) continue
    const key = f.unionCouncil.trim()
    if (!ucMap[key]) {
      ucMap[key] = {
        name:       key,
        districtId: f.districtId,
        town:       f.town?.trim() || null,
        facilities: [],
      }
    }
    ucMap[key].facilities.push(f)
  }

  const ucList = Object.values(ucMap).sort((a, b) => a.name.localeCompare(b.name))

  const filtered = ucList.filter((uc) => {
    const q = searchQuery.toLowerCase()
    return (
      uc.name.toLowerCase().includes(q) ||
      (districtMap[uc.districtId] ?? '').toLowerCase().includes(q) ||
      (uc.town ?? '').toLowerCase().includes(q)
    )
  })

  const columns = [
    {
      key: 'name',
      label: 'UC Name',
      render: (uc) => (
        <div className="flex items-center gap-2">
          <MapPin size={14} className="text-primary flex-shrink-0" />
          <span className="font-bold text-text">{uc.name}</span>
        </div>
      ),
    },
    {
      key: 'district',
      label: 'District',
      render: (uc) => (
        <span className="text-xs font-semibold text-text-muted">
          {districtMap[uc.districtId] ?? '—'}
        </span>
      ),
    },
    {
      key: 'town',
      label: 'Town',
      render: (uc) => (
        <span className="text-xs font-semibold text-text-muted">
          {uc.town ?? '—'}
        </span>
      ),
    },
    {
      key: 'facilities',
      label: 'Facilities',
      render: (uc) => (
        <div className="flex flex-col gap-1.5">
          {uc.facilities.map((f) => (
            <div key={f.id} className="flex items-center gap-2">
              <Building2 size={11} className="text-text-muted/60 flex-shrink-0" />
              <span className="text-xs font-semibold text-text">{f.name}</span>
              <Badge type={f.isActive ? 'active' : 'inactive'} />
            </div>
          ))}
        </div>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (uc) => (
        <div className="flex flex-col gap-1">
          {uc.facilities.map((f) => (
            <RouterLink
              key={f.id}
              to={`/super-admin/facilities/${f.id}`}
              className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline px-2 py-1"
            >
              View <ArrowRight size={11} strokeWidth={2.5} />
            </RouterLink>
          ))}
        </div>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-200">

      {/* Header */}
      <div className="bg-primary rounded-2xl px-6 py-5 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Union Councils</h1>
          <p className="text-sm text-white/70 mt-0.5">
            {!isLoading
              ? `${ucList.length} ${ucList.length === 1 ? 'UC' : 'UCs'} · ${facilities.filter((f) => f.unionCouncil).length} facilities assigned`
              : 'Loading…'}
          </p>
        </div>
      </div>

      {/* Search */}
      {!isLoading && !isError && ucList.length > 0 && (
        <div className="relative w-80">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
          <input
            type="text"
            placeholder="Search by UC, district or town…"
            value={searchQuery}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-3.5 py-2.5 text-sm border border-surface-border rounded-xl bg-white shadow-sm focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all placeholder:text-text-muted/60"
          />
        </div>
      )}

      {/* Loading skeletons */}
      {isLoading && (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 bg-slate-50 border border-slate-200 rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {/* Error */}
      {isError && (
        <div className="bg-danger-bg border border-danger/10 text-xs font-semibold text-danger rounded-xl px-4 py-3">
          Failed to load data. Please try refreshing.
        </div>
      )}

      {/* No UCs registered at all */}
      {!isLoading && !isError && ucList.length === 0 && (
        <div className="bg-white border border-surface-border rounded-2xl px-6 py-12 text-center shadow-sm">
          <MapPin size={32} className="text-text-muted/40 mx-auto mb-3" />
          <p className="text-sm font-bold text-text">No Union Councils yet</p>
          <p className="text-xs text-text-muted mt-1">
            Assign a Union Council when creating a facility to see it listed here.
          </p>
        </div>
      )}

      {/* Table */}
      {!isLoading && !isError && ucList.length > 0 && (
        <Table
          columns={columns}
          rows={filtered}
          rowKey={(uc) => uc.name}
          emptyMessage={`No UCs match "${searchQuery}".`}
        />
      )}
    </div>
  )
}
