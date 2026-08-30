/* clevia — Service Worker
   Macht die App offline nutzbar. clevias Bewertung (KURIERT_DB + Muster),
   die Guides und der Offline-Coach (kiCoachEngine) laufen komplett im
   Browser — der Service Worker sorgt dafür, dass die App-Shell auch ohne
   Internet startet. Genau der Vorteil, den Yuka & Co. nicht haben.

   Strategie:
   - App-Seite (Navigation): Network-first → nach Deploy sofort neue Version,
     bei Offline die zuletzt gecachte App als Fallback.
   - Statische Ressourcen (Icons, Manifest, CDN-Skripte): Stale-while-revalidate.
   - Live-Daten (Supabase, Analytics): nie cachen (immer frisch/übersprungen).

   Bei jedem Deploy CACHE_VERSION hochzählen. */

const CACHE_VERSION = "clevia-v2-20260828";
// App-Shell: die Wurzel (=App) + statische Assets. Die App-HTML selbst wird
// über die Navigation gecacht (siehe fetch-Handler), da sie dynamisch mit
// Runtime-Config ausgeliefert wird.
const APP_SHELL = [
  "./",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-192.png",
  "./icons/icon-maskable-512.png",
];

/* Diese Hosts nie cachen: Live-Daten müssen immer frisch sein. */
const NETWORK_ONLY = ["supabase.co", "umami", "api.anthropic.com", "api.cloudflare.com"];

self.addEventListener("install", (e) => {
  // App-Shell vorladen. Einzelne Fehlschläge (z.B. fehlendes Icon) dürfen den
  // Install NICHT abbrechen — sonst bleibt die App ganz ohne Offline-Fähigkeit.
  e.waitUntil(
    caches.open(CACHE_VERSION).then((c) =>
      Promise.allSettled(APP_SHELL.map((u) => c.add(u)))
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  let url;
  try { url = new URL(req.url); } catch { return; }
  if (NETWORK_ONLY.some((h) => url.hostname.includes(h))) return; // nie cachen

  /* App-Navigation: Network-first, gecachte App als Offline-Fallback.
     Die frisch geladene App enthält bereits window.__CLEVIA_CONFIG__
     (vom Server injiziert), daher ist die gecachte Kopie offline gültig. */
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put("./", copy));
          return res;
        })
        .catch(() => caches.match("./").then((r) => r || caches.match(req)))
    );
    return;
  }

  /* Statische Ressourcen: Stale-while-revalidate (schnell aus Cache, im
     Hintergrund aktualisieren). */
  e.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});

/* ==== Push (Erinnerungen bei geschlossener App) ==== */
self.addEventListener("push", (e) => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch (_) { data = { body: e.data && e.data.text() }; }
  const title = data.title || "clevia";
  const options = {
    body: data.body || "",
    icon: "./icons/icon-192.png",
    badge: "./icons/icon-192.png",
    data: { url: data.url || "./" },
    tag: data.tag || "clevia-reminder",
    renotify: false,
  };
  e.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const target = (e.notification.data && e.notification.data.url) || "./";
  e.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ("focus" in c) { c.navigate(target); return c.focus(); }
      }
      return clients.openWindow(target);
    })
  );
});
