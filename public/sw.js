const CONFIG = {
  VERSION: "v6",
  CACHE_NAME: "story-cache-v6",
  API_CACHE_NAME: "api-cache-v4",
  OFFLINE_URL: "/offline.html",
  API_BASE_URL: "https://story-api.dicoding.dev/v1",
  PRECACHE_URLS: [
    "/offline.html",
    "/icons/apple-touch-icon.png",
    "/icons/icon-96x96.png",
    "/icons/icon-192x192.png",
    "/icons/icon-512x512.png",
    "/icons/icon.ico",
    "/icons/icon.svg",
  ],
  PRODUCTION_ONLY_URLS: ["/", "/index.html", "/manifest.json"],
  OPTIONAL_FILES: [
    "/manifest.json",
    "/icons/apple-touch-icon.png",
    "/icons/icon.ico",
    "/icons/icon.svg",
  ],
  DEV_ASSETS: [
    "@vite/client",
    "src/scripts/",
    "src/styles/",
    "?import",
    "node_modules",
    ".js?v=",
    ".css?v=",
    "__vite_ping",
  ],
  IGNORED_FILES: ["/favicon.ico"],
  get isDevelopment() {
    return (
      location.hostname === "localhost" || location.hostname === "127.0.0.1"
    );
  },
};

// ========== CACHE MANAGER ==========
const cacheManager = {
  async install() {
    const cache = await caches.open(CONFIG.CACHE_NAME);
    await cacheManager.cacheFile(cache, CONFIG.OFFLINE_URL);

    const coreFiles = CONFIG.PRECACHE_URLS.filter(
      (url) => url !== CONFIG.OFFLINE_URL
    );
    const allFiles = CONFIG.isDevelopment
      ? coreFiles
      : [...coreFiles, ...CONFIG.PRODUCTION_ONLY_URLS];

    await cacheManager.cacheFiles(cache, allFiles);
    console.log("[SW] Pre-caching completed");
    return self.skipWaiting();
  },

  async activate() {
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames
        .filter(
          (name) => name !== CONFIG.CACHE_NAME && name !== CONFIG.API_CACHE_NAME
        )
        .map((name) => {
          console.log("[SW] Deleting old cache:", name);
          return caches.delete(name);
        })
    );
    await self.clients.claim();
    console.log("[SW] Service worker activated");
  },

  async cacheFile(cache, url) {
    try {
      if (CONFIG.OPTIONAL_FILES.includes(url)) {
        const response = await fetch(url, { method: "HEAD" });
        if (!response.ok) {
          console.log(`[SW] Skipping optional file: ${url}`);
          return;
        }
      }
      await cache.add(url);
      console.log(`[SW] Cached: ${url}`);
    } catch (error) {
      if (CONFIG.OPTIONAL_FILES.includes(url)) {
        console.log(`[SW] Skipping optional file: ${url}`);
      } else {
        console.warn(`[SW] Failed to cache ${url}:`, error.message);
      }
    }
  },

  async cacheFiles(cache, urls) {
    for (const url of urls) {
      await cacheManager.cacheFile(cache, url);
    }
  },
};

// ========== NOTIFICATION MANAGER ==========
const notificationManager = {
  async handlePush(event) {
    let payload = { title: "Notifikasi", body: "Pesan baru diterima." };
    try {
      if (event.data) payload = event.data.json();
    } catch (err) {
      console.warn("[SW] Gagal parsing push payload", err);
    }

    const options = {
      body: payload.body,
      icon: "/icons/icon-192x192.png",
      badge: "/icons/icon-192x192.png",
      data: { url: payload.url || "/" },
    };

    return self.registration.showNotification(payload.title, options);
  },

  async handleClick(event) {
    event.notification.close();
    const urlToOpen = event.notification.data?.url || "/";
    const allClients = await clients.matchAll({ type: "window" });

    for (const client of allClients) {
      if (client.url === urlToOpen && "focus" in client) {
        return client.focus();
      }
    }

    if (clients.openWindow) {
      return clients.openWindow(urlToOpen);
    }
  },
  
  async handleSubscription(subscription) {
    try {
      const token = await this.getStoredToken();
      const response = await fetch(`${CONFIG.API_BASE_URL}/subscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          subscription: subscription,
          userAgent: navigator.userAgent
        })
      });
      
      if (response.ok) {
        console.log('[SW] Push subscription saved to server');
      }
    } catch (error) {
      console.warn('[SW] Failed to save subscription:', error);
    }
  },

  async getStoredToken() {
    return new Promise((resolve) => {
      self.clients.matchAll().then(clients => {
        if (clients.length > 0) {
          clients[0].postMessage({ type: 'GET_AUTH_TOKEN' });
        }
        resolve(null);
      });
    });
  }
};

// ========== REQUEST HANDLER ==========
const requestHandler = {
  async handle(request) {
    if (request.method !== "GET" || !request.url.startsWith("http")) {
      return fetch(request);
    }

    const url = new URL(request.url);
    if (shouldSkipRequest(url, request)) {
      return fetch(request);
    }

    if (request.mode === "navigate") {
      return navigationHandler.handle(request);
    }

    if (isApiRequest(request)) {
      return apiHandler.handle(request);
    }

    if (!CONFIG.isDevelopment || !isDevelopmentAsset(request.url)) {
      return assetHandler.handle(request);
    }

    return fetch(request);
  },
};

function shouldSkipRequest(url, request) {
  return (
    url.protocol.startsWith("chrome-extension") ||
    CONFIG.IGNORED_FILES.some((ignored) => request.url.endsWith(ignored)) ||
    (CONFIG.isDevelopment && isDevelopmentAsset(request.url))
  );
}

function isDevelopmentAsset(url) {
  return CONFIG.DEV_ASSETS.some((asset) => url.includes(asset));
}

function isApiRequest(request) {
  return (
    request.url.includes(CONFIG.API_BASE_URL) ||
    request.url.includes("/api/") ||
    request.url.includes("story-api.dicoding.dev")
  );
}

// ========== HANDLERS ==========
const navigationHandler = {
  async handle(request) {
    try {
      const networkResponse = await fetch(request);
      if (!CONFIG.isDevelopment && networkResponse.ok) {
        const cache = await caches.open(CONFIG.CACHE_NAME);
        cache.put(request, networkResponse.clone()).catch(console.warn);
      }
      return networkResponse;
    } catch (error) {
      return navigationHandler.handleOfflineNavigation(request);
    }
  },

  async handleOfflineNavigation(request) {
    const cache = await caches.open(CONFIG.CACHE_NAME);
    let cached = await cache.match(request.url);
    if (cached) return cached;

    const urlWithoutQuery = request.url.split("?")[0];
    cached = await cache.match(urlWithoutQuery);
    if (cached) return cached;

    if (request.url.endsWith("/") || request.url.includes("index")) {
      cached = (await cache.match("/index.html")) || (await cache.match("/"));
      if (cached) return cached;
    }

    return cache.match(CONFIG.OFFLINE_URL) || createFallbackOfflinePage();
  },
};

function createFallbackOfflinePage() {
  return new Response(
    '<html><body><h1>Offline</h1><p>No connection</p><button onclick="location.reload()">Retry</button></body></html>',
    { status: 200, headers: { "Content-Type": "text/html" } }
  );
}

const apiHandler = {
  async handle(request) {
    const cache = await caches.open(CONFIG.API_CACHE_NAME);
    try {
      const networkResponse = await fetch(request);
      if (networkResponse.ok) {
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    } catch (error) {
      return cache.match(request);
    }
  },
};

const assetHandler = {
  async handle(request) {
    const cache = await caches.open(CONFIG.CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) return cached;
    try {
      const networkResponse = await fetch(request);
      if (networkResponse.ok) {
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    } catch {
      return cached;
    }
  },
};

// ========== SYNC PLACEHOLDER ==========
const offlineManager = {
  async syncPendingRequests() {
    console.log("[SW] Syncing pending requests (placeholder)");
  },
  triggerSync(event) {
    self.registration.sync.register("background-sync").catch(console.error);
  },
};

// ========== EVENTS ==========
self.addEventListener("install", (event) => {
  console.log(`[SW] Installing service worker v${CONFIG.VERSION}...`);
  event.waitUntil(cacheManager.install());
});

self.addEventListener("activate", (event) => {
  console.log("[SW] Activating service worker...");
  event.waitUntil(cacheManager.activate());
});

self.addEventListener("fetch", (event) => {
  event.respondWith(requestHandler.handle(event.request));
});

self.addEventListener("sync", (event) => {
  if (event.tag === "background-sync") {
    event.waitUntil(offlineManager.syncPendingRequests());
  }
});

self.addEventListener("push", (event) => {
  event.waitUntil(notificationManager.handlePush(event));
});

self.addEventListener("notificationclick", (event) => {
  event.waitUntil(notificationManager.handleClick(event));
});

self.addEventListener("message", (event) => {
  switch (event.data?.type) {
    case "SKIP_WAITING":
      self.skipWaiting();
      break;
    case "TRIGGER_SYNC":
      offlineManager.triggerSync(event);
      break;
    case "GET_VERSION":
      event.ports[0]?.postMessage({ version: CONFIG.CACHE_NAME });
      break;
  }
});

