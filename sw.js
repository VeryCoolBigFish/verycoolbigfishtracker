// Service worker: precaches every app file so the tracker runs fully offline after one install.
// Bump VERSION when any file changes; the app asks before switching to the new version.
const VERSION = '0.2.1';
const CACHE = 'ht-' + VERSION;
const FILES = [
  './', 'index.html', 'manifest.webmanifest',
  'css/app.css', 'css/charts.css', 'css/screens.css', 'css/report.css',
  'js/util.js', 'js/db.js', 'js/crypto.js', 'js/content.js', 'js/scoring.js', 'js/model.js', 'js/sync.js', 'js/cycle.js',
  'js/insights.js', 'js/ui.js', 'js/forms.js', 'js/charts.js', 'js/mind.js', 'js/body.js', 'js/food.js', 'js/today.js',
  'js/report.js', 'js/settings.js', 'js/feedback.js', 'js/app.js',
  'fonts/nunito-latin.woff2', 'fonts/nunito-latin-ext.woff2',
  'icons/icon.svg', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png',
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
