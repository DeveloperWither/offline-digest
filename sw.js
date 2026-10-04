/* Offline Digest service worker.
 * Bump VERSION whenever you change any cached file so clients pick up the update. */
const VERSION = 'v1.1.0';
const CACHE = `offline-digest-${VERSION}`;

// Paths are relative to this file, so the app works from any GitHub Pages sub-path.
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './articles.json',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(ASSETS.map((url) => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k.startsWith('offline-digest-') && k !== CACHE).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // let cross-origin sync requests pass through

  if (req.mode === 'navigate') {
    // App shell: serve cached index.html instantly, refresh it in the background.
    event.respondWith(staleWhileRevalidate(event, './index.html'));
  } else if (req.cache === 'no-store' || req.cache === 'reload') {
    // Explicit "Sync" from the app: try the network first, fall back to cache.
    event.respondWith(networkFirst(req));
  } else {
    event.respondWith(staleWhileRevalidate(event));
  }
});

function cacheable(res) {
  // Safari refuses redirected responses for navigations, so never store them.
  return res && res.ok && res.type === 'basic' && !res.redirected;
}

function staleWhileRevalidate(event, cacheKey) {
  const req = event.request;
  const key = cacheKey || req;
  const network = fetch(req)
    .then((res) => {
      if (cacheable(res)) {
        const copy = res.clone();
        return caches.open(CACHE).then((cache) => cache.put(key, copy)).then(() => res);
      }
      return res;
    })
    .catch(() => null);
  event.waitUntil(network);

  return caches.open(CACHE)
    .then((cache) => cache.match(key, { ignoreSearch: true }))
    .then((cached) => cached || network.then((res) => res || offlineResponse(req)));
}

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req);
    if (cacheable(res)) await cache.put(req, res.clone());
    return res;
  } catch {
    return (await cache.match(req, { ignoreSearch: true })) || offlineResponse(req);
  }
}

function offlineResponse(req) {
  if (req.mode === 'navigate') {
    return new Response('<!doctype html><meta name="viewport" content="width=device-width"><body style="background:#0e0f12;color:#ecebe7;font-family:-apple-system,sans-serif;padding:40px">Offline — open the app once while online to enable offline mode.', {
      status: 503,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
  return new Response('Offline', { status: 503, statusText: 'Offline' });
}
