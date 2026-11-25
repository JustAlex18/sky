/**
 * Sky — Bullet Journal Digital
 * sw.js — Service Worker básico para funcionamiento offline / PWA
 */

const CACHE_NAME   = 'sky-cache-v7';
const ASSETS_CACHE = 'sky-assets-v7';

/* Archivos a cachear en el install */
const STATIC_ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  // Google Fonts (si hay conexión, se cachean automáticamente en runtime)
];

/* ─── Install ────────────────────────────────────────────── */
self.addEventListener('install', event => {
  console.log('[Sky SW] Instalando…');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Sky SW] Pre-cacheando assets estáticos');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

/* ─── Activate ───────────────────────────────────────────── */
self.addEventListener('activate', event => {
  console.log('[Sky SW] Activando…');
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME && k !== ASSETS_CACHE)
          .map(k => {
            console.log('[Sky SW] Eliminando caché obsoleta:', k);
            return caches.delete(k);
          })
      )
    ).then(() => self.clients.claim())
  );
});

/* ─── Fetch — Estrategia: Cache First con Network Fallback ─ */
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Sólo manejar peticiones GET al mismo origen (o fonts de Google)
  if (event.request.method !== 'GET') return;

  const isGoogleFont = url.hostname.includes('fonts.googleapis.com') ||
                       url.hostname.includes('fonts.gstatic.com');

  if (!url.origin.includes(self.location.origin) && !isGoogleFont) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) {
        // Revalidar en background (stale-while-revalidate para assets)
        if (isGoogleFont) {
          fetch(event.request)
            .then(response => {
              caches.open(ASSETS_CACHE)
                .then(cache => cache.put(event.request, response.clone()));
            })
            .catch(() => {/* sin conexión, OK */});
        }
        return cached;
      }

      // No está en caché → buscar en red
      return fetch(event.request)
        .then(response => {
          if (!response || response.status !== 200 || response.type === 'opaque') {
            return response;
          }

          const cacheKey = isGoogleFont ? ASSETS_CACHE : CACHE_NAME;
          const clone = response.clone();
          caches.open(cacheKey).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => {
          // Offline fallback: devolver index.html para navegación
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
    })
  );
});

/* ─── Message: forzar actualización ─────────────────────── */
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
