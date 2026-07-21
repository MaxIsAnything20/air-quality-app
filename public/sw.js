// AirTrack background push service worker. Handles two things: showing a
// notification when a push arrives (even with no tab open) and focusing
// or opening the app when that notification is tapped. This is separate
// from the foreground-only browser Notification flow in
// src/hooks/useAlertNotifications.ts, which only works while a tab is
// open — this is what makes alerts survive the tab closing.
self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { title: 'Air quality alert', body: event.data ? event.data.text() : '' }
  }

  const title = data.title || 'Air quality alert'
  const options = {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { url: data.url || '/' }
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data && event.notification.data.url ? event.notification.data.url : '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) return client.focus()
      }
      if (self.clients.openWindow) return self.clients.openWindow(url)
    })
  )
})
