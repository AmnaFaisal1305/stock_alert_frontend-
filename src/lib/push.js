import { getPushPublicKey, subscribePush, unsubscribePush } from './api'

export function isPushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

// serviceWorker.ready never resolves when no worker is registered (blocked, some private windows,
// a first visit before activation), which would hang whatever awaits it. Resolves to null instead.
export const READY_TIMEOUT_MS = 2000
function workerReady() {
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise((resolve) => setTimeout(() => resolve(null), READY_TIMEOUT_MS)),
  ])
}

// Returns 'ok' | 'denied' | 'not_configured' | 'unsupported' | throws on network error
export async function enablePush() {
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return 'denied'

  const reg = await workerReady()
  if (!reg) return 'unsupported'

  let publicKey
  try {
    const data = await getPushPublicKey()
    publicKey = data?.publicKey
  } catch (err) {
    if (err.status === 503) return 'not_configured'
    throw err
  }
  if (!publicKey) return 'not_configured'

  const existing = await reg.pushManager.getSubscription()
  if (existing) await existing.unsubscribe()

  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  })

  await subscribePush(sub.toJSON())
  return 'ok'
}

// Best-effort — call before logout; never throws
export async function disablePushForLogout() {
  try {
    const reg = await workerReady()
    if (!reg) return
    const sub = await reg.pushManager.getSubscription()
    if (!sub) return
    await unsubscribePush(sub.endpoint).catch(() => {})
    await sub.unsubscribe().catch(() => {})
  } catch {
    // best-effort
  }
}
