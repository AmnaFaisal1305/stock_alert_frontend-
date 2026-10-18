import { describe, it, expect, vi, afterEach } from 'vitest'
import { getDashboard, getUsers, getFacilities } from './api'

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
