import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip,
  ResponsiveContainer, LabelList, Cell,
} from 'recharts'
import {
  FileSpreadsheet, FileText, BarChart2, ChevronDown, X, PackageCheck, Syringe, Trash2, Boxes,
  Clock, ClipboardCheck, SlidersHorizontal, ArrowLeftRight, Scale, Info,
} from 'lucide-react'
import {
  getAnalytics, getDistricts, getUnionCouncils, getFacilities, getStockRequests, getVaccines,
} from '../../lib/api'
import { exportAnalyticsExcel, exportAnalyticsPdf } from '../../lib/reports'
import { localDateStr, toLocalDateStr, formatDate } from '../../lib/format'
import { ROLE_LABELS } from '../../lib/navigation'
import { approvalTypeLabel } from '../../lib/status'
import { OPEN_STAGES, vaccineSummary } from '../../lib/stockRequests'
import { useAuth } from '../../context/AuthContext'
import { useChartTheme } from '../../hooks/useChartTheme'
import { useUrlFilters } from '../../hooks/useUrlState'
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

const n = (v) => (v ?? 0).toLocaleString()
const muted = (v) => <span className="text-text-muted">{v}</span>
const toned = (v, cls) => <span className={v > 0 ? `${cls} font-medium` : 'text-text-muted'}>{v || 0}</span>
const signed = (v, sign) => (v > 0 ? <span className="font-medium">{sign}{n(v)}</span> : muted('—'))

const REDUCED_MOTION = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
const ANIM = { isAnimationActive: !REDUCED_MOTION, animationDuration: 450, animationEasing: 'ease-out' }

// Recharts 3 reports the hovered category as a string index (or null).
const tipIndex = (s) => (s?.activeTooltipIndex == null ? null : Number(s.activeTooltipIndex))

function useBarHover() {
  const [hover, setHover] = useState(null)
  return [hover, { onMouseMove: (s) => setHover(tipIndex(s)), onMouseLeave: () => setHover(null) }]
}

function useHiddenSeries() {
  const [hidden, setHidden] = useState(() => new Set())
  const toggle = (label) => setHidden((prev) => {
    const next = new Set(prev)
    if (next.has(label)) next.delete(label)
    else next.add(label)
    return next
  })
  return [hidden, toggle]
}

// ── Chart pieces ──────────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label, nameKey, hint }) {
  if (!active || !payload?.length) return null
  const title = nameKey ? (payload[0]?.payload?.[nameKey] ?? label) : label
  return (
    <div className="bg-surface border border-surface-border rounded-control shadow-float px-3.5 py-2.5 text-xs min-w-[150px] max-w-[240px]">
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
      {hint && <p className="mt-2 pt-2 border-t border-surface-border text-text-muted">{typeof hint === 'function' ? hint(payload[0]?.payload) : hint}</p>}
    </div>
  )
}

function WastageTooltip({ active, payload, label, nameKey, hint }) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload ?? {}
  const title = nameKey ? (row[nameKey] ?? label) : label
  return (
    <div className="bg-surface border border-surface-border rounded-control shadow-float px-3.5 py-2.5 text-xs min-w-[170px]">
      <p className="font-semibold text-text mb-1.5 leading-tight break-words">{title}</p>
      <p className="text-text-muted">Wasted: <span className="font-medium text-text tabular-nums">{row.rate}%</span></p>
      <p className="text-text-muted tabular-nums">{n(row.wasted)} of {n(row.received)} vials</p>
      {hint && <p className="mt-2 pt-2 border-t border-surface-border text-text-muted">{hint(row)}</p>}
    </div>
  )
}

// Legend chips; with onToggle each one shows or hides its series.
function SeriesLegend({ items, hidden, onToggle }) {
  return (
    <ul className="flex flex-wrap justify-end gap-x-1 gap-y-1 text-xs text-text-muted">
      {items.map(({ label, color }) => {
        const off = hidden?.has(label)
        const dot = (
          <span
            className="w-2 h-2 rounded-full flex-shrink-0 transition-colors"
            style={off ? { boxShadow: `inset 0 0 0 1.5px ${color}` } : { background: color }}
            aria-hidden="true"
          />
        )
        return (
          <li key={label}>
            {onToggle ? (
              <button
                type="button"
                aria-pressed={!off}
                title={off ? `Show ${label}` : `Hide ${label}`}
                onClick={() => onToggle(label)}
                className={`flex items-center gap-1.5 h-7 px-2 rounded-pill transition-colors hover:bg-surface-alt hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${off ? 'opacity-60 line-through' : ''}`}
              >
                {dot}{label}
              </button>
            ) : (
              <span className="flex items-center gap-1.5 px-2">{dot}{label}</span>
            )}
          </li>
        )
      })}
    </ul>
  )
}

function ChartCard({ title, subtitle, legend, hidden, onToggle, className = '', children }) {
  return (
    <Card className={className}>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4">
        <CardHeader title={title} description={subtitle} />
        {legend && <SeriesLegend items={legend} hidden={hidden} onToggle={onToggle} />}
      </div>
      <div className="mt-4">{children}</div>
    </Card>
  )
}

function EmptyChart({ message = 'No data for this period' }) {
  return <EmptyState icon={BarChart2} title={message} />
}

function UsageRankList({ title, rows, selected, onSelect }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-text mb-2">{title}</h3>
      <ol className="flex flex-col">
        {rows.map((r, i) => {
          const on = selected === r.id
          return (
            <li key={r.id}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => onSelect(r.id)}
                className={`w-full flex items-center gap-3 py-1.5 px-1.5 -mx-1.5 rounded-control text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${on ? 'bg-primary-bg' : 'hover:bg-surface-alt'} ${selected && !on ? 'opacity-50' : ''}`}
              >
                <span className="w-5 h-5 flex-shrink-0 grid place-items-center rounded-full bg-surface-chip text-xs font-medium text-text-muted tabular-nums">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate text-sm text-text" title={r.name}>{r.name}</span>
                <span className="flex-shrink-0 text-sm font-medium text-text tabular-nums">{n(r.doses)}<span className="font-normal text-text-muted"> doses</span></span>
                <span className="flex-shrink-0 w-20 text-right text-xs text-text-muted tabular-nums">{n(r.vials)} vials</span>
              </button>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

// One line that shows the five cards balance: in = out + on hand.
function BalanceLine({ totals, available, openingBal, balanced, hasPeriodBalances, to }) {
  const term = (v, label) => <span className="whitespace-nowrap"><span className="font-medium text-text tabular-nums">{n(v)}</span> {label}</span>
  return (
    <div className={`flex items-start gap-2.5 rounded-control px-3.5 py-2.5 text-xs ${balanced ? 'bg-surface-alt text-text-muted' : 'bg-info-bg text-info-dark'}`}>
      {balanced ? <Scale size={14} strokeWidth={1.75} className="flex-shrink-0 mt-px" aria-hidden="true" /> : <Info size={14} strokeWidth={1.75} className="flex-shrink-0 mt-px" aria-hidden="true" />}
      {balanced ? (
        <p className="leading-relaxed">
          {openingBal > 0 && <>{term(openingBal, 'on hand at start')} + </>}
          {term(totals.received, 'received')} + {term(totals.added, 'added')} − {term(totals.deleted, 'deleted')}
          {' = '}
          {term(totals.used, 'used')} + {term(totals.wasted, 'wasted')} + {term(available, hasPeriodBalances ? 'on hand at end' : 'available')}
        </p>
      ) : (
        <p className="leading-relaxed">
          These figures don't add up for this period: Vials Available is today's stock{to < localDateStr() ? `, not the stock on ${formatDate(to)}` : ''}, and stock on hand before the start date isn't counted. Pick a period that starts before the first entry and ends today to see them balance.
        </p>
      )}
    </div>
  )
}

const METRICS = {
  received:   { label: 'Vials received',   noun: 'received' },
  correction: { label: 'Stock correction', noun: 'corrected' },
  used:       { label: 'Vials used',       noun: 'used' },
  wasted:     { label: 'Vials wasted',     noun: 'wasted' },
  available:  { label: 'Vials available',  noun: 'available' },
}

// Drill-down: where a card's figure comes from, by facility, month or vaccinator.
function DrillPanel({ metric, movement, remaining, vaccineName, multiFacility, t, C, onClose }) {
  const dims = useMemo(() => {
    if (metric === 'available') return ['facility']
    const d = []
    if (multiFacility) d.push('facility')
    d.push('month')
    if (metric === 'used' || metric === 'wasted') d.push('vaccinator')
    return d
  }, [metric, multiFacility])
  const [dimState, setDim] = useState(dims[0])
  const dim = dims.includes(dimState) ? dimState : dims[0]
  const [hover, hoverHandlers] = useBarHover()

  const series = metric === 'correction'
    ? [{ key: 'Added', color: C.added }, { key: 'Deleted', color: C.deleted }]
    : metric === 'available'
      ? [{ key: 'In store', color: C.available }, { key: 'With vaccinators', color: C.used }]
      : [{ key: METRICS[metric].label.replace('Vials ', '').replace(/^./, (c) => c.toUpperCase()), color: C[metric] }]

  const rows = (() => {
    const acc = {}
    const bump = (key, label, vals) => {
      acc[key] ??= { key, name: label, ...Object.fromEntries(series.map((s) => [s.key, 0])) }
      for (const [k, v] of Object.entries(vals)) acc[key][k] += v ?? 0
    }
    if (metric === 'available') {
      for (const r of remaining) bump(r.facilityId, r.facilityName, { 'In store': r.storeVials, 'With vaccinators': r.heldVials })
    } else {
      for (const r of movement) {
        if (dim === 'vaccinator' && !r.workerId) continue
        const key   = dim === 'facility' ? r.facilityId : dim === 'month' ? r.month : r.workerId
        const label = dim === 'facility' ? r.facilityName : dim === 'month' ? fmtMonth(r.month) : (r.workerName ?? '—')
        const vals = metric === 'correction' ? { Added: r.adjustmentIncrease, Deleted: r.adjustmentDecrease }
          : metric === 'received' ? { [series[0].key]: (r.received ?? 0) + (r.opening ?? 0) }
          : { [series[0].key]: r[metric] }
        bump(key, label, vals)
      }
    }
    const total = (r) => series.reduce((s, x) => s + r[x.key], 0)
    let list = Object.values(acc).filter((r) => total(r) > 0)
    list = dim === 'month'
      ? list.sort((a, b) => a.key.localeCompare(b.key))
      : list.sort((a, b) => total(b) - total(a)).slice(0, 12)
    return list.map((r) => ({ ...r, shortName: abbrev(r.name, 20) }))
  })()

  const dimLabel = { facility: 'By facility', month: 'By month', vaccinator: 'By vaccinator' }
  const scope = vaccineName ? `${vaccineName} · ` : ''
  const vertical = dim !== 'month'

  return (
    <Card className="animate-toast-in motion-reduce:animate-none">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <CardHeader
          title={`${METRICS[metric].label}: where it comes from`}
          description={`${scope}${dim === 'facility' && rows.length === 12 ? 'Top 12 facilities' : dimLabel[dim]}, in vials`}
        />
        <div className="flex items-center gap-2 self-start">
          {dims.length > 1 && (
            <Tabs size="sm" label="Break down by" value={dim} onChange={setDim} tabs={dims.map((d) => ({ value: d, label: dimLabel[d] }))} />
          )}
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close breakdown"><X size={14} strokeWidth={2} /></Button>
        </div>
      </div>
      <div className="mt-4">
        {rows.length === 0 ? <EmptyChart message={`Nothing ${METRICS[metric].noun} in this period`} /> : (
          <ResponsiveContainer width="100%" height={vertical ? Math.max(140, rows.length * 40) : 240}>
            <BarChart
              layout={vertical ? 'vertical' : 'horizontal'}
              data={rows}
              margin={{ top: 4, right: vertical ? 48 : 12, left: 4, bottom: 4 }}
              barCategoryGap="30%"
              {...hoverHandlers}
            >
              <CartesianGrid horizontal={!vertical} vertical={false} stroke={t.grid} />
              {vertical ? (
                <>
                  <XAxis type="number" tick={t.tick} tickLine={false} axisLine={false} allowDecimals={false} tickFormatter={fmtNum} />
                  <YAxis type="category" dataKey="shortName" tick={{ ...t.tick, fill: t.tickStrong }} tickLine={false} axisLine={false} width={150} />
                </>
              ) : (
                <>
                  <XAxis dataKey="shortName" tick={t.tick} tickLine={false} axisLine={false} />
                  <YAxis tick={t.tick} tickLine={false} axisLine={false} allowDecimals={false} tickFormatter={fmtNum} width={38} />
                </>
              )}
              <ReTooltip content={<ChartTooltip nameKey="name" />} cursor={{ fill: t.grid, fillOpacity: 0.4 }} />
              {series.map((s, si) => (
                <Bar key={s.key} dataKey={s.key} stackId={metric === 'available' ? 'a' : undefined} fill={s.color} maxBarSize={vertical ? 20 : 30} {...ANIM}
                  radius={metric === 'available' && si === 0 ? 0 : vertical ? [0, 3, 3, 0] : [3, 3, 0, 0]}>
                  {rows.map((_, i) => <Cell key={i} fillOpacity={hover != null && hover !== i ? 0.45 : 1} />)}
                </Bar>
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  )
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

const FILTER_DEFAULTS = { district: '', uc: '', facility: '', vaccine: '' }

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Analytics() {
  const { user } = useAuth()
  const t = useChartTheme()
  const [from, setFrom]             = useState(defaultFrom)
  const [to, setTo]                 = useState(() => localDateStr())
  const [activeTab, setTab]         = useState('stockSummary')
  const [exporting, setExporting]   = useState(null)
  const [exportError, setExportError] = useState('')
  const [drill, setDrill]           = useState(null)

  // Location and vaccine live in the URL (shareable, survive refresh).
  const [filters, setFilters] = useUrlFilters(FILTER_DEFAULTS)
  const reqDistrict   = filters.district || null
  const reqUc         = filters.uc || null
  const reqFacilityId = filters.facility || null
  const vaccineId     = filters.vaccine || null

  // Requests tab state
  const [reqMonth,       setReqMonth]       = useState(null)
  const [detailStatus,   setDetailStatus]   = useState(null)
  const [expandedReq,    setExpandedReq]    = useState(null)

  // Per-chart interaction state
  const [wasteHover, wasteHoverHandlers] = useBarHover()
  const [flowHover,  flowHoverHandlers]  = useBarHover()
  const [stockHover, stockHoverHandlers] = useBarHover()
  const [reqHover,   reqHoverHandlers]   = useBarHover()
  const [flowHidden, toggleFlow] = useHiddenSeries()
  const [reqHidden,  toggleReq]  = useHiddenSeries()
  const [apprHidden, toggleAppr] = useHiddenSeries()

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
  const { data: vaccinesData } = useQuery({ queryKey: ['vaccines'], queryFn: getVaccines })

  const reqFacilityName = (reqFacilitiesData?.facilities ?? []).find((f) => f.id === reqFacilityId)?.name ?? ''

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
  // Period balances (BACKEND_REQUESTS.md §1). Until they ship, "available" is today's stock.
  const balances         = data?.balances

  // Until the API takes vaccineId (BACKEND_REQUESTS.md §2), the vaccine filter is applied here.
  const vMovement  = useMemo(() => (vaccineId ? movement.filter((r) => r.vaccineId === vaccineId) : movement), [movement, vaccineId])
  const vRemaining = useMemo(() => (vaccineId ? remaining.filter((r) => r.vaccineId === vaccineId) : remaining), [remaining, vaccineId])

  // Non-status series take the categorical palette; request statuses take status hues.
  const C = {
    received:   t.series[0],
    used:       t.series[1],
    wasted:     t.series[2],
    available:  t.series[3],
    added:      t.series[0],
    deleted:    t.series[4],
    remaining:  t.series[0],
    correction: t.series[0],
    threshold:  t.series[1],
    completed:  t.status('adequate'),
    partial:    t.status('low'),
    open:       t.series[1],
    declined:   t.status('critical'),
    cancelled:  t.status('no_data'),
  }

  function toggleVaccine(id) {
    if (!id) return
    setFilters({ vaccine: vaccineId === id ? '' : id })
  }

  // ── Vaccine rollup (every vaccine; comparison charts highlight the selected one) ──
  const vaccineRows = useMemo(() => {
    const acc = {}
    const row = (id, name) => (acc[id] ??= {
      id, vaccineName: name,
      received: 0, used: 0, wasted: 0, added: 0, deleted: 0, usedDoses: 0,
      inStore: 0, withWorkers: 0, doses: 0, openingBal: 0, closingBal: null,
    })
    for (const r of movement) {
      const v = row(r.vaccineId, r.vaccineName)
      // `opening` is the one-time initial stock load, counted as received (BACKEND_REQUESTS.md §1).
      v.received  += (r.received ?? 0) + (r.opening ?? 0)
      v.used      += r.used ?? 0
      v.wasted    += r.wasted ?? 0
      v.added     += r.adjustmentIncrease ?? 0
      v.deleted   += r.adjustmentDecrease ?? 0
      v.usedDoses += r.usedDoses ?? 0
    }
    for (const r of remaining) {
      const v = row(r.vaccineId, r.vaccineName)
      v.inStore     += r.storeVials ?? 0
      v.withWorkers += r.heldVials ?? 0
      v.doses       += r.totalDoses ?? 0
    }
    for (const b of balances ?? []) {
      const v = row(b.vaccineId, b.vaccineName)
      v.openingBal += b.openingVials ?? 0
      v.closingBal  = (v.closingBal ?? 0) + (b.closingVials ?? 0)
    }
    return Object.values(acc)
      .map((v) => {
        const available = v.closingBal ?? v.inStore + v.withWorkers
        const wasteRate = v.received > 0 ? +((v.wasted / v.received) * 100).toFixed(1) : 0
        return { ...v, available, wasteRate }
      })
      .sort((a, b) => a.vaccineName.localeCompare(b.vaccineName))
  }, [movement, remaining, balances])

  const selectedRows = useMemo(
    () => (vaccineId ? vaccineRows.filter((v) => v.id === vaccineId) : vaccineRows),
    [vaccineRows, vaccineId],
  )
  const selectedVaccineName = vaccineId
    ? (vaccineRows.find((v) => v.id === vaccineId)?.vaccineName
      ?? (vaccinesData?.vaccines ?? []).find((v) => v.id === vaccineId)?.name ?? 'Selected vaccine')
    : null

  const totals = useMemo(() => {
    const sum = (k) => selectedRows.reduce((s, v) => s + v[k], 0)
    return {
      received: sum('received'), used: sum('used'), wasted: sum('wasted'),
      added: sum('added'), deleted: sum('deleted'), available: sum('available'), openingBal: sum('openingBal'),
    }
  }, [selectedRows])
  const balanced = totals.openingBal + totals.received + totals.added - totals.deleted
    === totals.used + totals.wasted + totals.available
  const multiFacility = new Set([...movement, ...remaining].map((r) => r.facilityId)).size > 1

  // ── Chart data ────────────────────────────────────────────────────────────
  const stockFlowChartData = useMemo(() =>
    vaccineRows
      .filter((v) => v.received || v.used || v.wasted || v.available)
      .map((v) => ({
        id:        v.id,
        name:      abbrev(v.vaccineName),
        fullName:  v.vaccineName,
        Received:  v.received,
        Used:      v.used,
        Wasted:    v.wasted,
        Available: v.available,
      }))
  , [vaccineRows])

  const remainingChartData = useMemo(() =>
    vaccineRows
      .filter((v) => v.doses > 0)
      .sort((a, b) => b.doses - a.doses)
      .map((v) => ({ id: v.id, name: abbrev(v.vaccineName, 18), fullName: v.vaccineName, doses: v.doses }))
  , [vaccineRows])

  // Antigen usage ranking (by doses administered; vials shown alongside).
  const usageRanked = useMemo(() =>
    vaccineRows
      .filter((v) => v.received || v.used || v.wasted)
      .map((v) => ({ id: v.id, name: v.vaccineName, doses: v.usedDoses, vials: v.used }))
      .sort((a, b) => b.doses - a.doses || b.vials - a.vials)
  , [vaccineRows])

  const topUsed    = usageRanked.slice(0, 3)
  const bottomUsed = usageRanked.length > 3 ? usageRanked.slice(-3).reverse() : []

  const wastageRateData = useMemo(() =>
    vaccineRows
      .filter((v) => v.received > 0)
      .map((v) => ({ id: v.id, name: abbrev(v.vaccineName, 18), fullName: v.vaccineName, rate: v.wasteRate, wasted: v.wasted, received: v.received }))
      .sort((a, b) => b.rate - a.rate)
  , [vaccineRows])

  function wastageBarColor(rate) {
    if (rate >= 7) return t.status('critical')
    if (rate >= 3) return t.status('low')
    return t.status('adequate')
  }

  // Selected vaccine stays full strength; with nothing selected, the hovered bar does.
  function fade(i, id, hover) {
    if (vaccineId) return id === vaccineId ? 1 : 0.22
    return hover != null && hover !== i ? 0.45 : 1
  }
  const clickBar = (rows) => (s) => {
    const i = tipIndex(s)
    if (i != null && rows[i]) toggleVaccine(rows[i].id)
  }
  const clickHint = (row) => (row?.id === vaccineId ? 'Click again to show every vaccine' : 'Click to filter the page to this vaccine')

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
        key:       r.month,
        month:     fmtMonth(r.month),
        Completed: r.completed || 0,
        'Partially fulfilled': r.partially_fulfilled || 0,
        Open:      r.submitted || 0,
        Declined:  r.declined || 0,
      }))
  , [requestsByMonth])

  const requestTotals = useMemo(() => {
    const tt = { completed: 0, partially_fulfilled: 0, submitted: 0, declined: 0, cancelled: 0 }
    for (const row of requests) tt[row.status] = (tt[row.status] || 0) + row.count
    return [
      { name: 'Completed', value: tt.completed,           key: 'completed' },
      { name: 'Partially fulfilled', value: tt.partially_fulfilled, key: 'partial'   },
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
      { name: 'Partially fulfilled', value: row.partially_fulfilled || 0, key: 'partial'   },
      { name: 'Open',      value: row.submitted || 0,           key: 'open'      },
      { name: 'Declined',  value: row.declined || 0,            key: 'declined'  },
      { name: 'Cancelled', value: row.cancelled || 0,           key: 'cancelled' },
    ].filter((d) => d.value > 0)
  }, [reqMonth, requestTotals, requestsByMonth])

  // Cascade select options; '' is the "All …" choice.
  const reqDistrictOptions = useMemo(() => [
    { value: '', label: 'All districts' },
    ...(reqDistrictsData?.districts ?? []).map((d) => ({ value: d.id, label: d.name })),
  ], [reqDistrictsData])

  const reqUcOptions = useMemo(() => [
    { value: '', label: 'All UCs' },
    ...(reqUcsData?.unionCouncils ?? []).map((uc) => ({ value: uc.id, label: uc.name })),
  ], [reqUcsData])

  const reqFacilityOptions = useMemo(() => [
    { value: '', label: 'All facilities' },
    ...(reqFacilitiesData?.facilities ?? []).map((f) => ({ value: f.id, label: f.name })),
  ], [reqFacilitiesData])

  const vaccineOptions = useMemo(() => [
    { value: '', label: 'All vaccines' },
    ...(vaccinesData?.vaccines ?? []).map((v) => ({ value: v.id, label: v.name })),
  ], [vaccinesData])

  const reqMonthOptions = useMemo(() => [
    { value: '', label: 'All months' },
    ...[...requestsByMonth]
      .sort((a, b) => a.month.localeCompare(b.month))
      .map((r) => ({ value: r.month, label: fmtMonth(r.month) })),
  ], [requestsByMonth])

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

  function setLocation(patch) {
    setFilters(patch)
    setDetailStatus(null); setExpandedReq(null)
  }

  const hasFilters = !!(reqDistrict || vaccineId)
  function clearAllFilters() {
    setFilters({ district: '', uc: '', facility: '', vaccine: '' })
    setDetailStatus(null); setExpandedReq(null); setDrill(null)
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
    stockSummary: selectedRows.length,
    requests:     requestsByMonth.length,
    approvals:    pendingApprovals.length,
  }), [selectedRows, requestsByMonth, pendingApprovals])

  // ── Export ────────────────────────────────────────────────────────────────
  async function runExport(kind) {
    setExportError('')
    setExporting(kind)
    try {
      const fn = kind === 'xlsx' ? exportAnalyticsExcel : exportAnalyticsPdf
      await fn({ movement: vMovement, from, to, vaccineName: selectedVaccineName })
    } catch {
      setExportError('Could not generate the report. Please try again.')
    } finally {
      setExporting(null)
    }
  }

  const canExport = !isLoading && !isError && vMovement.length > 0
  const activePreset = PRESETS.find((p) => {
    const r = applyPreset(p.months)
    return r.from === from && r.to === to
  })?.label ?? null

  // ── Column definitions ────────────────────────────────────────────────────
  const stockSummaryColumns = [
    { key: 'vaccineName', label: 'Vaccine', render: (r) => <span className="font-medium">{r.vaccineName}</span> },
    { key: 'received',    label: 'Received Vials', align: 'right', render: (r) => (r.received ? n(r.received) : muted('—')) },
    { key: 'used',        label: 'Vials Used',     align: 'right', render: (r) => (r.used ? n(r.used) : muted('—')) },
    { key: 'wasted',      label: 'Vials Wasted',   align: 'right', render: (r) => toned(r.wasted, 'text-warning-dark') },
    { key: 'wasteRate',   label: 'Wasted %',       align: 'right',
      render: (r) => {
        if (r.wasteRate === 0) return muted('0%')
        const cls = r.wasteRate >= 7 ? 'text-danger-dark font-medium' : r.wasteRate >= 3 ? 'text-warning-dark font-medium' : 'text-success-dark font-medium'
        return <span className={cls}>{r.wasteRate}%</span>
      },
    },
    { key: 'added',   group: 'Stock Correction', label: 'Add',    align: 'right', render: (r) => signed(r.added, '+') },
    { key: 'deleted', group: 'Stock Correction', label: 'Delete', align: 'right', render: (r) => signed(r.deleted, '−') },
    { key: 'inStore',     label: 'In Store (vials)',         align: 'right', render: (r) => (r.inStore ? n(r.inStore) : muted('—')) },
    { key: 'withWorkers', label: 'With Vaccinators (vials)', align: 'right', render: (r) => (r.withWorkers ? n(r.withWorkers) : muted('—')) },
    { key: 'doses',       label: 'Stock Left (doses)',       align: 'right', render: (r) => <span className="font-medium">{n(r.doses)}</span> },
  ]

  const requestColumns = [
    { key: 'month', label: 'Month', render: (r) => <span className="font-medium">{fmtMonth(r.month)}</span> },
    { key: 'completed', label: 'Completed', align: 'right', render: (r) => toned(r.completed, 'text-success-dark') },
    { key: 'partially_fulfilled', label: 'Partially fulfilled', align: 'right', render: (r) => toned(r.partially_fulfilled, 'text-warning-dark') },
    { key: 'submitted', label: 'Open', align: 'right', render: (r) => r.submitted || muted(0) },
    { key: 'cancelled', label: 'Cancelled', align: 'right', render: (r) => muted(r.cancelled || 0) },
    { key: 'declined', label: 'Declined', align: 'right', render: (r) => toned(r.declined, 'text-danger-dark') },
  ]

  const approvalsColumns = [
    { key: 'facilityName', label: 'Facility', render: (r) => <span className="font-medium">{r.facilityName}</span> },
    { key: 'type', label: 'Type', render: (r) => approvalTypeLabel(r.type) },
    { key: 'count', label: 'Pending', align: 'right', render: (r) => toned(r.count, 'text-warning-dark') },
  ]

  const grid   = <CartesianGrid vertical={false} stroke={t.grid} />
  const cursor = { fill: t.grid, fillOpacity: 0.4 }
  const loaded = !isLoading && !isError
  const toggleDrill = (m) => setDrill((d) => (d === m ? null : m))

  // Requests and approvals carry no vaccine yet (BACKEND_REQUESTS.md §2).
  const notByVaccine = vaccineId && (
    <p className="flex items-center gap-2 rounded-control bg-info-bg text-info-dark px-3.5 py-2.5 text-xs">
      <Info size={14} strokeWidth={1.75} className="flex-shrink-0" aria-hidden="true" />
      This tab isn't split by vaccine yet, so it shows every vaccine, not only {selectedVaccineName}.
    </p>
  )

  return (
    <div>
      <PageHeader
        breadcrumb={`${ROLE_LABELS[user?.role] ?? 'Analytics'} › Records`}
        title="Analytics"
        subtitle="Stock movement, remaining inventory, requests and approvals for a period"
      />

      {/* ── Period, filters + export ─────────────────────────────────────── */}
      <Card className="mb-5" data-tour="analytics-filters">
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-end gap-3 sm:gap-4">
          <div className="grid grid-cols-2 sm:flex sm:items-end gap-3">
            <DatePicker id="analytics-from" label="From" value={from} onChange={(e) => setFrom(e.target.value)} />
            <DatePicker id="analytics-to"   label="To"   value={to}   onChange={(e) => setTo(e.target.value)} />
          </div>
          <FilterChips
            label="Quick period"
            value={activePreset}
            onChange={(label) => {
              const r = applyPreset(PRESETS.find((p) => p.label === label).months)
              setFrom(r.from); setTo(r.to)
            }}
            options={PRESETS.map((p) => ({ value: p.label, label: p.label }))}
          />
          <div className="flex items-center gap-2 sm:ml-auto" data-tour="analytics-export">
            <Button variant="secondary" size="sm" onClick={() => runExport('xlsx')} disabled={!canExport || exporting !== null} title={canExport ? 'Download Excel report' : 'No data to export'}>
              <FileSpreadsheet size={14} strokeWidth={1.75} /> {exporting === 'xlsx' ? 'Preparing…' : 'Excel'}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => runExport('pdf')} disabled={!canExport || exporting !== null} title={canExport ? 'Download PDF report' : 'No data to export'}>
              <FileText size={14} strokeWidth={1.75} /> {exporting === 'pdf' ? 'Preparing…' : 'PDF'}
            </Button>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-surface-border grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
          {canFilterLocation && (
            <>
              <Select
                id="req-district"
                label="District"
                value={reqDistrict ?? ''}
                placeholder="All districts"
                options={reqDistrictOptions}
                onChange={(e) => setLocation({ district: e.target.value, uc: '', facility: '' })}
              />
              <Select
                id="req-uc"
                label="UC"
                value={reqUc ?? ''}
                placeholder={reqDistrict ? 'All UCs' : 'Pick a district first'}
                options={reqUcOptions}
                disabled={!reqDistrict}
                onChange={(e) => setLocation({ uc: e.target.value, facility: '' })}
              />
              <Select
                id="req-facility"
                label="Facility"
                value={reqFacilityId ?? ''}
                placeholder={reqUc ? 'All facilities' : 'Pick a UC first'}
                options={reqFacilityOptions}
                disabled={!reqUc}
                onChange={(e) => setLocation({ facility: e.target.value })}
              />
            </>
          )}
          <div data-tour="analytics-vaccine">
            <Select
              id="analytics-vaccine"
              label="Vaccine"
              value={vaccineId ?? ''}
              placeholder="All vaccines"
              options={vaccineOptions}
              onChange={(e) => setFilters({ vaccine: e.target.value })}
            />
          </div>
        </div>
        {hasFilters && (
          <div className="mt-3 flex justify-end">
            <Button variant="ghost" size="sm" onClick={clearAllFilters}><X size={14} strokeWidth={2} /> Clear filters</Button>
          </div>
        )}
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
              {/* Stat cards: received ± correction = used + wasted + available */}
              <div className="flex flex-col gap-3" data-tour="analytics-cards">
                <div className="grid grid-cols-2 xl:grid-cols-5 gap-3 sm:gap-4">
                  <StatCard label="Vials Received" icon={PackageCheck} accent={1} value={n(totals.received)} subtitle="From UC + opening stock" onClick={() => toggleDrill('received')} active={drill === 'received'} />
                  <StatCard
                    label="Stock Correction" icon={ArrowLeftRight} accent={4}
                    value={<><span>{totals.added ? `+${n(totals.added)}` : 0}</span><span className="text-text-muted mx-1.5 text-2xl leading-none">/</span><span>{totals.deleted ? `−${n(totals.deleted)}` : 0}</span></>}
                    subtitle="Approved corrections"
                    onClick={() => toggleDrill('correction')} active={drill === 'correction'}
                  />
                  <StatCard label="Vials Used" icon={Syringe} accent={2} value={n(totals.used)} subtitle="Administered to patients" onClick={() => toggleDrill('used')} active={drill === 'used'} />
                  <StatCard label="Vials Wasted" icon={Trash2} accent={3} value={n(totals.wasted)} subtitle="Discarded in administration" onClick={() => toggleDrill('wasted')} active={drill === 'wasted'} />
                  <div className="col-span-2 xl:col-span-1 grid">
                    <StatCard label="Vials Available" icon={Boxes} accent={5} value={n(totals.available)} subtitle={balances ? `On hand on ${formatDate(to)}` : 'Current stock on hand'} onClick={() => toggleDrill('available')} active={drill === 'available'} />
                  </div>
                </div>
                {(totals.received > 0 || totals.available > 0) && (
                  <BalanceLine totals={totals} available={totals.available} openingBal={totals.openingBal} balanced={balanced} hasPeriodBalances={!!balances} to={to} />
                )}
              </div>

              {drill && (
                <DrillPanel
                  key={drill}
                  metric={drill}
                  movement={vMovement}
                  remaining={vRemaining}
                  vaccineName={selectedVaccineName}
                  multiFacility={multiFacility}
                  t={t}
                  C={C}
                  onClose={() => setDrill(null)}
                />
              )}

              {/* Most / Least used antigen */}
              {topUsed.length > 0 && (
                <Card>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8">
                    <UsageRankList title="Most used (Top 3)" rows={topUsed} selected={vaccineId} onSelect={toggleVaccine} />
                    {bottomUsed.length > 0 && <UsageRankList title="Least used (Bottom 3)" rows={bottomUsed} selected={vaccineId} onSelect={toggleVaccine} />}
                  </div>
                </Card>
              )}

              {/* Chart 1 — Wastage Rate by Vaccine */}
              <ChartCard
                title="Wastage Rate by Vaccine"
                subtitle="Wasted vials as a % of vials received: green under 3%, amber 3–7%, red 7% or more. Click a bar to filter by vaccine."
              >
                {wastageRateData.length === 0 ? <EmptyChart /> : (
                  <div className="cursor-pointer" data-tour="analytics-chart">
                    <ResponsiveContainer width="100%" height={Math.max(160, wastageRateData.length * 44)}>
                      <BarChart layout="vertical" data={wastageRateData} margin={{ top: 4, right: 60, left: 4, bottom: 4 }} {...wasteHoverHandlers} onClick={clickBar(wastageRateData)}>
                        <CartesianGrid horizontal={false} stroke={t.grid} />
                        <XAxis type="number" tick={t.tick} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
                        <YAxis type="category" dataKey="name" tick={{ ...t.tick, fill: t.tickStrong }} tickLine={false} axisLine={false} width={140} />
                        <ReTooltip content={<WastageTooltip nameKey="fullName" hint={clickHint} />} cursor={cursor} />
                        <Bar dataKey="rate" name="Wasted %" radius={[0, 3, 3, 0]} maxBarSize={22} {...ANIM}>
                          {wastageRateData.map((d, i) => (
                            <Cell key={d.id} fill={wastageBarColor(d.rate)} fillOpacity={fade(i, d.id, wasteHover)} />
                          ))}
                          <LabelList dataKey="rate" position="right" formatter={(v) => `${v}%`} style={{ fontSize: 11, fill: t.tickStrong }} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </ChartCard>

              {/* Chart 2 — Stock Flow by Vaccine */}
              <ChartCard
                title="Stock Flow by Vaccine"
                subtitle="Vials received, used, wasted and available per vaccine. Click a series name to hide it."
                legend={[{ label: 'Received', color: C.received }, { label: 'Used', color: C.used }, { label: 'Wasted', color: C.wasted }, { label: 'Available', color: C.available }]}
                hidden={flowHidden}
                onToggle={toggleFlow}
              >
                {stockFlowChartData.length === 0 ? <EmptyChart /> : (
                  <div className="cursor-pointer">
                    <ResponsiveContainer width="100%" height={295}>
                      <BarChart data={stockFlowChartData} margin={{ top: 6, right: 12, left: 0, bottom: 56 }} barGap={2} barCategoryGap="28%" {...flowHoverHandlers} onClick={clickBar(stockFlowChartData)}>
                        {grid}
                        <XAxis dataKey="name" tick={t.tick} tickLine={false} axisLine={false} angle={-35} textAnchor="end" height={60} interval={0} />
                        <YAxis tick={t.tick} tickLine={false} axisLine={false} tickFormatter={fmtNum} width={38} />
                        <ReTooltip content={<ChartTooltip nameKey="fullName" hint={clickHint} />} cursor={cursor} />
                        {['Received', 'Used', 'Wasted', 'Available'].map((k) => (
                          <Bar key={k} dataKey={k} fill={C[k.toLowerCase()]} hide={flowHidden.has(k)} radius={[3, 3, 0, 0]} maxBarSize={18} {...ANIM}>
                            {stockFlowChartData.map((d, i) => <Cell key={d.id} fillOpacity={fade(i, d.id, flowHover)} />)}
                          </Bar>
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </ChartCard>

              {/* Chart 3 — Current Stock Left by Vaccine */}
              <ChartCard title="Current Stock by Vaccine" subtitle="Doses on hand now, in store and with vaccinators. Click a bar to filter by vaccine.">
                {remainingChartData.length === 0 ? <EmptyChart message="No stock data available" /> : (
                  <div className="cursor-pointer">
                    <ResponsiveContainer width="100%" height={Math.max(200, remainingChartData.length * 46)}>
                      <BarChart layout="vertical" data={remainingChartData} margin={{ top: 4, right: 56, left: 4, bottom: 4 }} {...stockHoverHandlers} onClick={clickBar(remainingChartData)}>
                        <CartesianGrid horizontal={false} stroke={t.grid} />
                        <XAxis type="number" tick={t.tick} tickLine={false} axisLine={false} tickFormatter={fmtNum} />
                        <YAxis type="category" dataKey="name" tick={{ ...t.tick, fill: t.tickStrong }} tickLine={false} axisLine={false} width={140} />
                        <ReTooltip content={<ChartTooltip nameKey="fullName" hint={clickHint} />} cursor={cursor} />
                        <Bar dataKey="doses" name="Doses left" fill={C.remaining} radius={[0, 3, 3, 0]} maxBarSize={22} {...ANIM}>
                          {remainingChartData.map((d, i) => <Cell key={d.id} fillOpacity={fade(i, d.id, stockHover)} />)}
                          <LabelList dataKey="doses" position="right" style={{ fontSize: 11, fill: t.tickStrong }} formatter={fmtNum} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </ChartCard>

              {/* Combined table */}
              <div data-tour="analytics-table">
                <Table
                  columns={stockSummaryColumns}
                  rows={selectedRows.filter((v) => v.received || v.used || v.wasted || v.added || v.deleted || v.available)}
                  rowKey={(r) => r.id}
                  onRowClick={(r) => toggleVaccine(r.id)}
                  rowClassName={(r) => (r.id === vaccineId ? 'bg-primary-bg' : '')}
                  emptyMessage={vaccineId ? `No ${selectedVaccineName} recorded in this date range.` : 'No vaccine data recorded in this date range.'}
                />
              </div>
            </div>
          )}

          {/* ── Stock Requests ── */}
          {activeTab === 'requests' && (
            <div className="flex flex-col gap-5">
              {notByVaccine}
              {/* Month filter bar */}
              <Card>
                <div className="flex flex-wrap items-end gap-3">
                  <div className="w-full sm:w-56">
                    <Select
                      id="req-month"
                      label="Month"
                      value={reqMonth ?? ''}
                      placeholder="All months"
                      options={reqMonthOptions}
                      onChange={(e) => { setReqMonth(e.target.value || null); setDetailStatus(null); setExpandedReq(null) }}
                    />
                  </div>
                  {reqMonth && (
                    <Button variant="ghost" size="sm" onClick={clearReqFilters}><X size={14} strokeWidth={2} /> Clear</Button>
                  )}
                </div>
              </Card>

              {/* Chart + totals by status */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <ChartCard
                  title="Requests by month"
                  subtitle="Status of requests raised each month. Click a month to filter."
                  className="lg:col-span-2"
                  legend={[{ label: 'Completed', color: C.completed }, { label: 'Partially fulfilled', color: C.partial }, { label: 'Open', color: C.open }, { label: 'Declined', color: C.declined }]}
                  hidden={reqHidden}
                  onToggle={toggleReq}
                >
                  {requestChartData.length === 0 ? <EmptyChart message="No requests in this period" /> : (
                    <div className="cursor-pointer">
                      <ResponsiveContainer width="100%" height={260}>
                        <BarChart
                          data={requestChartData}
                          margin={{ top: 6, right: 10, left: 0, bottom: 4 }}
                          barCategoryGap="32%"
                          {...reqHoverHandlers}
                          onClick={(s) => {
                            const i = tipIndex(s)
                            const m = i != null ? requestChartData[i]?.key : null
                            if (m) { setReqMonth(reqMonth === m ? null : m); setDetailStatus(null); setExpandedReq(null) }
                          }}
                        >
                          {grid}
                          <XAxis dataKey="month" tick={t.tick} tickLine={false} axisLine={false} />
                          <YAxis tick={t.tick} tickLine={false} axisLine={false} allowDecimals={false} width={32} />
                          <ReTooltip content={<ChartTooltip hint={reqMonth ? 'Click again to show every month' : 'Click to filter to this month'} />} cursor={cursor} />
                          {[['Completed', C.completed], ['Partially fulfilled', C.partial], ['Open', C.open], ['Declined', C.declined]].map(([k, fill], si, all) => (
                            <Bar key={k} dataKey={k} stackId="a" fill={fill} hide={reqHidden.has(k)} maxBarSize={30} radius={si === all.length - 1 ? [3, 3, 0, 0] : 0} {...ANIM}>
                              {requestChartData.map((d, i) => (
                                <Cell key={d.key} fillOpacity={reqMonth ? (d.key === reqMonth ? 1 : 0.22) : reqHover != null && reqHover !== i ? 0.45 : 1} />
                              ))}
                            </Bar>
                          ))}
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
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
                            aria-pressed={detailStatus === d.key}
                            className={`w-full flex items-center justify-between gap-3 py-2.5 px-1.5 text-sm text-left rounded-control transition-colors hover:bg-surface-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${detailStatus === d.key ? 'bg-surface-alt' : ''}`}
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
                <Card className="animate-toast-in motion-reduce:animate-none">
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
                            aria-expanded={expandedReq === req.id}
                            className="w-full flex items-start justify-between gap-3 py-3 px-1.5 text-left text-sm hover:bg-surface-alt rounded-control transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
              {notByVaccine}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                <StatCard label="Pending" icon={Clock} accent={totalPending > 0 ? 'low' : 5} value={totalPending} tone={totalPending > 0 ? 'low' : undefined} subtitle={totalPending > 0 ? 'Waiting for the Facility Head' : 'Nothing waiting'} />
                <StatCard label="Stock corrections" icon={ClipboardCheck} accent={1} value={approvalTotals.corrections} subtitle="Pending" />
                <StatCard label="Threshold changes" icon={SlidersHorizontal} accent={2} value={approvalTotals.thresholds} subtitle="Pending" />
              </div>

              {approvalsByFacility.length > 0 && (
                <ChartCard
                  title="Pending approvals by facility"
                  subtitle="Stock corrections and threshold changes, top 10"
                  legend={[{ label: 'Corrections', color: C.correction }, { label: 'Thresholds', color: C.threshold }]}
                  hidden={apprHidden}
                  onToggle={toggleAppr}
                >
                  <ResponsiveContainer width="100%" height={Math.max(160, approvalsByFacility.length * 46)}>
                    <BarChart layout="vertical" data={approvalsByFacility.map((d) => ({ ...d, name: d.shortName }))} margin={{ top: 4, right: 30, left: 4, bottom: 4 }} barCategoryGap="35%">
                      <CartesianGrid horizontal={false} stroke={t.grid} />
                      <XAxis type="number" tick={t.tick} tickLine={false} axisLine={false} allowDecimals={false} />
                      <YAxis type="category" dataKey="name" tick={{ ...t.tick, fill: t.tickStrong }} tickLine={false} axisLine={false} width={145} />
                      <ReTooltip content={<ChartTooltip nameKey="fullName" />} cursor={cursor} />
                      <Bar dataKey="Corrections" stackId="a" fill={C.correction} hide={apprHidden.has('Corrections')} maxBarSize={22} {...ANIM} />
                      <Bar dataKey="Thresholds"  stackId="a" fill={C.threshold}  hide={apprHidden.has('Thresholds')} radius={[0, 3, 3, 0]} maxBarSize={22} {...ANIM} />
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
