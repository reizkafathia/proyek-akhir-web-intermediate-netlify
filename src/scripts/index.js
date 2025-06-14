import { Router } from "./routes/routes.js";
import notificationManager from "../utils/notification.js";
import '../../public/styles/styles.css';

(() => {
  "use strict";

  let router = null;
  let isInitialized = false;
  let updateBannerShown = false;
  
  // Fix BASE_PATH untuk GitHub Pages
  const BASE_PATH = import.meta.env.PROD 
    ? '/proyek-akhir-web-intermediate/' 
    : '/';

  document.addEventListener("DOMContentLoaded", async () => {
    if (isInitialized) return;

    try {
      console.log("Initializing app...", { BASE_PATH });
      loadBaseStyles();
      addSkipLink();

      // Initialize router first
      router = new Router();
      await router.init();

      // Setup service worker after router is ready
      await setupServiceWorker();
      setupNetworkEvents();

      isInitialized = true;
      console.log("App initialized successfully");
    } catch (error) {
      console.error("Init failed:", error);
      showError("Failed to load app. Try refreshing.");
    }
  });

  function loadBaseStyles() {
    if (document.querySelector('#app-base-styles')) return;

    const link = document.createElement('link');
    link.id = 'app-base-styles';
    link.rel = 'stylesheet';
    
    // Fix CSS path untuk GitHub Pages
    link.href = BASE_PATH + 'styles/styles.css';

    link.onerror = () => {
      console.log('External CSS not found, using inline styles');
      const style = document.createElement('style');
      style.id = 'app-inline-styles';
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

  function setupNetworkEvents() {
    window.removeEventListener("online", handleOnline);
    window.removeEventListener("offline", handleOffline);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
  }

  async function handleOnline() {
    console.log("Network back online");
    showToast("Back online", "success");

    if (window.storyModel && typeof window.storyModel.syncDrafts === 'function') {
      try {
        const result = await window.storyModel.syncDrafts();
        if (result && result.synced > 0) {
          notificationManager.showLocalNotification("Sync Complete", {
            body: result.message,
          });
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

  async function setupServiceWorker() {
    if (!("serviceWorker" in navigator)) {
      console.log("Service Worker not supported");
      return;
    }

    // Fix service worker path untuk GitHub Pages
    const swPath = 'sw.js';
    console.log("Registering Service Worker:", swPath);

    try {
      // Unregister existing service worker first
      const existingRegistration = await navigator.serviceWorker.getRegistration();
      if (existingRegistration) {
        console.log("Unregistering existing service worker");
        await existingRegistration.unregister();
      }

      const registration = await navigator.serviceWorker.register(swPath, {
        scope: BASE_PATH,
        updateViaCache: 'none'
      });

      console.log("Service Worker registered successfully", registration);
      
      // Wait for service worker to be ready
      await navigator.serviceWorker.ready;
      console.log("Service Worker is ready");

      // Setup notifications after SW is ready
      await setupNotifications();
      watchServiceWorker(registration);

    } catch (error) {
      console.error("SW setup failed:", error);
      // Show user-friendly error
      showToast("Service Worker failed to load. Some features may not work offline.", "warning");
    }
  }

  async function setupNotifications() {
    try {
      console.log("Setting up notifications...");
      
      // Check if notifications are supported
      if (!('Notification' in window)) {
        console.log("Notifications not supported");
        return false;
      }

      // Request permission
      const permission = await notificationManager.requestPermission();
      console.log("Notification permission:", permission);
      
      if (permission === 'granted') {
        // Subscribe to push notifications
        const subscription = await notificationManager.subscribeUser();
        if (subscription) {
          console.log("Push subscription active");
          
          // Show notification permission granted message
          showToast("Notifications enabled successfully!", "success");
          
          return true;
        }
      } else if (permission === 'denied') {
        showToast("Notifications blocked. Enable in browser settings for updates.", "warning");
      }
      
      return false;
    } catch (error) {
      console.error("Notification setup failed:", error);
      showToast("Could not set up notifications", "warning");
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

        if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
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
    });
  }

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

    const updateBtn = document.getElementById("updateNow");
    const dismissBtn = document.getElementById("dismiss");

    updateBtn.onclick = () => {
      console.log("User clicked update");
      updateBtn.textContent = "Updating...";
      updateBtn.disabled = true;

      setTimeout(() => {
        window.location.reload();
      }, 500);
    };

    dismissBtn.onclick = () => {
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

  function showToast(message, type = "info") {
    // Remove existing toast of same type
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
        div.style.animation = 'slideOut 0.3s ease-out';
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

  // Add CSS animations
  const style = document.createElement('style');
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

  // Global error handler
  window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
  });

  window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
  });

  // Make available in dev mode
  if (import.meta.env.DEV) {
    window.app = { 
      router: () => router, 
      notificationManager,
      isInitialized: () => isInitialized,
      BASE_PATH
    };
  }

  // Export for use in other modules
  window.APP_BASE_PATH = BASE_PATH;
})();