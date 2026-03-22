const CACHE = "song-v1";

// Static assets to cache on install
const PRECACHE = [
  "/",
  "/index.html",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(PRECACHE))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  // Delete old caches
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);

  // Never intercept API calls or YouTube — always go to network
  if (
    url.hostname.includes("render.com") ||
    url.hostname.includes("youtube") ||
    url.hostname.includes("ytimg") ||
    url.hostname.includes("googleapis") ||
    url.pathname.startsWith("/api/")
  ) {
    return;
  }

  // For navigation requests (page loads) — network first, fallback to cached /index.html
  if (e.request.mode === "navigate") {
    e.respondWith(
      fetch(e.request).catch(() =>
        caches.match("/index.html")
      )
    );
    return;
  }

  // For static assets — cache first, network fallback
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        // Cache JS/CSS/fonts
        if (
          res.ok &&
          (e.request.url.includes(".js") ||
           e.request.url.includes(".css") ||
           e.request.url.includes(".woff") ||
           e.request.url.includes(".png") ||
           e.request.url.includes(".svg"))
        ) {
          const clone = res.clone();
          caches.open(CACHE).then(cache => cache.put(e.request, clone));
        }
        return res;
      });
    })
  );
});