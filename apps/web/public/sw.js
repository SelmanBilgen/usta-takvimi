const CACHE_NAME = "ustatakvimi-v2";
const ASSETS = ["/", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png"];
// Dev chunks have stable names, so caching them would serve stale code
const IS_LOCAL = ["localhost", "127.0.0.1"].includes(self.location.hostname);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => IS_LOCAL || key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

function cacheResponse(request, response) {
  if (response && response.status === 200 && response.type === "basic") {
    const cloned = response.clone();
    caches.open(CACHE_NAME).then((cache) => cache.put(request, cloned));
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Never intercept API calls or other origins
  if (IS_LOCAL || request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  // Hashed build assets never change, so the cache is always safe
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request).then((response) => cacheResponse(request, response)))
    );
    return;
  }

  // Pages, images and everything else: always try the network first so deploys show up immediately
  event.respondWith(
    fetch(request)
      .then((response) => cacheResponse(request, response))
      .catch(() => caches.match(request).then((cached) => cached || (request.mode === "navigate" ? caches.match("/") : Response.error())))
  );
});
