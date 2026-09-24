/**
 * P2P Wallet Service Worker
 * - Caches static shell for offline access
 * - Network-first for HTML, cache-first for assets
 */
const CACHE_NAME = 'p2p-wallet-v1.0.0';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/login.html',
  '/dashboard.html',
  '/send.html',
  '/receive.html',
  '/history.html',
  '/profile.html',
  '/pay.html',
  '/common.js',
  '/firebase-config.js',
  '/manifest.json',
];

self.addEventListener('install', (ev) => {
  ev.waitUntil(
    caches.open(CACHE_NAME)
      .then((c) => c.addAll(STATIC_ASSETS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (ev) => {
  ev.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (ev) => {
  const req = ev.request;
  const url = new URL(req.url);

  // Skip non-GET, cross-origin, and API calls
  if (req.method !== 'GET') return;
  if (url.origin !== location.origin) return;
  if (url.pathname.startsWith('/api')) return;

  // Network-first for HTML
  if (req.headers.get('accept')?.includes('text/html')) {
    ev.respondWith(
      fetch(req)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, clone)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match('/index.html')))
    );
    return;
  }

  // Cache-first for other static
  ev.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res.ok && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, clone)).catch(() => {});
        }
        return res;
      });
    })
  );
});

// Register from page
self.addEventListener('message', (ev) => {
  if (ev.data === 'skipWaiting') self.skipWaiting();
});
