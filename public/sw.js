const CACHE_NAME = 'story-cache-v1';
const urlsToCache = [
  '/',
  'index.html',
  'styles/styles.css',
  'src/scripts/index.js',
  'manifest.json',
  'icons/icon-96x96.png',
  'icons/icon-192x192.png',
  'icons/icon-512x512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js',
];

self.addEventListener('install', event => {
  console.log('[SW] Installing');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(urlsToCache);
    })
  );
});

self.addEventListener('activate', event => {
  console.log('[SW] Activated');
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(key => {
        if (key !== CACHE_NAME) {
          return caches.delete(key);
        }
      }))
    )
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response =>
      response || fetch(event.request)
    )
  );
});
