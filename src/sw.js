import { precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching'
import { registerRoute, NavigationRoute } from 'workbox-routing'

// Precache the app shell (Workbox injects the manifest at build time)
const manifest = self.__WB_MANIFEST
precacheAndRoute(manifest)

// Any page URL (reload on /facility/day-end, a pushed link) gets the cached shell offline.
// The dev server precaches nothing, so skip it there rather than throw.
if (manifest.some((e) => e.url === 'index.html')) {
  registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html'), { denylist: [/^\/api\//] }))
}

// API routes with credentials:include cannot be cached cross-origin by the Cache API.
// NetworkFirst was a no-op that added CORS risk in strict environments — removed.

// Push notification handler
self.addEventListener('push', (event) => {
  if (!event.data) return
  let payload
  try { payload = event.data.json() } catch { payload = { title: 'Stock Alert', body: event.data.text() } }
  const { title = 'Stock Alert', body = '', url = '/', type, entityType, entityId } = payload
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/images/icon-192.png',
      badge: '/images/icon-192.png',
      data: { url, type, entityType, entityId },
    }),
  )
})

// Notification click — focus existing tab or open url
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  // `url` is the app root for every type; the app maps type → the signed-in role's screen.
  const { url, type, entityType } = event.notification.data ?? {}
  const target = type
    ? `/?${new URLSearchParams({ notif: type, ...(entityType ? { entityType } : {}) })}`
    : (url ?? '/')
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => c.url.includes(self.location.origin))
      if (existing) return existing.focus().then((c) => c.navigate(target))
      return self.clients.openWindow(target)
    }),
  )
})
