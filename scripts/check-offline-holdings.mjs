// Self-check for the offline holdings overlay: node scripts/check-offline-holdings.mjs
import assert from 'node:assert/strict'
import { applyQueued } from '../src/lib/queuedHoldings.js'

const F = 'fac', W = 'worker', V = 'bcg'
const server = [{ facilityId: F, workerId: null, vaccineId: V, assigned: 0, used: 0, returned: 0, wasted: 0, remaining: 20 }]
const find = (rows, workerId) => rows.find((r) => (r.workerId ?? null) === workerId && r.vaccineId === V)

// Morning assign offline: store loses 5, a worker row appears holding 5.
const assign = { kind: 'assign', payload: { workerId: W, items: [{ vaccineId: V, vials: 5 }] } }
let rows = applyQueued(server, [assign], F)
assert.equal(find(rows, null).remaining, 15)
assert.equal(find(rows, W).remaining, 5)
assert.equal(find(rows, W).assigned, 5)

// Evening day-end offline: 3 used, 1 returned, 1 wasted -> worker holds 0, store gets 1 back.
const dayend = { kind: 'dayend', payload: { workerId: W, items: [{ vaccineId: V, usedVials: 3, returnedVials: 1, wastedVials: 1 }] } }
rows = applyQueued(server, [assign, dayend], F)
assert.equal(find(rows, W).remaining, 0)
assert.equal(find(rows, null).remaining, 16)

// Holdings with worker rows only (what the server sends today): no store row is invented.
rows = applyQueued([], [assign], F)
assert.equal(find(rows, null), undefined)
assert.equal(find(rows, W).remaining, 5)

// Server rows are not mutated, and an empty queue is a no-op.
assert.equal(server[0].remaining, 20)
assert.deepEqual(applyQueued(server, [], F), server)

console.log('offline holdings overlay: ok')
