// LIFELINE service worker: lets the app open without a connection.
// Same-origin files are cached so the provider list and a saved plan work
// offline. Live data (NWS, FEMA, USGS, NHC, NASA, map tiles) is never cached:
// it must be current, so it simply fails offline and the app says so.
const CACHE = "lifeline-v1";
const SHELL = ["./", "./index.html", "./data/facilities.json", "./manifest.webmanifest", "./icons/icon-192.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

async function networkFirst(req, fallback) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(fallback ?? req, res.clone());
    return res;
  } catch {
    return (await cache.match(fallback ?? req)) ?? Response.error();
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;
  if (req.mode === "navigate") e.respondWith(networkFirst(req, "./index.html"));
  else if (url.pathname.endsWith("/data/facilities.json")) e.respondWith(networkFirst(req));
  else e.respondWith(cacheFirst(req)); // hashed build assets and images never change in place
});
