import { describe, it, expect } from 'vitest'
import { isOpenRequest, hasFigures, pipelineSteps, REQUEST_FILTERS } from './stockRequests'

const item = (sentVials = null, receivedVials = null) => ({ vaccineId: 'v1', vaccineName: 'BCG', requestedVials: 10, sentVials, receivedVials })
const filter = (value) => REQUEST_FILTERS.find((f) => f.value === value).test
const done = (r) => pipelineSteps(r).filter((s) => s.done).map((s) => s.label)

const openPartial = { status: 'partially_fulfilled', stage: 'awaiting_both', closedAt: null, items: [item()] }
const closedShort = { status: 'partially_fulfilled', stage: 'partially_fulfilled', closedAt: '2026-10-01T00:00:00Z', items: [item()] }

describe('stockRequests', () => {
  it('an open partial request is in progress and partially fulfilled; a closed-short one is not in progress', () => {
    expect(isOpenRequest(openPartial)).toBe(true)
    expect(filter('awaiting')(openPartial)).toBe(true)
    expect(filter('partially_fulfilled')(openPartial)).toBe(true)
    expect(isOpenRequest(closedShort)).toBe(false)
    expect(filter('awaiting')(closedShort)).toBe(false)
    expect(filter('partially_fulfilled')(closedShort)).toBe(true)
  })

  it('a recorded 0 counts as a figure', () => {
    expect(hasFigures({ items: [item()] })).toBe(false)
    expect(hasFigures({ items: [item(0)] })).toBe(true)
    expect(hasFigures({ items: [item(null, 0)] })).toBe(true)
  })

  it('pipeline steps follow the figures, whichever side records first', () => {
    expect(done({ status: 'submitted', closedAt: null, items: [item(null, 5)] })).toEqual(['Requested', 'Received'])
    expect(done({ status: 'submitted', closedAt: null, items: [item(5, 5)] })).toEqual(['Requested', 'Sent', 'Received'])
    expect(done({ status: 'completed', closedAt: '2026-10-01T00:00:00Z', items: [item()] })).toEqual(['Requested', 'Sent', 'Received', 'Approved'])
  })
})
