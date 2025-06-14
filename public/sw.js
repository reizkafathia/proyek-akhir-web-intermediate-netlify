const CACHE_NAME = 'story-cache-v4';
const OFFLINE_URL = '/offline.html';
const API_CACHE_NAME = 'api-cache-v2';

// Precached resources
const PRECACHE_URLS = [
  '/',
  '/index.html',
  OFFLINE_URL,
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/src/styles/styles.css',
  '/src/scripts/app.js',
  '/src/utils/indexedDB.js'
];

// API endpoints to cache
const API_ENDPOINTS = [
  '/api/stories',
  '/api/login'
];

// ==================== INSTALL ==================== //
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching essential resources');
        return cache.addAll(PRECACHE_URLS);
      })
      .then(() => self.skipWaiting())
  );
});

// ==================== ACTIVATE ==================== //
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (![CACHE_NAME, API_CACHE_NAME].includes(cacheName)) {
            console.log('[SW] Removing old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// ==================== FETCH HANDLER ==================== //
self.addEventListener('fetch', (event) => {
  const { request } = event;
  
  // Skip non-GET requests and non-http requests
  if (request.method !== 'GET' || !request.url.startsWith('http')) return;

  // Handle navigation requests
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE_URL))
    );
    return;
  }

  // Handle API requests
  if (isApiRequest(request)) {
    event.respondWith(handleApiRequest(request));
    return;
  }

  // Handle static assets
  event.respondWith(handleAssetRequest(request));
});

// ==================== API REQUEST HANDLER ==================== //
async function handleApiRequest(request) {
  try {
    // Try network first
    const networkResponse = await fetch(request);
    
    // Cache successful API responses
    if (networkResponse.ok) {
      const clone = networkResponse.clone();
      caches.open(API_CACHE_NAME)
        .then(cache => cache.put(request, clone));
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[SW] Network failed, checking cache for:', request.url);
    
    // Check cache for API response
    const cachedResponse = await caches.match(request);
    if (cachedResponse) return cachedResponse;
    
    // For POST requests, store in IndexedDB for later sync
    if (request.method === 'POST') {
      const requestData = await request.clone().json();
      return handleOfflinePost(request.url, requestData);
    }
    
    return createOfflineResponse();
  }
}

// ==================== ASSET REQUEST HANDLER ==================== //
async function handleAssetRequest(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    console.log('[SW] Cache hit:', request.url);
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);
    
    // Cache dynamic resources
    if (networkResponse.ok) {
      const clone = networkResponse.clone();
      caches.open(CACHE_NAME)
        .then(cache => cache.put(request, clone));
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[SW] Network failed for:', request.url);
    return Response.error();
  }
}

// ==================== OFFLINE POST HANDLER ==================== //
async function handleOfflinePost(url, data) {
  console.log('[SW] Storing offline data for:', url);
  
  // Store in IndexedDB
  const db = await openIDB();
  const tx = db.transaction('pendingRequests', 'readwrite');
  const store = tx.objectStore('pendingRequests');
  
  await store.add({
    url,
    data,
    timestamp: Date.now()
  });
  
  return new Response(JSON.stringify({
    success: true,
    message: "Stored offline. Will sync when online.",
    offline: true
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

// ==================== BACKGROUND SYNC ==================== //
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-pending') {
    console.log('[SW] Background sync triggered');
    event.waitUntil(syncPendingRequests());
  }
});

async function syncPendingRequests() {
  console.log('[SW] Syncing pending requests...');
  const db = await openIDB();
  const tx = db.transaction('pendingRequests', 'readwrite');
  const store = tx.objectStore('pendingRequests');
  const requests = await store.getAll();

  const results = [];
  
  for (const request of requests) {
    try {
      const response = await fetch(request.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request.data)
      });
      
      if (response.ok) {
        await store.delete(request.timestamp);
        results.push({
          url: request.url,
          status: 'success'
        });
      }
    } catch (error) {
      results.push({
        url: request.url,
        status: 'failed',
        error: error.message
      });
    }
  }
  
  if (results.some(r => r.status === 'success')) {
    await self.registration.showNotification('Sync Complete', {
      body: `Synced ${results.filter(r => r.status === 'success').length} items`,
      icon: '/icons/icon-192x192.png'
    });
  }
  
  return results;
}

// ==================== PUSH NOTIFICATIONS ==================== //
self.addEventListener('push', (event) => {
  const payload = event.data?.json() || {
    title: 'New Story',
    body: 'A new story has been published!'
  };
  
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-96x96.png',
      data: { url: payload.url || '/' },
      vibrate: [200, 100, 200]
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' })
      .then((clients) => {
        const targetUrl = event.notification.data.url;
        const client = clients.find(c => c.url === targetUrl);
        
        if (client) return client.focus();
        return clients.openWindow(targetUrl);
      })
  );
});

// ==================== INDEXEDDB HELPERS ==================== //
function openIDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('StoryShareDB', 2);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('pendingRequests')) {
        db.createObjectStore('pendingRequests', { keyPath: 'timestamp' });
      }
    };
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ==================== UTILITY FUNCTIONS ==================== //
function isApiRequest(request) {
  return API_ENDPOINTS.some(endpoint => 
    request.url.includes(endpoint)
  );
}

function createOfflineResponse() {
  return new Response(JSON.stringify({ 
    error: "You're offline",
    offline: true
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

// ==================== MESSAGE HANDLER ==================== //
self.addEventListener('message', (event) => {
  switch (event.data.type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
      
    case 'TRIGGER_SYNC':
      self.registration.sync.register('sync-pending')
        .then(() => console.log('[SW] Sync registered'))
        .catch(console.error);
      break;
  }
});