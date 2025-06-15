// ==================== IMPORTS ====================
import { Router } from "./routes/routes.js";
import StoryDBManager from "../components/StoryDBManager.js";
import storyDB from "../utils/indexedDB.js";
import { VAPID_PUBLIC_KEY } from "./config.js";

// ==================== CONSTANTS ====================
const NOTIFICATION_ICON = "./icons/icon-192x192.png";
const NOTIFICATION_BADGE = "./icons/icon-96x96.png";
const API_BASE_URL = "https://story-api.dicoding.dev/v1";

// ==================== GLOBAL INITIALIZATION ====================
window.storyDB = storyDB;
let globalNotificationManager = null;

// ==================== NOTIFICATION MANAGER ====================
class NotificationManager {
  constructor() {
    this.isSupported = "Notification" in window;
    this.permission = Notification.permission;
    this.serviceWorkerRegistration = null;
  }

  async init() {
    if (!this.isSupported) {
      console.warn(
        "[NotificationManager] Browser does not support notifications"
      );
      return false;
    }

    try {
      if ("serviceWorker" in navigator) {
        this.serviceWorkerRegistration = await navigator.serviceWorker.ready;
        console.log("[NotificationManager] Service Worker ready");
      }
      return true;
    } catch (error) {
      console.error("[NotificationManager] Initialization failed:", error);
      return false;
    }
  }

  async requestPermission() {
    if (!this.isSupported) return false;
    if (this.permission === "granted") return true;

    try {
      this.permission = await Notification.requestPermission();
      if (this.permission === "granted") {
        await this.subscribeToPushNotifications();
        return true;
      }
      return false;
    } catch (error) {
      console.error(
        "[NotificationManager] Error requesting notification permission:",
        error
      );
      return false;
    }
  }

  async subscribeToPushNotifications() {
    if (!this.serviceWorkerRegistration || this.permission !== "granted") {
      return null;
    }

    try {
      let subscription =
        await this.serviceWorkerRegistration.pushManager.getSubscription();

      if (!subscription) {
        subscription = await this._createPushSubscription();
        await this._sendSubscriptionToServer(subscription);
      }

      return subscription;
    } catch (error) {
      console.error("[NotificationManager] Push subscription failed:", error);
      return null;
    }
  }

  async showNotification(title, options = {}) {
    if (!this._validateNotificationRequirements()) {
      return false;
    }

    try {
      await this.serviceWorkerRegistration.showNotification(title, {
        body: options.body || "",
        icon: options.icon || NOTIFICATION_ICON,
        badge: options.badge || NOTIFICATION_BADGE,
        data: options.data || { url: "/" },
        ...options,
      });
      return true;
    } catch (error) {
      console.error(
        "[NotificationManager] Failed to show notification:",
        error
      );
      return false;
    }
  }

  // ==================== PRIVATE METHODS ====================
  async _createPushSubscription() {
    const applicationServerKey = this._urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
    return await this.serviceWorkerRegistration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    });
  }

  async _sendSubscriptionToServer(subscription) {
    try {
      const response = await fetch(SUBSCRIPTION_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
        },
        body: JSON.stringify({
          subscription: subscription,
          userAgent: navigator.userAgent,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }

      console.log(
        "[NotificationManager] Subscription successfully saved to server"
      );
      return await response.json();
    } catch (error) {
      console.error(
        "[NotificationManager] Failed to send subscription:",
        error
      );
    }
  }

  _validateNotificationRequirements() {
    if (!this.isSupported) {
      console.warn("[NotificationManager] Notifications not supported");
      return false;
    }

    if (this.permission !== "granted") {
      console.warn("[NotificationManager] Notification permission not granted");
      return false;
    }

    if (!this.serviceWorkerRegistration) {
      console.warn("[NotificationManager] Service Worker not ready");
      return false;
    }

    return true;
  }

  _urlBase64ToUint8Array(base64String) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, "+")
      .replace(/_/g, "/");

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }
}

// ==================== SERVICE WORKER MANAGER ====================
class ServiceWorkerManager {
  constructor() {
    this.registration = null;
    this.isUpdateAvailable = false;
    this.init();
  }

  async init() {
    if ("serviceWorker" in navigator) {
      try {
        await this.registerServiceWorker();
        this.setupUpdateHandler();
      } catch (error) {
        console.error(
          "[ServiceWorkerManager] Service Worker setup failed:",
          error
        );
      }
    } else {
      console.warn("[ServiceWorkerManager] Service Worker not supported");
    }
  }

  async registerServiceWorker() {
    try {
      const registration = await navigator.serviceWorker.register("/sw.js", {
        scope: "/",
      });

      this.registration = registration;
      console.log(
        "[ServiceWorkerManager] Service Worker registered successfully"
      );

      // Listen for updates
      registration.addEventListener("updatefound", () => {
        const newWorker = registration.installing;

        newWorker.addEventListener("statechange", () => {
          if (
            newWorker.state === "installed" &&
            navigator.serviceWorker.controller
          ) {
            console.log("[ServiceWorkerManager] New service worker available");
            this.isUpdateAvailable = true;
            this.notifyUpdate();
          }
        });
      });

      // Handle controlled by service worker
      if (registration.active && !navigator.serviceWorker.controller) {
        window.location.reload();
      }

      return registration;
    } catch (error) {
      console.error(
        "[ServiceWorkerManager] Service Worker registration failed:",
        error
      );
      throw error;
    }
  }

  setupUpdateHandler() {
    // Listen for messages from service worker
    navigator.serviceWorker.addEventListener("message", (event) => {
      if (event.data && event.data.type === "SW_UPDATED") {
        this.handleServiceWorkerUpdate();
      }
    });

    // Check for updates every 10 minutes
    setInterval(() => {
      if (this.registration) {
        this.registration.update();
      }
    }, 10 * 60 * 1000);
  }

  notifyUpdate() {
    const event = new CustomEvent("sw-update-available");
    window.dispatchEvent(event);
  }

  async activateUpdate() {
    if (this.registration && this.registration.waiting) {
      this.registration.waiting.postMessage({ type: "SKIP_WAITING" });
      return true;
    }
    return false;
  }

  async triggerSync() {
    try {
      if (
        this.registration &&
        "sync" in window.ServiceWorkerRegistration.prototype
      ) {
        await this.registration.sync.register("background-sync");
        console.log("[ServiceWorkerManager] Background sync registered");
        return true;
      }
      return false;
    } catch (error) {
      console.error(
        "[ServiceWorkerManager] Background sync registration failed:",
        error
      );
      return false;
    }
  }
}

// ==================== NETWORK STATUS MANAGER ====================
class NetworkStatusManager {
  constructor() {
    this.isOnline = navigator.onLine;
    this.callbacks = [];
    this.init();
  }

  init() {
    window.addEventListener("online", () => {
      this.isOnline = true;
      this.notifyStatusChange(true);
      console.log("[NetworkStatusManager] Network: Online");
    });

    window.addEventListener("offline", () => {
      this.isOnline = false;
      this.notifyStatusChange(false);
      console.log("[NetworkStatusManager] Network: Offline");
    });
  }

  onStatusChange(callback) {
    this.callbacks.push(callback);
  }

  notifyStatusChange(isOnline) {
    this.callbacks.forEach((callback) => {
      try {
        callback(isOnline);
      } catch (error) {
        console.error(
          "[NetworkStatusManager] Network status callback error:",
          error
        );
      }
    });
  }

  getStatus() {
    return this.isOnline;
  }
}

// ==================== MAIN APP CLASS ====================
class App {
  constructor() {
    this.router = null;
    this.swManager = null;
    this.networkManager = null;
    this.isInitialized = false;
  }

  async init() {
    try {
      console.log("[App] 🚀 Initializing application...");

      // Create accessibility skip link
      this._createSkipToContentLink();

      // Initialize managers
      this.networkManager = new NetworkStatusManager();
      this.swManager = new ServiceWorkerManager();

      // Initialize core systems
      await this.initializeDatabase();
      await this.initializeRouter();
      await this._initializeNotificationSystem();

      // Setup handlers
      this.setupNetworkHandlers();
      this.loadPWAInstaller();

      this.isInitialized = true;
      console.log("[App] ✅ Application initialized successfully");
    } catch (error) {
      console.error("[App] Initialization failed:", error);
      this.handleInitializationError(error);
    }
  }

  // ==================== INITIALIZATION METHODS ====================
  async initializeDatabase() {
    try {
      await window.storyDB.init();
      console.log("[App] Database initialized");
    } catch (error) {
      console.error("[App] Database initialization failed:", error);
      throw error;
    }
  }

  async initializeRouter() {
    try {
      this.router = new Router();
      await this.router.init();
      console.log("[App] Router initialized");
    } catch (error) {
      console.error("[App] Router initialization failed:", error);
      throw error;
    }
  }

  _createSkipToContentLink() {
    const skipLink = document.createElement("a");
    skipLink.href = "#main-content";
    skipLink.textContent = "Skip to main content";
    skipLink.className = "skip-link";
    document.body.prepend(skipLink);
  }

  async _initializeNotificationSystem() {
    try {
      console.log("[App] 🔔 Initializing notification system...");

      globalNotificationManager = new NotificationManager();
      const initialized = await globalNotificationManager.init();

      if (initialized) {
        window.globalNotificationManager = globalNotificationManager;
        this._setupNotificationEventListeners();
        console.log("[App] Notification system ready");
      }
    } catch (error) {
      console.error("[App] Failed to initialize notification system:", error);
    }
  }

  _setupNotificationEventListeners() {
    document.addEventListener("story-added", async (event) => {
      if (globalNotificationManager) {
        const storyTitle = event.detail?.title || "New story added";
        await globalNotificationManager.showNotification("New Story", {
          body: storyTitle,
          data: { url: "/stories" },
        });
      }
    });

    document.addEventListener("user-logged-in", () => {
      if (globalNotificationManager?.permission === "default") {
        setTimeout(() => globalNotificationManager.requestPermission(), 1000);
      }
    });
  }

  // ==================== NETWORK HANDLING ====================
  setupNetworkHandlers() {
    this.networkManager.onStatusChange((isOnline) => {
      if (isOnline) {
        this.handleOnline();
      } else {
        this.handleOffline();
      }
    });
  }

  async handleOnline() {
    console.log("[App] App is now online");

    if (this.swManager) {
      await this.swManager.triggerSync();
    }

    this.updateNetworkStatusUI(true);
    this.refreshDataIfNeeded();
  }

  handleOffline() {
    console.log("[App] App is now offline");
    this.updateNetworkStatusUI(false);
    this.showOfflineMessage();
  }

  updateNetworkStatusUI(isOnline) {
    if (isOnline) {
      document.body.classList.remove("offline");
      document.body.classList.add("online");
    } else {
      document.body.classList.add("offline");
      document.body.classList.remove("online");
    }

    const event = new CustomEvent("network-status-change", {
      detail: { isOnline },
    });
    window.dispatchEvent(event);
  }

  showOfflineMessage() {
    const message = document.createElement("div");
    message.className = "offline-notification";
    message.innerHTML = `
      <div class="offline-content">
        📵 You are offline. Some features may not be available.
      </div>
    `;

    // Add styles if not already present
    if (!document.getElementById("offline-notification-styles")) {
      const style = document.createElement("style");
      style.id = "offline-notification-styles";
      style.textContent = `
        .offline-notification {
          position: fixed;
          top: 20px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 10000;
          background: #ff9800;
          color: white;
          padding: 12px 20px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          animation: slideDown 0.3s ease;
        }
        
        @keyframes slideDown {
          from {
            transform: translateX(-50%) translateY(-100%);
            opacity: 0;
          }
          to {
            transform: translateX(-50%) translateY(0);
            opacity: 1;
          }
        }
        
        @media (max-width: 768px) {
          .offline-notification {
            left: 10px;
            right: 10px;
            transform: none;
          }
        }
      `;
      document.head.appendChild(style);
    }

    document.body.appendChild(message);

    // Auto remove after 5 seconds
    setTimeout(() => {
      if (message.parentElement) {
        message.remove();
      }
    }, 5000);
  }

  async refreshDataIfNeeded() {
    const lastSync = localStorage.getItem("lastDataSync");
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;

    if (!lastSync || now - parseInt(lastSync) > fiveMinutes) {
      console.log("[App] Refreshing data after coming online");

      try {
        const event = new CustomEvent("refresh-data");
        window.dispatchEvent(event);

        localStorage.setItem("lastDataSync", now.toString());
      } catch (error) {
        console.error("[App] Data refresh failed:", error);
      }
    }
  }

  // ==================== UTILITY METHODS ====================
  loadPWAInstaller() {
    import("../utils/pwa-installer.js").catch((error) => {
      console.warn("[App] PWA installer not loaded:", error);
    });
  }

  handleInitializationError(error) {
    console.error("[App] Critical initialization error:", error);

    const errorDiv = document.createElement("div");
    errorDiv.innerHTML = `
      <div style="
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        padding: 30px;
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.2);
        text-align: center;
        max-width: 400px;
        z-index: 10000;
      ">
        <h3 style="color: #d32f2f; margin-bottom: 16px;">Initialization Error</h3>
        <p style="color: #666; margin-bottom: 20px;">
          There was an error loading the application. Please refresh the page.
        </p>
        <button onclick="window.location.reload()" style="
          background: #2196F3;
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 4px;
          cursor: pointer;
          font-weight: 600;
        ">
          Refresh Page
        </button>
      </div>
    `;

    document.body.appendChild(errorDiv);
  }
}

// ==================== DEBUG UTILITIES ====================
window.debugNotifications = async () => {
  console.group("Notification Debug");
  console.log("Manager instance:", globalNotificationManager);
  console.log("Permission status:", Notification.permission);

  if ("serviceWorker" in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      console.log("Push subscription:", sub);
    } catch (error) {
      console.error("Service Worker debug error:", error);
    }
  }

  console.groupEnd();
};

window.testNotification = async () => {
  if (globalNotificationManager) {
    return await globalNotificationManager.showNotification(
      "Test Notification",
      {
        body: "This is a test notification",
        data: { url: "/" },
      }
    );
  }
  return false;
};

// ==================== APP STARTUP ====================
const app = new App();

const initializeApp = async () => {
  await app.init();
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeApp);
} else {
  initializeApp();
}

// ==================== GLOBAL SETUP ====================
window.app = app;

// Global error handlers
window.addEventListener("error", (event) => {
  console.error("[App] Global error:", event.error);
});

window.addEventListener("unhandledrejection", (event) => {
  console.error("[App] Unhandled promise rejection:", event.reason);
});

// ==================== EXPORTS ====================
export { globalNotificationManager };
export default app;
