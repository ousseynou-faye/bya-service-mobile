const scope = self.registration.scope;
const prefix = `bya-mobile:${scope}:`;
const cacheName = prefix + "2.7.1";
const landing = new URL("index.html", scope).href;
const files = ["index.html", "manifest.webmanifest", "assets/accueil.webp", "assets/favicon.svg",
  "assets/icon-192.png", "assets/icon-512.png", "ui/app.js", "ui/theme.js", "ui/styles.css", "ui/home.css",
  "ui/theme.css", "src/start.js", "src/model.js", "src/reports.js", "src/storage.js", "src/backup.js", "src/drawer.js", "src/outreach.js", "src/local-api.js"];
const urls = new Set(files.map(file => new URL(file, scope).href));

self.addEventListener("install", event => {
  event.waitUntil(caches.open(cacheName).then(cache => cache.addAll([...urls].map(url => new Request(url, {cache: "reload"})))));
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const old = (await caches.keys()).filter(key => key.startsWith(prefix) && key !== cacheName);
    await Promise.all(old.map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const {request} = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== new URL(scope).origin) return;
  url.search = "";
  const target = request.mode === "navigate" && (url.href === scope || url.href === landing) ? landing : url.href;
  if (!urls.has(target)) return;
  event.respondWith(caches.open(cacheName).then(async cache => (await cache.match(target)) ?? fetch(request)));
});
