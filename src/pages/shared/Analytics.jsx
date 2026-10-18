import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip,
  ResponsiveContainer, LabelList, Cell,
} from 'recharts'
import { FileSpreadsheet, FileText, BarChart2, ChevronDown, X, PackageCheck, Syringe, Trash2, Percent, Clock, ClipboardCheck, SlidersHorizontal } from 'lucide-react'
import {
  getAnalytics, getDistricts, getUnionCouncils, getFacilities, getStockRequests,
} from '../../lib/api'
import { exportAnalyticsExcel, exportAnalyticsPdf } from '../../lib/reports'
import { displayVaccineName } from '../../lib/vaccineNames'
import { localDateStr, toLocalDateStr, formatDate } from '../../lib/format'
import { ROLE_LABELS } from '../../lib/navigation'
import { OPEN_STAGES, vaccineSummary } from '../../lib/stockRequests'
import { useAuth } from '../../context/AuthContext'
import { useChartTheme } from '../../hooks/useChartTheme'
import Table from '../../components/shared/Table'
import StatCard from '../../components/shared/StatCard'
import Card, { CardHeader } from '../../components/shared/Card'
import FilterChips from '../../components/shared/FilterChips'
import EmptyState from '../../components/shared/EmptyState'
import ErrorState from '../../components/shared/ErrorState'
import StatusBadge from '../../components/shared/StatusBadge'
import { SkeletonRows } from '../../components/shared/SkeletonCard'
import DatePicker from '../../components/ui/DatePicker'
import Button from '../../components/ui/Button'
import Select from '../../components/ui/Select'
import Tabs from '../../components/ui/Tabs'
import PageHeader from '../../components/shared/PageHeader'
import { RequestItemsTable } from '../../components/stock-requests/RequestList'

// ── Quick date presets ────────────────────────────────────────────────────────
const PRESETS = [
  { label: '30d', months: 1  },
  { label: '3m',  months: 3  },
  { label: '6m',  months: 6  },
  { label: '1y',  months: 12 },
]

function applyPreset(months) {
  const to   = new Date()
  const from = new Date()
  from.setMonth(from.getMonth() - months)
  from.setDate(1)
  return { from: toLocalDateStr(from), to: toLocalDateStr(to) }
}

function defaultFrom() {
  const d = new Date()
  d.setMonth(d.getMonth() - 11)
  d.setDate(1)
  return toLocalDateStr(d)
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtMonth(m) {
  const [y, mo] = m.split('-')
  return new Date(+y, +mo - 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
}

function abbrev(name, max = 13) {
  return name.length > max ? name.slice(0, max - 1) + '…' : name
}

function fmtNum(v) {
  return v >= 1000 ? `${+(v / 1000).toFixed(1)}k` : String(v)
}

const muted = (v) => <span className="text-text-muted">{v}</span>
const toned = (n, cls) => <span className={n > 0 ? `${cls} font-medium` : 'text-text-muted'}>{n || 0}</span>

// ── Chart pieces ──────────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label, nameKey }) {
  if (!active || !payload?.length) return null
  const title = nameKey ? (payload[0]?.payload?.[nameKey] ?? label) : label
  return (
    <div className="bg-surface border border-surface-border rounded-control shadow-float px-3.5 py-2.5 text-xs min-w-[150px] max-w-[230px]">
      <p className="font-semibold text-text mb-1.5 leading-tight break-words">{title}</p>
      {payload.filter((p) => (p.value ?? 0) > 0).map((p) => (
        <p key={p.dataKey ?? p.name} className="flex items-center justify-between gap-6">
          <span className="flex items-center gap-1.5 min-w-0 text-text-muted">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.fill ?? p.color }} aria-hidden="true" />
            <span className="truncate">{p.name}</span>
          </span>
          <span className="font-medium text-text tabular-nums">{(p.value ?? 0).toLocaleString()}</span>
        </p>
      ))}
    </div>
  )
}

function WastageTooltip({ active, payload, label, nameKey }) {
  if (!active || !payload?.length) return null
  const title = nameKey ? (payload[0]?.payload?.[nameKey] ?? label) : label
  const rate = payload[0]?.value ?? 0
  return (
    <div className="bg-surface border border-surface-border rounded-control shadow-float px-3.5 py-2.5 text-xs min-w-[160px]">
      <p className="font-semibold text-text mb-1.5 leading-tight break-words">{title}</p>
      <p className="text-text-muted">Waste rate: <span className="font-medium text-text">{rate}%</span></p>
    </div>
  )
}

function SeriesLegend({ items }) {
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-text-muted">
      {items.map(({ label, color }) => (
        <li key={label} className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ background: color }} aria-hidden="true" />{label}
        </li>
      ))}
    </ul>
  )
}

function ChartCard({ title, subtitle, legend, className = '', children }) {
  return (
    <Card className={className}>
      <CardHeader title={title} description={subtitle} action={legend && <SeriesLegend items={legend} />} />
      <div className="mt-4">{children}</div>
    </Card>
  )
}

function EmptyChart({ message = 'No data for this period' }) {
  return <EmptyState icon={BarChart2} title={message} />
}

// ── Tabs ──────────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'stockSummary', label: 'Stock Summary'  },
  { id: 'requests',     label: 'Stock Requests' },
  { id: 'approvals',    label: 'Approvals'      },
]

// Maps analytics display key → API status param for getStockRequests
const DETAIL_API_PARAM = {
  completed: 'completed',
  partial:   'partially_fulfilled',
  open:      null, // fetch all, filter client-side by OPEN_STAGES
  declined:  'declined',
  cancelled: 'cancelled',
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Analytics() {
  const { user } = useAuth()
  const t = useChartTheme()
  const [from, setFrom]             = useState(defaultFrom)
  const [to, setTo]                 = useState(() => localDateStr())
  const [activeTab, setTab]         = useState('stockSummary')
  const [exporting, setExporting]   = useState(null)
  const [exportError, setExportError] = useState('')

  // Requests tab filters
  const [reqDistrict,    setReqDistrict]    = useState(null)
  const [reqUc,          setReqUc]          = useState(null)
  const [reqFacilityId,  setReqFacilityId]  = useState(null)
  const [reqFacilityName, setReqFacilityName] = useState('')
  const [reqMonth,       setReqMonth]       = useState(null)
  const [detailStatus,   setDetailStatus]   = useState(null)
  const [expandedReq,    setExpandedReq]    = useState(null)

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['analytics', from, to, reqDistrict, reqUc, reqFacilityId],
    queryFn: () => getAnalytics({ from, to, districtId: reqDistrict, ucId: reqUc, facilityId: reqFacilityId }),
  })

  // Location cascade: narrows every section via the analytics query. Only roles above a UC can
  // list districts/UCs (others get 403), and their scope is already one UC or facility.
  const canFilterLocation = ['super_admin', 'observer', 'district_supervisor'].includes(user?.role)
  const { data: reqDistrictsData } = useQuery({
    queryKey: ['districts'],
    queryFn:  getDistricts,
    enabled:  canFilterLocation,
  })
  const { data: reqUcsData } = useQuery({
    queryKey: ['ucs', reqDistrict],
    queryFn:  () => getUnionCouncils({ districtId: reqDistrict }),
    enabled:  !!reqDistrict,
  })
  const { data: reqFacilitiesData } = useQuery({
    queryKey: ['facilities', reqUc],
    queryFn:  () => getFacilities({ ucId: reqUc }),
    enabled:  !!reqUc,
  })

  const detailApiParam = DETAIL_API_PARAM[detailStatus] ?? null
  const { data: detailData, isLoading: detailLoading } = useQuery({
    queryKey: ['stock-requests-detail', detailApiParam, reqMonth],
    queryFn:  () => getStockRequests(detailApiParam, { month: reqMonth }),
    enabled:  !!detailStatus,
  })

  const movement         = data?.movement        ?? []
  const remaining        = data?.remaining       ?? []
  const requests         = data?.requests        ?? []
  const pendingApprovals = data?.pendingApprovals ?? []

  // Non-status series take the categorical palette; request statuses take status hues.
  const C = {
    received:   t.series[0],
    dosesGiven: t.series[1],
    wasted:     t.series[2],
    remaining:  t.series[0],
    correction: t.series[0],
    threshold:  t.series[1],
    completed:  t.status('adequate'),
    partial:    t.status('low'),
    open:       t.series[1],
    declined:   t.status('critical'),
    cancelled:  t.status('no_data'),
  }

  // ── Vaccine movement rollup ───────────────────────────────────────────────
  const vaccineMovement = useMemo(() => {
    const acc = {}
    for (const row of movement) {
      if (!acc[row.vaccineId]) {
        acc[row.vaccineId] = {
          vaccineName: displayVaccineName(row.vaccineName),
          opening: 0, received: 0, used: 0, wasted: 0,
          adjustmentIncrease: 0, adjustmentDecrease: 0, usedDoses: 0,
        }
      }
      const v = acc[row.vaccineId]
      v.opening            += row.opening ?? 0
      v.received           += row.received
      v.used               += row.used
      v.wasted             += row.wasted
      v.adjustmentIncrease += row.adjustmentIncrease
      v.adjustmentDecrease += row.adjustmentDecrease
      v.usedDoses          += row.usedDoses
    }
    return Object.values(acc).sort((a, b) => a.vaccineName.localeCompare(b.vaccineName))
  }, [movement])

  const totals = useMemo(() => ({
    received:  vaccineMovement.reduce((s, v) => s + v.opening + v.received, 0),
    dosesGiven: vaccineMovement.reduce((s, v) => s + v.usedDoses, 0),
    wasted:    vaccineMovement.reduce((s, v) => s + v.wasted, 0),
  }), [vaccineMovement])

  const wastageRate = totals.received > 0
    ? +((totals.wasted / totals.received) * 100).toFixed(1)
    : 0

  const wastageTone = wastageRate === 0 ? undefined
    : wastageRate < 3 ? 'adequate'
    : wastageRate < 7 ? 'low'
    : 'critical'

  // ── Remaining stock rollup (extended: store + workers) ────────────────────
  const remainingByVaccine = useMemo(() => {
    const acc = {}
    for (const r of remaining) {
      const name = displayVaccineName(r.vaccineName)
      if (!acc[name]) acc[name] = { name, doses: 0, inStore: 0, withWorkers: 0 }
      acc[name].doses       += r.totalDoses ?? 0
      acc[name].inStore     += r.storeVials ?? 0
      acc[name].withWorkers += r.heldVials  ?? 0
    }
    return Object.values(acc)
      .sort((a, b) => b.doses - a.doses)
      .map((v) => ({ ...v, shortName: abbrev(v.name, 18), fullName: v.name }))
  }, [remaining])

  const remainingMap = useMemo(() => {
    const m = {}
    for (const r of remainingByVaccine) m[r.name] = r
    return m
  }, [remainingByVaccine])

  // ── Stock Summary combined rows (movement + remaining joined per vaccine) ──
  const stockSummaryRows = useMemo(() =>
    vaccineMovement.map((v) => {
      const rem   = remainingMap[v.vaccineName] ?? { doses: 0, inStore: 0, withWorkers: 0 }
      const total = v.opening + v.received
      const wasteRate = total > 0 ? +((v.wasted / total) * 100).toFixed(1) : 0
      return {
        vaccineName:  v.vaccineName,
        received:     total,
        dosesGiven:   v.usedDoses,
        wasted:       v.wasted,
        wasteRate,
        adjustments:  v.adjustmentIncrease - v.adjustmentDecrease,
        inStore:      rem.inStore,
        withWorkers:  rem.withWorkers,
        stockLeft:    rem.doses,
      }
    })
  , [vaccineMovement, remainingMap])

  // ── Chart data ────────────────────────────────────────────────────────────
  const stockFlowChartData = useMemo(() =>
    vaccineMovement.map((v) => ({
      name:          abbrev(v.vaccineName),
      fullName:      v.vaccineName,
      Received:      v.opening + v.received,
      'Doses Given': v.usedDoses,
      Wasted:        v.wasted,
    }))
  , [vaccineMovement])

  const wastageRateData = useMemo(() =>
    vaccineMovement
      .map((v) => {
        const total = v.opening + v.received
        const rate  = total > 0 ? +((v.wasted / total) * 100).toFixed(1) : 0
        return { name: abbrev(v.vaccineName, 18), fullName: v.vaccineName, rate }
      })
      .sort((a, b) => b.rate - a.rate)
  , [vaccineMovement])

  function wastageBarColor(rate) {
    if (rate >= 7) return t.status('critical')
    if (rate >= 3) return t.status('low')
    return t.status('adequate')
  }

  // ── Requests rollup ───────────────────────────────────────────────────────
  const requestsByMonth = useMemo(() => {
    const acc = {}
    for (const row of requests) {
      if (!acc[row.month]) acc[row.month] = {
        month: row.month, completed: 0, partially_fulfilled: 0,
        submitted: 0, cancelled: 0, declined: 0,
      }
      acc[row.month][row.status] = (acc[row.month][row.status] ?? 0) + row.count
    }
    return Object.values(acc).sort((a, b) => b.month.localeCompare(a.month))
  }, [requests])

  const requestChartData = useMemo(() =>
    [...requestsByMonth]
      .sort((a, b) => a.month.localeCompare(b.month))
      .map((r) => ({
        month:     fmtMonth(r.month),
        Completed: r.completed || 0,
        Partial:   r.partially_fulfilled || 0,
        Open:      r.submitted || 0,
        Declined:  r.declined || 0,
      }))
  , [requestsByMonth])

  const requestTotals = useMemo(() => {
    const tt = { completed: 0, partially_fulfilled: 0, submitted: 0, declined: 0, cancelled: 0 }
    for (const row of requests) tt[row.status] = (tt[row.status] || 0) + row.count
    return [
      { name: 'Completed', value: tt.completed,           key: 'completed' },
      { name: 'Partial',   value: tt.partially_fulfilled, key: 'partial'   },
      { name: 'Open',      value: tt.submitted,           key: 'open'      },
      { name: 'Declined',  value: tt.declined,            key: 'declined'  },
      { name: 'Cancelled', value: tt.cancelled,           key: 'cancelled' },
    ].filter((d) => d.value > 0)
  }, [requests])

  // Month-filtered totals (used when a month is selected)
  const filteredRequestTotals = useMemo(() => {
    if (!reqMonth) return requestTotals
    const row = requestsByMonth.find((r) => r.month === reqMonth)
    if (!row) return []
    return [
      { name: 'Completed', value: row.completed || 0,           key: 'completed' },
      { name: 'Partial',   value: row.partially_fulfilled || 0, key: 'partial'   },
      { name: 'Open',      value: row.submitted || 0,           key: 'open'      },
      { name: 'Declined',  value: row.declined || 0,            key: 'declined'  },
      { name: 'Cancelled', value: row.cancelled || 0,           key: 'cancelled' },
    ].filter((d) => d.value > 0)
  }, [reqMonth, requestTotals, requestsByMonth])

  // Cascade select options
  const reqDistrictOptions = useMemo(() =>
    (reqDistrictsData?.districts ?? []).map((d) => ({ value: d.id, label: d.name }))
  , [reqDistrictsData])

  const reqUcOptions = useMemo(() =>
    (reqUcsData?.unionCouncils ?? []).map((uc) => ({ value: uc.id, label: uc.name }))
  , [reqUcsData])

  const reqFacilityOptions = useMemo(() =>
    (reqFacilitiesData?.facilities ?? []).map((f) => ({ value: f.id, label: f.name }))
  , [reqFacilitiesData])

  const reqMonthOptions = useMemo(() =>
    [...requestsByMonth]
      .sort((a, b) => a.month.localeCompare(b.month))
      .map((r) => ({ value: r.month, label: fmtMonth(r.month) }))
  , [requestsByMonth])

  // Detail requests filtered by month + facility
  const detailRequests = useMemo(() => {
    let list = detailData?.stockRequests ?? []
    if (detailStatus === 'open')    list = list.filter((r) => OPEN_STAGES.has(r.stage))
    if (detailStatus === 'partial') list = list.filter((r) => r.stage === 'partially_fulfilled')
    if (reqFacilityName) list = list.filter((r) => r.facilityName === reqFacilityName)
    return list
  }, [detailData, detailStatus, reqFacilityName])

  // Table rows filtered by selected month
  const displayedRequestsByMonth = reqMonth
    ? requestsByMonth.filter((r) => r.month === reqMonth)
    : requestsByMonth

  function clearReqFilters() {
    setReqMonth(null); setDetailStatus(null); setExpandedReq(null)
  }

  // ── Approvals rollup ──────────────────────────────────────────────────────
  const approvalsByFacility = useMemo(() => {
    const acc = {}
    for (const r of pendingApprovals) {
      if (!acc[r.facilityName]) acc[r.facilityName] = { name: r.facilityName, Corrections: 0, Thresholds: 0 }
      if (r.type === 'stock_correction') acc[r.facilityName].Corrections += r.count
      else                               acc[r.facilityName].Thresholds  += r.count
    }
    return Object.values(acc)
      .sort((a, b) => (b.Corrections + b.Thresholds) - (a.Corrections + a.Thresholds))
      .slice(0, 10)
      .map((d) => ({ ...d, shortName: abbrev(d.name, 20), fullName: d.name }))
  }, [pendingApprovals])

  const approvalTotals = useMemo(() => ({
    corrections: pendingApprovals.filter((r) => r.type === 'stock_correction').reduce((s, r) => s + r.count, 0),
    thresholds:  pendingApprovals.filter((r) => r.type === 'threshold_change').reduce((s, r) => s + r.count, 0),
  }), [pendingApprovals])
  const totalPending = approvalTotals.corrections + approvalTotals.thresholds

  // ── Tab data counts ───────────────────────────────────────────────────────
  const tabCounts = useMemo(() => ({
    stockSummary: vaccineMovement.length,
    requests:     requestsByMonth.length,
    approvals:    pendingApprovals.length,
  }), [vaccineMovement, requestsByMonth, pendingApprovals])

  // ── Export ────────────────────────────────────────────────────────────────
  async function runExport(kind) {
    setExportError('')
    setExporting(kind)
    try {
      const fn = kind === 'xlsx' ? exportAnalyticsExcel : exportAnalyticsPdf
      await fn({ movement, from, to })
    } catch {
      setExportError('Could not generate the report. Please try again.')
    } finally {
      setExporting(null)
    }
  }

  const canExport = !isLoading && !isError && movement.length > 0
  const activePreset = PRESETS.find((p) => {
    const r = applyPreset(p.months)
    return r.from === from && r.to === to
  })?.label ?? null

  // ── Column definitions ────────────────────────────────────────────────────
  const stockSummaryColumns = [
    { key: 'vaccineName',  label: 'Vaccine',                             render: (r) => <span className="font-medium">{r.vaccineName}</span> },
    { key: 'received',     label: 'Received (opening + new)',            align: 'right', render: (r) => r.received || muted('—') },
    { key: 'dosesGiven',   label: 'Doses Given (to patients)',           align: 'right', render: (r) => r.dosesGiven || muted('—') },
    { key: 'wasted',       label: 'Wasted (discarded vials)',            align: 'right', render: (r) => toned(r.wasted, 'text-warning-dark') },
    { key: 'wasteRate',    label: 'Waste % (wasted ÷ received)',        align: 'right',
      render: (r) => {
        if (r.wasteRate === 0) return muted('0%')
        const cls = r.wasteRate >= 7 ? 'text-danger font-medium' : r.wasteRate >= 3 ? 'text-warning-dark font-medium' : 'text-success-dark font-medium'
        return <span className={cls}>{r.wasteRate}%</span>
      }
    },
    { key: 'adjustments',  label: 'Adjustments (net corrections)', align: 'right',
      render: (r) => {
        if (r.adjustments === 0) return muted('—')
        return <span className={`font-medium ${r.adjustments > 0 ? 'text-success-dark' : 'text-danger-dark'}`}>{r.adjustments > 0 ? `+${r.adjustments}` : `−${Math.abs(r.adjustments)}`}</span>
      }
    },
    { key: 'inStore',      label: 'In Store (cold chain store)',        align: 'right', render: (r) => r.inStore      || muted('—') },
    { key: 'withWorkers',  label: 'With Workers (assigned, not used)', align: 'right', render: (r) => r.withWorkers  || muted('—') },
    { key: 'stockLeft',    label: 'Stock Left (in store + workers)',   align: 'right', render: (r) => <span className="font-medium">{r.stockLeft || 0}</span> },
  ]

  const requestColumns = [
    { key: 'month', label: 'Month', render: (r) => <span className="font-medium">{fmtMonth(r.month)}</span> },
    { key: 'completed', label: 'Completed', align: 'right', render: (r) => toned(r.completed, 'text-success-dark') },
    { key: 'partially_fulfilled', label: 'Partial', align: 'right', render: (r) => toned(r.partially_fulfilled, 'text-warning-dark') },
    { key: 'submitted', label: 'Open', align: 'right', render: (r) => r.submitted || muted(0) },
    { key: 'cancelled', label: 'Cancelled', align: 'right', render: (r) => muted(r.cancelled || 0) },
    { key: 'declined', label: 'Declined', align: 'right', render: (r) => toned(r.declined, 'text-danger-dark') },
  ]

  const approvalsColumns = [
    { key: 'facilityName', label: 'Facility', render: (r) => <span className="font-medium">{r.facilityName}</span> },
    { key: 'type', label: 'Type', render: (r) => (r.type === 'stock_correction' ? 'Stock correction' : 'Threshold change') },
    { key: 'count', label: 'Pending', align: 'right', render: (r) => toned(r.count, 'text-warning-dark') },
  ]

  const grid   = <CartesianGrid vertical={false} stroke={t.grid} />
  const cursor = { fill: t.grid, fillOpacity: 0.4 }
  const loaded = !isLoading && !isError

  return (
    <div>
      <PageHeader
        breadcrumb={`${ROLE_LABELS[user?.role] ?? 'Analytics'} › Records`}
        title="Analytics"
        subtitle="Stock movement, remaining inventory, requests and approvals for a period"
      />

      {/* ── Period + export ──────────────────────────────────────────────── */}
      <Card className="mb-5">
        <div className="flex flex-col lg:flex-row lg:items-end gap-4 flex-wrap">
          <div className="flex items-end gap-3 flex-wrap">
            <DatePicker id="analytics-from" label="From" value={from} onChange={(e) => setFrom(e.target.value)} />
            <DatePicker id="analytics-to"   label="To"   value={to}   onChange={(e) => setTo(e.target.value)} />
          </div>
          {canFilterLocation && <div className="flex items-end gap-3 flex-wrap">
            <Select
              id="req-district"
              label="District"
              value={reqDistrict ?? ''}
              placeholder="All districts"
              options={reqDistrictOptions}
              onChange={(e) => {
                setReqDistrict(e.target.value || null)
                setReqUc(null); setReqFacilityId(null); setReqFacilityName('')
                setDetailStatus(null); setExpandedReq(null)
              }}
            />
            <Select
              id="req-uc"
              label="UC"
              value={reqUc ?? ''}
              placeholder="All UCs"
              options={reqUcOptions}
              disabled={!reqDistrict}
              onChange={(e) => {
                setReqUc(e.target.value || null)
                setReqFacilityId(null); setReqFacilityName('')
                setDetailStatus(null); setExpandedReq(null)
              }}
            />
            <Select
              id="req-facility"
              label="Facility"
              value={reqFacilityId ?? ''}
              placeholder="All facilities"
              options={reqFacilityOptions}
              disabled={!reqUc}
              onChange={(e) => {
                const v = e.target.value
                const f = (reqFacilitiesData?.facilities ?? []).find((x) => x.id === v)
                setReqFacilityId(v || null)
                setReqFacilityName(f?.name ?? '')
                setDetailStatus(null); setExpandedReq(null)
              }}
            />
          </div>}
          <FilterChips
            label="Quick period"
            value={activePreset}
            onChange={(label) => {
              const r = applyPreset(PRESETS.find((p) => p.label === label).months)
              setFrom(r.from); setTo(r.to)
            }}
            options={PRESETS.map((p) => ({ value: p.label, label: p.label }))}
          />
          <div className="flex items-center gap-2 lg:ml-auto">
            <Button variant="secondary" size="sm" onClick={() => runExport('xlsx')} disabled={!canExport || exporting !== null} title={canExport ? 'Download Excel report' : 'No data to export'}>
              <FileSpreadsheet size={14} strokeWidth={1.75} /> {exporting === 'xlsx' ? 'Preparing…' : 'Excel'}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => runExport('pdf')} disabled={!canExport || exporting !== null} title={canExport ? 'Download PDF report' : 'No data to export'}>
              <FileText size={14} strokeWidth={1.75} /> {exporting === 'pdf' ? 'Preparing…' : 'PDF'}
            </Button>
          </div>
        </div>
        {exportError && <p role="alert" className="mt-3 text-sm text-danger-dark bg-danger-bg rounded-control px-3.5 py-2.5">{exportError}</p>}
      </Card>

      <Tabs
        label="Analytics sections"
        value={activeTab}
        onChange={setTab}
        tabs={TABS.map((tb) => ({ value: tb.id, label: tb.label, count: loaded && tabCounts[tb.id] > 0 ? tabCounts[tb.id] : undefined }))}
        className="mb-5"
      />

      {isLoading && <Card padding={false}><SkeletonRows rows={6} /></Card>}

      {isError && <ErrorState title="Couldn't load analytics" error={error} onRetry={refetch} />}

      {loaded && (
        <>
          {/* ── Stock Summary ── */}
          {activeTab === 'stockSummary' && (
            <div className="flex flex-col gap-5">
              {/* Stat cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <StatCard label="Received" icon={PackageCheck} accent={1} value={totals.received} subtitle="Vials received (incl. opening)" />
                <StatCard label="Doses Given" icon={Syringe} accent={2} value={totals.dosesGiven} subtitle="Doses administered" />
                <StatCard label="Wasted" icon={Trash2} accent={3} value={totals.wasted} subtitle="Vials discarded" />
                <StatCard label="Waste %" icon={Percent} accent={wastageTone ?? 5} value={`${wastageRate}%`} tone={wastageTone} subtitle="Of all vials received" />
              </div>

              {/* Chart 1 — Wastage Rate by Vaccine */}
              <ChartCard
                title="Wastage Rate by Vaccine"
                subtitle="Wasted vials as a % of total received — green < 3%, amber 3–7%, red ≥ 7%"
              >
                {wastageRateData.length === 0 ? <EmptyChart /> : (
                  <ResponsiveContainer width="100%" height={Math.max(160, wastageRateData.length * 44)}>
                    <BarChart layout="vertical" data={wastageRateData} margin={{ top: 4, right: 60, left: 4, bottom: 4 }}>
                      <CartesianGrid horizontal={false} stroke={t.grid} />
                      <XAxis type="number" tick={t.tick} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
                      <YAxis type="category" dataKey="name" tick={{ ...t.tick, fill: t.tickStrong }} tickLine={false} axisLine={false} width={140} />
                      <ReTooltip content={<WastageTooltip nameKey="fullName" />} cursor={cursor} />
                      <Bar dataKey="rate" name="Waste %" radius={[0, 3, 3, 0]} maxBarSize={22} isAnimationActive={false}>
                        {wastageRateData.map((d, i) => (
                          <Cell key={i} fill={wastageBarColor(d.rate)} />
                        ))}
                        <LabelList dataKey="rate" position="right" formatter={(v) => `${v}%`} style={{ fontSize: 11, fill: t.tickStrong }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>

              {/* Chart 2 — Stock Flow by Vaccine */}
              <ChartCard
                title="Stock Flow by Vaccine"
                subtitle="Vials received, doses given and vials wasted per vaccine"
                legend={[{ label: 'Received', color: C.received }, { label: 'Doses Given', color: C.dosesGiven }, { label: 'Wasted', color: C.wasted }]}
              >
                {stockFlowChartData.length === 0 ? <EmptyChart /> : (
                  <ResponsiveContainer width="100%" height={295}>
                    <BarChart data={stockFlowChartData} margin={{ top: 6, right: 12, left: 0, bottom: 56 }} barGap={2} barCategoryGap="28%">
                      {grid}
                      <XAxis dataKey="name" tick={t.tick} tickLine={false} axisLine={false} angle={-35} textAnchor="end" height={60} interval={0} />
                      <YAxis tick={t.tick} tickLine={false} axisLine={false} tickFormatter={fmtNum} width={38} />
                      <ReTooltip content={<ChartTooltip nameKey="fullName" />} cursor={cursor} />
                      <Bar dataKey="Received"     fill={C.received}   radius={[3, 3, 0, 0]} maxBarSize={18} isAnimationActive={false} />
                      <Bar dataKey="Doses Given"  fill={C.dosesGiven} radius={[3, 3, 0, 0]} maxBarSize={18} isAnimationActive={false} />
                      <Bar dataKey="Wasted"       fill={C.wasted}     radius={[3, 3, 0, 0]} maxBarSize={18} isAnimationActive={false} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>

              {/* Chart 3 — Current Stock Left by Vaccine */}
              <ChartCard title="Current Stock by Vaccine" subtitle="Total doses remaining across all facilities">
                {remainingByVaccine.length === 0 ? <EmptyChart message="No stock data available" /> : (
                  <ResponsiveContainer width="100%" height={Math.max(200, remainingByVaccine.length * 46)}>
                    <BarChart layout="vertical" data={remainingByVaccine.map((v) => ({ ...v, name: v.shortName }))} margin={{ top: 4, right: 56, left: 4, bottom: 4 }}>
                      <CartesianGrid horizontal={false} stroke={t.grid} />
                      <XAxis type="number" tick={t.tick} tickLine={false} axisLine={false} tickFormatter={fmtNum} />
                      <YAxis type="category" dataKey="name" tick={{ ...t.tick, fill: t.tickStrong }} tickLine={false} axisLine={false} width={140} />
                      <ReTooltip content={<ChartTooltip nameKey="fullName" />} cursor={cursor} />
                      <Bar dataKey="doses" name="Doses left" fill={C.remaining} radius={[0, 3, 3, 0]} maxBarSize={22} isAnimationActive={false}>
                        <LabelList dataKey="doses" position="right" style={{ fontSize: 11, fill: t.tickStrong }} formatter={fmtNum} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>

              {/* Combined table */}
              <Table
                columns={stockSummaryColumns}
                rows={stockSummaryRows}
                rowKey={(r) => r.vaccineName}
                emptyMessage="No vaccine data recorded in this date range."
              />
            </div>
          )}

          {/* ── Stock Requests ── */}
          {activeTab === 'requests' && (
            <div className="flex flex-col gap-5">
              {/* Month filter bar */}
              <Card>
                <div className="flex flex-wrap items-end gap-3">
                  <Select
                    id="req-month"
                    label="Month"
                    value={reqMonth ?? ''}
                    placeholder="All months"
                    options={reqMonthOptions}
                    onChange={(e) => { setReqMonth(e.target.value || null); setDetailStatus(null); setExpandedReq(null) }}
                  />
                  {reqMonth && (
                    <button
                      onClick={clearReqFilters}
                      className="flex items-center gap-1 text-xs text-text-muted hover:text-text pb-1 self-end"
                    >
                      <X size={12} /> Clear
                    </button>
                  )}
                </div>
              </Card>

              {/* Chart + totals by status */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <ChartCard
                  title="Requests by month"
                  subtitle="Status of requests raised each month"
                  className="lg:col-span-2"
                  legend={[{ label: 'Completed', color: C.completed }, { label: 'Partial', color: C.partial }, { label: 'Open', color: C.open }, { label: 'Declined', color: C.declined }]}
                >
                  {requestChartData.length === 0 ? <EmptyChart message="No requests in this period" /> : (
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={requestChartData} margin={{ top: 6, right: 10, left: 0, bottom: 4 }} barCategoryGap="32%">
                        {grid}
                        <XAxis dataKey="month" tick={t.tick} tickLine={false} axisLine={false} />
                        <YAxis tick={t.tick} tickLine={false} axisLine={false} allowDecimals={false} width={32} />
                        <ReTooltip content={<ChartTooltip />} cursor={cursor} />
                        <Bar dataKey="Completed" stackId="a" fill={C.completed} maxBarSize={30} isAnimationActive={false} />
                        <Bar dataKey="Partial"   stackId="a" fill={C.partial}   maxBarSize={30} isAnimationActive={false} />
                        <Bar dataKey="Open"      stackId="a" fill={C.open}      maxBarSize={30} isAnimationActive={false} />
                        <Bar dataKey="Declined"  stackId="a" fill={C.declined}  radius={[3, 3, 0, 0]} maxBarSize={30} isAnimationActive={false} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </ChartCard>

                <Card>
                  <CardHeader
                    title="Totals by status"
                    description={reqMonth ? fmtMonth(reqMonth) : 'All requests in the period'}
                  />
                  {filteredRequestTotals.length === 0 ? <EmptyChart message="No request data" /> : (
                    <ul className="mt-4 divide-y divide-surface-border">
                      {filteredRequestTotals.map((d) => (
                        <li key={d.name}>
                          <button
                            onClick={() => { setDetailStatus(detailStatus === d.key ? null : d.key); setExpandedReq(null) }}
                            className={`w-full flex items-center justify-between gap-3 py-2.5 px-1.5 text-sm text-left rounded-control transition-colors hover:bg-surface-alt ${detailStatus === d.key ? 'bg-surface-alt' : ''}`}
                          >
                            <span className="flex items-center gap-2 text-text">
                              <span className="w-2 h-2 rounded-full" style={{ background: C[d.key] }} aria-hidden="true" />
                              {d.name}
                            </span>
                            <span className="font-medium text-text tabular-nums">{d.value.toLocaleString()}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="mt-3 text-xs text-text-muted">Click a status to see individual requests.</p>
                </Card>
              </div>

              {/* Detail panel — shown when a status is selected */}
              {detailStatus && (
                <Card>
                  <CardHeader
                    title={`${requestTotals.find((r) => r.key === detailStatus)?.name ?? ''} requests`}
                    description={[reqMonth && fmtMonth(reqMonth), reqFacilityName].filter(Boolean).join(' · ') || 'All facilities and months'}
                  />
                  {detailLoading ? (
                    <SkeletonRows rows={4} />
                  ) : detailRequests.length === 0 ? (
                    <div className="mt-4">
                      <EmptyState title="No requests found" description="Try changing the filters." />
                    </div>
                  ) : (
                    <ul className="mt-4 divide-y divide-surface-border">
                      {detailRequests.map((req) => (
                        <li key={req.id}>
                          <button
                            onClick={() => setExpandedReq(expandedReq === req.id ? null : req.id)}
                            className="w-full flex items-start justify-between gap-3 py-3 px-1.5 text-left text-sm hover:bg-surface-alt rounded-control transition-colors"
                          >
                            <div className="flex flex-col gap-0.5 min-w-0">
                              <span className="font-medium text-text truncate">{req.facilityName}</span>
                              <span className="text-text-muted text-xs">
                                {vaccineSummary(req.items)} · {formatDate(req.createdAt)}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <StatusBadge kind="workflow" status={req.stage} />
                              <ChevronDown size={14} className={`text-text-muted transition-transform ${expandedReq === req.id ? 'rotate-180' : ''}`} />
                            </div>
                          </button>
                          {expandedReq === req.id && (
                            <div className="pb-4 px-1.5">
                              <RequestItemsTable items={req.items} />
                              {req.note && (
                                <p className="mt-2 text-xs text-text-muted">Note: {req.note}</p>
                              )}
                              {req.shortfallNote && (
                                <p className="mt-1 text-xs text-text-muted">Shortfall: {req.shortfallNote}</p>
                              )}
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              )}

              <Table
                columns={requestColumns}
                rows={displayedRequestsByMonth}
                rowKey={(r) => r.month}
                emptyMessage="No stock requests in this date range."
              />
            </div>
          )}

          {/* ── Approvals ── */}
          {activeTab === 'approvals' && (
            <div className="flex flex-col gap-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                <StatCard label="Pending" icon={Clock} accent={totalPending > 0 ? 'low' : 5} value={totalPending} tone={totalPending > 0 ? 'low' : undefined} subtitle={totalPending > 0 ? 'Waiting for a facility head' : 'Nothing waiting'} />
                <StatCard label="Stock corrections" icon={ClipboardCheck} accent={1} value={approvalTotals.corrections} subtitle="Pending" />
                <StatCard label="Threshold changes" icon={SlidersHorizontal} accent={2} value={approvalTotals.thresholds} subtitle="Pending" />
              </div>

              {approvalsByFacility.length > 0 && (
                <ChartCard
                  title="Pending approvals by facility"
                  subtitle="Stock corrections and threshold changes, top 10"
                  legend={[{ label: 'Corrections', color: C.correction }, { label: 'Thresholds', color: C.threshold }]}
                >
                  <ResponsiveContainer width="100%" height={Math.max(160, approvalsByFacility.length * 46)}>
                    <BarChart layout="vertical" data={approvalsByFacility.map((d) => ({ ...d, name: d.shortName }))} margin={{ top: 4, right: 30, left: 4, bottom: 4 }} barCategoryGap="35%">
                      <CartesianGrid horizontal={false} stroke={t.grid} />
                      <XAxis type="number" tick={t.tick} tickLine={false} axisLine={false} allowDecimals={false} />
                      <YAxis type="category" dataKey="name" tick={{ ...t.tick, fill: t.tickStrong }} tickLine={false} axisLine={false} width={145} />
                      <ReTooltip content={<ChartTooltip nameKey="fullName" />} cursor={cursor} />
                      <Bar dataKey="Corrections" stackId="a" fill={C.correction} maxBarSize={22} isAnimationActive={false} />
                      <Bar dataKey="Thresholds"  stackId="a" fill={C.threshold}  radius={[0, 3, 3, 0]} maxBarSize={22} isAnimationActive={false} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              )}

              <Table columns={approvalsColumns} rows={pendingApprovals} rowKey={(r) => `${r.facilityName}-${r.type}`} emptyMessage="No pending approvals." />
            </div>
          )}
        </>
      )}
    </div>
  )
}
