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

function currentUserId() {
  try { return JSON.parse(sessionStorage.getItem('sst_user'))?.id ?? null } catch { return null }
}

function allItems() {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]') } catch { return [] }
}

// Entries stay on the device after logout; each user only sees and replays their own.
// Entries queued before userId was recorded belong to whoever is signed in.
const isMine = (item) => !item.userId || item.userId === currentUserId()

export function getQueue() {
  return allItems().filter(isMine)
}

function save(items) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(items))
  notify()
}

export function enqueue(kind, payload) {
  save([...allItems(), { id: payload.clientRef, kind, payload, userId: currentUserId(), status: 'pending' }])
}

// fetch rejected before any response (no signal, DNS, CORS): the server never answered
export const isNetworkError = (err) => !err?.status

export const pendingCount = () => getQueue().filter((i) => i.status === 'pending').length
export const failedCount  = () => getQueue().filter((i) => i.status === 'error').length
export const failedItems  = () => getQueue().filter((i) => i.status === 'error')

export function discardFailed() {
  save(allItems().filter((i) => !(isMine(i) && i.status === 'error')))
}

export function getLastSynced() {
  return localStorage.getItem(LAST_SYNC_KEY)
}

function markError(id, reason) {
  save(allItems().map((item) => item.id === id ? { ...item, status: 'error', reason } : item))
}

function remove(id) {
  save(allItems().filter((item) => item.id !== id))
  localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString())
}

// A 4xx means the server read the entry and refused it, so retrying cannot help.
// 401 (login expired), 408 and 429 are temporary: keep the entry and stop.
const isPermanent = (status) => status >= 400 && status < 500 && ![401, 408, 429].includes(status)

// Returns { drained: number, kept: number }
export async function replayQueue() {
  const q = getQueue().filter((item) => item.status === 'pending')
  let drained = 0

  for (const item of q) {
    const fn = item.kind === 'assign' ? assignVials : recordDayEnd
    try {
      await fn(item.payload)
      remove(item.id)
      drained++
    } catch (err) {
      // shortcut: a 409 is marked failed, not resent with a new clientRef (it could double-count
      // if 409 means "already recorded"); revisit once the backend confirms its meaning
      if (isPermanent(err?.status)) markError(item.id, err.message)
      else break // 401 / 5xx / network: keep this entry and the rest
    }
  }

  notify()
  return { drained, kept: getQueue().length }
}
