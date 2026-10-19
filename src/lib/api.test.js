import { describe, it, expect, vi, afterEach } from 'vitest'
import { getDashboard, getUsers, getFacilities, getAllAuditLog } from './api'

const ok = () => new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } })
const queryContext = () => ({ client: {}, queryKey: ['x'], signal: new AbortController().signal })

afterEach(() => vi.unstubAllGlobals())

describe('query strings', () => {
  it.each([
    ['getDashboard', getDashboard, '/api/dashboard'],
    ['getUsers', getUsers, '/api/users'],
    ['getFacilities', getFacilities, '/api/facilities'],
  ])('%s used directly as a queryFn does not leak the TanStack context into the URL', async (_name, fn, path) => {
    const fetchMock = vi.fn(async () => ok())
    vi.stubGlobal('fetch', fetchMock)
    await fn(queryContext())
    expect(fetchMock.mock.calls[0][0].endsWith(path)).toBe(true)
  })

  it('still sends real params', async () => {
    const fetchMock = vi.fn(async () => ok())
    vi.stubGlobal('fetch', fetchMock)
    await getDashboard({ compareTo: '2026-10-11', empty: '', skip: null })
    expect(fetchMock.mock.calls[0][0].endsWith('/api/dashboard?compareTo=2026-10-11')).toBe(true)
  })
})

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

describe('getAllAuditLog', () => {
  it('follows nextCursor at limit 500 until it is null', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json({ auditLog: [{ id: 1 }, { id: 2 }], nextCursor: 'c1' }))
      .mockResolvedValueOnce(json({ auditLog: [{ id: 3 }], nextCursor: null }))
    vi.stubGlobal('fetch', fetchMock)
    const rows = await getAllAuditLog({ actorRole: 'facility_head' })
    expect(rows.map((r) => r.id)).toEqual([1, 2, 3])
    expect(fetchMock.mock.calls[0][0]).toContain('limit=500')
    expect(fetchMock.mock.calls[0][0]).not.toContain('before=')
    expect(fetchMock.mock.calls[1][0]).toContain('before=c1')
  })
})

describe('500 errors', () => {
  it('carry the requestId in the message', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ error: 'Internal server error', requestId: 'abc-123' }, 500)))
    await expect(getDashboard()).rejects.toThrow('Internal server error. Reference: abc-123')
  })
})
