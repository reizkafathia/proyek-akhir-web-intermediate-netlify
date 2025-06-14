import { Router } from "./routes/routes.js";
import { requestNotificationPermission, getNotificationStatus, testNotification } from '../utils/notification.js';
import '../styles/styles.css';

(() => {
  "use strict";

  let router = null;
  let isInitialized = false;
  let updateBannerShown = false;
  
  // Fix BASE_PATH untuk berbagai deployment
  const BASE_PATH = (() => {
    // Deteksi environment
    const hostname = window.location.hostname;
    const pathname = window.location.pathname;
    
    if (hostname.includes('netlify.app')) {
      // Netlify deployment - no additional path needed
      return '/';
    } else if (hostname.includes('github.io')) {
      // GitHub Pages deployment
      return '/proyek-akhir-web-intermediate/';
    } else if (import.meta.env.PROD) {
      // Production build tapi bukan GitHub Pages
      return '/';
    } else {
      // Development
      return '/';
    }
  })();

  // Main initialization
  document.addEventListener("DOMContentLoaded", async () => {
    if (isInitialized) return;

    try {
      console.log("Initializing app...", { BASE_PATH, hostname: window.location.hostname });
      loadBaseStyles();
      addSkipLink();

      // Initialize router first
      router = new Router();
      await router.init();

      // Setup service worker after router is ready
      const swSetup = await setupServiceWorker();
      console.log('Service Worker setup result:', swSetup);
      
      setupNetworkEvents();

      isInitialized = true;
      console.log("App initialized successfully");
      
      // Show initialization complete message
      showToast("App loaded successfully!", "success");
      
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
    
    // Fix CSS path - gunakan path yang benar sesuai struktur folder
    link.href = './src/styles/styles.css';

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
          // Use native Notification API instead of undefined notificationManager
          if (Notification.permission === 'granted') {
            new Notification("Sync Complete", {
              body: result.message,
              icon: '/icon-192x192.png' // adjust path as needed
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

  async function setupServiceWorker() {
    console.log('Setting up Service Worker...');
    
    try {
      // Check if service workers are supported
      if (!('serviceWorker' in navigator)) {
        console.warn('Service Workers not supported in this browser');
        return false;
      }
  
      // Unregister existing service worker first (optional - for development)
      const registrations = await navigator.serviceWorker.getRegistrations();
      if (registrations.length > 0) {
        console.log('Unregistering existing service worker');
        for (const registration of registrations) {
          await registration.unregister();
        }
      }
  
      // Register new service worker
      console.log('Registering Service Worker: ./sw.js');
      const registration = await navigator.serviceWorker.register('./sw.js', {
        scope: '/'
      });
  
      console.log('Service Worker registered successfully', registration);
  
      // Wait for service worker to be ready
      await navigator.serviceWorker.ready;
      console.log('Service Worker is ready');
  
      // Setup notifications after service worker is ready
      await setupNotifications();
  
      // Listen for service worker updates
      watchServiceWorker(registration);
  
      return true;
  
    } catch (error) {
      console.error('Service Worker setup failed:', error);
      return false;
    }
  }

  async function setupNotifications() {
    console.log('Setting up notifications...');
    
    try {
      // Check if notifications are supported
      if (!('Notification' in window)) {
        console.warn('❌ Notifications not supported in this browser');
        showToast('Notifications not supported in this browser', 'warning');
        return false;
      }
      
      // Check current permission status
      console.log('Current notification permission:', Notification.permission);
      
      // If permission is already granted, test immediately
      if (Notification.permission === 'granted') {
        console.log('✅ Notification permission already granted');
        
        // Test notification immediately
        setTimeout(() => {
          showTestNotification();
        }, 1000);
        
        return true;
      }

      // If permission was previously denied, show instruction
      if (Notification.permission === 'denied') {
        console.warn('⚠️ Notification permission was denied');
        showToast('Notifications blocked. Enable in browser settings if needed.', 'warning');
        return false;
      }

      // Request permission (only if it's 'default')
      if (Notification.permission === 'default') {
        console.log('🔔 Requesting notification permission...');
        
        // Show user-friendly prompt first
        showNotificationPrompt();
        
        return true;
      }
      
    } catch (error) {
      console.error('Notification setup failed:', error);
      return false;
    }
  }

  // Show a custom prompt to ask user about notifications
  function showNotificationPrompt() {
    const promptDiv = document.createElement('div');
    promptDiv.id = 'notification-prompt';
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
    
    // Handle allow button
    document.getElementById('allow-notifications').onclick = async () => {
      try {
        const permission = await Notification.requestPermission();
        console.log('Permission result:', permission);
        
        if (permission === 'granted') {
          console.log('✅ Notification permission granted!');
          showToast('Notifications enabled successfully!', 'success');
          
          // Test notification
          setTimeout(() => {
            showTestNotification();
          }, 500);
        } else {
          console.warn('⚠️ Notification permission denied');
          showToast('Notifications not enabled', 'warning');
        }
      } catch (error) {
        console.error('Error requesting permission:', error);
        showToast('Failed to request notification permission', 'error');
      }
      
      promptDiv.remove();
    };
    
    // Handle deny button
    document.getElementById('deny-notifications').onclick = () => {
      console.log('User declined notifications');
      promptDiv.remove();
    };
    
    // Auto-remove after 30 seconds
    setTimeout(() => {
      if (document.contains(promptDiv)) {
        promptDiv.remove();
      }
    }, 30000);
  }

  // Test notification function
  function showTestNotification() {
    if (Notification.permission !== 'granted') {
      console.warn('Cannot show test notification: permission not granted');
      return;
    }
    
    try {
      const notification = new Notification('🎉 Notifications Enabled!', {
        body: 'You will now receive important updates from this app.',
        icon: '/icon.ico', // fallback icon
        badge: '/icon.ico',
        tag: 'welcome-notification',
        requireInteraction: false,
        silent: false
      });
      
      notification.onclick = () => {
        console.log('Welcome notification clicked');
        notification.close();
        window.focus();
      };
      
      // Auto close after 5 seconds
      setTimeout(() => {
        notification.close();
      }, 5000);
      
      console.log('✅ Test notification shown');
      
    } catch (error) {
      console.error('Failed to show test notification:', error);
      showToast('Failed to show test notification', 'error');
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

      // Handle different message types
      switch (event.data?.type) {
        case 'CACHE_UPDATED':
          console.log('Cache updated by Service Worker');
          break;
        case 'OFFLINE_FALLBACK':
          console.log('Service Worker serving offline content');
          break;
        case 'SW_UPDATE_READY':
          // Already handled above
          break;
        default:
          if (event.data?.type) {
            console.log('Unknown message from Service Worker:', event.data);
          }
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

  // Helper function for showing notifications (replaces undefined showNotification)
  function showAppNotification(title, options = {}) {
    console.log('showAppNotification called:', { title, options, permission: Notification.permission });
    
    if (!('Notification' in window)) {
      console.warn('Notifications not supported');
      showToast(title + (options.body ? ': ' + options.body : ''), 'info');
      return null;
    }
    
    if (Notification.permission === 'granted') {
      try {
        const notification = new Notification(title, {
          icon: '/icon.ico',
          badge: '/icon.ico',
          tag: 'app-notification',
          requireInteraction: false,
          ...options
        });
        
        notification.onclick = () => {
          console.log('Notification clicked:', title);
          notification.close();
          window.focus();
        };
        
        notification.onerror = (error) => {
          console.error('Notification error:', error);
        };
        
        console.log('✅ Notification created successfully');
        return notification;
        
      } catch (error) {
        console.error('Failed to create notification:', error);
        showToast(title + (options.body ? ': ' + options.body : ''), 'info');
        return null;
      }
    } else {
      console.warn('Cannot show notification: permission =', Notification.permission);
      showToast(title + (options.body ? ': ' + options.body : ''), 'warning');
      return null;
    }
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

  // Global error handlers
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
      showAppNotification,
      showTestNotification,
      setupNotifications,
      isInitialized: () => isInitialized,
      BASE_PATH,
      // Debug helpers
      testNotification: () => {
        console.log('Testing notification...');
        showTestNotification();
      },
      checkNotificationStatus: () => {
        console.log('Notification permission:', Notification.permission);
        console.log('Notification supported:', 'Notification' in window);
        return {
          permission: Notification.permission,
          supported: 'Notification' in window
        };
      }
    };
    
    // Add debug button for testing notifications
    setTimeout(() => {
      if (document.querySelector('#app')) {
        const debugButton = document.createElement('button');
        debugButton.id = 'debug-notification-btn';
        debugButton.textContent = '🔔 Test Notification';
        debugButton.style.cssText = `
          position: fixed; bottom: 20px; right: 20px; z-index: 1000;
          background: #6366f1; color: white; border: none;
          padding: 12px 16px; border-radius: 8px; cursor: pointer;
          font-size: 14px; font-weight: 500;
          box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        `;
        
        debugButton.onclick = () => {
          console.log('Debug: Testing notification...');
          
          if (Notification.permission === 'granted') {
            showTestNotification();
          } else if (Notification.permission === 'default') {
            showNotificationPrompt();
          } else {
            showToast('Notifications are blocked. Please enable them in browser settings.', 'warning');
          }
        };
        
        document.body.appendChild(debugButton);
        console.log('🔧 Debug notification button added');
      }
    }, 2000);
  }

  // Export for use in other modules
  window.APP_BASE_PATH = BASE_PATH;
})();