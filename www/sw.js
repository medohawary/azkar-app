const V = "azkar-v2";
const FILES = ["./", "index.html", "style.css", "app.js", "data.js", "icon.svg", "icon-192.png", "icon-512.png", "manifest.webmanifest"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(V).then((c) => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k))))); self.clients.claim(); });
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request).then((res) => {
    const copy = res.clone(); caches.open(V).then((c) => c.put(e.request, copy)); return res;
  }).catch(() => caches.match("index.html"))));
});
