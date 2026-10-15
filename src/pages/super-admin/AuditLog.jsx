import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getAuditLog, getVaccines, getFacilities } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import Table from '../../components/shared/Table'
import Select from '../../components/ui/Select'
import Button from '../../components/ui/Button'
import DatePicker from '../../components/ui/DatePicker'
import { ChevronLeft, ChevronRight, Shield, Clock, Users, ShieldAlert, Award, Building2, ArrowLeft } from 'lucide-react'
import { displayVaccineName } from '../../lib/vaccineNames'
import PageHeader from '../../components/shared/PageHeader'

function humanizeKey(key) {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())
}

const ACTION_LABELS = {
  LOGOUT: 'Logout',
  STOCK_ENTRY: 'Stock Entry',
  ADJUST_STOCK:  'Stock Correction',
  STOCK_ASSIGN:  'Vials Assigned',
  STOCK_DAY_END: 'Day End Recorded',
  CREATE_VACCINE: 'Vaccine Added',
  DELETE_VACCINE: 'Vaccine Deleted',
  EDIT_VACCINE: 'Vaccine Edited',
  CREATE_USER: 'User Created',
  ACTIVATE_USER: 'User Activated',
  DEACTIVATE_USER: 'User Deactivated',
  RESET_PASSWORD: 'Password Reset',
  ASSIGN_UC_SUPERVISOR: 'UC Assignment',
  CREATE_DISTRICT: 'District Created',
  EDIT_DISTRICT: 'District Renamed',
  DEACTIVATE_DISTRICT: 'District Deactivated',
  ACTIVATE_DISTRICT: 'District Activated',
  CREATE_FACILITY: 'Facility Created',
  EDIT_FACILITY: 'Facility Renamed',
  DEACTIVATE_FACILITY: 'Facility Deactivated',
  ACTIVATE_FACILITY: 'Facility Activated',
  CREATE_TOWN: 'Town Created',
  EDIT_TOWN: 'Town Renamed',
  DEACTIVATE_TOWN: 'Town Deactivated',
  ACTIVATE_TOWN: 'Town Activated',
  CREATE_UC: 'UC Created',
  EDIT_UC: 'UC Renamed',
  DEACTIVATE_UC: 'UC Deactivated',
  ACTIVATE_UC: 'UC Activated',
  // Sprint 3 — Approvals
  APPROVAL_REQUEST: 'Approval Requested',
  APPROVAL_APPROVE: 'Approval Approved',
  APPROVAL_REJECT:  'Approval Rejected',
  APPROVAL_CANCEL:  'Approval Cancelled',
  // Sprint 4 — Stock Requests
  STOCK_REQUEST_CREATE:   'Stock Request Raised',
  STOCK_REQUEST_SENT:     'Stock Sent Recorded',
  STOCK_REQUEST_RECEIVED: 'Stock Received Recorded',
  STOCK_REQUEST_APPROVE:  'Stock Request Approved',
  STOCK_REQUEST_CANCEL:      'Stock Request Cancelled',
  STOCK_REQUEST_CLOSE_SHORT: 'Request Closed Short',
  STOCK_REQUEST_DECLINE:     'Stock Request Declined',
}

function formatDetails(row, vaccineNameById) {
  const d = row.details
  if (!d) return '—'

  const vaccineName = (id) => vaccineNameById[id] ?? (id ? `vaccine ${String(id).slice(0, 8)}…` : 'unknown vaccine')

  switch (row.action) {
    case 'STOCK_ENTRY': {
      const verb =
        d.entryType === 'used'     ? 'used' :
        d.entryType === 'returned' ? 'returned' :
        d.entryType === 'legacy'   ? 'recorded (legacy)' :
        d.entryType === 'opening'  ? 'opening balance' : 'received'
      return `${d.quantity} doses ${verb} — ${vaccineName(d.vaccineId)}`
    }
    case 'ADJUST_STOCK':
      return `Stock corrected ${d.delta > 0 ? '+' : ''}${d.delta} (${d.previousBalance} → ${d.newBalance}) — ${vaccineName(d.vaccineId)}`
    case 'STOCK_ASSIGN': {
      const items = d.items ?? []
      return `${items.length} vaccine${items.length !== 1 ? 's' : ''} assigned to ${d.workerEmail ?? d.workerId ?? 'worker'}`
    }
    case 'STOCK_DAY_END': {
      const items = d.items ?? []
      return `Day-end recorded for ${items.length} vaccine${items.length !== 1 ? 's' : ''} — ${d.workerEmail ?? d.workerId ?? 'worker'}`
    }
    case 'CREATE_VACCINE':
      return `Added "${d.name ? displayVaccineName(d.name) : vaccineName(d.vaccineId)}" (${d.dosesPerVial ?? '?'} doses/vial)`
    case 'DELETE_VACCINE':
      return `Deleted "${d.name ? displayVaccineName(d.name) : vaccineName(d.vaccineId)}"`
    case 'EDIT_VACCINE': {
      const newName = d.newName ?? d.name ?? vaccineName(d.vaccineId)
      const displayNew = d.newName || d.name ? displayVaccineName(newName) : newName
      return d.oldName
        ? `Renamed "${displayVaccineName(d.oldName)}" → "${displayNew}"`
        : `Edited "${displayNew}"`
    }
    case 'CREATE_USER':
      return `${(d.role ?? '').replace(/_/g, ' ')} — ${d.email}`
    case 'ASSIGN_UC_SUPERVISOR':
      return `Assigned ${(d.ucNames ?? d.ucIds ?? []).length} UC(s) to ${d.email ?? d.userId ?? '—'}`
    case 'CREATE_DISTRICT':
    case 'EDIT_DISTRICT':
    case 'DEACTIVATE_DISTRICT':
    case 'ACTIVATE_DISTRICT':
    case 'CREATE_FACILITY':
    case 'EDIT_FACILITY':
    case 'DEACTIVATE_FACILITY':
    case 'ACTIVATE_FACILITY':
    case 'CREATE_TOWN':
    case 'EDIT_TOWN':
    case 'DEACTIVATE_TOWN':
    case 'ACTIVATE_TOWN':
    case 'CREATE_UC':
    case 'EDIT_UC':
    case 'DEACTIVATE_UC':
    case 'ACTIVATE_UC':
      return `"${d.name}"`
    case 'APPROVAL_REQUEST':
    case 'APPROVAL_APPROVE':
    case 'APPROVAL_REJECT':
    case 'APPROVAL_CANCEL': {
      const typeLabel = d.type === 'stock_correction' ? 'Stock Correction' : d.type === 'threshold_change' ? 'Threshold Change' : (d.type ?? '')
      const name = d.vaccineName ? displayVaccineName(d.vaccineName) : vaccineName(d.vaccineId)
      return `${typeLabel}${name ? ` — ${name}` : ''}`
    }
    case 'STOCK_REQUEST_CREATE':
    case 'STOCK_REQUEST_SENT':
    case 'STOCK_REQUEST_RECEIVED':
    case 'STOCK_REQUEST_APPROVE':
    case 'STOCK_REQUEST_CANCEL':
    case 'STOCK_REQUEST_CLOSE_SHORT':
    case 'STOCK_REQUEST_DECLINE': {
      const noteStr = d.note ? ` · "${d.note}"` : ''
      if (d.items?.length) {
        const parts = d.items.map(item => {
          const name = item.vaccineName ? displayVaccineName(item.vaccineName) : vaccineName(item.vaccineId)
          const vials = item.requestedVials ?? item.sentVials ?? item.receivedVials ?? item.fulfilledVials
          return vials != null ? `${name} (${vials} vials)` : name
        })
        return parts.join(', ') + noteStr
      }
      const count = d.itemCount ?? null
      return count != null ? `${count} vaccine${count !== 1 ? 's' : ''}${noteStr}` : (d.reason ?? '—')
    }
    case 'LOGOUT':
      return '—'
    default:
      return Object.entries(d).map(([k, v]) => `${humanizeKey(k)}: ${v}`).join(', ')
  }
}

export default function AuditLog({ title = 'Audit Log', subtitle = '' }) {
  const { user } = useAuth()

  const isDistrictSup = user?.role === 'district_supervisor'
  const isFacilityHead = user?.role === 'facility_head'
  const defaultTab = isDistrictSup ? 'all' : isFacilityHead ? 'facility_supervisor' : 'super_admin'

  const [activeTab, setActiveTab]         = useState(defaultTab)
  const [selectedFacility, setSelectedFacility] = useState(null)
  const [dateFrom, setDateFrom]           = useState('')
  const [dateTo, setDateTo]               = useState('')
  const [actionFilter, setActionFilter]   = useState('')
  const [currentPage, setCurrentPage]     = useState(1)
  const [drillPage, setDrillPage]         = useState(1)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['audit-log'],
    queryFn: getAuditLog,
  })
  const { data: vaccineData } = useQuery({ queryKey: ['vaccines'], queryFn: getVaccines })
  const { data: facilityData } = useQuery({
    queryKey: ['facilities'],
    queryFn: getFacilities,
    enabled: isDistrictSup,
    staleTime: 30_000,
  })

  const vaccineNameById = useMemo(
    () => Object.fromEntries((vaccineData?.vaccines ?? []).map((v) => [v.id, displayVaccineName(v.name)])),
    [vaccineData]
  )

  const hasFilters = !!(dateFrom || dateTo || actionFilter)
  const logs       = data?.auditLog ?? []
  const facilities = facilityData?.facilities ?? []

  const filtered = useMemo(() => {
    if (activeTab === 'all') return []
    const tabLogs = logs.filter((l) => l.actorRole === activeTab)
    return tabLogs.filter((l) => {
      const lDate = l.createdAt?.split('T')[0]
      if (dateFrom && lDate < dateFrom) return false
      if (dateTo   && lDate > dateTo)   return false
      if (actionFilter && l.action !== actionFilter) return false
      return true
    })
  }, [logs, activeTab, dateFrom, dateTo, actionFilter])

  const itemsPerPage = 10
  const totalPages   = Math.ceil(filtered.length / itemsPerPage)
  const paginatedRows = useMemo(
    () => filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage),
    [filtered, currentPage]
  )

  // Per-facility log counts for the "All" tab facility list
  const facilityLogCounts = useMemo(() => {
    const counts = {}
    for (const l of logs) {
      if (!l.facilityId) continue
      if (l.actorRole !== 'facility_supervisor' && l.actorRole !== 'facility_worker') continue
      counts[l.facilityId] = (counts[l.facilityId] ?? 0) + 1
    }
    return counts
  }, [logs])

  // Drill-down: combined supervisor + worker logs for selected facility, newest first
  const drillLogs = useMemo(() => {
    if (!selectedFacility) return []
    return logs
      .filter((l) =>
        (l.actorRole === 'facility_supervisor' || l.actorRole === 'facility_worker') &&
        (l.facilityId
          ? l.facilityId === selectedFacility.id
          : l.facilityName === selectedFacility.name)
      )
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  }, [logs, selectedFacility])

  const drillTotalPages = Math.ceil(drillLogs.length / itemsPerPage)
  const drillPaginated  = drillLogs.slice((drillPage - 1) * itemsPerPage, drillPage * itemsPerPage)

  const tabs = isFacilityHead
    ? [
        { id: 'uc_supervisor',       label: 'UC Supervisors',       icon: Shield },
        { id: 'facility_head',       label: 'Facility Heads',       icon: Building2 },
        { id: 'facility_supervisor', label: 'Facility Supervisors', icon: Award },
        { id: 'facility_worker',     label: 'Workers',              icon: Users },
      ]
    : isDistrictSup
    ? [
        { id: 'all',                 label: 'All',                  icon: Building2 },
        { id: 'district_supervisor', label: 'District Supervisor',  icon: Shield },
        { id: 'uc_supervisor',       label: 'UC Supervisors',       icon: Shield },
        { id: 'facility_head',       label: 'Facility Heads',       icon: Building2 },
        { id: 'facility_supervisor', label: 'Facility Supervisors', icon: Award },
        { id: 'facility_worker',     label: 'Workers',              icon: Users },
      ]
    : [
        { id: 'super_admin',         label: 'Super Admin',          icon: ShieldAlert },
        { id: 'district_supervisor', label: 'District Supervisors', icon: Shield },
        { id: 'uc_supervisor',       label: 'UC Supervisors',       icon: Shield },
        { id: 'facility_head',       label: 'Facility Heads',       icon: Building2 },
        { id: 'facility_supervisor', label: 'Facility Supervisors', icon: Award },
        { id: 'facility_worker',     label: 'Workers',              icon: Users },
      ]

  // Show facility columns when tab is facility-level
  const isFacilityTab = activeTab === 'facility_supervisor' || activeTab === 'facility_worker'
  // Show vaccine/vials/details only for tabs where it's meaningful
  const showVaccineVialsDetails = activeTab === 'uc_supervisor' || activeTab === 'facility_head' || activeTab === 'facility_supervisor'

  const columns = [
    {
      key: 'createdAt',
      label: 'Date & Time',
      render: (row) => (
        <div className="flex items-center gap-1.5 text-xs text-text font-semibold whitespace-nowrap">
          <Clock size={12} className="text-text-muted flex-shrink-0" />
          <span>
            {new Date(row.createdAt).toLocaleString('en-US', {
              month: 'short', day: 'numeric', year: 'numeric',
              hour: 'numeric', minute: '2-digit', hour12: true,
            })}
          </span>
        </div>
      )
    },
    {
      key: 'actor',
      label: 'Actor',
      render: (row) => (
        <div className="flex flex-col min-w-[120px]">
          <span className="text-sm text-text font-bold">{row.actorName ?? '—'}</span>
          <span className="text-[9px] text-text-muted font-bold tracking-wider mt-0.5">
            {row.actorRole ? row.actorRole.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '—'}
          </span>
        </div>
      )
    },
    {
      key: 'action',
      label: 'Action',
      render: (row) => {
        const actionText = ACTION_LABELS[row.action] ?? row.action
        const showStatus = row.status != null &&
          (row.entityType === 'stock_request' || row.entityType === 'approval')
        return (
          <div className="flex flex-col gap-1">
            <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded bg-surface-alt border border-surface-border text-text-muted whitespace-nowrap">
              {actionText}
            </span>
            {showStatus && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-surface-chip border border-surface-border text-text-muted w-fit">
                {row.status.replace(/_/g, ' ')}
              </span>
            )}
          </div>
        )
      }
    },
    { key: 'entityType', label: 'Category', render: (row) => <span className="text-xs font-semibold text-text">{row.entityType ?? '—'}</span> },
    // District column: hide for district_supervisor (already scoped to one district)
    ...(!isDistrictSup ? [{
      key: 'districtName',
      label: 'District',
      render: (row) => <span className="text-xs font-medium text-text-muted">{row.districtName ?? '—'}</span>
    }] : []),
    // Facility: only relevant for facility-level tabs
    ...(isFacilityTab ? [
      { key: 'facilityName', label: 'Facility', render: (row) => <span className="text-xs font-medium text-text-muted">{row.facilityName ?? '—'}</span> },
    ] : []),
    // Vaccine / Vials / Details — only for tabs where stock data is meaningful
    ...(showVaccineVialsDetails ? [
      {
        key: 'vaccine_name',
        label: 'Vaccine',
        render: (row) => {
          const d = row.details
          if (!d) return <span className="text-text-muted/50 text-xs">—</span>
          if (d.vaccineName) {
            return <span className="text-xs font-semibold text-text">{displayVaccineName(d.vaccineName)}</span>
          }
          if (d.items?.length) {
            const names = d.items.map(item =>
              item.vaccineName
                ? displayVaccineName(item.vaccineName)
                : (vaccineNameById[item.vaccineId] ?? null)
            ).filter(Boolean)
            if (!names.length) return <span className="text-text-muted/50 text-xs">—</span>
            return (
              <span className="text-xs font-semibold text-text">
                {names.length === 1 ? names[0] : `${names.length} vaccines`}
              </span>
            )
          }
          return <span className="text-text-muted/50 text-xs">—</span>
        }
      },
      {
        key: 'vials',
        label: 'Vials',
        render: (row) => {
          const d = row.details
          if (!d) return <span className="text-text-muted/50 text-xs">—</span>
          if (row.action === 'STOCK_ENTRY' && d.vials != null) {
            return <span className="text-sm font-bold text-text tabular-nums">{d.vials}</span>
          }
          if (row.action?.startsWith('STOCK_REQUEST') && d.items?.length) {
            const total = d.items.reduce((sum, item) =>
              sum + (item.requestedVials ?? item.sentVials ?? item.receivedVials ?? item.fulfilledVials ?? 0), 0)
            return <span className="text-sm font-bold text-text tabular-nums">{total}</span>
          }
          return <span className="text-text-muted/50 text-xs">—</span>
        }
      },
      {
        key: 'details',
        label: 'Details',
        render: (row) => (
          <p className="text-xs text-text-muted font-medium leading-relaxed break-words min-w-[160px] max-w-[320px]">
            {formatDetails(row, vaccineNameById)}
          </p>
        )
      },
    ] : []),
  ]

  const getCount = (tabId) => {
    if (tabId === 'all') return facilities.length
    return logs.filter((l) => l.actorRole === tabId).length
  }

  function handleTabChange(tabId) {
    setActiveTab(tabId)
    setCurrentPage(1)
    setSelectedFacility(null)
    setDrillPage(1)
    setDateFrom('')
    setDateTo('')
    setActionFilter('')
  }

  const auditMobileCard = (row) => (
    <div className="px-4 py-3 hover:bg-surface-alt/50">
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded bg-surface-alt border border-surface-border text-text-muted">
          {ACTION_LABELS[row.action] ?? row.action}
        </span>
        <div className="flex items-center gap-1 text-[10px] text-text-muted font-semibold flex-shrink-0">
          <Clock size={10} />
          <span>
            {new Date(row.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}
          </span>
        </div>
      </div>
      <p className="font-bold text-sm text-text">{row.actorName ?? '—'}</p>
      <p className="text-[10px] text-text-muted font-semibold mt-0.5">
        {row.actorRole ? row.actorRole.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '—'}
        {row.facilityName ? ` · ${row.facilityName}` : ''}
      </p>
      <p className="text-xs text-text-muted font-medium mt-1.5 leading-relaxed">
        {formatDetails(row, vaccineNameById)}
      </p>
    </div>
  )

  return (
    <div className="flex flex-col gap-4 animate-in fade-in duration-200">

      <PageHeader
        breadcrumb={isFacilityHead ? 'Facility Head › Audit Log' : isDistrictSup ? 'District Supervisor › Audit Log' : 'Super Admin › Audit Log'}
        title={title}
        subtitle={subtitle || undefined}
        actions={
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-60" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
            </span>
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest hidden sm:block">
              Live · Auto-refreshing
            </span>
          </div>
        }
      />

      {/* Tabs list */}
      {!isLoading && !isError && (
        <div className="overflow-x-auto max-w-full -mx-1 px-1 pb-0.5">
        <div className="flex gap-1 p-1 bg-surface-chip border border-surface-border rounded-xl w-fit min-w-max">
          {tabs.map((t) => {
            const Icon = t.icon
            const active = activeTab === t.id
            const count = getCount(t.id)
            return (
              <button
                key={t.id}
                onClick={() => handleTabChange(t.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                  active
                    ? 'bg-surface text-primary shadow-sm border border-surface-border'
                    : 'text-text-muted hover:text-text'
                }`}
              >
                <Icon size={13} strokeWidth={2.2} />
                {t.label}
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  active ? 'bg-primary/10 text-primary' : 'bg-surface text-text-muted border border-surface-border'
                }`}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>
        </div>
      )}

      {/* ── All tab: facility list or drill-down ─────────────────────── */}
      {activeTab === 'all' && !isLoading && !isError && (
        <>
          {!selectedFacility ? (
            /* Facility list */
            <div className="bg-surface rounded-2xl border border-surface-border overflow-hidden shadow-sm">
              <div className="hidden sm:grid grid-cols-[2fr_1.5fr_1fr] px-6 py-3.5 bg-surface-alt border-b border-surface-border gap-4 items-center">
                <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Facility</span>
                <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Supervisor</span>
                <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest text-right">Activity</span>
              </div>
              {facilities.length === 0 ? (
                <div className="px-6 py-10 text-center text-sm text-text-muted">No facilities registered yet.</div>
              ) : (
                facilities.map((f) => {
                  const count = facilityLogCounts[f.id] ?? 0
                  return (
                    <div key={f.id} className="border-b border-surface-border last:border-b-0">
                      {/* Mobile card */}
                      <button
                        onClick={() => { setSelectedFacility(f); setDrillPage(1) }}
                        className="sm:hidden w-full px-4 py-3 hover:bg-surface-alt/60 transition-colors text-left cursor-pointer"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <Building2 size={13} className="text-text-muted/60 flex-shrink-0" />
                            <span className="font-bold text-text text-sm truncate">{f.name}</span>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${count > 0 ? 'bg-primary/10 text-primary' : 'bg-surface-chip text-text-muted'}`}>
                              {count} {count === 1 ? 'log' : 'logs'}
                            </span>
                            <ArrowLeft size={13} className="text-text-muted/50 rotate-180" />
                          </div>
                        </div>
                        <p className={`text-xs mt-0.5 pl-5 ${f.facilitySupervisorName ? 'text-text-muted' : 'text-text-muted/60 italic'}`}>
                          {f.facilitySupervisorName ?? 'Unstaffed'}
                        </p>
                      </button>
                      {/* Desktop row */}
                      <button
                        onClick={() => { setSelectedFacility(f); setDrillPage(1) }}
                        className="hidden sm:grid w-full grid-cols-[2fr_1.5fr_1fr] px-6 py-4 gap-4 items-center hover:bg-surface-alt/60 transition-colors text-left cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Building2 size={14} className="text-text-muted/60 flex-shrink-0" />
                          <span className="font-bold text-text text-sm truncate">{f.name}</span>
                        </div>
                        <span className={`text-sm truncate ${f.facilitySupervisorName ? 'text-text font-medium' : 'text-text-muted italic text-xs'}`}>
                          {f.facilitySupervisorName ?? 'Unstaffed'}
                        </span>
                        <div className="flex justify-end items-center gap-1.5">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${count > 0 ? 'bg-primary/10 text-primary' : 'bg-surface-chip text-text-muted'}`}>
                            {count} {count === 1 ? 'log' : 'logs'}
                          </span>
                          <ArrowLeft size={13} className="text-text-muted/50 rotate-180" />
                        </div>
                      </button>
                    </div>
                  )
                })
              )}
            </div>
          ) : (
            /* Drill-down: selected facility logs */
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => { setSelectedFacility(null); setDrillPage(1) }}
                  className="inline-flex items-center gap-1.5 text-sm font-bold text-text-muted hover:text-primary transition-colors"
                >
                  <ArrowLeft size={14} /> Back to Facilities
                </button>
                <span className="text-text-muted/40">·</span>
                <span className="text-sm font-bold text-text">{selectedFacility.name}</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${drillLogs.length > 0 ? 'bg-primary/10 text-primary' : 'bg-surface-chip text-text-muted'}`}>
                  {drillLogs.length} {drillLogs.length === 1 ? 'entry' : 'entries'}
                </span>
              </div>
              <Table
                columns={columns}
                rows={drillPaginated}
                emptyMessage="No activity recorded for this facility yet."
                mobileCard={auditMobileCard}
              />
              {drillTotalPages > 1 && (
                <div className="flex items-center justify-between bg-surface px-5 py-4 rounded-2xl border border-surface-border shadow-sm">
                  <p className="text-xs text-text-muted font-semibold hidden sm:block">
                    Page <span className="font-extrabold text-text">{drillPage}</span> of{' '}
                    <span className="font-extrabold text-text">{drillTotalPages}</span>
                  </p>
                  <nav className="isolate inline-flex -space-x-px rounded-xl shadow-sm border border-surface-border bg-surface-chip p-0.5 gap-1">
                    <button onClick={() => setDrillPage(drillPage - 1)} disabled={drillPage === 1}
                      className="relative inline-flex items-center rounded-lg p-1.5 text-text-muted hover:bg-surface disabled:opacity-40 transition-all cursor-pointer">
                      <ChevronLeft size={16} />
                    </button>
                    {Array.from({ length: drillTotalPages }).map((_, i) => {
                      const p = i + 1
                      return (
                        <button key={p} onClick={() => setDrillPage(p)}
                          className={`relative inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${p === drillPage ? 'bg-primary text-white shadow-sm' : 'text-text-muted hover:bg-surface'}`}>
                          {p}
                        </button>
                      )
                    })}
                    <button onClick={() => setDrillPage(drillPage + 1)} disabled={drillPage === drillTotalPages}
                      className="relative inline-flex items-center rounded-lg p-1.5 text-text-muted hover:bg-surface disabled:opacity-40 transition-all cursor-pointer">
                      <ChevronRight size={16} />
                    </button>
                  </nav>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Filter panel */}
      {activeTab !== 'all' && (() => {
        const DISTRICT_ACTIONS = new Set(['STOCK_ENTRY', 'ADJUST_STOCK', 'LOGOUT'])
        const STOCK_ONLY = new Set(['STOCK_ENTRY', 'ADJUST_STOCK'])
        const visibleActions = Object.entries(ACTION_LABELS).filter(([k]) => {
          if (isDistrictSup) return DISTRICT_ACTIONS.has(k)
          if (activeTab === 'facility_worker') return STOCK_ONLY.has(k)
          return true
        })
        return (
          <div className="bg-surface rounded-2xl border border-surface-border px-4 py-3 shadow-sm flex flex-wrap items-center gap-3">
            <select
              value={actionFilter}
              onChange={(e) => { setActionFilter(e.target.value); setCurrentPage(1) }}
              className="bg-surface border border-surface-border rounded-xl px-3 py-2 text-sm text-text font-medium focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer"
            >
              <option value="">All action types</option>
              {visibleActions.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-text-muted">From</span>
              <DatePicker
                id="date-from"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setCurrentPage(1) }}
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-text-muted">To</span>
              <DatePicker
                id="date-to"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setCurrentPage(1) }}
              />
            </div>

            {hasFilters && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => { setDateFrom(''); setDateTo(''); setActionFilter(''); setCurrentPage(1) }}
              >
                Clear
              </Button>
            )}

            <span className="ml-auto text-xs font-bold text-text-muted tabular-nums">
              {filtered.length} {filtered.length === 1 ? 'entry' : 'entries'}
            </span>
          </div>
        )
      })()}

      {isLoading && activeTab !== 'all' && (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-14 bg-surface-alt border border-surface-border rounded-xl animate-pulse" />)}
        </div>
      )}

      {isError && (
        <div className="bg-danger-bg border border-danger/10 text-xs font-semibold text-danger rounded-xl px-4 py-3">
          Failed to load audit logs. Please try refreshing.
        </div>
      )}

      {!isLoading && !isError && activeTab !== 'all' && (
        <div className="flex flex-col gap-3">
          <Table
            columns={columns}
            rows={paginatedRows}
            emptyMessage={hasFilters ? 'No log entries match your filters.' : 'No activity recorded yet.'}
            mobileCard={auditMobileCard}
          />

          {/* Pagination bar */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-surface-border bg-surface px-5 py-4 mt-2 rounded-2xl border border-surface-border shadow-sm">
              <div className="flex flex-1 justify-between sm:hidden">
                <Button variant="secondary" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage(currentPage - 1)}>
                  Previous
                </Button>
                <Button variant="secondary" size="sm" disabled={currentPage === totalPages} onClick={() => setCurrentPage(currentPage + 1)}>
                  Next
                </Button>
              </div>
              <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs text-text-muted font-semibold">
                    Page <span className="font-extrabold text-text">{currentPage}</span> of{' '}
                    <span className="font-extrabold text-text">{totalPages}</span>
                  </p>
                </div>
                <div>
                  <nav className="isolate inline-flex -space-x-px rounded-xl shadow-sm border border-surface-border bg-surface-chip p-0.5 gap-1" aria-label="Pagination">
                    <button
                      onClick={() => setCurrentPage(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center rounded-lg p-1.5 text-text-muted hover:bg-surface disabled:opacity-55 disabled:hover:bg-transparent transition-all cursor-pointer"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    {Array.from({ length: totalPages }).map((_, i) => {
                      const p = i + 1
                      return (
                        <button
                          key={p}
                          onClick={() => setCurrentPage(p)}
                          className={`relative inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                            p === currentPage
                              ? 'bg-primary text-white shadow-sm shadow-primary/10'
                              : 'text-text-muted hover:bg-surface'
                          }`}
                        >
                          {p}
                        </button>
                      )
                    })}
                    <button
                      onClick={() => setCurrentPage(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="relative inline-flex items-center rounded-lg p-1.5 text-text-muted hover:bg-surface disabled:opacity-55 disabled:hover:bg-transparent transition-all cursor-pointer"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
