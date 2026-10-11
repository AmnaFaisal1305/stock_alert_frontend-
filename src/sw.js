import { precacheAndRoute } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { NetworkFirst } from 'workbox-strategies'

// Precache the app shell (Workbox injects the manifest at build time)
precacheAndRoute(self.__WB_MANIFEST)

// shortcut: GET-only API caching, credentials not cached — read-only fallback when offline
const API_ORIGIN = self.location.hostname === 'localhost'
  ? 'http://localhost:3000'
  : 'https://smart-stock-alert-be.vercel.app'

registerRoute(
  ({ url, request }) => url.origin === API_ORIGIN && request.method === 'GET',
  new NetworkFirst({ cacheName: 'api-cache', networkTimeoutSeconds: 5 }),
)

// Push notification handler
self.addEventListener('push', (event) => {
  if (!event.data) return
  let payload
  try { payload = event.data.json() } catch { payload = { title: 'Stock Alert', body: event.data.text() } }
  const { title = 'Stock Alert', body = '', url = '/', entityType, entityId } = payload
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/icon.svg',
      badge: '/icon.svg',
      data: { url, entityType, entityId },
    }),
  )
})

// Notification click — focus existing tab or open url
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = event.notification.data?.url ?? '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => c.url.includes(self.location.origin))
      if (existing) return existing.focus().then((c) => c.navigate(target))
      return self.clients.openWindow(target)
    }),
  )
})
