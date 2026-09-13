// ----------------------------------------------------------------------------
// Service worker "kill-switch": desactiva el caché anterior.
//
// Durante el desarrollo, el caché offline provocaba que el iPhone siguiera
// mostrando versiones viejas. Este SW borra TODAS las cachés, se da de baja a
// sí mismo y recarga la app para que a partir de ahora todo venga siempre
// fresco desde la red (que de todos modos hace falta para Supabase).
//
// Más adelante se puede volver a agregar un service worker de caché bien
// versionado para soporte offline.
// ----------------------------------------------------------------------------
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Borra todas las cachES guardadas por versiones anteriores.
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      // Se da de baja para dejar de interceptar peticiones.
      await self.registration.unregister();
      // Recarga las pestañas abiertas para cargar la versión nueva.
      const clients = await self.clients.matchAll({ type: 'window' });
      for (const client of clients) {
        client.navigate(client.url);
      }
    })()
  );
});

// Sin manejador de 'fetch': todas las peticiones van directo a la red.
