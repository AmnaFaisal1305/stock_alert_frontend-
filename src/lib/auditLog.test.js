import { describe, it, expect } from 'vitest'
import { buildContext, formatAuditEntry, deriveApproveStatus } from './auditLog'

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

  it('unknown worker id with no email: workerName is null (renders "—"), not raw UUID', () => {
    const e = entry('STOCK_ASSIGN', {
      workerId: 'usr-unknown', items: [{ vaccineId: vacId, vaccineName: vacName, vials: 1 }],
    })
    const f = formatAuditEntry(e, baseCtx())
    expect(f.workerName).toBeNull()
    expect(f.summary).not.toContain('Unknown worker')
  })

  it('STOCK_REQUEST_CANCEL: Round 40 rows use their own items, no CREATE needed', () => {
    const e = entry('STOCK_REQUEST_CANCEL', {
      reason: 'duplicate', items: [{ vaccineId: vacId, vaccineName: vacName, requestedVials: 5 }],
    }, { entityId: eid })
    const f = formatAuditEntry(e, baseCtx())
    expect(f.summary).toBe('Cancelled request for 5 vials of BCG')
    expect(f.parsed.vaccine).toBe('BCG')
  })

  it('STOCK_REQUEST_CANCEL: older rows fall back to the CREATE entry', () => {
    const createEntry = entry('STOCK_REQUEST_CREATE', {
      items: [{ vaccineId: vacId, vaccineName: vacName, requestedVials: 4 }],
    }, { entityId: eid })
    const f = formatAuditEntry(entry('STOCK_REQUEST_CANCEL', { reason: 'r' }, { entityId: eid }), baseCtx({ logs: [createEntry] }))
    expect(f.summary).toBe('Cancelled request for 4 vials of BCG')
  })

  it('STOCK_REQUEST_CLOSE_SHORT: reads "Partially fulfilled", not "Closed short"', () => {
    const e = entry('STOCK_REQUEST_CLOSE_SHORT', {
      items: [{ vaccineId: vacId, vaccineName: vacName, requestedVials: 10, sentVials: 6 }],
    }, { entityId: eid })
    const f = formatAuditEntry(e, baseCtx())
    expect(f.statusLabel).toBe('Partially fulfilled')
    expect(f.summary).toBe('Closed as partially fulfilled — received 6 of 10 vials')
  })

  it('APPROVAL_APPROVE: names the approval type from the shared label', () => {
    const e = entry('APPROVAL_APPROVE', { vaccineId: vacId, vaccineName: vacName, type: 'stock_correction' })
    expect(formatAuditEntry(e, baseCtx()).summary).toBe('Approved stock correction for BCG')
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

// ─── Head-specific tests ───────────────────────────────────────────────────────

const OLD = '2020-01-01T00:00:00.000Z' // always >72h old

describe('STOCK_REQUEST_APPROVE (head)', () => {
  it('partial single-vaccine: summary "Approved 8 of 10 BCG vials · short by 2"', () => {
    const e = entry('STOCK_REQUEST_APPROVE', {
      items: [{ vaccineId: vacId, vaccineName: vacName, requestedVials: 10, fulfilledVials: 8, receivedVials: 8 }],
    }, { entityId: eid })
    const f = formatAuditEntry(e, baseCtx())
    expect(f.summary).toBe('Approved 8 of 10 BCG vials · short by 2')
  })

  it('multi-vaccine some short: summary lists short vaccines', () => {
    const e = entry('STOCK_REQUEST_APPROVE', {
      items: [
        { vaccineId: vacId, vaccineName: 'BCG', requestedVials: 10, fulfilledVials: 10, receivedVials: 10 },
        { vaccineId: 'vac-002', vaccineName: 'OPV', requestedVials: 8, fulfilledVials: 5, receivedVials: 5 },
        { vaccineId: 'vac-003', vaccineName: 'PCV', requestedVials: 6, fulfilledVials: 4, receivedVials: 4 },
      ],
    }, { entityId: eid })
    const f = formatAuditEntry(e, baseCtx())
    expect(f.summary).toContain('short on 2 vaccines')
    expect(f.summary).toContain('OPV 5/8')
    expect(f.summary).toContain('PCV 4/6')
  })

  it('follow-up: summary starts with "Shortfall closed"', () => {
    const earlier = { ...entry('STOCK_REQUEST_APPROVE', {
      items: [{ vaccineId: vacId, vaccineName: vacName, requestedVials: 9, fulfilledVials: 5, receivedVials: 5 }],
    }, { entityId: eid, id: 'log-1' }), createdAt: '2026-10-14T08:00:00.000Z' }
    const later = { ...entry('STOCK_REQUEST_APPROVE', {
      items: [{ vaccineId: vacId, vaccineName: vacName, requestedVials: 9, fulfilledVials: 9, receivedVials: 4 }],
    }, { entityId: eid, id: 'log-2' }), createdAt: '2026-10-15T08:00:00.000Z' }
    const ctx = buildContext([earlier, later], [{ id: vacId, name: vacName }], [])
    const f = formatAuditEntry(later, ctx)
    expect(f.summary).toMatch(/^Shortfall closed/)
    expect(f.summary).toContain('+4')
    expect(f.summary).toContain('9 of 9')
    expect(f.summary).toContain('Completed')
  })

  it('follow-up: qty.done = fulfilledVials (9), not receivedVials (4)', () => {
    const earlier = { ...entry('STOCK_REQUEST_APPROVE', {
      items: [{ vaccineId: vacId, vaccineName: vacName, requestedVials: 9, fulfilledVials: 5, receivedVials: 5 }],
    }, { entityId: eid, id: 'log-1' }), createdAt: '2026-10-14T08:00:00.000Z' }
    const later = { ...entry('STOCK_REQUEST_APPROVE', {
      items: [{ vaccineId: vacId, vaccineName: vacName, requestedVials: 9, fulfilledVials: 9, receivedVials: 4 }],
    }, { entityId: eid, id: 'log-2' }), createdAt: '2026-10-15T08:00:00.000Z' }
    const ctx = buildContext([earlier, later], [{ id: vacId, name: vacName }], [])
    const f = formatAuditEntry(later, ctx)
    expect(f.qty).toEqual({ done: 9, total: 9 })
  })

  it('no items (older entry): summary "Request approved"', () => {
    const e = entry('STOCK_REQUEST_APPROVE', {}, { entityId: eid })
    const f = formatAuditEntry(e, baseCtx())
    expect(f.summary).toBe('Request approved')
  })

  it('storeImpact is null, qty field is populated, awaiting_both suppresses showCurrentStatus', () => {
    const e = entry('STOCK_REQUEST_APPROVE', {
      items: [{ vaccineId: vacId, vaccineName: vacName, requestedVials: 10, fulfilledVials: 8, receivedVials: 8 }],
    }, { entityId: eid, status: 'awaiting_both' })
    const f = formatAuditEntry(e, baseCtx())
    expect(f.storeImpact).toBeNull()
    expect(f.qty).toEqual({ done: 8, total: 10 })
    expect(f.showCurrentStatus).toBe(false)
  })
})

describe('APPROVAL_APPROVE threshold_change (head)', () => {
  it('critical thresholds lowered: summary has diff + "lowers alert sensitivity", thresholdOverridden excluded', () => {
    const e = entry('APPROVAL_APPROVE', {
      vaccineId: vacId, vaccineName: vacName, type: 'threshold_change',
      previous: { lowDoses: 40, lowVials: 4, criticalDoses: 20, criticalVials: 2, thresholdOverridden: false },
      new:      { lowDoses: 40, lowVials: 4, criticalDoses: 10, criticalVials: 1, thresholdOverridden: true },
    })
    const f = formatAuditEntry(e, baseCtx())
    expect(f.summary).toContain('BCG')
    expect(f.summary).toContain('10')
    expect(f.summary).not.toContain('thresholdOverridden')
    expect(f.summary).toContain('lowers alert sensitivity')
  })

  it('no values changed: fallback summary', () => {
    const e = entry('APPROVAL_APPROVE', {
      vaccineId: vacId, vaccineName: vacName, type: 'threshold_change',
      previous: {}, new: {},
    })
    const f = formatAuditEntry(e, baseCtx())
    expect(f.summary).toBe('Approved threshold change for BCG')
  })
})

describe('APPROVAL_REJECT (head)', () => {
  it('with APPROVAL_REQUEST in context: includes requester and storeVials', () => {
    const req = { ...entry('APPROVAL_REQUEST', {
      vaccineId: vacId, vaccineName: vacName, type: 'stock_correction',
      payload: { storeVials: 5 },
    }, { entityId: eid }), id: 'log-req', actorName: 'Amna Faisal' }
    const rej = entry('APPROVAL_REJECT', {
      vaccineId: vacId, vaccineName: vacName, type: 'stock_correction',
      decisionReason: 'Count seems wrong',
    }, { entityId: eid, id: 'log-rej' })
    const ctx = buildContext([req, rej], [{ id: vacId, name: vacName }], [])
    const f = formatAuditEntry(rej, ctx)
    expect(f.summary).toContain('Amna Faisal')
    expect(f.summary).toContain('5 vials')
    expect(f.summary).toContain('Count seems wrong')
  })

  it('without APPROVAL_REQUEST in context: no requester, still shows reason', () => {
    const e = entry('APPROVAL_REJECT', {
      vaccineId: vacId, vaccineName: vacName, type: 'stock_correction',
      decisionReason: 'Count seems wrong',
    }, { entityId: eid })
    const f = formatAuditEntry(e, baseCtx())
    expect(f.summary).not.toContain('requested by')
    expect(f.summary).toContain('Count seems wrong')
  })
})

describe('SHEET_SAVED (head)', () => {
  it('old format {month:10,year:2026} → "Form B saved · Oct 2026"', () => {
    const e = entry('SHEET_SAVED', { month: 10, year: 2026 })
    const f = formatAuditEntry(e, baseCtx())
    expect(f.summary).toBe('Form B saved · Oct 2026')
  })

  it('new format {month:"2026-10"} → "Form B saved · Oct 2026"', () => {
    const e = entry('SHEET_SAVED', { month: '2026-10' })
    const f = formatAuditEntry(e, baseCtx())
    expect(f.summary).toBe('Form B saved · Oct 2026')
  })
})

describe('open_shortfall / resolved_shortfall flags', () => {
  it('>24h partial with no closers: open_shortfall warning', () => {
    const e = { ...entry('STOCK_REQUEST_APPROVE', {
      items: [{ vaccineId: vacId, vaccineName: vacName, requestedVials: 10, fulfilledVials: 7, receivedVials: 7 }],
    }, { entityId: eid }), createdAt: new Date(Date.now() - 2 * 86_400_000).toISOString() }
    const ctx = buildContext([e], [{ id: vacId, name: vacName }], [])
    const f = formatAuditEntry(e, ctx)
    const fl = f.flags.find((x) => x.type === 'open_shortfall')
    expect(fl).toBeDefined()
    expect(fl.tone).toBe('warning')
  })

  it('>72h partial with no closers: open_shortfall danger', () => {
    const e = { ...entry('STOCK_REQUEST_APPROVE', {
      items: [{ vaccineId: vacId, vaccineName: vacName, requestedVials: 10, fulfilledVials: 7, receivedVials: 7 }],
    }, { entityId: eid }), createdAt: OLD }
    const ctx = buildContext([e], [{ id: vacId, name: vacName }], [])
    const f = formatAuditEntry(e, ctx)
    const fl = f.flags.find((x) => x.type === 'open_shortfall')
    expect(fl).toBeDefined()
    expect(fl.tone).toBe('danger')
  })

  it('CLOSE_SHORT for same entityId: open_shortfall NOT flagged', () => {
    const approve = { ...entry('STOCK_REQUEST_APPROVE', {
      items: [{ vaccineId: vacId, vaccineName: vacName, requestedVials: 10, fulfilledVials: 7, receivedVials: 7 }],
    }, { entityId: eid }), createdAt: OLD }
    const closer = { ...entry('STOCK_REQUEST_CLOSE_SHORT', {}, { entityId: eid }), id: 'log-close' }
    const ctx = buildContext([approve, closer], [{ id: vacId, name: vacName }], [])
    const f = formatAuditEntry(approve, ctx)
    expect(f.flags.some((x) => x.type === 'open_shortfall')).toBe(false)
  })

  it('STOCK_REQUEST_CANCEL for same entityId: open_shortfall NOT flagged', () => {
    const approve = { ...entry('STOCK_REQUEST_APPROVE', {
      items: [{ vaccineId: vacId, vaccineName: vacName, requestedVials: 10, fulfilledVials: 7, receivedVials: 7 }],
    }, { entityId: eid }), createdAt: OLD }
    const cancel = { ...entry('STOCK_REQUEST_CANCEL', {}, { entityId: eid }), id: 'log-cancel' }
    const ctx = buildContext([approve, cancel], [{ id: vacId, name: vacName }], [])
    const f = formatAuditEntry(approve, ctx)
    expect(f.flags.some((x) => x.type === 'open_shortfall')).toBe(false)
  })

  it('later completed APPROVE in context: resolved_shortfall flag', () => {
    const partial = { ...entry('STOCK_REQUEST_APPROVE', {
      items: [{ vaccineId: vacId, vaccineName: vacName, requestedVials: 9, fulfilledVials: 5, receivedVials: 5 }],
    }, { entityId: eid, id: 'log-1' }), createdAt: '2026-10-14T08:00:00.000Z' }
    const complete = { ...entry('STOCK_REQUEST_APPROVE', {
      items: [{ vaccineId: vacId, vaccineName: vacName, requestedVials: 9, fulfilledVials: 9, receivedVials: 4 }],
    }, { entityId: eid, id: 'log-2' }), createdAt: '2026-10-15T08:00:00.000Z' }
    const ctx = buildContext([partial, complete], [{ id: vacId, name: vacName }], [])
    const f = formatAuditEntry(partial, ctx)
    expect(f.flags.some((x) => x.type === 'resolved_shortfall')).toBe(true)
    expect(f.flags.some((x) => x.type === 'open_shortfall')).toBe(false)
  })
})

describe('deriveApproveStatus', () => {
  it('all fulfilled → completed', () => {
    expect(deriveApproveStatus({ items: [{ requestedVials: 5, fulfilledVials: 5 }] })).toBe('completed')
  })
  it('partial → partially_fulfilled', () => {
    expect(deriveApproveStatus({ items: [{ requestedVials: 5, fulfilledVials: 3 }] })).toBe('partially_fulfilled')
  })
  it('no items → falls back to d.status', () => {
    expect(deriveApproveStatus({ status: 'completed' })).toBe('completed')
  })
})
