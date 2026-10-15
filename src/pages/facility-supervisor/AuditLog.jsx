import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../context/AuthContext'
import { getAuditLog, getUsers, getVaccines } from '../../lib/api'
import {
  Clock, Package, Settings, Syringe, Tag,
  UserPlus, UserX, ClipboardList, KeyRound,
  UserCheck, Search, Shield, ArrowUp, ArrowDown, Users,
  RefreshCcw, Trash2, ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  CheckCircle2, XCircle, Send, FileText, AlertTriangle,
} from 'lucide-react'
import DatePicker from '../../components/ui/DatePicker'
import Button from '../../components/ui/Button'
import PageHeader from '../../components/shared/PageHeader'
import { displayVaccineName } from '../../lib/vaccineNames'

// ─── Helpers ──────────────────────────────────────────────────────────────────
const AVATAR_COLORS = [
  'bg-teal-500', 'bg-violet-500', 'bg-amber-500',
  'bg-sky-500',  'bg-pink-500',   'bg-emerald-500',
]
function avatarBg(key = '') {
  return AVATAR_COLORS[key ? key.charCodeAt(0) % AVATAR_COLORS.length : 0]
}

function formatDate(isoStr) {
  if (!isoStr) return '—'
  return new Date(isoStr).toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  })
}

function trimName(s) {
  return s ? s.trim().replace(/\s+/g, ' ') : s
}

// Abbreviate long vaccine names for inline lists in the Details cell
function abbr(name) {
  return name ? name.replace('Pentavalent', 'Penta') : '—'
}

const CATEGORY_LABEL = {
  sheet:         'Sheet',
  stock_request: 'Stock Request',
  stock_entry:   'Stock Entry',
  approval:      'Approval',
  user:          'Session',
}

function getCategory(entry) {
  if (entry.category) return CATEGORY_LABEL[entry.category] ?? entry.category
  const a = entry.action ?? ''
  if (a === 'SHEET_SAVED')            return 'Sheet'
  if (a === 'LOGOUT')                 return 'Session'
  if (a.startsWith('STOCK_REQUEST'))  return 'Stock Request'
  if (a.startsWith('APPROVAL'))       return 'Approval'
  if (a === 'STOCK_ENTRY' || a === 'ADJUST_STOCK' || a === 'STOCK_ASSIGN' || a === 'STOCK_RECEIVE' || a === 'STOCK_DAY_END') return 'Stock Entry'
  return null
}

const ACTION_META = {
  SHEET_SAVED:               { label: 'Sheet Saved',             pill: 'bg-primary/5 text-primary border-primary/10',             icon: FileText      },
  STOCK_ENTRY:               { label: 'Stock Entry',             pill: 'bg-primary/5 text-primary border-primary/10',             icon: Package       },
  ADJUST_STOCK:              { label: 'Stock Correction',        pill: 'bg-primary/5 text-primary border-primary/10',             icon: RefreshCcw    },
  LOGOUT:                    { label: 'Logout',                  pill: 'bg-surface-alt text-text-muted border-surface-border',    icon: KeyRound      },
  CREATE_VACCINE:            { label: 'Vaccine Added',           pill: 'bg-success-bg text-success-dark border-success/15',       icon: Syringe       },
  EDIT_VACCINE:              { label: 'Vaccine Renamed',         pill: 'bg-surface-alt text-text-muted border-surface-border',    icon: Tag           },
  DELETE_VACCINE:            { label: 'Vaccine Deleted',         pill: 'bg-danger-bg text-danger border-danger/15',               icon: Trash2        },
  SET_THRESHOLD:             { label: 'Threshold Updated',       pill: 'bg-warning-bg text-warning-dark border-warning/15',       icon: Settings      },
  CREATE_USER:               { label: 'Worker Added',            pill: 'bg-primary/5 text-primary border-primary/10',             icon: UserPlus      },
  ACTIVATE_USER:             { label: 'Worker Activated',        pill: 'bg-success-bg text-success-dark border-success/15',       icon: UserCheck     },
  DEACTIVATE_USER:           { label: 'Worker Deactivated',      pill: 'bg-danger-bg text-danger border-danger/15',               icon: UserX         },
  RESET_PASSWORD:            { label: 'Password Reset',          pill: 'bg-surface-alt text-text-muted border-surface-border',    icon: KeyRound      },
  STOCK_REQUEST_CREATE:      { label: 'Stock Request Raised',    pill: 'bg-primary/5 text-primary border-primary/10',             icon: ClipboardList },
  STOCK_REQUEST_SENT:        { label: 'Stock Sent',              pill: 'bg-primary/5 text-primary border-primary/10',             icon: Send          },
  STOCK_REQUEST_RECEIVED:    { label: 'Stock Received',          pill: 'bg-success-bg text-success-dark border-success/15',       icon: Package       },
  STOCK_REQUEST_APPROVE:     { label: 'Request Approved',        pill: 'bg-success-bg text-success-dark border-success/15',       icon: CheckCircle2  },
  STOCK_REQUEST_CANCEL:      { label: 'Stock Request Cancelled', pill: 'bg-surface-alt text-text-muted border-surface-border',    icon: XCircle       },
  STOCK_REQUEST_CLOSE_SHORT: { label: 'Request Closed Short',   pill: 'bg-surface-alt text-text-muted border-surface-border',    icon: XCircle       },
  STOCK_REQUEST_DECLINE:     { label: 'Request Declined',        pill: 'bg-danger-bg text-danger border-danger/15',               icon: XCircle       },
  APPROVAL_REQUEST:          { label: 'Approval Requested',      pill: 'bg-primary/5 text-primary border-primary/10',             icon: ClipboardList },
  APPROVAL_APPROVE:          { label: 'Approval Approved',       pill: 'bg-success-bg text-success-dark border-success/15',       icon: CheckCircle2  },
  APPROVAL_REJECT:           { label: 'Approval Rejected',       pill: 'bg-danger-bg text-danger border-danger/15',               icon: XCircle       },
  APPROVAL_DECLINE:          { label: 'Approval Rejected',       pill: 'bg-danger-bg text-danger border-danger/15',               icon: XCircle       },
  APPROVAL_CANCEL:           { label: 'Approval Cancelled',      pill: 'bg-surface-alt text-text-muted border-surface-border',    icon: XCircle       },
  STOCK_ASSIGN:              { label: 'Stock Assigned',          pill: 'bg-success-bg text-success-dark border-success/15',       icon: Package       },
  STOCK_RECEIVE:             { label: 'Stock Received',          pill: 'bg-success-bg text-success-dark border-success/15',       icon: Package       },
  STOCK_DAY_END:             { label: 'Day-End Closed',          pill: 'bg-surface-alt text-text-muted border-surface-border',    icon: ClipboardList },
}

// Stock request actions that carry an entityId worth filtering by
const ENTITY_ACTIONS = new Set([
  'STOCK_REQUEST_CREATE', 'STOCK_REQUEST_SENT', 'STOCK_REQUEST_RECEIVED',
  'STOCK_REQUEST_APPROVE', 'STOCK_REQUEST_CANCEL', 'STOCK_REQUEST_CLOSE_SHORT',
  'STOCK_REQUEST_DECLINE',
])

// ─── parseEntry ───────────────────────────────────────────────────────────────
// Returns: { vaccineName, vials, vialsDir, detail, inlineItems, zeroVialsWarning, statusText }
// inlineItems: [{name, vials}] rendered inline in the Details cell
function parseEntry(action, details, vaccineNameById, workerNameById, createByEntityId, entityId) {
  const base = { inlineItems: null, zeroVialsWarning: false, statusText: null }
  if (!details) return { ...base, vaccineName: null, vials: null, vialsDir: null, detail: null }

  const vn = (id)   => id ? (vaccineNameById?.[id] ?? null)  : null
  const wn = (id)   => id ? (workerNameById?.[id]  ?? null)  : null
  const rv = (item) => item.vaccineName ? displayVaccineName(item.vaccineName) : vn(item.vaccineId)

  switch (action) {
    case 'SHEET_SAVED': {
      let detail = 'Monthly sheet saved'
      if (details.month && details.year) {
        const d = new Date(details.year, details.month - 1)
        detail = `Saved monthly sheet for ${d.toLocaleString('en-US', { month: 'short' })} ${details.year}`
      } else if (details.occurredOn) {
        const d = new Date(details.occurredOn + 'T00:00:00')
        detail = `Saved monthly sheet for ${d.toLocaleString('en-US', { month: 'short', year: 'numeric' })}`
      }
      return { ...base, vaccineName: null, vials: null, vialsDir: null, detail }
    }

    case 'LOGOUT':
      return { ...base, vaccineName: null, vials: null, vialsDir: null, detail: 'Logged out' }

    case 'STOCK_ENTRY': {
      const name = details.vaccineName ? displayVaccineName(details.vaccineName) : vn(details.vaccineId)
      return { ...base,
        vaccineName: name,
        vials: details.vials ?? details.quantity ?? null,
        vialsDir: details.entryType === 'used' ? 'out' : 'in',
        detail: details.entryType ?? null,
      }
    }

    case 'ADJUST_STOCK': {
      const name = details.vaccineName ? displayVaccineName(details.vaccineName) : vn(details.vaccineId)
      const delta = details.delta ?? null
      return { ...base,
        vaccineName: name,
        vials: delta != null ? `${delta > 0 ? '+' : ''}${delta}` : null,
        vialsDir: delta > 0 ? 'in' : delta < 0 ? 'out' : 'neutral',
        detail: details.reason ?? null,
      }
    }

    case 'SET_THRESHOLD': {
      const name = details.vaccineName ? displayVaccineName(details.vaccineName) : vn(details.vaccineId)
      return { ...base,
        vaccineName: name,
        vials: details.minQuantity != null ? String(details.minQuantity) : null,
        vialsDir: 'neutral',
        detail: 'Min threshold',
      }
    }

    case 'CREATE_VACCINE':
    case 'DELETE_VACCINE':
      return { ...base, vaccineName: details.name ?? vn(details.vaccineId), vials: null, vialsDir: null, detail: null }

    case 'EDIT_VACCINE': {
      const { oldName, newName, name, vaccineId } = details
      const resolved = newName ?? name ?? vn(vaccineId)
      return { ...base,
        vaccineName: oldName && resolved ? `${oldName} → ${resolved}` : (resolved ?? null),
        vials: null, vialsDir: null, detail: null,
      }
    }

    case 'CREATE_USER':
      return { ...base, vaccineName: null, vials: null, vialsDir: null, detail: details.email ?? null }

    case 'ACTIVATE_USER':
    case 'DEACTIVATE_USER':
    case 'RESET_PASSWORD':
      return { ...base, vaccineName: null, vials: null, vialsDir: null, detail: details.email ?? details.name ?? null }

    case 'STOCK_REQUEST_CREATE': {
      const statusText = details.status ? `Current status: ${details.status}` : null
      if (details.items?.length) {
        const il = details.items.map(item => ({ name: rv(item) ?? '—', vials: item.requestedVials ?? 0 }))
        const total = il.reduce((s, i) => s + i.vials, 0)
        const noteStr = details.note ? `"${details.note}"` : null
        return {
          ...base,
          vaccineName: il.length === 1 ? il[0].name : `${il.length} vaccines`,
          vials: total || null,
          vialsDir: 'in',
          detail: noteStr,
          inlineItems: il.length > 1 ? il : null,
          statusText,
        }
      }
      return { ...base, vaccineName: null, vials: null, vialsDir: null, detail: details.note ? `"${details.note}"` : null, statusText }
    }

    case 'STOCK_REQUEST_CANCEL': {
      const reason = details.reason || 'No reason given'
      const original = createByEntityId?.[entityId]
      if (original?.items?.length) {
        const il = original.items.map(item => ({ name: rv(item) ?? '—', vials: item.requestedVials ?? 0 }))
        const total = il.reduce((s, i) => s + i.vials, 0)
        return {
          ...base,
          vaccineName: il.length === 1 ? il[0].name : `${il.length} vaccines`,
          vials: total || null,
          vialsDir: 'neutral',
          detail: reason,
          inlineItems: il.length > 1 ? il : null,
        }
      }
      return { ...base, vaccineName: null, vials: null, vialsDir: null, detail: reason }
    }

    case 'STOCK_REQUEST_SENT': {
      const statusText = details.status ? `Current status: ${details.status}` : null
      if (details.items?.length) {
        const il = details.items.map(item => ({ name: rv(item) ?? '—', vials: item.sentVials ?? 0 }))
        const total = il.reduce((s, i) => s + i.vials, 0)
        const zeroVialsWarning = il.every(i => i.vials === 0)
        return {
          ...base,
          vaccineName: il.length === 1 ? il[0].name : `${il.length} vaccines`,
          vials: total || null,
          vialsDir: 'in',
          detail: null,
          inlineItems: il.length > 1 ? il : null,
          zeroVialsWarning,
          statusText,
        }
      }
      return { ...base, vaccineName: null, vials: null, vialsDir: null, detail: null, statusText }
    }

    case 'STOCK_REQUEST_RECEIVED': {
      const statusText = details.status ? `Current status: ${details.status}` : null
      if (details.items?.length) {
        const il = details.items.map(item => ({ name: rv(item) ?? '—', vials: item.receivedVials ?? 0 }))
        const total = il.reduce((s, i) => s + i.vials, 0)
        const batchParts = [
          details.batchNo && `Batch ${details.batchNo}`,
          details.expiryDate && `Exp ${details.expiryDate}`,
          details.manufacturer,
        ].filter(Boolean)
        return {
          ...base,
          vaccineName: il.length === 1 ? il[0].name : `${il.length} vaccines`,
          vials: total || null,
          vialsDir: 'in',
          detail: batchParts.join(' · ') || null,
          inlineItems: il.length > 1 ? il : null,
          statusText,
        }
      }
      return { ...base, vaccineName: null, vials: null, vialsDir: null, detail: null, statusText }
    }

    case 'STOCK_REQUEST_APPROVE': {
      const statusText = details.status ? `Current status: ${details.status}` : null
      if (details.items?.length) {
        const il = details.items.map(item => ({
          name: rv(item) ?? '—',
          vials: item.fulfilledVials ?? item.requestedVials ?? 0,
        }))
        const total = il.reduce((s, i) => s + i.vials, 0)
        return {
          ...base,
          vaccineName: il.length === 1 ? il[0].name : `${il.length} vaccines`,
          vials: total || null,
          vialsDir: 'in',
          detail: details.note ?? null,
          inlineItems: il.length > 1 ? il : null,
          statusText,
        }
      }
      return { ...base, vaccineName: null, vials: null, vialsDir: null, detail: details.note ?? null, statusText }
    }

    case 'STOCK_REQUEST_CLOSE_SHORT':
    case 'STOCK_REQUEST_DECLINE': {
      if (details.items?.length) {
        const il = details.items.map(item => ({ name: rv(item) ?? '—', vials: item.requestedVials ?? item.sentVials ?? 0 }))
        const total = il.reduce((s, i) => s + i.vials, 0)
        return {
          ...base,
          vaccineName: il.length === 1 ? il[0].name : `${il.length} vaccines`,
          vials: total || null,
          vialsDir: 'in',
          detail: details.note ?? details.reason ?? null,
          inlineItems: il.length > 1 ? il : null,
        }
      }
      return { ...base, vaccineName: null, vials: details.itemCount ?? null, vialsDir: null, detail: details.note ?? details.reason ?? null }
    }

    case 'APPROVAL_REQUEST':
    case 'APPROVAL_APPROVE':
    case 'APPROVAL_REJECT':
    case 'APPROVAL_DECLINE':
    case 'APPROVAL_CANCEL': {
      const name = details.vaccineName ? displayVaccineName(details.vaccineName) : vn(details.vaccineId)
      const payloadVials = details.payload?.storeVials ?? null
      const parts = []
      if (details.type) parts.push(details.type.replace(/_/g, ' '))
      if (details.payload?.from != null && details.payload?.to != null) {
        parts.push(`store vials → ${details.payload.to}`)
      } else if (details.payload?.oldValue != null && details.payload?.newValue != null) {
        parts.push(`${details.payload.oldValue} → ${details.payload.newValue}`)
      }
      if (details.decisionReason) parts.push(`"${details.decisionReason}"`)
      const statusText = details.status ? `Status: ${details.status}` : null
      return {
        ...base,
        vaccineName: name,
        vials: payloadVials,
        vialsDir: payloadVials != null ? 'neutral' : null,
        detail: parts.join(' · ') || details.note || null,
        statusText,
      }
    }

    case 'STOCK_ASSIGN':
    case 'STOCK_RECEIVE': {
      const workerName = wn(details.workerId)
      if (details.items?.length) {
        const il = details.items.map(item => ({ name: rv(item) ?? '—', vials: item.vials ?? 0 }))
        const total = il.reduce((s, i) => s + i.vials, 0)
        const parts = []
        if (workerName) parts.push(`Assigned to ${workerName}`)
        if (action === 'STOCK_ASSIGN' && details.occurredOn) {
          const d = new Date(details.occurredOn + 'T00:00:00')
          parts.push(`on ${d.toLocaleString('en-US', { month: 'short', day: 'numeric' })}`)
        }
        return {
          ...base,
          vaccineName: il.length === 1 ? il[0].name : `${il.length} vaccines`,
          vials: total || null,
          vialsDir: 'in',
          detail: parts.join(' ') || null,
          inlineItems: il.length > 1 ? il : null,
        }
      }
      const singleName = details.vaccineName ? displayVaccineName(details.vaccineName) : vn(details.vaccineId)
      const parts = []
      if (workerName) parts.push(`Assigned to ${workerName}`)
      if (action === 'STOCK_ASSIGN' && details.occurredOn) {
        const d = new Date(details.occurredOn + 'T00:00:00')
        parts.push(`on ${d.toLocaleString('en-US', { month: 'short', day: 'numeric' })}`)
      }
      return { ...base, vaccineName: singleName, vials: details.vials ?? null, vialsDir: 'in', detail: parts.join(' ') || null }
    }

    case 'STOCK_DAY_END': {
      if (details.items?.length) {
        const workerName = wn(details.workerId)
        const il = details.items.map(item => ({ name: rv(item) ?? '—', vials: item.usedVials ?? 0 }))
        const used     = details.items.reduce((s, i) => s + (i.usedVials     ?? 0), 0)
        const wasted   = details.items.reduce((s, i) => s + (i.wastedVials   ?? 0), 0)
        const returned = details.items.reduce((s, i) => s + (i.returnedVials ?? 0), 0)
        const parts = [`Used ${used}, wasted ${wasted}, returned ${returned}`]
        if (workerName) parts.push(`(${workerName})`)
        return {
          ...base,
          vaccineName: il.length === 1 ? il[0].name : `${il.length} vaccines`,
          vials: used || null,
          vialsDir: 'out',
          detail: parts.join(' '),
          inlineItems: il.length > 1 ? il : null,
        }
      }
      return { ...base, vaccineName: null, vials: null, vialsDir: null, detail: null }
    }

    default:
      return { ...base, vaccineName: null, vials: null, vialsDir: null, detail: null }
  }
}

// ─── Grid (shared by header + rows) ──────────────────────────────────────────
// Cols: Time | Action | Category | Vaccine | Vials | Details
const GRID = 'grid-cols-[130px_200px_100px_1fr_60px_1fr]'

// ─── Column Headers ───────────────────────────────────────────────────────────
function ColumnHeaders() {
  return (
    <div className={`hidden sm:grid ${GRID} gap-3 px-5 py-3 bg-surface-alt border-b border-surface-border`}>
      <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Time</span>
      <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Action</span>
      <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Category</span>
      <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Vaccine</span>
      <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Vials</span>
      <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Details</span>
    </div>
  )
}

// ─── Entry Row ────────────────────────────────────────────────────────────────
function EntryRow({ entry, vaccineNameById, workerNameById, createByEntityId, onEntityFilter }) {
  const [expanded, setExpanded] = useState(false)

  const meta    = ACTION_META[entry.action] ?? { label: entry.action ?? '—', pill: 'bg-surface-alt text-text-muted border-surface-border', icon: ClipboardList }
  const IconCmp = meta.icon
  const parsed  = parseEntry(entry.action, entry.details, vaccineNameById, workerNameById, createByEntityId, entry.entityId)
  const { vaccineName, vials, vialsDir, detail, inlineItems, zeroVialsWarning, statusText } = parsed

  const vialsColor = vialsDir === 'in' ? 'text-success-dark' : vialsDir === 'out' ? 'text-warning-dark' : 'text-text-muted'
  const category   = getCategory(entry)
  const shortId    = entry.entityId ? entry.entityId.slice(0, 8) : null
  const showEntity = ENTITY_ACTIONS.has(entry.action) && !!shortId
  const canExpand  = !!(inlineItems?.length)

  return (
    <div>
      {/* Mobile card */}
      <div className="sm:hidden px-4 py-3 hover:bg-surface-alt/50 transition-colors">
        <div className="flex items-center gap-2 text-[10px] text-text-muted mb-1.5">
          <Clock size={10} className="flex-shrink-0" />
          <span>{formatDate(entry.createdAt)}</span>
        </div>
        <div className="flex items-start justify-between gap-2 mb-1">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border w-fit ${meta.pill}`}>
            <IconCmp size={12} strokeWidth={2.2} />
            {meta.label}
          </span>
          {vials != null && (
            <div className={`flex items-center gap-1 text-xs font-bold flex-shrink-0 ${vialsColor}`}>
              {vialsDir === 'in'  && <ArrowUp   size={12} strokeWidth={2.5} />}
              {vialsDir === 'out' && <ArrowDown  size={12} strokeWidth={2.5} />}
              {vials}
            </div>
          )}
        </div>
        {vaccineName && <p className="text-sm font-semibold text-text">{vaccineName}</p>}
        {inlineItems && (
          <p className="text-xs text-text-muted mt-0.5">
            {inlineItems.map((it, i) => `${i > 0 ? ', ' : ''}${abbr(it.name)} ${it.vials}`).join('')}
          </p>
        )}
        {detail && <p className="text-xs text-text-muted mt-0.5">{detail}</p>}
        {statusText && <p className="text-[10px] font-bold text-primary mt-0.5">{statusText}</p>}
        {zeroVialsWarning && (
          <p className="text-[10px] font-bold text-warning-dark flex items-center gap-1 mt-0.5">
            <AlertTriangle size={10} /> Dispatched with 0 vials
          </p>
        )}
      </div>

      {/* Desktop row */}
      <div className={`hidden sm:grid ${GRID} gap-3 items-start px-5 py-3 hover:bg-surface-alt/50 transition-colors`}>
        {/* Time */}
        <div className="flex items-center gap-1.5 text-xs text-text-muted font-medium pt-0.5">
          <Clock size={12} className="flex-shrink-0" />
          <span className="whitespace-nowrap">{formatDate(entry.createdAt)}</span>
        </div>

        {/* Action pill */}
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border w-fit max-w-full ${meta.pill}`}>
          <IconCmp size={12} strokeWidth={2.2} className="flex-shrink-0" />
          <span className="truncate">{meta.label}</span>
        </span>

        {/* Category */}
        <span className="text-xs text-text-muted pt-0.5">
          {category ?? <span className="opacity-40">—</span>}
        </span>

        {/* Vaccine + expand toggle */}
        <div className="flex items-center gap-1.5 min-w-0 pt-0.5">
          <p className="text-sm font-semibold text-text truncate" title={vaccineName ?? undefined}>
            {vaccineName ?? <span className="text-text-muted italic text-xs font-normal">—</span>}
          </p>
          {canExpand && (
            <button
              onClick={() => setExpanded(e => !e)}
              className="flex-shrink-0 text-text-muted hover:text-text transition-colors"
              title={expanded ? 'Collapse' : 'Show per-vaccine breakdown'}
            >
              {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
          )}
        </div>

        {/* Vials */}
        <div className={`flex items-center gap-1 text-xs font-bold pt-0.5 ${vialsColor}`}>
          {vialsDir === 'in'  && vials != null && <ArrowUp   size={12} strokeWidth={2.5} />}
          {vialsDir === 'out' && vials != null && <ArrowDown  size={12} strokeWidth={2.5} />}
          {vials != null ? vials : <span className="text-text-muted font-normal">—</span>}
        </div>

        {/* Details */}
        <div className="flex flex-col gap-0.5 min-w-0 pt-0.5">
          {/* Inline per-vaccine list (compact) */}
          {inlineItems && !expanded && (
            <p className="text-xs text-text break-words">
              {inlineItems.map((it, i) => (
                <span key={i}>
                  {i > 0 && <span className="text-text-muted">, </span>}
                  <span className="font-medium">{abbr(it.name)}</span>
                  {' '}
                  <span className={`font-bold tabular-nums ${vialsColor}`}>{it.vials}</span>
                </span>
              ))}
            </p>
          )}
          {detail && <p className="text-xs text-text-muted break-words">{detail}</p>}
          {statusText && <span className="text-[10px] font-semibold text-primary">{statusText}</span>}
          {zeroVialsWarning && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-warning-dark">
              <AlertTriangle size={10} /> Dispatched with 0 vials
            </span>
          )}
          {!inlineItems && !detail && !statusText && !zeroVialsWarning && !showEntity && (
            <span className="text-xs text-text-muted opacity-40">—</span>
          )}
          {showEntity && onEntityFilter && (
            <button
              onClick={() => onEntityFilter(entry.entityId)}
              className="text-[10px] font-mono text-text-muted/50 hover:text-primary transition-colors w-fit"
              title="Show all events for this request"
            >
              #{shortId}
            </button>
          )}
        </div>
      </div>

      {/* Expandable per-vaccine breakdown (desktop) */}
      {expanded && canExpand && (
        <div className="hidden sm:block bg-surface-chip/50 border-b border-surface-border px-5 pb-3 pt-0">
          <div className="ml-[444px] border border-surface-border rounded-xl overflow-hidden">
            {inlineItems.map((item, i) => (
              <div key={i} className={`flex justify-between items-center px-3 py-1.5 text-xs ${i > 0 ? 'border-t border-surface-border' : ''}`}>
                <span className="text-text font-medium">{item.name}</span>
                <span className={`font-bold tabular-nums ${vialsColor}`}>{item.vials} vials</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Pagination ────────────────────────────────────────────────────────────────
function Pagination({ currentPage, totalPages, onPageChange }) {
  if (totalPages <= 1) return null
  return (
    <div className="flex items-center justify-between border-t border-surface-border bg-surface px-5 py-4">
      <p className="text-xs text-text-muted font-semibold hidden sm:block">
        Page <span className="font-extrabold text-text">{currentPage}</span> of{' '}
        <span className="font-extrabold text-text">{totalPages}</span>
      </p>
      <nav className="isolate inline-flex -space-x-px rounded-xl shadow-sm border border-surface-border bg-surface-chip p-0.5 gap-1">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="relative inline-flex items-center rounded-lg p-1.5 text-text-muted hover:bg-surface disabled:opacity-40 transition-all cursor-pointer"
        >
          <ChevronLeft size={16} />
        </button>
        {Array.from({ length: totalPages }).map((_, i) => {
          const p = i + 1
          return (
            <button
              key={p}
              onClick={() => onPageChange(p)}
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
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="relative inline-flex items-center rounded-lg p-1.5 text-text-muted hover:bg-surface disabled:opacity-40 transition-all cursor-pointer"
        >
          <ChevronRight size={16} />
        </button>
      </nav>
    </div>
  )
}

// ─── Supervisor Tab ───────────────────────────────────────────────────────────
function SupervisorTab({ name, email, entries, vaccineNameById, workerNameById, createByEntityId, onEntityFilter, currentPage, setCurrentPage }) {
  const displayName = trimName(name ?? email)
  const itemsPerPage = 10
  const totalPages = Math.ceil(entries.length / itemsPerPage)
  const paginatedEntries = entries.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  return (
    <div className="bg-surface rounded-2xl border border-surface-border overflow-hidden shadow-sm">
      <div className="px-5 py-4 bg-surface-alt border-b border-surface-border flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-primary text-white flex items-center justify-center text-sm font-bold flex-shrink-0 shadow-sm border border-primary/20">
            {displayName ? displayName[0].toUpperCase() : 'S'}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-text truncate">{displayName ?? '—'}</p>
            <p className="text-[10px] text-primary uppercase tracking-widest font-bold mt-0.5">Facility Supervisor</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-[10px] font-bold text-text-muted bg-surface border border-surface-border px-2.5 py-1 rounded-lg">
            {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-lg bg-primary/5 text-primary border border-primary/10">
            <Shield size={10} strokeWidth={2.2} /> Supervisor
          </span>
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-5 py-12 text-text-muted text-center bg-surface">
          <ClipboardList size={32} className="opacity-20 flex-shrink-0" />
          <p className="text-sm font-bold text-text">No supervisor actions matched</p>
          <p className="text-xs">Try adjusting your filter criteria above.</p>
        </div>
      ) : (
        <>
          <ColumnHeaders />
          <div className="divide-y divide-surface-border">
            {paginatedEntries.map((entry, i) => (
              <EntryRow
                key={i}
                entry={entry}
                vaccineNameById={vaccineNameById}
                workerNameById={workerNameById}
                createByEntityId={createByEntityId}
                onEntityFilter={onEntityFilter}
              />
            ))}
          </div>
          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
        </>
      )}
    </div>
  )
}

// ─── Worker Card ──────────────────────────────────────────────────────────────
function WorkerCard({ worker, entries, vaccineNameById, workerNameById, createByEntityId, onEntityFilter }) {
  const [workerPage, setWorkerPage] = useState(1)
  const workerName = trimName(worker.name ?? worker.email)
  const itemsPerPage = 5
  const totalPages = Math.ceil(entries.length / itemsPerPage)
  const paginatedEntries = entries.slice((workerPage - 1) * itemsPerPage, workerPage * itemsPerPage)

  return (
    <div className="bg-surface rounded-2xl border border-surface-border overflow-hidden shadow-sm">
      <div className="px-5 py-4 bg-surface-alt border-b border-surface-border flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-9 h-9 rounded-xl ${avatarBg(workerName)} text-white flex items-center justify-center text-sm font-bold flex-shrink-0 shadow-sm`}>
            {workerName[0].toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-text truncate">{workerName}</p>
            <p className="text-[10px] text-text-muted uppercase tracking-widest font-bold mt-0.5">Facility Worker</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {entries.length > 0 && (
            <span className="text-[10px] font-bold text-text-muted bg-surface border border-surface-border px-2.5 py-1 rounded-lg">
              {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
            </span>
          )}
          <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-lg border ${
            worker.isActive
              ? 'bg-success-bg text-success-dark border-success/15'
              : 'bg-surface border-surface-border text-text-muted'
          }`}>
            {worker.isActive ? <UserCheck size={10} strokeWidth={2.2} /> : <UserX size={10} strokeWidth={2.2} />}
            {worker.isActive ? 'Active' : 'Inactive'}
          </span>
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="flex items-center gap-3 px-5 py-5 text-text-muted italic text-xs">
          <ClipboardList size={14} className="opacity-30 flex-shrink-0" />
          <span>No activity matched for this worker</span>
        </div>
      ) : (
        <>
          <ColumnHeaders />
          <div className="divide-y divide-surface-border">
            {paginatedEntries.map((entry, i) => (
              <EntryRow
                key={i}
                entry={entry}
                vaccineNameById={vaccineNameById}
                workerNameById={workerNameById}
                createByEntityId={createByEntityId}
                onEntityFilter={onEntityFilter}
              />
            ))}
          </div>
          <Pagination currentPage={workerPage} totalPages={totalPages} onPageChange={setWorkerPage} />
        </>
      )}
    </div>
  )
}

// ─── Workers Tab ──────────────────────────────────────────────────────────────
function WorkersTab({ workers, workerEntriesFn, search, setSearch, vaccineNameById, workerNameById, createByEntityId, onEntityFilter }) {
  const filteredWorkers = workers.filter(w =>
    !search || trimName(w.name ?? w.email ?? '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="flex flex-col gap-4">
      {workers.length > 0 && (
        <div className="relative w-full sm:w-80">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
          <input
            type="text"
            placeholder="Search worker by name..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-3.5 py-2.5 text-sm border border-surface-border rounded-xl bg-surface shadow-sm focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all placeholder:text-text-muted/60"
          />
        </div>
      )}

      {workers.length === 0 && (
        <div className="text-center py-14 border border-dashed border-surface-border bg-surface rounded-2xl text-text-muted shadow-sm">
          <Users size={36} className="mx-auto mb-3 opacity-20" />
          <p className="font-bold text-text">No workers registered</p>
          <p className="text-xs mt-1">Add workers in Worker Management to trace their logs.</p>
        </div>
      )}

      {workers.length > 0 && filteredWorkers.length === 0 && (
        <div className="text-center py-10 border border-dashed border-surface-border bg-surface rounded-2xl text-text-muted shadow-sm">
          <p className="text-sm font-semibold">No workers match &quot;{search}&quot;</p>
          <button onClick={() => setSearch('')} className="text-xs text-primary font-bold hover:underline mt-1.5">
            Clear search
          </button>
        </div>
      )}

      {filteredWorkers.map(worker => (
        <WorkerCard
          key={worker.id}
          worker={worker}
          entries={workerEntriesFn(worker)}
          vaccineNameById={vaccineNameById}
          workerNameById={workerNameById}
          createByEntityId={createByEntityId}
          onEntityFilter={onEntityFilter}
        />
      ))}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function FacilitySupervisorAuditLog() {
  const { user } = useAuth()
  const [tab,             setTab]             = useState('supervisor')
  const [search,          setSearch]          = useState('')
  const [actionFilter,    setActionFilter]    = useState('')
  const [startDateFilter, setStartDateFilter] = useState('')
  const [endDateFilter,   setEndDateFilter]   = useState('')
  const [entityIdFilter,  setEntityIdFilter]  = useState('')
  const [currentPage,     setCurrentPage]     = useState(1)

  const { data: userData,   isLoading: loadingUsers } = useQuery({ queryKey: ['users'],     queryFn: getUsers    })
  const { data: logData,    isLoading: loadingLog, isError } = useQuery({ queryKey: ['audit-log'], queryFn: getAuditLog })
  const { data: vaccineData }                         = useQuery({ queryKey: ['vaccines'], queryFn: getVaccines })

  const workers = (userData?.users ?? []).filter(u => u.role === 'facility_worker')
  const logs    = logData?.auditLog ?? []

  // Build vaccineNameById from both the vaccines list and any vaccineName fields in log items
  const vaccineNameById = useMemo(() => {
    const map = Object.fromEntries((vaccineData?.vaccines ?? []).map(v => [v.id, displayVaccineName(v.name)]))
    for (const log of logs) {
      for (const item of log.details?.items ?? []) {
        if (item.vaccineId && item.vaccineName && !map[item.vaccineId]) {
          map[item.vaccineId] = displayVaccineName(item.vaccineName)
        }
      }
      if (log.details?.vaccineId && log.details?.vaccineName && !map[log.details.vaccineId]) {
        map[log.details.vaccineId] = displayVaccineName(log.details.vaccineName)
      }
    }
    return map
  }, [vaccineData, logs])

  const workerNameById = useMemo(() =>
    Object.fromEntries((userData?.users ?? []).map(u => [u.id, trimName(u.name ?? u.email) ?? ''])),
    [userData]
  )

  // STOCK_REQUEST_CREATE entries keyed by entityId — used to fill CANCEL details
  const createByEntityId = useMemo(() => {
    const map = {}
    for (const log of logs) {
      if (log.action === 'STOCK_REQUEST_CREATE' && log.entityId) {
        map[log.entityId] = log.details
      }
    }
    return map
  }, [logs])

  const logsByActorId = useMemo(() => {
    const map = {}
    for (const log of logs) {
      if (!map[log.actorId]) map[log.actorId] = []
      map[log.actorId].push(log)
    }
    return map
  }, [logs])

  function filterEntries(entriesList) {
    return entriesList.filter(entry => {
      if (entityIdFilter && entry.entityId !== entityIdFilter)                           return false
      if (actionFilter   && entry.action   !== actionFilter)                             return false
      if (startDateFilter) {
        if (new Date(entry.createdAt).setHours(0,0,0,0) < new Date(startDateFilter).setHours(0,0,0,0)) return false
      }
      if (endDateFilter) {
        if (new Date(entry.createdAt).setHours(23,59,59,999) > new Date(endDateFilter).setHours(23,59,59,999)) return false
      }
      return true
    })
  }

  const filteredSupervisorEntries = filterEntries(logsByActorId[user?.id] ?? [])
  const getFilteredWorkerEntries  = (worker) => filterEntries(logsByActorId[worker.id] ?? [])
  const workerTotal = workers.reduce((s, w) => s + getFilteredWorkerEntries(w).length, 0)
  const isLoading   = loadingUsers || loadingLog

  // Dynamic action options — only actions present in the current tab's raw (unfiltered) data
  const availableActions = useMemo(() => {
    const src = tab === 'supervisor'
      ? (logsByActorId[user?.id] ?? [])
      : workers.flatMap(w => logsByActorId[w.id] ?? [])
    return [...new Set(src.map(e => e.action))].filter(Boolean)
      .sort((a, b) => (ACTION_META[a]?.label ?? a).localeCompare(ACTION_META[b]?.label ?? b))
  }, [tab, logsByActorId, user?.id, workers])

  const hasFilters = !!(actionFilter || startDateFilter || endDateFilter || entityIdFilter)

  function resetFilters() {
    setActionFilter(''); setStartDateFilter(''); setEndDateFilter('')
    setEntityIdFilter(''); setCurrentPage(1)
  }

  function handleEntityFilter(id) {
    setEntityIdFilter(id)
    setCurrentPage(1)
  }

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto">
      <PageHeader
        breadcrumb="Facility Supervisor"
        title="Audit Log"
        subtitle="Actions logged by you and stock entries recorded by your workers"
      />

      {/* Tab bar */}
      <div className="flex gap-1 p-1 bg-surface-chip border border-surface-border rounded-xl w-fit">
        <button
          onClick={() => { setTab('supervisor'); setCurrentPage(1) }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
            tab === 'supervisor'
              ? 'bg-surface text-primary shadow-sm border border-surface-border'
              : 'text-text-muted hover:text-text'
          }`}
        >
          <Shield size={13} strokeWidth={2.2} />
          Supervisor Actions
          {!isLoading && (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
              tab === 'supervisor' ? 'bg-primary/10 text-primary' : 'bg-surface-chip text-text-muted border border-surface-border'
            }`}>
              {filteredSupervisorEntries.length}
            </span>
          )}
        </button>
        <button
          onClick={() => { setTab('workers'); setSearch('') }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
            tab === 'workers'
              ? 'bg-surface text-primary shadow-sm border border-surface-border'
              : 'text-text-muted hover:text-text'
          }`}
        >
          <Users size={13} strokeWidth={2.2} />
          Worker Entries
          {!isLoading && (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
              tab === 'workers' ? 'bg-primary/10 text-primary' : 'bg-surface-chip text-text-muted border border-surface-border'
            }`}>
              {workerTotal}
            </span>
          )}
        </button>
      </div>

      {/* Filter bar */}
      <div className="bg-surface rounded-2xl border border-surface-border px-4 py-3 shadow-sm flex flex-wrap items-center gap-3">
        <select
          value={actionFilter}
          onChange={e => { setActionFilter(e.target.value); setCurrentPage(1) }}
          className="bg-surface border border-surface-border rounded-xl px-3 py-2 text-sm text-text font-medium focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer"
        >
          <option value="">All action types</option>
          {availableActions.map(action => (
            <option key={action} value={action}>{ACTION_META[action]?.label ?? action}</option>
          ))}
        </select>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-text-muted">From</span>
          <DatePicker id="start-date" value={startDateFilter} max={endDateFilter || undefined} onChange={e => { setStartDateFilter(e.target.value); setCurrentPage(1) }} />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-text-muted">To</span>
          <DatePicker id="end-date" value={endDateFilter} min={startDateFilter || undefined} onChange={e => { setEndDateFilter(e.target.value); setCurrentPage(1) }} />
        </div>

        {entityIdFilter && (
          <div className="flex items-center gap-1.5 bg-primary/5 border border-primary/10 text-primary text-[11px] font-bold px-2.5 py-1.5 rounded-xl">
            <span>Request #{entityIdFilter.slice(0, 8)}</span>
            <button onClick={() => setEntityIdFilter('')} className="hover:text-danger transition-colors ml-0.5">
              <XCircle size={12} />
            </button>
          </div>
        )}

        {hasFilters && (
          <Button variant="secondary" size="sm" onClick={resetFilters}>Clear</Button>
        )}

        <span className="ml-auto text-xs font-bold text-text-muted tabular-nums">
          {workerTotal + filteredSupervisorEntries.length} {workerTotal + filteredSupervisorEntries.length === 1 ? 'entry' : 'entries'}
        </span>
      </div>

      {/* Skeleton */}
      {isLoading && (
        <div className="flex flex-col gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-surface rounded-2xl border border-surface-border p-5 animate-pulse shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-xl bg-surface-chip" />
                <div className="h-4 bg-surface-chip rounded w-48" />
              </div>
              <div className="h-3 bg-surface-chip rounded w-full mt-2" />
              <div className="h-3 bg-surface-chip rounded w-3/4 mt-2" />
            </div>
          ))}
        </div>
      )}

      {isError && (
        <div className="bg-danger-bg border border-danger/10 text-xs font-semibold text-danger rounded-xl px-4 py-3">
          Failed to load audit logs. Please try refreshing.
        </div>
      )}

      {/* Tab content */}
      {!isLoading && !isError && (
        <div className="animate-in fade-in duration-200">
          {tab === 'supervisor' && (
            <SupervisorTab
              name={user?.name}
              email={user?.email}
              entries={filteredSupervisorEntries}
              vaccineNameById={vaccineNameById}
              workerNameById={workerNameById}
              createByEntityId={createByEntityId}
              onEntityFilter={handleEntityFilter}
              currentPage={currentPage}
              setCurrentPage={setCurrentPage}
            />
          )}
          {tab === 'workers' && (
            <WorkersTab
              workers={workers}
              workerEntriesFn={getFilteredWorkerEntries}
              search={search}
              setSearch={setSearch}
              vaccineNameById={vaccineNameById}
              workerNameById={workerNameById}
              createByEntityId={createByEntityId}
              onEntityFilter={handleEntityFilter}
            />
          )}
        </div>
      )}
    </div>
  )
}
