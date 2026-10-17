import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getDashboard, getTowns, getUnionCouncils } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import Select from '../../components/ui/Select'
import Button from '../../components/ui/Button'
import PageHeader from '../../components/shared/PageHeader'
import Card from '../../components/shared/Card'
import ErrorState from '../../components/shared/ErrorState'
import { SkeletonRows } from '../../components/shared/SkeletonCard'
import { FacilityBoard } from '../../components/facilities/FacilityOverview'
import { useFacilityList } from '../../components/facilities/FacilityDirectory'
import { plural } from '../../lib/format'

export default function DistrictDashboard() {
  const { user } = useAuth()
  // One scope (town → UC) drives both the server-side dashboard query and the facility list below.
  const [townId, setTownId] = useState('')
  const [ucId, setUcId] = useState('')
  const scope = { townId: townId || undefined, ucId: ucId || undefined }

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['dashboard', scope],
    queryFn:  () => getDashboard(scope),
    placeholderData: (prev) => prev,
    refetchInterval: 15_000,
    staleTime: 10_000,
  })
  const facilitiesQ = useFacilityList()
  const { data: townData } = useQuery({ queryKey: ['towns'], queryFn: getTowns, staleTime: 60_000 })
  const { data: ucData } = useQuery({ queryKey: ['ucs'], queryFn: () => getUnionCouncils(), staleTime: 60_000 })

  const townOptions = [
    { value: '', label: 'All towns' },
    ...(townData?.towns ?? []).filter((t) => t.isActive).map((t) => ({ value: t.id, label: t.name })),
  ]
  const ucOptions = [
    { value: '', label: 'All union councils' },
    ...(ucData?.unionCouncils ?? [])
      .filter((uc) => uc.isActive && (!townId || uc.townId === townId))
      .map((uc) => ({ value: uc.id, label: uc.name })),
  ]

  const facilities = useMemo(
    () => (facilitiesQ.data?.facilities ?? []).filter((f) => (!townId || f.townId === townId) && (!ucId || f.ucId === ucId)),
    [facilitiesQ.data, townId, ucId],
  )

  const s = data?.summary
  const districtName = s?.districtName ?? user?.districtName
  const subtitle = [
    s?.province,
    s?.townCount ? plural(s.townCount, 'town') : null,
    s?.ucCount ? plural(s.ucCount, 'UC') : null,
    plural(facilities.length, 'facility', 'facilities'),
  ].filter(Boolean).join(' · ')

  return (
    <div>
      <PageHeader
        size="display"
        breadcrumb="District Supervisor › Dashboard"
        title={districtName ? `${districtName} District` : 'My district'}
        subtitle={facilitiesQ.isLoading ? undefined : subtitle}
      />

      <div className="flex flex-wrap items-end gap-3 mb-5">
        <div className="w-full sm:w-56">
          <Select id="scope-town" label="Town" options={townOptions} value={townId} onChange={(e) => { setTownId(e.target.value); setUcId('') }} />
        </div>
        <div className="w-full sm:w-64">
          <Select id="scope-uc" label="Union council" options={ucOptions} value={ucId} onChange={(e) => setUcId(e.target.value)} disabled={ucOptions.length === 1} />
        </div>
        {(townId || ucId) && <Button variant="ghost" onClick={() => { setTownId(''); setUcId('') }}>Clear</Button>}
      </div>

      {isError || facilitiesQ.isError ? (
        <ErrorState title="Couldn’t load the district dashboard" error={error ?? facilitiesQ.error} onRetry={() => { refetch(); facilitiesQ.refetch() }} />
      ) : isLoading || facilitiesQ.isLoading ? (
        <Card padding={false}><SkeletonRows rows={6} /></Card>
      ) : (
        <FacilityBoard facilities={facilities} dashboard={data} base="/district" />
      )}
    </div>
  )
}
