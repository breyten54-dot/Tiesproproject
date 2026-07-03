// Bump this on every deploy so returning staff pick up the new version
// instead of a stale cached copy.
const CACHE_NAME = 'tiespro-site-v5';
const ASSETS = [
  './',
  './index.html',
  './home.html',
  './tool.html',
  './tool.js',
  './404.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Cache-first for the app shell, so the tool opens instantly and works offline.
// Falls back to network for anything not pre-cached; if that also fails while
// offline, navigations (typing/following a link to a page) get the branded
// 404 page, and other requests (e.g. fetch/XHR) simply fail through.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).catch(() => {
        if (event.request.mode === 'navigate') return caches.match('./404.html');
        return Response.error();
      });
    })
  );
});
