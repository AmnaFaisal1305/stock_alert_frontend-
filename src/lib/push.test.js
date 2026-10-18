import { describe, it, expect, vi, afterEach } from 'vitest'
import { disablePushForLogout, enablePush, READY_TIMEOUT_MS } from './push'

const noWorker = () => vi.stubGlobal('navigator', { serviceWorker: { ready: new Promise(() => {}) } })

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('push with no service worker (ready never resolves)', () => {
  it('disablePushForLogout resolves instead of hanging, so sign out can go on', async () => {
    vi.useFakeTimers()
    noWorker()
    const done = vi.fn()
    const p = disablePushForLogout().then(done)
    await vi.advanceTimersByTimeAsync(READY_TIMEOUT_MS - 1)
    expect(done).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    await p
    expect(done).toHaveBeenCalled()
  })

  it('enablePush answers "unsupported"', async () => {
    vi.useFakeTimers()
    noWorker()
    vi.stubGlobal('Notification', { requestPermission: async () => 'granted' })
    const p = enablePush()
    await vi.advanceTimersByTimeAsync(READY_TIMEOUT_MS)
    await expect(p).resolves.toBe('unsupported')
  })

  it('does not wait when a worker is ready and has no subscription', async () => {
    vi.stubGlobal('navigator', { serviceWorker: { ready: Promise.resolve({ pushManager: { getSubscription: async () => null } }) } })
    await expect(disablePushForLogout()).resolves.toBeUndefined()
  })
})
