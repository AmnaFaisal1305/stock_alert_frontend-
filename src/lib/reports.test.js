import { describe, it, expect } from 'vitest'
import { buildBalanceRows } from './reports'

const mv = (o) => ({ facilityId: 'f1', facilityName: 'RHC', vaccineId: 'v1', vaccineName: 'BCG', workerId: null, ...o })

describe('buildBalanceRows', () => {
  it('sums movement per facility × vaccine beside the start/end balances', () => {
    const rows = buildBalanceRows(
      [{ facilityId: 'f1', facilityName: 'RHC', vaccineId: 'v1', vaccineName: 'BCG', startVials: 10, endVials: 13 }],
      [mv({ received: 8, adjustmentIncrease: 1 }), mv({ workerId: 'w1', used: 4, wasted: 1, adjustmentDecrease: 0 }), mv({ adjustmentDecrease: 1 })],
    )
    expect(rows).toHaveLength(1)
    const r = rows[0]
    expect(r.start + r.received + r.adjustmentIncrease - r.adjustmentDecrease - r.used - r.wasted).toBe(r.end)
  })

  it('treats a pair with no balance row as 0 / 0', () => {
    const [r] = buildBalanceRows([], [mv({ vaccineId: 'v2', vaccineName: 'OPV', received: 0 })])
    expect(r).toMatchObject({ vaccine: 'OPV', start: 0, end: 0 })
  })
})
