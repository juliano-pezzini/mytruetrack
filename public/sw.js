/// <reference lib="webworker" />

const CACHE_NAME = 'mytruetrack-v3';

// Relative to the service worker URL so a project-site base (`/<repo>/`) works.
// Only stable public files belong here. Vite emits hashed JS/CSS/WASM under
// `assets/`; those are filled in by the fetch handler after the first successful GET.
// A missing precache URL fails the entire install (`cache.addAll`).
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
];

const sw = /** @type {ServiceWorkerGlobalScope} */ (/** @type {unknown} */ (self));

sw.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)));
  sw.skipWaiting();
});

sw.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))),
      ),
  );
  sw.clients.claim();
});

sw.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Only cache same-origin requests (skip API calls to WebDAV, Google Drive, etc.)
  if (url.origin !== sw.location.origin) return;

  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request).then((response) => {
        // Don't cache error responses
        if (!response.ok) return response;

        // Cache successful responses for static assets
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, clone);
        });

        return response;
      });
    }),
  );
});
