import { precacheAndRoute } from 'workbox-precaching'

// Precache the app shell (Workbox injects the manifest at build time)
precacheAndRoute(self.__WB_MANIFEST)

// API routes with credentials:include cannot be cached cross-origin by the Cache API.
// NetworkFirst was a no-op that added CORS risk in strict environments — removed.

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
