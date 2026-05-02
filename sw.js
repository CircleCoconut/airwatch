// AirWatch Service Worker v1
// Handles: offline caching, push notifications, background AQI checks

const CACHE_NAME = 'airwatch-v1';
const OFFLINE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  'https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Syne:wght@400;600;700;800&display=swap',
];

// ── Install: cache shell assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(OFFLINE_URLS).catch(() => {
        // Font CDN may fail offline — that's fine
        return cache.addAll(['/', '/index.html', '/manifest.json']);
      });
    })
  );
  self.skipWaiting();
});

// ── Activate: clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Fetch: serve from cache when offline, network-first when online
self.addEventListener('fetch', event => {
  // Don't intercept WAQI API calls — always need fresh data
  if (event.request.url.includes('waqi.info')) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Cache successful GET responses
        if (event.request.method === 'GET' && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// ── Push notification received (from server or Cloudflare Worker)
self.addEventListener('push', event => {
  let data = { title: 'AirWatch Alert', body: 'Air quality has changed.', aqi: null, color: '#4ade80' };

  try {
    data = { ...data, ...event.data.json() };
  } catch(e) {
    if (event.data) data.body = event.data.text();
  }

  // Pick icon colour based on AQI
  let badge = '🟢';
  if (data.aqi > 300) badge = '🔴';
  else if (data.aqi > 200) badge = '🟣';
  else if (data.aqi > 150) badge = '🔴';
  else if (data.aqi > 100) badge = '🟠';
  else if (data.aqi > 50)  badge = '🟡';

  const options = {
    body: data.body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'airwatch-alert',           // replaces previous notification — no spam
    renotify: true,
    vibrate: [200, 100, 200],
    data: { url: '/', aqi: data.aqi },
    actions: [
      { action: 'open',    title: 'View details' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(`${badge} ${data.title}`, options)
  );
});

// ── Notification click — open or focus the app
self.addEventListener('notificationclick', event => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      const existing = windowClients.find(c => c.url.includes(self.location.origin));
      if (existing) return existing.focus();
      return clients.openWindow('/');
    })
  );
});

// ── Background sync: re-check AQI when connectivity restored
self.addEventListener('sync', event => {
  if (event.tag === 'aqi-check') {
    event.waitUntil(backgroundAqiCheck());
  }
});

async function backgroundAqiCheck() {
  // Reads stored location + token from IndexedDB if available
  // Minimal implementation — full version wired in Phase 3 with backend
  console.log('[AirWatch SW] Background AQI sync triggered');
}
