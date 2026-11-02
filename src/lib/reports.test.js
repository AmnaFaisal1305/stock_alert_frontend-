import { describe, it, expect } from 'vitest'
import { buildBalanceRows, buildExpiryRows } from './reports'

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

describe('buildExpiryRows', () => {
  const ex = (o) => ({ facilityId: 'f1', facilityName: 'RHC', vaccineId: 'v1', vaccineName: 'BCG', nearExpiryVials: 0, expiredVials: 0, ...o })

  it('sums per vaccine, then lists facility rows when several facilities are in scope', () => {
    const rows = buildExpiryRows([
      ex({ nearExpiryVials: 3 }),
      ex({ facilityId: 'f2', facilityName: 'BHU', nearExpiryVials: 2, expiredVials: 1 }),
      ex({ vaccineId: 'v2', vaccineName: 'OPV', nearExpiryVials: 1 }),
    ])
    expect(rows.slice(0, 2)).toEqual([
      { vaccine: 'BCG', facility: 'All facilities', near: 5, expired: 1 },
      { vaccine: 'OPV', facility: 'All facilities', near: 1, expired: 0 },
    ])
    expect(rows).toHaveLength(5)
  })

  it('leaves out zero rows and names the facility when there is only one', () => {
    expect(buildExpiryRows([ex({}), ex({ vaccineId: 'v2', vaccineName: 'OPV', expiredVials: 2 })]))
      .toEqual([{ vaccine: 'OPV', facility: 'RHC', near: 0, expired: 2 }])
    expect(buildExpiryRows([])).toEqual([])
  })
})
