self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: "Daily Sales Summary", body: event.data.text() };
    }
  }

  const title = data.title || "Daily Sales Summary";
  const options = {
    body: data.body || "Daily closed day revenue data updated.",
    icon: "https://cdn-icons-png.flaticon.com/512/3176/3176366.png",
    badge: "https://cdn-icons-png.flaticon.com/512/3176/3176366.png",
    tag: "daily-revenue-summary",
    renotify: true
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Optional: handle clicking the notification (open the dashboard)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});
