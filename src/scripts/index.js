import { Router } from "./routes/routes.js";
import {
  requestNotificationPermission,
  getNotificationStatus,
  testNotification,
} from "../utils/notification.js";
import "../styles/styles.css";

(() => {
  "use strict";

  // ==================== VARIABLES ====================
  let router = null;
  let isInitialized = false;
  let updateBannerShown = false;

  // ==================== BASE PATH CONFIGURATION ====================
  const BASE_PATH = (() => {
    const hostname = window.location.hostname;

    if (hostname.includes("netlify.app")) {
      return "/";
    } else if (import.meta.env.PROD) {
      return "/";
    } else {
      return "/";
    }
  })();

  // ==================== MAIN INITIALIZATION ====================
  document.addEventListener("DOMContentLoaded", async () => {
    if (isInitialized) return;

    try {
      console.log("Initializing app...", {
        BASE_PATH,
        hostname: window.location.hostname,
      });

      loadBaseStyles();
      addSkipLink();

      // Initialize router
      router = new Router();
      await router.init();

      // Setup service worker and notifications
      const swSetup = await setupServiceWorker();
      console.log("Service Worker setup result:", swSetup);

      setupNetworkEvents();

      isInitialized = true;
      console.log("App initialized successfully");
      showToast("App loaded successfully!", "success");
    } catch (error) {
      console.error("Init failed:", error);
      showError("Failed to load app. Try refreshing.");
    }
  });

  // ==================== STYLES AND ACCESSIBILITY ====================
  function loadBaseStyles() {
    if (document.querySelector("#app-base-styles")) return;

    const link = document.createElement("link");
    link.id = "app-base-styles";
    link.rel = "stylesheet";
    link.href = "./src/styles/styles.css";

    link.onerror = () => {
      console.log("External CSS not found, using inline styles");
      const style = document.createElement("style");
      style.id = "app-inline-styles";
      style.textContent = `
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          font-family: Arial, sans-serif; 
          line-height: 1.6; 
          color: #333; 
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
        }
        #app { 
          max-width: 1200px; 
          margin: 20px auto; 
          padding: 20px; 
          background: rgba(255,255,255,0.95);
          border-radius: 20px;
          min-height: calc(100vh - 40px);
        }
        .skip-link:focus { top: 6px !important; }
        .loading {
          display: flex;
          justify-content: center;
          align-items: center;
          height: 50vh;
          font-size: 18px;
          color: #666;
        }
      `;
      document.head.appendChild(style);
    };

    document.head.appendChild(link);
  }

  function addSkipLink() {
    if (document.querySelector(".skip-link")) return;

    const skip = document.createElement("a");
    skip.href = "#app";
    skip.textContent = "Skip to main content";
    skip.className = "skip-link";
    skip.setAttribute("aria-label", "Skip to main content");
    skip.style.cssText = `
      position: absolute; top: -40px; left: 6px;
      background: #000; color: #fff; padding: 8px;
      text-decoration: none; z-index: 1000; border-radius: 4px;
      transition: top 0.2s ease;
    `;
    skip.addEventListener("focus", () => (skip.style.top = "6px"));
    skip.addEventListener("blur", () => (skip.style.top = "-40px"));
    document.body.prepend(skip);
  }

  // ==================== NETWORK HANDLING ====================
  function setupNetworkEvents() {
    window.removeEventListener("online", handleOnline);
    window.removeEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
  }

  async function handleOnline() {
    console.log("Network back online");
    showToast("Back online", "success");

    if (
      window.storyModel &&
      typeof window.storyModel.syncDrafts === "function"
    ) {
      try {
        const result = await window.storyModel.syncDrafts();
        if (result && result.synced > 0) {
          if (Notification.permission === "granted") {
            new Notification("Sync Complete", {
              body: result.message,
              icon: "/icon-192x192.png",
            });
          }
        }
      } catch (err) {
        console.error("Sync error:", err);
      }
    }
  }

  function handleOffline() {
    console.log("Network offline");
    showToast("You are offline. Drafts will sync when online.", "warning");
  }

  // ==================== SERVICE WORKER SETUP ====================
  async function setupServiceWorker() {
    console.log("Setting up Service Worker...");

    try {
      if (!("serviceWorker" in navigator)) {
        console.warn("Service Workers not supported in this browser");
        return false;
      }

      // Unregister existing service workers
      const registrations = await navigator.serviceWorker.getRegistrations();
      if (registrations.length > 0) {
        console.log("Unregistering existing service worker");
        for (const registration of registrations) {
          await registration.unregister();
        }
      }

      // Register new service worker
      console.log("Registering Service Worker: ./sw.js");
      const registration = await navigator.serviceWorker.register("./sw.js", {
        scope: "/",
      });

      console.log("Service Worker registered successfully", registration);
      await navigator.serviceWorker.ready;
      console.log("Service Worker is ready");

      // Setup notifications and watch for updates
      await setupNotifications();
      watchServiceWorker(registration);

      return true;
    } catch (error) {
      console.error("Service Worker setup failed:", error);
      return false;
    }
  }

  function watchServiceWorker(registration) {
    if (!registration) return;

    registration.addEventListener("updatefound", () => {
      const newWorker = registration.installing;
      if (!newWorker) return;

      console.log("New Service Worker found");

      newWorker.addEventListener("statechange", () => {
        console.log("SW state changed to:", newWorker.state);

        if (
          newWorker.state === "installed" &&
          navigator.serviceWorker.controller
        ) {
          setTimeout(() => {
            if (!updateBannerShown) {
              showUpdateBanner();
            }
          }, 2000);
        }
      });
    });

    navigator.serviceWorker.addEventListener("message", (event) => {
      console.log("Message from SW:", event.data);

      if (event.data && event.data.type === "SW_UPDATE_READY") {
        setTimeout(() => {
          if (!updateBannerShown) {
            showUpdateBanner();
          }
        }, 1000);
      }

      // Handle different message types
      switch (event.data?.type) {
        case "CACHE_UPDATED":
          console.log("Cache updated by Service Worker");
          break;
        case "OFFLINE_FALLBACK":
          console.log("Service Worker serving offline content");
          break;
        case "SW_UPDATE_READY":
          break;
        default:
          if (event.data?.type) {
            console.log("Unknown message from Service Worker:", event.data);
          }
      }
    });
  }

  // ==================== NOTIFICATION SYSTEM ====================
  async function setupNotifications() {
    console.log("Setting up notifications...");

    try {
      if (!("Notification" in window)) {
        console.warn("❌ Notifications not supported in this browser");
        showToast("Notifications not supported in this browser", "warning");
        return false;
      }

      console.log("Current notification permission:", Notification.permission);

      if (Notification.permission === "granted") {
        console.log("✅ Notification permission already granted");
        setTimeout(() => {
          showTestNotification();
        }, 1000);
        return true;
      }

      if (Notification.permission === "denied") {
        console.warn("⚠️ Notification permission was denied");
        showToast(
          "Notifications blocked. Enable in browser settings if needed.",
          "warning"
        );
        return false;
      }

      if (Notification.permission === "default") {
        console.log("🔔 Requesting notification permission...");
        showNotificationPrompt();
        return true;
      }
    } catch (error) {
      console.error("Notification setup failed:", error);
      return false;
    }
  }

  function showNotificationPrompt() {
    const promptDiv = document.createElement("div");
    promptDiv.id = "notification-prompt";
    promptDiv.style.cssText = `
      position: fixed; top: 20px; right: 20px; z-index: 1001;
      background: white; border: 2px solid #6366f1; border-radius: 12px;
      padding: 20px; max-width: 350px; box-shadow: 0 8px 25px rgba(0,0,0,0.15);
      font-family: Arial, sans-serif;
    `;

    promptDiv.innerHTML = `
      <div style="display: flex; align-items: center; margin-bottom: 12px;">
        <span style="font-size: 24px; margin-right: 8px;">🔔</span>
        <strong style="color: #333;">Enable Notifications?</strong>
      </div>
      <p style="color: #666; margin-bottom: 16px; line-height: 1.4;">
        Get notified about important updates and sync status.
      </p>
      <div style="display: flex; gap: 8px;">
        <button id="allow-notifications" style="
          background: #6366f1; color: white; border: none;
          padding: 10px 16px; border-radius: 6px; cursor: pointer;
          font-weight: 500; flex: 1;
        ">Allow</button>
        <button id="deny-notifications" style="
          background: #e5e7eb; color: #374151; border: none;
          padding: 10px 16px; border-radius: 6px; cursor: pointer;
          font-weight: 500; flex: 1;
        ">Not Now</button>
      </div>
    `;

    document.body.appendChild(promptDiv);

    // Handle buttons
    document.getElementById("allow-notifications").onclick = async () => {
      try {
        const permission = await Notification.requestPermission();
        console.log("Permission result:", permission);

        if (permission === "granted") {
          console.log("✅ Notification permission granted!");
          showToast("Notifications enabled successfully!", "success");
          setTimeout(() => {
            showTestNotification();
          }, 500);
        } else {
          console.warn("⚠️ Notification permission denied");
          showToast("Notifications not enabled", "warning");
        }
      } catch (error) {
        console.error("Error requesting permission:", error);
        showToast("Failed to request notification permission", "error");
      }

      promptDiv.remove();
    };

    document.getElementById("deny-notifications").onclick = () => {
      console.log("User declined notifications");
      promptDiv.remove();
    };

    // Auto-remove after 30 seconds
    setTimeout(() => {
      if (document.contains(promptDiv)) {
        promptDiv.remove();
      }
    }, 30000);
  }

  function showTestNotification() {
    if (Notification.permission !== "granted") {
      console.warn("Cannot show test notification: permission not granted");
      return;
    }

    try {
      const notification = new Notification("🎉 Notifications Enabled!", {
        body: "You will now receive important updates from this app.",
        icon: "/icon.ico",
        badge: "/icon.ico",
        tag: "welcome-notification",
        requireInteraction: false,
        silent: false,
      });

      notification.onclick = () => {
        console.log("Welcome notification clicked");
        notification.close();
        window.focus();
      };

      setTimeout(() => {
        notification.close();
      }, 5000);

      console.log("✅ Test notification shown");
    } catch (error) {
      console.error("Failed to show test notification:", error);
      showToast("Failed to show test notification", "error");
    }
  }

  function showAppNotification(title, options = {}) {
    console.log("showAppNotification called:", {
      title,
      options,
      permission: Notification.permission,
    });

    if (!("Notification" in window)) {
      console.warn("Notifications not supported");
      showToast(title + (options.body ? ": " + options.body : ""), "info");
      return null;
    }

    if (Notification.permission === "granted") {
      try {
        const notification = new Notification(title, {
          icon: "/icon.ico",
          badge: "/icon.ico",
          tag: "app-notification",
          requireInteraction: false,
          ...options,
        });

        notification.onclick = () => {
          console.log("Notification clicked:", title);
          notification.close();
          window.focus();
        };

        notification.onerror = (error) => {
          console.error("Notification error:", error);
        };

        console.log("✅ Notification created successfully");
        return notification;
      } catch (error) {
        console.error("Failed to create notification:", error);
        showToast(title + (options.body ? ": " + options.body : ""), "info");
        return null;
      }
    } else {
      console.warn(
        "Cannot show notification: permission =",
        Notification.permission
      );
      showToast(title + (options.body ? ": " + options.body : ""), "warning");
      return null;
    }
  }

  // ==================== UPDATE BANNER ====================
  function showUpdateBanner() {
    if (updateBannerShown || document.querySelector(".update-banner")) {
      return;
    }

    updateBannerShown = true;
    console.log("Showing update banner");

    const div = document.createElement("div");
    div.className = "update-banner";
    div.style.cssText = `
      position: fixed; top: 20px; right: 20px;
      background: #333; color: #fff; padding: 16px;
      border-radius: 8px; z-index: 1000; max-width: 300px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      animation: slideIn 0.3s ease-out;
    `;

    div.innerHTML = `
      <p><strong>New version available</strong></p>
      <div style="margin-top: 8px;">
        <button id="updateNow" style="
          background: #6366f1; color: white; border: none;
          padding: 8px 16px; border-radius: 4px; cursor: pointer;
          margin-right: 8px; font-size: 14px;
        ">Update Now</button>
        <button id="dismiss" style="
          background: transparent; color: #ccc; border: 1px solid #ccc;
          padding: 8px 16px; border-radius: 4px; cursor: pointer;
          font-size: 14px;
        ">Later</button>
      </div>
    `;

    document.body.appendChild(div);

    document.getElementById("updateNow").onclick = () => {
      console.log("User clicked update");
      document.getElementById("updateNow").textContent = "Updating...";
      document.getElementById("updateNow").disabled = true;
      setTimeout(() => {
        window.location.reload();
      }, 500);
    };

    document.getElementById("dismiss").onclick = () => {
      console.log("User dismissed update");
      div.remove();
      updateBannerShown = false;
    };

    setTimeout(() => {
      if (document.contains(div)) {
        div.remove();
        updateBannerShown = false;
      }
    }, 30000);
  }

  // ==================== UI HELPERS ====================
  function showToast(message, type = "info") {
    const existing = document.querySelector(`.toast-${type}`);
    if (existing) {
      existing.remove();
    }

    const colors = {
      success: "#4CAF50",
      warning: "#FF9800",
      error: "#f44336",
      info: "#2196F3",
    };

    const div = document.createElement("div");
    div.className = `toast toast-${type}`;
    div.style.cssText = `
      position: fixed; top: 20px; right: 20px;
      background: ${colors[type] || colors.info};
      color: #fff; padding: 12px 16px; border-radius: 6px;
      z-index: 999; max-width: 300px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      font-size: 14px; line-height: 1.4;
      animation: slideIn 0.3s ease-out;
    `;

    div.innerHTML = `<div>${message}</div>`;
    document.body.appendChild(div);

    setTimeout(() => {
      if (document.contains(div)) {
        div.style.animation = "slideOut 0.3s ease-out";
        setTimeout(() => div.remove(), 300);
      }
    }, 4000);
  }

  function showError(message) {
    const existingError = document.querySelector(".error-modal");
    if (existingError) {
      existingError.remove();
    }

    const div = document.createElement("div");
    div.className = "error-modal";
    div.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.5); z-index: 1001;
      display: flex; align-items: center; justify-content: center;
    `;

    div.innerHTML = `
      <div style="
        background: #fff; padding: 24px; border-radius: 8px;
        text-align: center; max-width: 400px; margin: 20px;
        box-shadow: 0 8px 16px rgba(0,0,0,0.2);
      ">
        <div style="color: #f44336; font-size: 48px; margin-bottom: 16px;">⚠️</div>
        <h3 style="margin: 0 0 12px 0; color: #333;">Something went wrong</h3>
        <p style="margin: 0 0 20px 0; color: #666;">${message}</p>
        <button id="reloadApp" style="
          background: #f44336; color: white; border: none;
          padding: 12px 24px; border-radius: 6px; cursor: pointer;
          font-size: 16px; font-weight: 500;
        ">Refresh Page</button>
      </div>
    `;

    document.body.appendChild(div);

    document.getElementById("reloadApp").onclick = () => {
      window.location.reload();
    };
  }

  // ==================== ANIMATIONS ====================
  const style = document.createElement("style");
  style.textContent = `
    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
      from { transform: translateX(0); opacity: 1; }
      to { transform: translateX(100%); opacity: 0; }
    }
  `;
  document.head.appendChild(style);

  // ==================== ERROR HANDLERS ====================
  window.addEventListener("error", (event) => {
    console.error("Global error:", event.error);
  });

  window.addEventListener("unhandledrejection", (event) => {
    console.error("Unhandled promise rejection:", event.reason);
  });

  // ==================== DEVELOPMENT TOOLS ====================
  if (import.meta.env.DEV) {
    window.app = {
      router: () => router,
      showAppNotification,
      showTestNotification,
      setupNotifications,
      isInitialized: () => isInitialized,
      BASE_PATH,
      testNotification: () => {
        console.log("Testing notification...");
        showTestNotification();
      },
      checkNotificationStatus: () => {
        console.log("Notification permission:", Notification.permission);
        console.log("Notification supported:", "Notification" in window);
        return {
          permission: Notification.permission,
          supported: "Notification" in window,
        };
      },
    };

    // Add debug notification button
    setTimeout(() => {
      if (document.querySelector("#app")) {
        const debugButton = document.createElement("button");
        debugButton.id = "debug-notification-btn";
        debugButton.textContent = "🔔 Test Notification";
        debugButton.style.cssText = `
          position: fixed; bottom: 20px; right: 20px; z-index: 1000;
          background: #6366f1; color: white; border: none;
          padding: 12px 16px; border-radius: 8px; cursor: pointer;
          font-size: 14px; font-weight: 500;
          box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        `;

        debugButton.onclick = () => {
          console.log("Debug: Testing notification...");

          if (Notification.permission === "granted") {
            showTestNotification();
          } else if (Notification.permission === "default") {
            showNotificationPrompt();
          } else {
            showToast(
              "Notifications are blocked. Please enable them in browser settings.",
              "warning"
            );
          }
        };

        document.body.appendChild(debugButton);
        console.log("🔧 Debug notification button added");
      }
    }, 2000);
  }

  // ==================== EXPORTS ====================
  window.APP_BASE_PATH = BASE_PATH;
})();
