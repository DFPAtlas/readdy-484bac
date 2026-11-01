self.addEventListener('install', () => { self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(self.clients.claim()); });
self.addEventListener('push', (e) => {
  if (!e.data) return;
  let data;
  try { data = e.data.json(); } catch { data = { title: 'QuickGuard', body: e.data.text() }; }
  const options = {
    body: data.body || 'New notification',
    icon: data.icon || 'https://public.readdy.ai/ai/img_res/66933a83-eb29-486f-86a7-dac739aa1e53.png',
    badge: data.badge || 'https://public.readdy.ai/ai/img_res/66933a83-eb29-486f-86a7-dac739aa1e53.png',
    tag: data.tag || 'quickguard-default',
    requireInteraction: data.requireInteraction || false,
    data: data.data || {},
    actions: data.actions || [],
  };
  e.waitUntil(self.registration.showNotification(data.title || 'QuickGuard', options));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  let url;
  try {
    const target = new URL(e.notification.data?.url || '/', self.location.origin);
    url = target.origin === self.location.origin ? target.href : self.location.origin + '/';
  } catch {
    url = self.location.origin + '/';
  }
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const c of clients) { if (c.url === url && 'focus' in c) return c.focus(); }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
