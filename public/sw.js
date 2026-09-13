// ----------------------------------------------------------------------------
// Service worker de la PWA: permite que la app ABRA SIN CONEXIÓN.
//
// Guarda en caché la "cáscara" de la app (index.html + JS + CSS + iconos) para
// que la interfaz cargue aunque no haya red. Los DATOS (cuentas, movimientos,
// KPIs) no se guardan aquí: eso lo hace la capa de datos (src/lib/store.js),
// que devuelve los últimos datos guardados cuando Supabase no responde.
//
// Estrategias:
//  - Navegación (abrir la app): red primero, con respaldo a la copia en caché.
//    Así, con red siempre se ve la versión nueva; sin red, la última guardada.
//  - Recursos (JS/CSS/iconos, con nombre versionado por Vite): se sirven del
//    caché al instante y se actualizan en segundo plano (stale-while-revalidate).
// ----------------------------------------------------------------------------
const CACHE = 'fp-shell-v1';
const PRECACHE = ['/', '/index.html', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // Best-effort: si algún recurso falla, no rompe la instalación.
      await Promise.allSettled(PRECACHE.map((u) => cache.add(u)));
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

function isCacheableResponse(res) {
  return res && res.status === 200 && res.type === 'basic';
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return; // nunca cachea escrituras

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Supabase/fuentes: a la red

  // Abrir la app (documento): red primero, respaldo a caché.
  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          if (isCacheableResponse(fresh)) {
            const cache = await caches.open(CACHE);
            cache.put('/', fresh.clone());
          }
          return fresh;
        } catch {
          const cache = await caches.open(CACHE);
          return (await cache.match('/')) || (await cache.match('/index.html')) || Response.error();
        }
      })()
    );
    return;
  }

  // Recursos: servir del caché y refrescar en segundo plano.
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(req);
      const network = fetch(req)
        .then((res) => {
          if (isCacheableResponse(res)) cache.put(req, res.clone());
          return res;
        })
        .catch(() => null);
      return cached || (await network) || Response.error();
    })()
  );
});
