// Service Worker: hält die App offline verfügbar.
// Antwortet sofort aus dem Cache und lädt im Hintergrund die neueste Version nach
// (wirksam beim nächsten Öffnen). Bei Änderungen an der Dateiliste VERSION erhöhen.

const VERSION = 'v2';
const CACHE = `planungsapp-${VERSION}`;
const FILES = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/style.css',
  'js/app.js',
  'js/calendar.js',
  'js/dates.js',
  'js/matrix-texts.js',
  'js/more.js',
  'js/now.js',
  'js/samples.js',
  'js/schedule.js',
  'js/store.js',
  'js/tasks.js',
  'js/topic-picker.js',
  'js/ui.js',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== location.origin) return;
  event.respondWith(caches.open(CACHE).then(async (cache) => {
    const cached = await cache.match(event.request, { ignoreSearch: true });
    const network = fetch(event.request)
      .then((response) => {
        if (response.ok) cache.put(event.request, response.clone());
        return response;
      })
      .catch(() => cached);
    return cached || network;
  }));
});
