// public/service-worker.js
self.addEventListener('push', event => {
    const data = event.data.json();

    // CRITICAL FIX: Add more robust options to ensure visibility.
    const options = {
        body: data.body,
        icon: '/assets/logo_for_mobile.jpg', // A more prominent icon for notifications.
        badge: '/favicon.svg', // A smaller, monochrome icon for the status bar.
        vibrate: [200, 100, 200], // Vibrate pattern: vibrate 200ms, pause 100ms, vibrate 200ms.
        tag: data.tag, // Use the chatId as a tag to stack notifications.
        requireInteraction: true, // Keep notification visible until the user interacts with it.
        data: {
            url: data.url, // URL to open on click.
        },
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

self.addEventListener('notificationclick', event => {
    event.notification.close();

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
            const urlToOpen = new URL(event.notification.data.url, self.location.origin).href;
            
            // Check if there's a window already open with the same URL path.
            for (const client of clientList) {
                const clientUrl = new URL(client.url);
                const notificationUrl = new URL(urlToOpen);
                if (clientUrl.pathname === notificationUrl.pathname && 'focus' in client) {
                    return client.focus();
                }
            }

            // If not, open a new window.
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen);
            }
        })
    );
});
