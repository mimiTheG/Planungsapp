// Service Worker: hält die App offline verfügbar.
// Mit Internet wird immer die neueste Version geladen (am Browser-Cache vorbei), ohne Internet die
// zuletzt gespeicherte. Bei Änderungen an der Dateiliste VERSION erhöhen.

const VERSION = 'v32';
const CACHE = `planungsapp-${VERSION}`;
const FILES = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/style.css',
  'js/app.js',
  'js/calendar.js',
  'js/color-chooser.js',
  'js/dates.js',
  'js/datetime-picker.js',
  'js/event-drag.js',
  'js/matrix-texts.js',
  'js/more.js',
  'js/now.js',
  'js/player.js',
  'js/parent-picker.js',
  'js/reorder.js',
  'js/repeat-fields.js',
  'js/repeat.js',
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
  // cache: 'reload' umgeht den HTTP-Cache, damit keine veralteten Dateien vorab gespeichert werden.
  event.waitUntil(caches.open(CACHE)
    .then((cache) => cache.addAll(FILES.map((file) => new Request(file, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Netz zuerst, bei fehlender Verbindung der gespeicherte Stand.
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const response = await fetch(request, { cache: 'no-cache' });
      if (response.ok) cache.put(request, response.clone());
      return response;
    } catch {
      const cached = await cache.match(request, { ignoreSearch: true });
      return cached || (request.mode === 'navigate' ? cache.match('index.html') : Response.error());
    }
  })());
});
