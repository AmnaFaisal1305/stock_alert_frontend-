import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip,
  ResponsiveContainer, Cell, PieChart, Pie, Legend, LabelList,
} from 'recharts'
import { getAnalytics } from '../../lib/api'
import { exportAnalyticsExcel, exportAnalyticsPdf } from '../../lib/reports'
import { displayVaccineName } from '../../lib/vaccineNames'
import Table from '../../components/shared/Table'
import StatCard from '../../components/shared/StatCard'
import DatePicker from '../../components/ui/DatePicker'
import Button from '../../components/ui/Button'
import {
  Package, TrendingDown, AlertTriangle, Clock, FileSpreadsheet, FileText,
  BarChart2, Activity, Percent, CheckCircle2,
} from 'lucide-react'

// ── Chart colour constants (aligned to Tailwind tokens) ───────────────────────
const C = {
  received:   '#006241',  // primary
  used:       '#3B82F6',  // blue-500
  wasted:     '#F59E0B',  // amber-500
  completed:  '#10B981',  // success
  partial:    '#F59E0B',  // amber
  open:       '#3B82F6',  // blue
  declined:   '#EF4444',  // danger
  cancelled:  '#94A3B8',  // slate-400
  remaining:  '#0EA5E9',  // sky-500
  correction: '#8B5CF6',  // violet-500
  threshold:  '#06B6D4',  // cyan-500
}

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
  return { from: from.toISOString().split('T')[0], to: to.toISOString().split('T')[0] }
}

function defaultFrom() {
  const d = new Date()
  d.setMonth(d.getMonth() - 11)
  d.setDate(1)
  return d.toISOString().split('T')[0]
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
  return v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
}

// ── Shared tooltip ────────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label, nameKey }) {
  if (!active || !payload?.length) return null
  const title = nameKey ? (payload[0]?.payload?.[nameKey] ?? label) : label
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-3.5 py-3 text-xs min-w-[150px] max-w-[230px]">
      <p className="font-bold text-text mb-2 leading-tight break-words">{title}</p>
      {payload.map((p) =>
        (p.value ?? 0) > 0 ? (
          <div key={p.dataKey ?? p.name} className="flex items-center justify-between gap-4 mb-1 last:mb-0">
            <span className="flex items-center gap-1.5 min-w-0">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.fill ?? p.color }} />
              <span className="text-text-muted truncate">{p.name}</span>
            </span>
            <span className="font-bold text-text tabular-nums flex-shrink-0">{(p.value ?? 0).toLocaleString()}</span>
          </div>
        ) : null
      )}
    </div>
  )
}

// ── Chart empty state ─────────────────────────────────────────────────────────
function EmptyChart({ message = 'No data for this period' }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-text-muted">
      <BarChart2 size={28} className="opacity-15 mb-2.5" />
      <p className="text-sm font-semibold">{message}</p>
    </div>
  )
}

// ── Chart card wrapper ────────────────────────────────────────────────────────
function ChartCard({ title, subtitle, icon: Icon, children }) {
  return (
    <div className="bg-white rounded-2xl border border-surface-border shadow-sm overflow-hidden">
      <div className="px-5 py-3.5 border-b border-surface-border flex items-center gap-2.5">
        {Icon && (
          <div className="p-1.5 rounded-lg bg-primary/10 flex-shrink-0">
            <Icon size={13} className="text-primary" />
          </div>
        )}
        <div>
          <p className="text-sm font-bold text-text">{title}</p>
          {subtitle && <p className="text-xs text-text-muted mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </div>
  )
}

// ── Section label ─────────────────────────────────────────────────────────────
function SectionLabel({ children }) {
  return (
    <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted px-0.5 mb-3">{children}</p>
  )
}

// ── Tabs ──────────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'movement',  label: 'Movement'          },
  { id: 'remaining', label: 'Remaining Stock'    },
  { id: 'requests',  label: 'Requests'           },
  { id: 'approvals', label: 'Pending Approvals'  },
]

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Analytics() {
  const [from, setFrom]             = useState(defaultFrom)
  const [to, setTo]                 = useState(() => new Date().toISOString().split('T')[0])
  const [activeTab, setTab]         = useState('movement')
  const [exporting, setExporting]   = useState(null)
  const [exportError, setExportError] = useState('')

  const { data, isLoading, isError } = useQuery({
    queryKey: ['analytics', from, to],
    queryFn: () => getAnalytics({ from, to }),
  })

  const movement         = data?.movement        ?? []
  const remaining        = data?.remaining       ?? []
  const requests         = data?.requests        ?? []
  const pendingApprovals = data?.pendingApprovals ?? []

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
    usedDoses: vaccineMovement.reduce((s, v) => s + v.usedDoses, 0),
    wasted:    vaccineMovement.reduce((s, v) => s + v.wasted,    0),
  }), [vaccineMovement])

  const wastageRate = totals.received > 0
    ? +((totals.wasted / totals.received) * 100).toFixed(1)
    : 0

  const wastageColor = wastageRate === 0
    ? 'text-primary'
    : wastageRate < 3  ? 'text-success-dark'
    : wastageRate < 7  ? 'text-amber-500'
    : 'text-danger'

  const movementChartData = useMemo(() =>
    vaccineMovement.map((v) => ({
      name:     abbrev(v.vaccineName),
      fullName: v.vaccineName,
      Received: v.opening + v.received,
      Used:     v.usedDoses,
      Wasted:   v.wasted,
    }))
  , [vaccineMovement])

  // ── Remaining stock rollup ────────────────────────────────────────────────
  const remainingByVaccine = useMemo(() => {
    const acc = {}
    for (const r of remaining) {
      const name = displayVaccineName(r.vaccineName)
      if (!acc[name]) acc[name] = { name, doses: 0 }
      acc[name].doses += r.totalDoses
    }
    return Object.values(acc)
      .sort((a, b) => b.doses - a.doses)
      .map((v) => ({ ...v, shortName: abbrev(v.name, 18), fullName: v.name }))
  }, [remaining])

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
    const t = { completed: 0, partially_fulfilled: 0, submitted: 0, declined: 0, cancelled: 0 }
    for (const row of requests) t[row.status] = (t[row.status] || 0) + row.count
    return [
      { name: 'Completed', value: t.completed,           color: C.completed  },
      { name: 'Partial',   value: t.partially_fulfilled, color: C.partial    },
      { name: 'Open',      value: t.submitted,           color: C.open       },
      { name: 'Declined',  value: t.declined,            color: C.declined   },
      { name: 'Cancelled', value: t.cancelled,           color: C.cancelled  },
    ].filter((d) => d.value > 0)
  }, [requests])

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

  // ── Tab data counts ───────────────────────────────────────────────────────
  const tabCounts = useMemo(() => ({
    movement:  vaccineMovement.length,
    remaining: remainingByVaccine.length,
    requests:  requestsByMonth.length,
    approvals: pendingApprovals.length,
  }), [vaccineMovement, remainingByVaccine, requestsByMonth, pendingApprovals])

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

  // ── Column definitions ────────────────────────────────────────────────────
  const movementColumns = [
    { key: 'vaccineName', label: 'Vaccine',
      render: (r) => <span className="text-sm font-semibold text-text">{r.vaccineName}</span> },
    { key: 'opening', label: 'Opening',
      render: (r) => <span className={`text-sm tabular-nums ${r.opening > 0 ? 'text-sky-700 font-semibold' : 'text-text-muted'}`}>{r.opening || '—'}</span> },
    { key: 'received', label: 'Received (vials)',
      render: (r) => <span className="text-sm tabular-nums text-text">{r.received}</span> },
    { key: 'usedDoses', label: 'Used (doses)',
      render: (r) => <span className="text-sm tabular-nums text-text">{r.usedDoses}</span> },
    { key: 'wasted', label: 'Wasted (vials)',
      render: (r) => (
        <span className={`text-sm font-semibold tabular-nums ${r.wasted > 0 ? 'text-amber-600' : 'text-text-muted'}`}>
          {r.wasted}
        </span>
      ) },
    { key: 'adj', label: 'Adj. (net)',
      render: (r) => {
        const net = r.adjustmentIncrease - r.adjustmentDecrease
        return (
          <span className={`text-sm font-semibold tabular-nums ${net > 0 ? 'text-emerald-600' : net < 0 ? 'text-danger' : 'text-text-muted'}`}>
            {net > 0 ? `+${net}` : net === 0 ? '—' : net}
          </span>
        )
      } },
  ]

  const remainingColumns = [
    { key: 'facilityName', label: 'Facility',
      render: (r) => <span className="text-sm font-semibold text-text">{r.facilityName}</span> },
    { key: 'vaccineName', label: 'Vaccine',
      render: (r) => <span className="text-sm text-text">{displayVaccineName(r.vaccineName)}</span> },
    { key: 'storeVials', label: 'Store (vials)',
      render: (r) => <span className="text-sm tabular-nums text-text">{r.storeVials}</span> },
    { key: 'heldVials', label: 'Held (vials)',
      render: (r) => <span className="text-sm tabular-nums text-text">{r.heldVials}</span> },
    { key: 'totalDoses', label: 'Total (doses)',
      render: (r) => <span className="text-sm font-bold tabular-nums text-text">{r.totalDoses}</span> },
  ]

  const requestColumns = [
    { key: 'month', label: 'Month',
      render: (r) => <span className="text-sm font-semibold text-text">{r.month}</span> },
    { key: 'completed', label: 'Completed',
      render: (r) => <span className="text-sm font-semibold tabular-nums text-emerald-600">{r.completed || 0}</span> },
    { key: 'partially_fulfilled', label: 'Partial',
      render: (r) => <span className="text-sm font-semibold tabular-nums text-amber-600">{r.partially_fulfilled || 0}</span> },
    { key: 'submitted', label: 'Open',
      render: (r) => <span className="text-sm font-semibold tabular-nums text-blue-600">{r.submitted || 0}</span> },
    { key: 'cancelled', label: 'Cancelled',
      render: (r) => <span className="text-sm tabular-nums text-text-muted">{r.cancelled || 0}</span> },
    { key: 'declined', label: 'Declined',
      render: (r) => <span className="text-sm font-semibold tabular-nums text-danger">{r.declined || 0}</span> },
  ]

  const approvalsColumns = [
    { key: 'facilityName', label: 'Facility',
      render: (r) => <span className="text-sm font-semibold text-text">{r.facilityName}</span> },
    { key: 'type', label: 'Type',
      render: (r) => (
        <span className="text-sm text-text">
          {r.type === 'stock_correction' ? 'Stock Correction' : 'Threshold Change'}
        </span>
      ) },
    { key: 'count', label: 'Pending',
      render: (r) => <span className="text-sm font-bold tabular-nums text-amber-600">{r.count}</span> },
  ]

  // ── Legend formatter ──────────────────────────────────────────────────────
  const legendFmt = (v) => <span style={{ fontSize: 11, color: '#64748B' }}>{v}</span>

  return (
    <div className="flex flex-col gap-5 animate-in fade-in duration-200">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="bg-primary rounded-2xl px-4 sm:px-6 py-4 sm:py-5 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Analytics</h1>
          <p className="text-sm text-white/70 mt-0.5">
            Stock movement · Remaining inventory · Requests · Approvals
          </p>
        </div>
      </div>

      {/* ── Date range controls ──────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-surface-border px-4 sm:px-5 py-4 shadow-sm flex flex-col sm:flex-row sm:items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-shrink-0">
          <Clock size={13} className="text-primary" />
          <span className="text-xs font-bold uppercase tracking-wider text-text-muted">Period</span>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <DatePicker id="analytics-from" label="From" value={from} onChange={(e) => setFrom(e.target.value)} />
          <DatePicker id="analytics-to"   label="To"   value={to}   onChange={(e) => setTo(e.target.value)} />
        </div>

        {/* Quick presets */}
        <div className="flex items-center gap-1.5">
          {PRESETS.map((p) => {
            const range = applyPreset(p.months)
            const active = from === range.from && to === range.to
            return (
              <button
                key={p.label}
                onClick={() => { setFrom(range.from); setTo(range.to) }}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  active
                    ? 'bg-primary text-white'
                    : 'text-text-muted hover:text-primary hover:bg-primary/5 border border-surface-border'
                }`}
              >
                {p.label}
              </button>
            )
          })}
        </div>

        {/* Export */}
        <div className="flex items-center gap-2 sm:ml-auto">
          <Button
            variant="secondary" size="sm"
            onClick={() => runExport('xlsx')}
            disabled={!canExport || exporting !== null}
            title={canExport ? 'Download Excel report' : 'No data to export'}
          >
            <FileSpreadsheet size={14} /> {exporting === 'xlsx' ? 'Preparing…' : 'Excel'}
          </Button>
          <Button
            variant="secondary" size="sm"
            onClick={() => runExport('pdf')}
            disabled={!canExport || exporting !== null}
            title={canExport ? 'Download PDF report' : 'No data to export'}
          >
            <FileText size={14} /> {exporting === 'pdf' ? 'Preparing…' : 'PDF'}
          </Button>
        </div>
      </div>

      {exportError && (
        <div className="bg-danger-bg border border-danger/10 text-xs font-semibold text-danger rounded-xl px-4 py-3">
          {exportError}
        </div>
      )}

      {/* ── Tabs ─────────────────────────────────────────────────────────── */}
      <div className="overflow-x-auto -mx-1 px-1 pb-0.5">
        <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit min-w-max">
          {TABS.map((t) => {
            const count = !isLoading && !isError ? tabCounts[t.id] : null
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                  activeTab === t.id
                    ? 'bg-white text-primary shadow-sm'
                    : 'text-text-muted hover:text-text'
                }`}
              >
                {t.label}
                {count !== null && count > 0 && (
                  <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-md tabular-nums ${
                    activeTab === t.id
                      ? 'bg-primary/10 text-primary'
                      : 'bg-slate-200 text-text-muted'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Loading skeleton ─────────────────────────────────────────────── */}
      {isLoading && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1,2,3,4].map((i) => <div key={i} className="h-24 bg-slate-50 border border-slate-200 rounded-2xl animate-pulse" />)}
          </div>
          <div className="h-[300px] bg-slate-50 border border-slate-200 rounded-2xl animate-pulse" />
          <div className="flex flex-col gap-2">
            {[1,2,3,4].map((i) => <div key={i} className="h-12 bg-slate-50 border border-slate-200 rounded-xl animate-pulse" />)}
          </div>
        </div>
      )}

      {isError && (
        <div className="bg-danger-bg border border-danger/10 text-xs font-semibold text-danger rounded-xl px-4 py-3">
          Failed to load analytics data. Please try refreshing.
        </div>
      )}

      {/* ── Tab content ──────────────────────────────────────────────────── */}
      {!isLoading && !isError && (
        <>
          {/* ══════════════════════════════════════ MOVEMENT ════════════════════════════════════ */}
          {activeTab === 'movement' && (
            <div className="flex flex-col gap-5">

              {/* KPI cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  label="Total Stock In"
                  value={totals.received}
                  unit="opening + received vials"
                  icon={Package}
                  colorClass="text-primary"
                />
                <StatCard
                  label="Total Used"
                  value={totals.usedDoses}
                  unit="doses administered"
                  icon={TrendingDown}
                  colorClass="text-blue-600"
                />
                <StatCard
                  label="Total Wasted"
                  value={totals.wasted}
                  unit="vials discarded"
                  icon={AlertTriangle}
                  colorClass="text-amber-500"
                />
                <StatCard
                  label="Wastage Rate"
                  value={`${wastageRate}%`}
                  unit="of vials received"
                  icon={Percent}
                  colorClass={wastageColor}
                />
              </div>

              {/* Stock Flow grouped bar chart */}
              <ChartCard
                title="Stock Flow by Vaccine"
                subtitle="Received vials · Used doses · Wasted vials"
                icon={BarChart2}
              >
                {movementChartData.length === 0 ? (
                  <EmptyChart />
                ) : (
                  <ResponsiveContainer width="100%" height={295}>
                    <BarChart
                      data={movementChartData}
                      margin={{ top: 6, right: 12, left: 0, bottom: 56 }}
                      barGap={2}
                      barCategoryGap="28%"
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 10, fill: '#94A3B8' }}
                        angle={-35}
                        textAnchor="end"
                        height={60}
                        interval={0}
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: '#94A3B8' }}
                        tickFormatter={fmtNum}
                        width={38}
                      />
                      <ReTooltip content={<ChartTooltip nameKey="fullName" />} cursor={{ fill: '#F8FAFC' }} />
                      <Legend verticalAlign="top" height={30} iconType="circle" iconSize={7} formatter={legendFmt} />
                      <Bar dataKey="Received" fill={C.received} radius={[3,3,0,0]} maxBarSize={18} />
                      <Bar dataKey="Used"     fill={C.used}     radius={[3,3,0,0]} maxBarSize={18} />
                      <Bar dataKey="Wasted"   fill={C.wasted}   radius={[3,3,0,0]} maxBarSize={18} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>

              {/* Movement table */}
              <div>
                <SectionLabel>Detailed Breakdown — per vaccine</SectionLabel>
                <Table
                  columns={movementColumns}
                  rows={vaccineMovement}
                  emptyMessage="No movement recorded in this date range."
                />
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════ REMAINING STOCK ═════════════════════════════ */}
          {activeTab === 'remaining' && (
            <div className="flex flex-col gap-5">

              {/* Remaining doses horizontal bar */}
              <ChartCard
                title="Remaining Doses by Vaccine"
                subtitle="Aggregated across all facilities — total doses available"
                icon={Package}
              >
                {remainingByVaccine.length === 0 ? (
                  <EmptyChart message="No stock data available" />
                ) : (
                  <ResponsiveContainer
                    width="100%"
                    height={Math.max(200, remainingByVaccine.length * 46)}
                  >
                    <BarChart
                      layout="vertical"
                      data={remainingByVaccine.map((v) => ({ ...v, name: v.shortName }))}
                      margin={{ top: 4, right: 56, left: 4, bottom: 4 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F1F5F9" />
                      <XAxis
                        type="number"
                        tick={{ fontSize: 10, fill: '#94A3B8' }}
                        tickFormatter={fmtNum}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        tick={{ fontSize: 11, fill: '#475569' }}
                        width={140}
                      />
                      <ReTooltip content={<ChartTooltip nameKey="fullName" />} cursor={{ fill: '#F8FAFC' }} />
                      <Bar dataKey="doses" name="Doses" fill={C.remaining} radius={[0,3,3,0]} maxBarSize={22}>
                        <LabelList
                          dataKey="doses"
                          position="right"
                          style={{ fontSize: 10, fill: '#475569', fontWeight: 600 }}
                          formatter={fmtNum}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>

              {/* Remaining table */}
              <div>
                <SectionLabel>Per Facility Breakdown</SectionLabel>
                <Table
                  columns={remainingColumns}
                  rows={remaining}
                  emptyMessage="No stock data available."
                />
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════ REQUESTS ════════════════════════════════════ */}
          {activeTab === 'requests' && (
            <div className="flex flex-col gap-5">

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Stacked bar — monthly trend (2/3 width on desktop) */}
                <ChartCard
                  title="Monthly Request Trend"
                  subtitle="Request status breakdown by month"
                  icon={Activity}
                  className="lg:col-span-2"
                >
                  {requestChartData.length === 0 ? (
                    <EmptyChart message="No requests in this period" />
                  ) : (
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart
                        data={requestChartData}
                        margin={{ top: 6, right: 10, left: 0, bottom: 4 }}
                        barCategoryGap="32%"
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                        <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94A3B8' }} />
                        <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} allowDecimals={false} width={32} />
                        <ReTooltip content={<ChartTooltip />} cursor={{ fill: '#F8FAFC' }} />
                        <Legend verticalAlign="top" height={30} iconType="circle" iconSize={7} formatter={legendFmt} />
                        <Bar dataKey="Completed" stackId="a" fill={C.completed} maxBarSize={30} />
                        <Bar dataKey="Partial"   stackId="a" fill={C.partial}   maxBarSize={30} />
                        <Bar dataKey="Open"      stackId="a" fill={C.open}      maxBarSize={30} />
                        <Bar dataKey="Declined"  stackId="a" fill={C.declined}  radius={[3,3,0,0]} maxBarSize={30} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </ChartCard>

                {/* Donut — overall status split (1/3 width on desktop) */}
                <div className="bg-white rounded-2xl border border-surface-border shadow-sm overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-surface-border flex items-center gap-2.5">
                    <div className="p-1.5 rounded-lg bg-primary/10 flex-shrink-0">
                      <CheckCircle2 size={13} className="text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-text">Status Distribution</p>
                      <p className="text-xs text-text-muted mt-0.5">All requests in period</p>
                    </div>
                  </div>
                  <div className="p-4 sm:p-5">
                    {requestTotals.length === 0 ? (
                      <EmptyChart message="No request data" />
                    ) : (
                      <>
                        <ResponsiveContainer width="100%" height={175}>
                          <PieChart>
                            <Pie
                              data={requestTotals}
                              cx="50%"
                              cy="50%"
                              innerRadius={52}
                              outerRadius={80}
                              paddingAngle={3}
                              dataKey="value"
                            >
                              {requestTotals.map((entry, i) => (
                                <Cell key={i} fill={entry.color} stroke="none" />
                              ))}
                            </Pie>
                            <ReTooltip
                              content={({ active, payload }) => {
                                if (!active || !payload?.length) return null
                                const d = payload[0].payload
                                return (
                                  <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-3.5 py-2.5 text-xs">
                                    <p className="font-bold text-text">{d.name}</p>
                                    <p className="text-text-muted mt-0.5">{d.value.toLocaleString()} requests</p>
                                  </div>
                                )
                              }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                        {/* Legend with counts */}
                        <div className="flex flex-col gap-1.5 mt-2">
                          {requestTotals.map((d) => (
                            <div key={d.name} className="flex items-center justify-between gap-2">
                              <span className="flex items-center gap-2 min-w-0">
                                <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: d.color }} />
                                <span className="text-xs text-text-muted truncate">{d.name}</span>
                              </span>
                              <span className="text-xs font-bold text-text tabular-nums flex-shrink-0">{d.value.toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Requests table */}
              <div>
                <SectionLabel>Monthly Breakdown</SectionLabel>
                <Table
                  columns={requestColumns}
                  rows={requestsByMonth}
                  emptyMessage="No stock requests in this date range."
                />
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════ PENDING APPROVALS ═══════════════════════════ */}
          {activeTab === 'approvals' && (
            <div className="flex flex-col gap-5">

              {/* Summary stat cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatCard
                  label="Total Pending"
                  value={approvalTotals.corrections + approvalTotals.thresholds}
                  unit="require action"
                  icon={AlertTriangle}
                  colorClass={approvalTotals.corrections + approvalTotals.thresholds > 0 ? 'text-amber-500' : 'text-primary'}
                />
                <StatCard
                  label="Stock Corrections"
                  value={approvalTotals.corrections}
                  unit="pending approvals"
                  icon={Package}
                  colorClass="text-violet-500"
                />
                <StatCard
                  label="Threshold Changes"
                  value={approvalTotals.thresholds}
                  unit="pending approvals"
                  icon={TrendingDown}
                  colorClass="text-cyan-600"
                />
              </div>

              {/* Pending by facility chart */}
              {approvalsByFacility.length > 0 && (
                <ChartCard
                  title="Pending Approvals by Facility"
                  subtitle="Stock corrections vs threshold changes — top 10"
                  icon={BarChart2}
                >
                  <ResponsiveContainer
                    width="100%"
                    height={Math.max(160, approvalsByFacility.length * 46)}
                  >
                    <BarChart
                      layout="vertical"
                      data={approvalsByFacility.map((d) => ({ ...d, name: d.shortName }))}
                      margin={{ top: 4, right: 30, left: 4, bottom: 4 }}
                      barCategoryGap="35%"
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F1F5F9" />
                      <XAxis type="number" tick={{ fontSize: 10, fill: '#94A3B8' }} allowDecimals={false} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#475569' }} width={145} />
                      <ReTooltip content={<ChartTooltip nameKey="fullName" />} cursor={{ fill: '#F8FAFC' }} />
                      <Legend verticalAlign="top" height={28} iconType="circle" iconSize={7} formatter={legendFmt} />
                      <Bar dataKey="Corrections" stackId="a" fill={C.correction} maxBarSize={22} />
                      <Bar dataKey="Thresholds"  stackId="a" fill={C.threshold}  radius={[0,3,3,0]} maxBarSize={22} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              )}

              {/* Approvals table */}
              <div>
                <SectionLabel>Approval Queue</SectionLabel>
                <Table
                  columns={approvalsColumns}
                  rows={pendingApprovals}
                  emptyMessage="No pending approvals."
                />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
