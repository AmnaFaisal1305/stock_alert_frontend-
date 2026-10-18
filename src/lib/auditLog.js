// Audit-log vocabulary and parsing shared by every role's Audit Log (components/audit/AuditLogView).
import { ROLE_LABELS } from './navigation'
import { approvalTypeLabel } from './status'
import { toLocalDateStr } from './format'

export const ACTION_LABELS = {
  LOGOUT:                    'Logged out',
  SHEET_SAVED:               'Form B saved',
  STOCK_ENTRY:               'Stock entry',
  ADJUST_STOCK:              'Stock corrected',
  STOCK_ASSIGN:              'Vials assigned',
  STOCK_RECEIVE:             'Stock received',
  STOCK_DAY_END:             'Day end closed',
  SET_THRESHOLD:             'Threshold updated',
  CREATE_VACCINE:            'Vaccine added',
  EDIT_VACCINE:              'Vaccine edited',
  DELETE_VACCINE:            'Vaccine deleted',
  CREATE_USER:               'User created',
  ACTIVATE_USER:             'User activated',
  DEACTIVATE_USER:           'User deactivated',
  RESET_PASSWORD:            'Password reset',
  ASSIGN_UC_SUPERVISOR:      'UCs assigned',
  CREATE_DISTRICT:           'District created',
  EDIT_DISTRICT:             'District renamed',
  DEACTIVATE_DISTRICT:       'District deactivated',
  ACTIVATE_DISTRICT:         'District activated',
  CREATE_FACILITY:           'Facility created',
  EDIT_FACILITY:             'Facility renamed',
  DEACTIVATE_FACILITY:       'Facility deactivated',
  ACTIVATE_FACILITY:         'Facility activated',
  CREATE_TOWN:               'Town created',
  EDIT_TOWN:                 'Town renamed',
  DEACTIVATE_TOWN:           'Town deactivated',
  ACTIVATE_TOWN:             'Town activated',
  CREATE_UC:                 'UC created',
  EDIT_UC:                   'UC renamed',
  DEACTIVATE_UC:             'UC deactivated',
  ACTIVATE_UC:               'UC activated',
  APPROVAL_REQUEST:          'Approval requested',
  APPROVAL_APPROVE:          'Change approved',
  APPROVAL_REJECT:           'Change rejected',
  APPROVAL_DECLINE:          'Change rejected',
  APPROVAL_CANCEL:           'Change withdrawn',
  EDIT_FACILITY_VACCINE:     'Facility thresholds changed',
  STOCK_REQUEST_CREATE:      'Stock request raised',
  STOCK_REQUEST_SENT:        'Stock sent',
  STOCK_REQUEST_RECEIVED:    'Stock received',
  STOCK_REQUEST_APPROVE:     'Stock request approved',
  STOCK_REQUEST_CANCEL:      'Stock request cancelled',
  STOCK_REQUEST_CLOSE_SHORT: 'Request closed as partially fulfilled',
  STOCK_REQUEST_DECLINE:     'Stock request declined',
}

export const actionLabel = (action) => ACTION_LABELS[action] ?? String(action ?? '—').replace(/_/g, ' ').toLowerCase()

// Lookups the parser needs: vaccine names (from the list plus names embedded in log items),
// user names, and each stock request's create entry (cancel, decline and close-short rows written
// before Round 40 don't repeat the items).
export function buildContext(logs, vaccines = [], users = []) {
  const vaccineNameById = Object.fromEntries(vaccines.map((v) => [v.id, v.name]))
  const createByEntityId = {}
  for (const log of logs) {
    const d = log.details
    for (const it of d?.items ?? []) {
      if (it.vaccineId && it.vaccineName && !vaccineNameById[it.vaccineId]) vaccineNameById[it.vaccineId] = it.vaccineName
    }
    if (d?.vaccineId && d?.vaccineName && !vaccineNameById[d.vaccineId]) vaccineNameById[d.vaccineId] = d.vaccineName
    if (log.action === 'STOCK_REQUEST_CREATE' && log.entityId) createByEntityId[log.entityId] = d
  }
  const userNameById = Object.fromEntries(users.map((u) => [u.id, (u.name ?? u.email ?? '').trim().replace(/\s+/g, ' ')]))
  // Used by computeFlags: entityId → all entries for that request (awaiting_received flag);
  // workerId:date → true for every STOCK_DAY_END (post_dayend_assign flag).
  const entriesByEntityId = {}
  const dayEndsByWorkerDate = new Set()
  for (const log of logs) {
    if (log.entityId) (entriesByEntityId[log.entityId] ??= []).push(log)
    if (log.action === 'STOCK_DAY_END' && log.details?.workerId && log.details?.occurredOn)
      dayEndsByWorkerDate.add(`${log.details.workerId}:${log.details.occurredOn}`)
  }
  return { vaccineNameById, userNameById, createByEntityId, entriesByEntityId, dayEndsByWorkerDate }
}

const STOCK_REQUEST_ACTIONS = new Set([
  'STOCK_REQUEST_CREATE', 'STOCK_REQUEST_SENT', 'STOCK_REQUEST_RECEIVED', 'STOCK_REQUEST_APPROVE',
  'STOCK_REQUEST_CANCEL', 'STOCK_REQUEST_CLOSE_SHORT', 'STOCK_REQUEST_DECLINE',
])
export const isRequestEvent = (entry) => STOCK_REQUEST_ACTIONS.has(entry.action) && !!entry.entityId

const shortDate = (iso) => new Date(iso + 'T00:00:00').toLocaleString('en-GB', { day: 'numeric', month: 'short' })

// → { vaccine, vials, dir: 'in'|'out'|null, detail, items: [{name, vials}]|null, warning }
export function parseEntry(entry, ctx) {
  const d = entry.details
  const out = { vaccine: null, vials: null, dir: null, detail: null, items: null, warning: null }
  if (!d) return out

  const vn = (id) => (id ? ctx.vaccineNameById[id] ?? null : null)
  const one = (src) => src.vaccineName || vn(src.vaccineId)
  const who = (id) => (id ? ctx.userNameById[id] ?? null : null)
  const fromItems = (items, key, dir) => {
    const list = items.map((it) => ({ name: one(it) ?? '—', vials: typeof key === 'function' ? key(it) : it[key] ?? 0 }))
    const total = list.reduce((s, i) => s + i.vials, 0)
    return { vaccine: list.length === 1 ? list[0].name : `${list.length} vaccines`, vials: total || null, dir, items: list.length > 1 ? list : null }
  }
  const quote = (s) => (s ? `“${s}”` : null)

  switch (entry.action) {
    case 'SHEET_SAVED':
      return { ...out, detail: d.month && d.year ? `For ${new Date(d.year, d.month - 1).toLocaleString('en-GB', { month: 'short' })} ${d.year}` : null }

    case 'STOCK_ENTRY':
      return { ...out, vaccine: one(d), vials: d.vials ?? d.quantity ?? null, dir: d.entryType === 'used' || d.entryType === 'wasted' ? 'out' : 'in', detail: d.entryType ?? null }

    case 'ADJUST_STOCK':
      return {
        ...out, vaccine: one(d),
        vials: d.delta != null ? `${d.delta > 0 ? '+' : ''}${d.delta}` : null,
        dir: d.delta > 0 ? 'in' : d.delta < 0 ? 'out' : null,
        detail: [d.previousBalance != null && d.newBalance != null ? `${d.previousBalance} → ${d.newBalance}` : null, d.reason].filter(Boolean).join(' · ') || null,
      }

    case 'SET_THRESHOLD':
      return { ...out, vaccine: one(d), vials: d.minQuantity ?? null, detail: 'Minimum threshold' }

    case 'CREATE_VACCINE':
    case 'DELETE_VACCINE':
      return { ...out, vaccine: d.name ? d.name : vn(d.vaccineId), detail: d.dosesPerVial ? `${d.dosesPerVial} doses per vial` : null }

    case 'EDIT_VACCINE': {
      const next = d.newName ?? d.name
      return { ...out, vaccine: next ? next : vn(d.vaccineId), detail: d.oldName ? `Was ${d.oldName}` : null }
    }

    case 'CREATE_USER':
      return { ...out, detail: [ROLE_LABELS[d.role] ?? d.role?.replace(/_/g, ' '), d.email].filter(Boolean).join(' · ') || null }
    case 'ACTIVATE_USER':
    case 'DEACTIVATE_USER':
    case 'RESET_PASSWORD':
      return { ...out, detail: d.email ?? d.name ?? null }
    case 'ASSIGN_UC_SUPERVISOR':
      return { ...out, detail: `${(d.ucNames ?? d.ucIds ?? []).length} UC(s) to ${d.email ?? who(d.userId) ?? 'supervisor'}` }

    case 'STOCK_REQUEST_CREATE':
      return d.items?.length ? { ...out, ...fromItems(d.items, 'requestedVials', null), detail: quote(d.note) } : { ...out, detail: quote(d.note) }
    case 'STOCK_REQUEST_SENT': {
      if (!d.items?.length) return out
      const r = fromItems(d.items, 'sentVials', null)
      return { ...out, ...r, detail: quote(d.note), warning: d.items.every((it) => !it.sentVials) ? 'Sent with 0 vials' : null }
    }
    case 'STOCK_REQUEST_RECEIVED': {
      const batch = [d.batchNo && `Batch ${d.batchNo}`, d.expiryDate && `exp ${d.expiryDate}`, d.manufacturer].filter(Boolean).join(' · ') || null
      return d.items?.length ? { ...out, ...fromItems(d.items, 'receivedVials', 'in'), detail: batch } : { ...out, detail: batch }
    }
    case 'STOCK_REQUEST_APPROVE':
      return d.items?.length
        ? { ...out, ...fromItems(d.items, (it) => it.fulfilledVials ?? it.requestedVials ?? 0, null), detail: quote(d.note) }
        : { ...out, detail: quote(d.note) }
    case 'STOCK_REQUEST_CANCEL':
    case 'STOCK_REQUEST_CLOSE_SHORT':
    case 'STOCK_REQUEST_DECLINE': {
      // New rows carry their items; older ones fall back to the create row if it is on this page.
      const items = d.items?.length ? d.items : ctx.createByEntityId[entry.entityId]?.items
      const detail = d.note ?? d.reason ?? (entry.action === 'STOCK_REQUEST_CANCEL' ? 'No reason given' : null)
      return items?.length
        ? { ...out, ...fromItems(items, (it) => it.requestedVials ?? it.sentVials ?? 0, null), detail }
        : { ...out, vials: d.itemCount ?? null, detail }
    }

    case 'APPROVAL_REQUEST':
    case 'APPROVAL_APPROVE':
    case 'APPROVAL_REJECT':
    case 'APPROVAL_DECLINE':
    case 'APPROVAL_CANCEL': {
      const parts = [d.type ? approvalTypeLabel(d.type) : null]
      if (d.payload?.storeVials != null) parts.push(`store → ${d.payload.storeVials} vials`)
      else if (d.payload?.oldValue != null && d.payload?.newValue != null) parts.push(`${d.payload.oldValue} → ${d.payload.newValue}`)
      if (d.decisionReason) parts.push(quote(d.decisionReason))
      return { ...out, vaccine: one(d), detail: parts.filter(Boolean).join(' · ') || d.note || null }
    }

    case 'STOCK_ASSIGN':
    case 'STOCK_RECEIVE': {
      const parts = [who(d.workerId) ? `To ${who(d.workerId)}` : d.workerEmail ? `To ${d.workerEmail}` : null]
      if (entry.action === 'STOCK_ASSIGN' && d.occurredOn) parts.push(`on ${shortDate(d.occurredOn)}`)
      const detail = parts.filter(Boolean).join(' ') || null
      return d.items?.length
        ? { ...out, ...fromItems(d.items, 'vials', null), detail }
        : { ...out, vaccine: one(d), vials: d.vials ?? null, detail }
    }

    case 'STOCK_DAY_END': {
      if (!d.items?.length) return out
      const sum = (k) => d.items.reduce((s, it) => s + (it[k] ?? 0), 0)
      const r = fromItems(d.items, 'usedVials', 'out')
      const worker = who(d.workerId) ?? d.workerEmail
      return { ...out, ...r, detail: `Used ${sum('usedVials')}, wasted ${sum('wastedVials')}, returned ${sum('returnedVials')}${worker ? ` · ${worker}` : ''}` }
    }

    case 'LOGOUT':
      return out

    default: {
      // Admin entity actions (districts, towns, UCs, facilities) carry just a name.
      if (d.name) return { ...out, detail: `“${d.name}”` }
      return { ...out, detail: Object.entries(d).map(([k, v]) => `${k}: ${v && typeof v === 'object' ? JSON.stringify(v) : v}`).join(', ') || null }
    }
  }
}

// Actions offered in the Action filter. The list is static because the log is paged on the
// server; legacy aliases nothing writes any more are left out.
const FACILITY_ACTIONS = Object.keys(ACTION_LABELS).filter((a) => /^(STOCK_|APPROVAL_|ADJUST_STOCK|SHEET_SAVED|LOGOUT)/.test(a))
// The API hides these from district and UC supervisors.
const ADMIN_ONLY = new Set(['CREATE_VACCINE', 'EDIT_VACCINE', 'DELETE_VACCINE', 'CREATE_USER', 'ACTIVATE_USER', 'DEACTIVATE_USER', 'RESET_PASSWORD'])
const LEGACY = new Set(['APPROVAL_DECLINE', 'SET_THRESHOLD', 'STOCK_RECEIVE'])

export function actionOptionsFor(role) {
  let actions = Object.keys(ACTION_LABELS)
  if (['facility_supervisor', 'facility_head', 'facility_worker'].includes(role)) actions = FACILITY_ACTIONS
  else if (role === 'district_supervisor' || role === 'uc_supervisor') actions = actions.filter((a) => !ADMIN_ONLY.has(a))
  return actions.filter((a) => !LEGACY.has(a)).map((a) => ({ value: a, label: actionLabel(a) })).sort((a, b) => a.label.localeCompare(b.label))
}

// ─── Rich formatting for facility supervisor audit entries ────────────────────

export function getCategory(action) {
  if (action === 'LOGOUT') return 'Session'
  if (action === 'SHEET_SAVED') return 'Forms'
  if (action === 'STOCK_DAY_END') return 'Day end'
  if (action === 'STOCK_REQUEST_RECEIVED' || action === 'STOCK_ASSIGN' || action === 'STOCK_RECEIVE') return 'Stock movement'
  if (action?.startsWith('STOCK_REQUEST')) return 'Request'
  if (action?.startsWith('APPROVAL')) return 'Approval'
  return null
}

// Natural statuses: the expected entity status immediately after an action.
// "Now: X" is only shown when the current status differs from these.
const NATURAL_STATUS = {
  STOCK_REQUEST_CREATE:   ['awaiting_both', 'awaiting_sent', 'awaiting_received'],
  STOCK_REQUEST_CANCEL:   ['cancelled'],
  STOCK_REQUEST_DECLINE:  ['declined'],
  STOCK_REQUEST_APPROVE:  ['completed', 'partially_fulfilled'],
  STOCK_REQUEST_RECEIVED: ['ready_for_approval', 'figures_differ', 'completed', 'partially_fulfilled'],
  STOCK_REQUEST_CLOSE_SHORT: ['partially_fulfilled'],
  APPROVAL_REQUEST:  ['pending'],
  APPROVAL_APPROVE:  ['approved'],
  APPROVAL_REJECT:   ['rejected'],
  APPROVAL_DECLINE:  ['rejected'],
  APPROVAL_CANCEL:   ['cancelled'],
}

// Event label and tone derived from the action, not the current entity status.
const EVENT_STATUS_LABEL = {
  STOCK_REQUEST_CREATE:      { label: 'Raised',       tone: 'neutral' },
  STOCK_REQUEST_SENT:        { label: 'Sent',         tone: 'neutral' },
  STOCK_REQUEST_RECEIVED:    { label: 'Received',     tone: 'success' },
  STOCK_REQUEST_CANCEL:      { label: 'Cancelled',    tone: 'danger'  },
  STOCK_REQUEST_DECLINE:     { label: 'Declined',     tone: 'danger'  },
  STOCK_REQUEST_APPROVE:     { label: 'Approved',     tone: 'success' },
  STOCK_REQUEST_CLOSE_SHORT: { label: 'Partially fulfilled', tone: 'warning' },
  APPROVAL_APPROVE:          { label: 'Approved',     tone: 'success' },
  APPROVAL_REJECT:           { label: 'Rejected',     tone: 'danger'  },
  APPROVAL_DECLINE:          { label: 'Rejected',     tone: 'danger'  },
  APPROVAL_CANCEL:           { label: 'Withdrawn',    tone: 'neutral' },
}

function buildSummary(entry, ctx) {
  const d = entry.details
  if (!d) return null
  const vn = (id) => (id ? ctx.vaccineNameById?.[id] ?? null : null)
  const wn = (id) => (id ? ctx.userNameById?.[id] ?? 'Unknown vaccinator' : null)
  const vaccineName = (it) => it.vaccineName || (vn(it.vaccineId) ?? 'Unknown vaccine')
  const ds = (iso) => new Date(iso + 'T00:00:00').toLocaleString('en-GB', { day: 'numeric', month: 'short' })
  // Closing rows written from Round 40 carry their items; older ones use the create row if loaded.
  const requestItems = () => (d.items?.length ? d.items : ctx.createByEntityId?.[entry.entityId]?.items)

  switch (entry.action) {
    case 'STOCK_ASSIGN': {
      const total = d.items?.reduce((s, it) => s + (it.vials ?? 0), 0) ?? d.vials ?? 0
      const vacStr = d.items?.length === 1
        ? ` of ${vaccineName(d.items[0])}`
        : d.items?.length > 1 ? ` (${d.items.map((it) => `${vaccineName(it)} ${it.vials ?? 0}`).join(', ')})` : ''
      const worker = wn(d.workerId) ?? (d.workerEmail ? d.workerEmail.split('@')[0] : null)
      const workerStr = worker ? ` to ${worker}` : ''
      const dateStr = d.occurredOn ? ` for ${ds(d.occurredOn)}` : ''
      return `Assigned ${total} vials${vacStr}${workerStr}${dateStr}`
    }
    case 'STOCK_REQUEST_CREATE': {
      if (!d.items?.length) return d.note ? `Requested stock — "${d.note}"` : 'Requested stock'
      const total = d.items.reduce((s, it) => s + (it.requestedVials ?? 0), 0)
      if (d.items.length === 1) return `Requested ${total} vials of ${vaccineName(d.items[0])}`
      const bd = d.items.map((it) => `${vaccineName(it)} ${it.requestedVials ?? 0}`).join(', ')
      return `Requested ${total} vials (${bd})`
    }
    case 'STOCK_REQUEST_RECEIVED': {
      const received = d.items?.reduce((s, it) => s + (it.receivedVials ?? 0), 0) ?? 0
      const create = ctx.createByEntityId?.[entry.entityId]
      if (create?.items?.length && d.items?.length) {
        const requested = create.items.reduce((s, it) => s + (it.requestedVials ?? 0), 0)
        const shorts = []
        for (const cit of create.items) {
          const rit = d.items.find((i) => i.vaccineId === cit.vaccineId)
          const diff = (cit.requestedVials ?? 0) - (rit?.receivedVials ?? 0)
          if (diff > 0) {
            const nm = cit.vaccineName || (vn(cit.vaccineId) ?? 'vaccine')
            shorts.push(`${nm} short by ${diff}`)
          }
        }
        const base = `Received ${received} of ${requested} vials`
        return shorts.length ? `${base} · ${shorts.join(', ')}` : base
      }
      return `Received ${received} vials`
    }
    case 'STOCK_REQUEST_CANCEL': {
      const items = requestItems()
      if (items?.length) {
        const total = items.reduce((s, it) => s + (it.requestedVials ?? 0), 0)
        if (items.length === 1) return `Cancelled request for ${total} vials of ${vaccineName(items[0])}`
        return `Cancelled request for ${total} vials`
      }
      return 'Cancelled stock request'
    }
    case 'STOCK_REQUEST_DECLINE': {
      const total = requestItems()?.reduce((s, it) => s + (it.requestedVials ?? 0), 0)
      return total != null ? `Request for ${total} vials declined` : 'Request declined'
    }
    case 'STOCK_REQUEST_APPROVE': {
      const total = d.items?.reduce((s, it) => s + (it.fulfilledVials ?? it.requestedVials ?? 0), 0)
      return total != null ? `Request approved — ${total} vials` : 'Request approved'
    }
    case 'STOCK_REQUEST_SENT': {
      const total = d.items?.reduce((s, it) => s + (it.sentVials ?? 0), 0) ?? 0
      return `Stock sent — ${total} vials`
    }
    case 'STOCK_REQUEST_CLOSE_SHORT': {
      const requested = requestItems()?.reduce((s, it) => s + (it.requestedVials ?? 0), 0)
      const sent = d.items?.reduce((s, it) => s + (it.receivedVials ?? it.sentVials ?? 0), 0)
      if (requested != null && sent != null) return `Closed as partially fulfilled — received ${sent} of ${requested} vials`
      return 'Request closed as partially fulfilled'
    }
    case 'APPROVAL_REQUEST': {
      const vaccine = d.vaccineName || (vn(d.vaccineId) ?? 'vaccine')
      if (d.type === 'threshold_change') {
        const t = d.payload?.thresholds ?? {}
        const parts = []
        if (t.lowDoses != null || t.lowVials != null) parts.push(`Low ${t.lowDoses ?? '?'} doses / ${t.lowVials ?? '?'} vials`)
        if (t.criticalDoses != null || t.criticalVials != null) parts.push(`Critical ${t.criticalDoses ?? '?'} doses / ${t.criticalVials ?? '?'} vials`)
        return `Asked to change ${vaccine} thresholds${parts.length ? `: ${parts.join(', ')}` : ''}`
      }
      if (d.type === 'stock_correction') {
        const sv = d.payload?.storeVials
        const reason = d.note ? ` · Reason: "${d.note}"` : ''
        return sv != null ? `Asked to correct ${vaccine} store to ${sv} vials${reason}` : `Asked to correct ${vaccine} store${reason}`
      }
      return `Requested approval for ${vaccine}`
    }
    case 'APPROVAL_APPROVE': {
      const vaccine = d.vaccineName || vn(d.vaccineId)
      const typeStr = d.type ? approvalTypeLabel(d.type).toLowerCase() : 'request'
      return vaccine ? `Approved ${typeStr} for ${vaccine}` : `Approved ${typeStr}`
    }
    case 'APPROVAL_REJECT':
    case 'APPROVAL_DECLINE': {
      const vaccine = d.vaccineName || vn(d.vaccineId)
      const typeStr = d.type ? approvalTypeLabel(d.type).toLowerCase() : 'request'
      return vaccine ? `Rejected ${typeStr} for ${vaccine}` : `Rejected ${typeStr}`
    }
    case 'APPROVAL_CANCEL': {
      const vaccine = d.vaccineName || vn(d.vaccineId)
      const typeStr = d.type ? approvalTypeLabel(d.type).toLowerCase() : 'approval request'
      return vaccine ? `Withdrew ${typeStr} for ${vaccine}` : 'Withdrew approval request'
    }
    case 'STOCK_DAY_END': {
      if (!d.items?.length) return 'Day end closed'
      const sum = (k) => d.items.reduce((s, it) => s + (it[k] ?? 0), 0)
      const worker = wn(d.workerId) ?? (d.workerEmail ? d.workerEmail.split('@')[0] : null)
      const workerStr = worker ? ` for ${worker}` : ''
      return `Day end${workerStr}: ${sum('assignedVials')} assigned = ${sum('usedVials')} used + ${sum('wastedVials')} wasted + ${sum('returnedVials')} returned`
    }
    case 'SHEET_SAVED': {
      if (d.month && d.year) {
        const month = new Date(d.year, d.month - 1).toLocaleString('en-GB', { month: 'short', year: 'numeric' })
        return `Form B saved · ${month}`
      }
      return 'Form B saved'
    }
    default:
      return null
  }
}

export function computeFlags(entry, ctx) {
  const d = entry.details
  if (!d) return []
  const flags = []
  const ageMs = Date.now() - new Date(entry.createdAt).getTime()
  const H24 = 86_400_000
  const H72 = 3 * H24

  if (entry.action === 'STOCK_REQUEST_RECEIVED') {
    // Short delivery: per-vaccine comparison against CREATE entry
    const create = ctx.createByEntityId?.[entry.entityId]
    if (create?.items?.length && d.items?.length) {
      for (const cit of create.items) {
        const rit = d.items.find((i) => i.vaccineId === cit.vaccineId)
        const diff = (cit.requestedVials ?? 0) - (rit?.receivedVials ?? 0)
        if (diff > 0) {
          const nm = cit.vaccineName || (ctx.vaccineNameById?.[cit.vaccineId] ?? 'vaccine')
          flags.push({ type: 'short_delivery', label: `${nm} short by ${diff}`, tone: 'warning' })
        }
      }
    }
    // Expiry on or before the received date
    if (d.expiryDate && d.expiryDate <= entry.createdAt.split('T')[0]) {
      flags.push({ type: 'expiry_soon', label: `Expires ${d.expiryDate}`, tone: 'danger' })
    }
  }

  // Pending approval older than 24h
  if (entry.action === 'APPROVAL_REQUEST' && entry.status === 'pending') {
    if (ageMs > H72) flags.push({ type: 'pending_stale', label: 'Pending over 3 days', tone: 'danger' })
    else if (ageMs > H24) flags.push({ type: 'pending_stale', label: 'Pending over 24h', tone: 'warning' })
  }

  // Request received but still awaiting_both for >24h
  if (entry.status === 'awaiting_both' && entry.entityId && ageMs > H24) {
    const siblings = ctx.entriesByEntityId?.[entry.entityId] ?? []
    if (siblings.some((e) => e.action === 'STOCK_REQUEST_RECEIVED')) {
      flags.push({ type: 'awaiting_received', label: 'Received but still awaiting both approvals', tone: 'warning' })
    }
  }

  // Backdated: occurredOn differs from the local calendar date of createdAt
  if (d.occurredOn) {
    const localCreated = toLocalDateStr(new Date(entry.createdAt))
    if (d.occurredOn !== localCreated) {
      const dt = new Date(d.occurredOn + 'T00:00:00').toLocaleString('en-GB', { day: 'numeric', month: 'short' })
      flags.push({ type: 'backdated', label: `Recorded for ${dt}`, tone: 'neutral' })
    }
  }

  // Possible assignment after day end for the same worker on the same date
  if (entry.action === 'STOCK_ASSIGN' && d.workerId && d.occurredOn) {
    if (ctx.dayEndsByWorkerDate?.has(`${d.workerId}:${d.occurredOn}`)) {
      flags.push({ type: 'post_dayend_assign', label: 'Possible: assigned after day end', tone: 'neutral' })
    }
  }

  return flags
}

// → { category, actionLabel, summary, vaccineLabel, workerName, storeImpact,
//     statusLabel, statusTone, currentStatus, showCurrentStatus, ref, flags, backdatedFor, parsed }
export function formatAuditEntry(entry, ctx) {
  const p = parseEntry(entry, ctx)
  const d = entry.details ?? {}
  const category = getCategory(entry.action)

  // storeImpact: only for true physical movements into/out of the store
  let storeImpact = null
  const vialsVal = typeof p.vials === 'number' ? p.vials : null
  if ((entry.action === 'STOCK_REQUEST_RECEIVED' || entry.action === 'STOCK_RECEIVE') && vialsVal) {
    storeImpact = { sign: '+', value: vialsVal }
  } else if (entry.action === 'STOCK_ASSIGN' && vialsVal) {
    storeImpact = { sign: '-', value: vialsVal }
  }

  // statusLabel and tone from action
  let statusLabel = null
  let statusTone = 'neutral'
  const es = EVENT_STATUS_LABEL[entry.action]
  if (es) {
    statusLabel = es.label
    statusTone = es.tone
  } else if (entry.action === 'APPROVAL_REQUEST') {
    const ageMs = Date.now() - new Date(entry.createdAt).getTime()
    if (entry.status === 'pending') {
      const days = Math.floor(ageMs / 86_400_000)
      const hrs  = Math.floor(ageMs / 3_600_000)
      statusLabel = days >= 1 ? `Pending ${days}d` : hrs > 0 ? `Pending ${hrs}h` : 'Pending'
      statusTone  = ageMs > 3 * 86_400_000 ? 'danger' : ageMs > 86_400_000 ? 'warning' : 'neutral'
    } else {
      statusLabel = 'Requested'
    }
  }

  // Show the entity's current status as a secondary badge only when it isn't
  // the natural result of this action (avoids redundant "Raised · Awaiting both").
  const natural = NATURAL_STATUS[entry.action]
  const showCurrentStatus = !!(natural && entry.status && !natural.includes(entry.status))

  // backdatedFor: non-null when occurredOn differs from the local createdAt date
  let backdatedFor = null
  if (d.occurredOn) {
    const localCreated = toLocalDateStr(new Date(entry.createdAt))
    if (d.occurredOn !== localCreated) {
      backdatedFor = new Date(d.occurredOn + 'T00:00:00').toLocaleString('en-GB', { day: 'numeric', month: 'short' })
    }
  }

  return {
    category,
    actionLabel: actionLabel(entry.action),
    summary: buildSummary(entry, ctx),
    vaccineLabel: p.vaccine,
    workerName: d.workerId ? (ctx.userNameById?.[d.workerId] ?? 'Unknown vaccinator') : null,
    storeImpact,
    statusLabel,
    statusTone,
    currentStatus: entry.status ?? null,
    showCurrentStatus,
    ref: entry.entityId ? entry.entityId.slice(0, 8) : null,
    flags: computeFlags(entry, ctx),
    backdatedFor,
    parsed: p,
  }
}
