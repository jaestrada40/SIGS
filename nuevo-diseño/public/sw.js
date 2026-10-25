// Service worker de la pantalla de jornada: solo guarda lo necesario para abrir /jornada sin señal.
// No toca la API ni ninguna otra página, y no guarda datos de personas (eso vive cifrado en IndexedDB).
const CACHE = "sisg-jornada-v1";
const PAGINA = "/jornada";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
  await self.clients.claim();
})()));

self.addEventListener("fetch", (e) => {
  const r = e.request;
  if (r.method !== "GET") return;
  const u = new URL(r.url);
  if (u.origin !== self.location.origin) return;

  // La página: con señal, la más reciente; sin señal, la última guardada.
  if (u.pathname === PAGINA) {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const res = await fetch(r);
        if (res.ok) await cache.put(PAGINA, res.clone());
        return res;
      } catch {
        return (await cache.match(PAGINA)) ?? Response.error();
      }
    })());
    return;
  }

  // Archivos con huella en el nombre: nunca cambian, así que primero la copia local.
  if (u.pathname.startsWith("/assets/")) {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const guardado = await cache.match(r);
      if (guardado) return guardado;
      const res = await fetch(r);
      if (res.ok) await cache.put(r, res.clone());
      return res;
    })());
  }
});
