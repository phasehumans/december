// Browser push for December (#636). The server sends { title, body, url, tag }.
// Built to the site root (build.ts) so its scope is the whole app.

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
    let data
    try {
        data = event.data ? event.data.json() : {}
    } catch (error) {
        // a payload that is not json is shown as plain text
        data = { body: event.data ? event.data.text() : '', error: String(error) }
    }

    event.waitUntil(
        self.registration.showNotification(data.title || 'December', {
            body: data.body || '',
            tag: data.tag,
            icon: '/assets/favicon.png',
            data: { url: data.url || '/' },
        })
    )
})

self.addEventListener('notificationclick', (event) => {
    event.notification.close()
    const url = (event.notification.data && event.notification.data.url) || '/'

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
            const open = windows.find((client) => client.url.startsWith(self.location.origin))
            if (open && 'navigate' in open) {
                return open.navigate(url).then((client) => (client || open).focus())
            }
            return self.clients.openWindow(url)
        })
    )
})
