/* eslint-disable no-restricted-globals */
const VERSION = 'v1.0.1';
const APP_SHELL_CACHE = `app-shell-${VERSION}`;
const API_CACHE = `api-cache-${VERSION}`;

// App shell to cache for offline
const APP_SHELL = [
  '/',
  '/index.html',
  '/bundle.js',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((k) => ![APP_SHELL_CACHE, API_CACHE].includes(k))
          .map((k) => caches.delete(k))
      );
    })
  );
  self.clients.claim();
});

// Listen for skip waiting message from client
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Periodic update check (every 6 hours)
setInterval(() => {
  self.registration.update().catch(err => {
    console.log('Periodic update check failed:', err);
  });
}, 6 * 60 * 60 * 1000);

// Helper: cache-first for static requests
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  const cache = await caches.open(APP_SHELL_CACHE);
  cache.put(request, response.clone());
  return response;
}

// Helper: network-first for API GETs
async function networkFirstApi(request) {
  try {
    const response = await fetch(request);
    const cache = await caches.open(API_CACHE);
    cache.put(request, response.clone());
    return response;
  } catch (_) {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw _;
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle GET
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Bypass dev-server HMR/SSE and websocket-like endpoints to prevent reload loops in development
  const acceptHeader = request.headers.get('accept') || '';
  if (acceptHeader.includes('text/event-stream')) return; // e.g., Vite/webpack HMR EventSource
  if (
    url.pathname.includes('sockjs') ||
    url.pathname.includes('webpack') ||
    url.pathname.includes('hot-update') ||
    url.pathname.includes('__vite') ||
    url.pathname.includes('vite') ||
    url.pathname.includes('hmr') ||
    url.pathname === '/ws'
  ) {
    return;
  }

  // Handle navigation requests: network-first for the real request, fallback to cached index.html when offline
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(request);
          try {
            const copy = res.clone();
            const cache = await caches.open(APP_SHELL_CACHE);
            await cache.put('/index.html', copy);
          } catch (_) {}
          return res;
        } catch (_) {
          const cached = await caches.match('/index.html');
          if (cached) return cached;
          // Final fallback: basic Response
          return new Response('Offline', { status: 503, statusText: 'Offline' });
        }
      })()
    );
    return;
  }

  // API GETs: network-first
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstApi(request));
    return;
  }
  
  // TTS cached audio files: cache-first so replay works offline after first play
  if (url.pathname.startsWith('/tts-cache/')) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Static assets: cache-first
  event.respondWith(cacheFirst(request));
});


