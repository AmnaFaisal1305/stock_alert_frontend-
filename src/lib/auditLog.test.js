import { describe, it, expect } from 'vitest'
import { buildContext, formatAuditEntry } from './auditLog'

const eid = 'req-0000-0001'
const vacId = 'vac-001'
const vacName = 'BCG'
const workerId = 'usr-001'
const workerName = 'Zain Khan'

const baseCtx = (extra = {}) =>
  buildContext(
    extra.logs ?? [],
    [{ id: vacId, name: vacName }],
    [{ id: workerId, name: workerName }],
  )

function entry(action, details = {}, extras = {}) {
  return { id: 'log-1', action, createdAt: '2026-10-15T08:00:00.000Z', details, ...extras }
}

describe('formatAuditEntry', () => {
  it('STOCK_ASSIGN: summary, storeImpact sign/value, workerName', () => {
    const e = entry('STOCK_ASSIGN', {
      workerId, items: [{ vaccineId: vacId, vaccineName: vacName, vials: 3 }], occurredOn: '2026-10-15',
    })
    const f = formatAuditEntry(e, baseCtx())
    expect(f.summary).toContain('Assigned 3 vials of BCG')
    expect(f.summary).toContain('Zain Khan')
    expect(f.storeImpact).toEqual({ sign: '-', value: 3 })
    expect(f.workerName).toBe(workerName)
    expect(f.category).toBe('Stock movement')
  })

  it('STOCK_REQUEST_CREATE: summary lists vaccines', () => {
    const e = entry('STOCK_REQUEST_CREATE', {
      items: [
        { vaccineId: vacId, vaccineName: 'BCG', requestedVials: 5 },
        { vaccineId: 'vac-002', vaccineName: 'OPV', requestedVials: 8 },
      ],
    }, { entityId: eid })
    const f = formatAuditEntry(e, baseCtx())
    expect(f.summary).toContain('13 vials')
    expect(f.summary).toContain('BCG 5')
    expect(f.summary).toContain('OPV 8')
    expect(f.statusLabel).toBe('Raised')
    expect(f.category).toBe('Request')
  })

  it('STOCK_REQUEST_RECEIVED with CREATE — short delivery in summary + flag', () => {
    const createEntry = entry('STOCK_REQUEST_CREATE', {
      items: [{ vaccineId: vacId, vaccineName: vacName, requestedVials: 10 }],
    }, { entityId: eid })
    const ctx = baseCtx({ logs: [createEntry] })
    const received = entry('STOCK_REQUEST_RECEIVED', {
      items: [{ vaccineId: vacId, vaccineName: vacName, receivedVials: 7 }],
    }, { entityId: eid })
    const f = formatAuditEntry(received, ctx)
    expect(f.summary).toContain('7 of 10')
    expect(f.summary).toContain('short by 3')
    expect(f.flags.some((fl) => fl.type === 'short_delivery')).toBe(true)
    expect(f.storeImpact).toEqual({ sign: '+', value: 7 })
  })

  it('STOCK_REQUEST_RECEIVED without CREATE — no short_delivery flag', () => {
    const ctx = baseCtx()
    const e = entry('STOCK_REQUEST_RECEIVED', {
      items: [{ vaccineId: vacId, vaccineName: vacName, receivedVials: 5 }],
    }, { entityId: eid })
    const f = formatAuditEntry(e, ctx)
    expect(f.flags.some((fl) => fl.type === 'short_delivery')).toBe(false)
    expect(f.summary).toContain('Received 5 vials')
  })

  it('APPROVAL_REQUEST threshold_change: summary and Pending statusLabel', () => {
    const e = entry('APPROVAL_REQUEST', {
      vaccineId: vacId, vaccineName: vacName, type: 'threshold_change',
      payload: { thresholds: { lowDoses: 40, lowVials: 4, criticalDoses: 20, criticalVials: 2 } },
    }, { status: 'pending' })
    const f = formatAuditEntry(e, baseCtx())
    expect(f.summary).toContain('BCG thresholds')
    expect(f.summary).toContain('Low 40 doses / 4 vials')
    expect(f.summary).toContain('Critical 20 doses / 2 vials')
    expect(f.statusLabel).toMatch(/Pending/)
    expect(f.category).toBe('Approval')
  })

  it('APPROVAL_REQUEST stock_correction with reason', () => {
    const e = entry('APPROVAL_REQUEST', {
      vaccineId: vacId, vaccineName: vacName, type: 'stock_correction',
      payload: { storeVials: 5 }, note: 'Physical count',
    }, { status: 'pending' })
    const f = formatAuditEntry(e, baseCtx())
    expect(f.summary).toContain('correct BCG store to 5 vials')
    expect(f.summary).toContain('Physical count')
  })

  it('backdated entry: backdatedFor is set when occurredOn differs from createdAt', () => {
    const e = entry('STOCK_ASSIGN', {
      workerId, items: [{ vaccineId: vacId, vaccineName: vacName, vials: 2 }],
      occurredOn: '2026-10-12', // 3 days before createdAt (2026-10-15)
    })
    const f = formatAuditEntry(e, baseCtx())
    expect(f.backdatedFor).not.toBeNull()
    expect(f.backdatedFor).toContain('12')
    expect(f.flags.some((fl) => fl.type === 'backdated')).toBe(true)
  })

  it('unknown worker id: falls back to "Unknown worker", not raw UUID', () => {
    const e = entry('STOCK_ASSIGN', {
      workerId: 'usr-unknown', items: [{ vaccineId: vacId, vaccineName: vacName, vials: 1 }],
    })
    const f = formatAuditEntry(e, baseCtx())
    expect(f.workerName).toBe('Unknown worker')
    expect(f.summary).toContain('Unknown worker')
  })

  it('unknown vaccine id: falls back to "Unknown vaccine"', () => {
    const e = entry('STOCK_ASSIGN', {
      workerId,
      items: [{ vaccineId: 'vac-unknown', vials: 1 }],
    })
    const f = formatAuditEntry(e, baseCtx())
    expect(f.summary).toContain('Unknown vaccine')
  })

  it('LOGOUT: category Session, no summary, no storeImpact', () => {
    const e = entry('LOGOUT', {})
    const f = formatAuditEntry(e, baseCtx())
    expect(f.category).toBe('Session')
    expect(f.summary).toBeNull()
    expect(f.storeImpact).toBeNull()
  })

  it('ref is first 8 chars of entityId', () => {
    const e = entry('STOCK_REQUEST_CREATE', {
      items: [{ vaccineId: vacId, vaccineName: vacName, requestedVials: 5 }],
    }, { entityId: 'abcd1234-5678-90ef' })
    const f = formatAuditEntry(e, baseCtx())
    expect(f.ref).toBe('abcd1234')
  })
})
