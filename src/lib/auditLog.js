// Audit-log vocabulary and parsing shared by every role's Audit Log (components/audit/AuditLogView).
import { displayVaccineName } from './vaccineNames'

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
  APPROVAL_APPROVE:          'Approval approved',
  APPROVAL_REJECT:           'Approval rejected',
  APPROVAL_DECLINE:          'Approval rejected',
  APPROVAL_CANCEL:           'Approval withdrawn',
  STOCK_REQUEST_CREATE:      'Stock request raised',
  STOCK_REQUEST_SENT:        'Stock sent',
  STOCK_REQUEST_RECEIVED:    'Stock received',
  STOCK_REQUEST_APPROVE:     'Stock request approved',
  STOCK_REQUEST_CANCEL:      'Stock request cancelled',
  STOCK_REQUEST_CLOSE_SHORT: 'Request closed short',
  STOCK_REQUEST_DECLINE:     'Stock request declined',
}

export const actionLabel = (action) => ACTION_LABELS[action] ?? String(action ?? '—').replace(/_/g, ' ').toLowerCase()

// Lookups the parser needs: vaccine names (from the list plus names embedded in log items),
// user names, and each stock request's create entry (cancel entries don't repeat the items).
export function buildContext(logs, vaccines = [], users = []) {
  const vaccineNameById = Object.fromEntries(vaccines.map((v) => [v.id, displayVaccineName(v.name)]))
  const createByEntityId = {}
  for (const log of logs) {
    const d = log.details
    for (const it of d?.items ?? []) {
      if (it.vaccineId && it.vaccineName && !vaccineNameById[it.vaccineId]) vaccineNameById[it.vaccineId] = displayVaccineName(it.vaccineName)
    }
    if (d?.vaccineId && d?.vaccineName && !vaccineNameById[d.vaccineId]) vaccineNameById[d.vaccineId] = displayVaccineName(d.vaccineName)
    if (log.action === 'STOCK_REQUEST_CREATE' && log.entityId) createByEntityId[log.entityId] = d
  }
  const userNameById = Object.fromEntries(users.map((u) => [u.id, (u.name ?? u.email ?? '').trim().replace(/\s+/g, ' ')]))
  return { vaccineNameById, userNameById, createByEntityId }
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
  const one = (src) => (src.vaccineName ? displayVaccineName(src.vaccineName) : vn(src.vaccineId))
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
      return { ...out, vaccine: d.name ? displayVaccineName(d.name) : vn(d.vaccineId), detail: d.dosesPerVial ? `${d.dosesPerVial} doses per vial` : null }

    case 'EDIT_VACCINE': {
      const next = d.newName ?? d.name
      return { ...out, vaccine: next ? displayVaccineName(next) : vn(d.vaccineId), detail: d.oldName ? `Was ${displayVaccineName(d.oldName)}` : null }
    }

    case 'CREATE_USER':
      return { ...out, detail: [d.role?.replace(/_/g, ' '), d.email].filter(Boolean).join(' · ') || null }
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
    case 'STOCK_REQUEST_CANCEL': {
      const original = ctx.createByEntityId[entry.entityId]
      const reason = d.reason || 'No reason given'
      return original?.items?.length ? { ...out, ...fromItems(original.items, 'requestedVials', null), detail: reason } : { ...out, detail: reason }
    }
    case 'STOCK_REQUEST_CLOSE_SHORT':
    case 'STOCK_REQUEST_DECLINE':
      return d.items?.length
        ? { ...out, ...fromItems(d.items, (it) => it.requestedVials ?? it.sentVials ?? 0, null), detail: d.note ?? d.reason ?? null }
        : { ...out, vials: d.itemCount ?? null, detail: d.note ?? d.reason ?? null }

    case 'APPROVAL_REQUEST':
    case 'APPROVAL_APPROVE':
    case 'APPROVAL_REJECT':
    case 'APPROVAL_DECLINE':
    case 'APPROVAL_CANCEL': {
      const parts = [d.type?.replace(/_/g, ' ')]
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
