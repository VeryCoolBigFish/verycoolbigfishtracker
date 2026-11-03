// Service worker: precaches every app file so the tracker runs fully offline after one install.
// Bump VERSION when any file changes; the app asks before switching to the new version.
const VERSION = '0.2.1';
const CACHE = 'ht-' + VERSION;
const FILES = [
  './', 'index.html', 'manifest.webmanifest',
  'app.css', 'charts.css', 'screens.css', 'report.css',
  'util.js', 'db.js', 'crypto.js', 'content.js', 'scoring.js', 'model.js', 'sync.js', 'cycle.js',
  'insights.js', 'ui.js', 'forms.js', 'charts.js', 'mind.js', 'body.js', 'food.js', 'today.js',
  'report.js', 'settings.js', 'feedback.js', 'app.js',
  'nunito-latin.woff2', 'nunito-latin-ext.woff2',
  'icon.svg', 'icon-180.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)));
});

// The page posts this when the user agrees to update.
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'skipWaiting') self.skipWaiting();
  if (e.data && e.data.type === 'version' && e.ports[0]) e.ports[0].postMessage(VERSION);
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('ht-') && k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

// Same-origin GETs only, cache first. Nothing cross-origin is ever cached or fetched by the app.
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try {
      return await fetch(req);
    } catch (err) {
      if (req.mode === 'navigate') return (await cache.match('index.html')) || Response.error();
      throw err;
    }
  })());
});
