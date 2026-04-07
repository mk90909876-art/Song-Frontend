const CACHE = "song-v1";
const PRECACHE = ["/", "/index.html"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);

  // Never intercept: API, YouTube, Supabase, external
  if (
    url.hostname.includes("render.com") ||
    url.hostname.includes("onrender.com") ||
    url.hostname.includes("youtube") ||
    url.hostname.includes("ytimg") ||
    url.hostname.includes("googlevideo") ||
    url.hostname.includes("googleapis") ||
    url.hostname.includes("supabase.co") ||
    url.hostname.includes("saavncdn.com") ||
    url.hostname.includes("jiosaavn") ||
    url.hostname.includes("workers.dev") ||
    url.pathname.startsWith("/api/")
  ) return;

  // Navigate → network first, fallback to index.html (SPA routing)
  if (e.request.mode === "navigate") {
    e.respondWith(
      fetch(e.request).catch(() => caches.match("/index.html"))
    );
    return;
  }

  // Static assets → cache first
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res.ok) {
          const ext = url.pathname.split(".").pop();
          if (["js", "css", "woff", "woff2", "ttf", "png", "svg", "ico", "webp"].includes(ext)) {
            const toCache = res.clone(); // clone BEFORE returning
            caches.open(CACHE).then(c => c.put(e.request, toCache));
          }
        }
        return res;
      }).catch(() => Response.error());
    })
  );
});