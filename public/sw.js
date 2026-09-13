// Service worker de la PWA.
// Estrategia:
//  - Navegaciones (HTML): network-first, con fallback al app shell cacheado
//    (permite abrir la app sin conexion).
//  - Assets estaticos del mismo origen (JS/CSS/iconos con hash de Vite):
//    stale-while-revalidate.
//  - Peticiones a Supabase u otros origenes (API/Auth): NUNCA se cachean;
//    pasan directo a la red.
const CACHE = 'finanzas-v1';
const APP_SHELL = ['/', '/index.html', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Solo GET; el resto (POST a Supabase, etc.) pasa directo.
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Distinto origen (Supabase API/Auth, CDNs): no interceptar.
  if (url.origin !== self.location.origin) return;

  // Navegaciones -> network-first con fallback al shell.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('/index.html', copy));
          return res;
        })
        .catch(() => caches.match('/index.html').then((r) => r || caches.match('/')))
    );
    return;
  }

  // Assets mismos-origen -> stale-while-revalidate.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
