// shortcut: localStorage is fine at pilot scale (Q27); upgrade to IndexedDB if volume grows
import { assignVials, recordDayEnd } from './api'

const QUEUE_KEY      = 'sst_offline_queue'
const LAST_SYNC_KEY  = 'sst_last_synced'

const listeners = new Set()

function notify() {
  for (const fn of listeners) fn()
}

export function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function getQueue() {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]') } catch { return [] }
}

function save(q) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q))
  notify()
}

export function enqueue(kind, payload) {
  const q = getQueue()
  q.push({ id: payload.clientRef, kind, payload, status: 'pending' })
  save(q)
}

export function getLastSynced() {
  return localStorage.getItem(LAST_SYNC_KEY)
}

function markError(id) {
  const q = getQueue().map((item) => item.id === id ? { ...item, status: 'error' } : item)
  save(q)
}

function remove(id) {
  save(getQueue().filter((item) => item.id !== id))
  localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString())
}

// Returns { drained: number, kept: number }
export async function replayQueue() {
  const q = getQueue().filter((item) => item.status !== 'error')
  let drained = 0

  for (const item of q) {
    const fn = item.kind === 'assign' ? assignVials : recordDayEnd
    try {
      await fn(item.payload)
      remove(item.id)
      drained++
    } catch (err) {
      const status = err?.status
      if (status === 400) {
        markError(item.id)
      } else if (status === 409) {
        // regenerate clientRef and retry once
        const newRef = crypto.randomUUID()
        const updated = { ...item.payload, clientRef: newRef }
        try {
          await fn(updated)
          remove(item.id)
          drained++
        } catch {
          markError(item.id)
        }
      } else {
        // 401 / 5xx / network: stop replaying, keep item
        break
      }
    }
  }

  notify()
  return { drained, kept: getQueue().length }
}
