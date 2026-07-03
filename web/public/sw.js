// ShareStamps 웹푸시 서비스워커 — 푸시 수신 표시 + 알림 클릭 시 해당 URL 열기.
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { title: 'ShareStamps', body: event.data ? event.data.text() : '' }; }
  const title = data.title || 'ShareStamps 🐝';
  const options = {
    body: data.body || '',
    icon: data.icon || '/logo/sharestamps-symbol.svg',
    badge: '/logo/sharestamps-symbol.svg',
    data: { url: data.url || '/me' },
    tag: data.tag || undefined,       // 같은 tag면 알림이 겹쳐 쌓이지 않음(남발 방지)
    renotify: !!data.tag,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/me';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) { if ('focus' in c) { c.navigate(url); return c.focus(); } }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
