const CACHE_NAME = 'story-cache-v1';

// URLs to cache - sesuaikan dengan struktur project
const urlsToCache = [
  './',
  './index.html',
  './src/styles/styles.css',
  './src/scripts/index.js',
  './manifest.json',
  './icons/icon-96x96.png',
  './icons/icon-192x192.png',
  './icons/icon-512x512.png',
  // External CDN resources
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js',
];

// Fungsi untuk check apakah URL valid sebelum caching
async function cacheValidUrls(cache, urls) {
  const results = await Promise.allSettled(
    urls.map(async (url) => {
      try {
        // Test fetch dulu sebelum add ke cache
        const response = await fetch(url);
        if (response.ok) {
          await cache.add(url);
          console.log(`[SW] Cached: ${url}`);
          return url;
        } else {
          console.warn(`[SW] Failed to cache (${response.status}): ${url}`);
          return null;
        }
      } catch (error) {
        console.warn(`[SW] Error caching ${url}:`, error.message);
        return null;
      }
    })
  );
  
  const successful = results
    .filter(result => result.status === 'fulfilled' && result.value)
    .map(result => result.value);
  
  console.log(`[SW] Successfully cached ${successful.length}/${urls.length} files`);
  return successful;
}

self.addEventListener('install', event => {
  console.log('[SW] Installing');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Cache opened');
        return cacheValidUrls(cache, urlsToCache);
      })
      .then(() => {
        console.log('[SW] All valid files cached');
        // Force activation
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('[SW] Cache installation failed:', error);
        // Jangan gagal install karena beberapa file tidak bisa di-cache
        return Promise.resolve();
      })
  );
});

self.addEventListener('activate', event => {
  console.log('[SW] Activated');
  
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then(keys =>
        Promise.all(
          keys.map(key => {
            if (key !== CACHE_NAME) {
              console.log('[SW] Deleting old cache:', key);
              return caches.delete(key);
            }
          })
        )
      ),
      // Take control of all clients
      self.clients.claim()
    ])
  );
});

self.addEventListener('fetch', event => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip chrome-extension and other non-http requests
  if (!event.request.url.startsWith('http')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Return cached version if available
        if (response) {
          console.log('[SW] Cache hit:', event.request.url);
          return response;
        }

        // Otherwise fetch from network
        console.log('[SW] Network fetch:', event.request.url);
        return fetch(event.request)
          .then(response => {
            // Don't cache non-successful responses
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Clone the response as it can only be consumed once
            const responseToCache = response.clone();

            // Add to cache for future requests
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              })
              .catch(error => {
                console.warn('[SW] Failed to cache response:', error);
              });

            return response;
          })
          .catch(error => {
            console.error('[SW] Fetch failed:', error);
            
            // Return a fallback response for navigation requests
            if (event.request.mode === 'navigate') {
              return caches.match('./index.html');
            }
            
            throw error;
          });
      })
  );
});

// Handle messages from main thread
self.addEventListener('message', event => {
  console.log('[SW] Message received:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Notify clients when new SW is ready
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'CLIENT_CHECK_UPDATE') {
    event.ports[0].postMessage({
      type: 'SW_UPDATE_READY'
    });
  }
});