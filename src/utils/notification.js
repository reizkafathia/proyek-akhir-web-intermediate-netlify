class NotificationManager {
  constructor() {
    // VAPID key from Dicoding API
    this.publicVapidKey =
      "BCCs2eonMI-6H2ctvFaWg-UYdDv387Vno_bzUzALpB442r2lCnsHmtrx8biyPi_E-1fSGABK_Qs_GlvPoJJqxbk";
    
    // Dinamis path untuk GitHub Pages
    this.BASE_PATH = window.location.pathname.includes('/proyek-akhir-web-intermediate') 
      ? '/proyek-akhir-web-intermediate' 
      : '';
    
    this.isSubscribed = false;
    this.swRegistration = null;
    this.subscriptionCache = null;
    this.isInitialized = false;
  }

  async init() {
    if (this.isInitialized) {
      console.log('NotificationManager already initialized');
      return true;
    }

    try {
      console.log('Initializing NotificationManager with BASE_PATH:', this.BASE_PATH);
      
      // Check if notifications are supported
      if (!this.isNotificationSupported()) {
        console.warn('Notifications not supported in this browser');
        return false;
      }

      // Register service worker first
      await this.registerServiceWorker();
      
      // Set up message listener
      this.setupMessageListener();
      
      // Check subscription status
      await this.checkSubscriptionStatus();
      
      // Show permission dialog immediately when initializing
      await this.requestPermissionWithDialog();
      
      this.isInitialized = true;
      console.log('NotificationManager initialized successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize NotificationManager:', error);
      return false;
    }
  }

  async registerServiceWorker() {
    if (!('serviceWorker' in navigator)) {
      throw new Error('Service Worker not supported');
    }

    try {
      // Construct SW path with proper base path handling
      const swPath = this.BASE_PATH ? `${this.BASE_PATH}/sw.js` : './sw.js';
      const swScope = this.BASE_PATH ? `${this.BASE_PATH}/` : './';
      
      console.log('Registering SW with path:', swPath, 'scope:', swScope);

      const registration = await navigator.serviceWorker.register(swPath, {
        scope: swScope
      });

      console.log('Service Worker registered successfully:', registration);
      
      // Wait for service worker to be ready
      this.swRegistration = await navigator.serviceWorker.ready;
      console.log('Service Worker ready:', this.swRegistration);
      
      return registration;
    } catch (error) {
      console.error('Service Worker registration failed:', error);
      throw error;
    }
  }

  async requestPermissionWithDialog() {
    if (!("Notification" in window)) {
      console.warn("This browser does not support notifications");
      return false;
    }

    if (Notification.permission === "granted") {
      console.log("Notification permission already granted");
      return true;
    }

    if (Notification.permission === "denied") {
      console.warn("Notification permission denied by user");
      return false;
    }

    try {
      // Show custom dialog/prompt to user first
      const userWantsNotifications = confirm(
        "Aplikasi ini ingin mengirim notifikasi untuk memberitahu Anda tentang story baru. Izinkan notifikasi?"
      );

      if (!userWantsNotifications) {
        console.log("User declined notification permission");
        return false;
      }

      const permission = await Notification.requestPermission();
      console.log("Notification permission result:", permission);
      
      if (permission === "granted") {
        // Automatically subscribe user after permission granted
        await this.subscribeUser();
        return true;
      }
      
      return false;
    } catch (error) {
      console.error("Error requesting notification permission:", error);
      return false;
    }
  }

  async requestPermission() {
    if (!("Notification" in window)) {
      console.warn("This browser does not support notifications");
      return false;
    }

    if (Notification.permission === "granted") {
      return true;
    }

    if (Notification.permission === "denied") {
      console.warn("Notification permission denied");
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      console.log("Notification permission:", permission);
      return permission === "granted";
    } catch (error) {
      console.error("Error requesting notification permission:", error);
      return false;
    }
  }

  async subscribeUser() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      console.warn("Push messaging is not supported");
      return null;
    }

    try {
      // Ensure service worker is ready
      if (!this.swRegistration) {
        this.swRegistration = await navigator.serviceWorker.ready;
      }

      console.log("Service worker ready for push subscription");

      // Check if already subscribed
      let subscription = await this.swRegistration.pushManager.getSubscription();
      
      if (!subscription) {
        console.log("Creating new push subscription");
        
        // Request notification permission first
        const hasPermission = await this.requestPermission();
        if (!hasPermission) {
          throw new Error('Notification permission not granted');
        }

        subscription = await this.swRegistration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: this.urlBase64ToUint8Array(this.publicVapidKey),
        });
      }

      console.log("Push subscription created:", subscription);
      this.isSubscribed = true;
      this.subscriptionCache = subscription;
      
      // Send subscription to server
      await this.sendSubscriptionToServer(subscription);
      
      return subscription;
    } catch (error) {
      console.error("Error subscribing user to push:", error);
      this.isSubscribed = false;
      this.subscriptionCache = null;
      return null;
    }
  }

  async sendSubscriptionToServer(subscription) {
    try {
      // For Dicoding submission, we don't need to send to our own server
      // Just cache the subscription for use
      this.subscriptionCache = subscription;
      console.log('Subscription cached in memory');
      
      // Store endpoint for debugging
      console.log('Push endpoint:', subscription.endpoint);
      console.log('Push keys:', {
        p256dh: subscription.getKey('p256dh'),
        auth: subscription.getKey('auth')
      });
      
      // Optional: Store in localStorage for persistence across page reloads
      try {
        localStorage.setItem('pushSubscription', JSON.stringify(subscription.toJSON()));
        console.log('Subscription saved to localStorage');
      } catch (storageError) {
        console.warn('Could not save to localStorage:', storageError);
      }
    } catch (error) {
      console.error('Error handling subscription:', error);
    }
  }

  urlBase64ToUint8Array(base64String) {
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

  async showLocalNotification(title, options = {}) {
    const hasPermission = await this.requestPermission();
    
    if (!hasPermission) {
      console.warn("Cannot show notification: permission not granted");
      return false;
    }

    try {
      const iconPath = this.BASE_PATH ? `${this.BASE_PATH}/icons/icon-192x192.png` : './icons/icon-192x192.png';
      const badgePath = this.BASE_PATH ? `${this.BASE_PATH}/icons/icon-96x96.png` : './icons/icon-96x96.png';
      const urlPath = this.BASE_PATH ? `${window.location.origin}${this.BASE_PATH}/` : window.location.origin;

      const notificationOptions = {
        body: options.body || "New story available!",
        icon: iconPath,
        badge: badgePath,
        tag: options.tag || "story-notification",
        requireInteraction: options.requireInteraction || false,
        vibrate: options.vibrate || [100, 50, 100],
        data: {
          url: urlPath,
          timestamp: Date.now(),
          ...options.data
        },
        silent: options.silent || false,
        renotify: options.renotify || false,
        ...options
      };

      const notification = new Notification(title, notificationOptions);

      notification.onclick = (event) => {
        event.preventDefault();
        window.focus();
        notification.close();
        
        if (options.onClick) {
          options.onClick(event);
        } else if (notification.data && notification.data.url) {
          window.location.href = notification.data.url;
        }
      };

      notification.onclose = (event) => {
        if (options.onClose) {
          options.onClose(event);
        }
      };

      notification.onerror = (event) => {
        console.error('Notification error:', event);
        if (options.onError) {
          options.onError(event);
        }
      };

      console.log('Local notification shown:', title);
      return true;
    } catch (error) {
      console.error("Error showing notification:", error);
      return false;
    }
  }

  // Method to send notification when a new story is added
  async notifyStoryAdded(storyTitle) {
    console.log('Sending story added notification for:', storyTitle);
    
    const notificationData = {
      title: "Story Berhasil Ditambahkan!",
      body: `"${storyTitle}" telah berhasil dibagikan`,
      tag: "story-added",
      requireInteraction: true,
      data: {
        type: 'story-added',
        storyTitle: storyTitle,
        url: this.BASE_PATH ? `${window.location.origin}${this.BASE_PATH}/` : window.location.origin
      }
    };

    // Try to send push notification first, fallback to local notification
    const pushSent = await this.sendPushNotification(notificationData);

    if (!pushSent) {
      // Fallback to local notification
      return await this.showLocalNotification(notificationData.title, notificationData);
    }
    
    return true;
  }

  // Method to send notification when data is saved offline
  async notifyOfflineSave(message) {
    return await this.showLocalNotification("Disimpan untuk Nanti", {
      body: message || "Story Anda telah disimpan secara offline",
      tag: "offline-save",
      data: {
        type: 'offline-save'
      }
    });
  }

  // Method to send notification when back online and syncing
  async notifySync(message) {
    return await this.showLocalNotification("Sinkronisasi Selesai", {
      body: message || "Story offline Anda telah disinkronkan",
      tag: "sync-complete",
      data: {
        type: 'sync-complete'
      }
    });
  }

  // Method to send push notification via service worker
  async sendPushNotification(data) {
    if (!this.swRegistration || !this.isSubscribed) {
      console.log('Push notification not available, service worker not ready or not subscribed');
      return false;
    }

    try {
      // Send message to service worker to show notification
      if (this.swRegistration.active) {
        this.swRegistration.active.postMessage({
          type: 'SHOW_NOTIFICATION',
          data: data
        });
        console.log('Push notification sent to service worker');
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error sending push notification:', error);
      return false;
    }
  }

  // Method to test push notifications
  async testPushNotification() {
    console.log('Testing push notification...');
    
    // First ensure we have permission
    const hasPermission = await this.requestPermission();
    if (!hasPermission) {
      console.error("Notification permission not granted");
      alert("Izin notifikasi diperlukan untuk menguji push notification!");
      return false;
    }

    try {
      const testData = {
        title: "Test Notification",
        body: "Ini adalah test push notification dari PWA Anda!",
        tag: "test-notification",
        requireInteraction: true,
        data: {
          url: this.BASE_PATH ? `${window.location.origin}${this.BASE_PATH}/` : window.location.origin,
          type: 'test',
          timestamp: Date.now()
        }
      };

      // First try to send via service worker
      const pushSent = await this.sendPushNotification(testData);
      
      if (!pushSent) {
        // Fallback to local notification
        const success = await this.showLocalNotification(testData.title, testData);
        if (success) {
          console.log('Test notification sent successfully (local)');
        }
        return success;
      }
      
      console.log('Test notification sent successfully (push)');
      return true;
    } catch (error) {
      console.error("Error testing push notification:", error);
      return false;
    }
  }

  // Method to unsubscribe from push notifications
  async unsubscribeUser() {
    if (!("serviceWorker" in navigator)) {
      return false;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      if (subscription) {
        const successful = await subscription.unsubscribe();
        console.log("Unsubscribed from push notifications:", successful);
        this.isSubscribed = false;
        this.subscriptionCache = null;
        
        // Remove from localStorage if it exists
        try {
          localStorage.removeItem('pushSubscription');
        } catch (error) {
          console.warn('Could not remove from localStorage:', error);
        }
        
        return successful;
      }
      
      return true;
    } catch (error) {
      console.error("Error unsubscribing from push:", error);
      return false;
    }
  }

  // Get current subscription status
  async getSubscriptionStatus() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      return {
        supported: false,
        subscribed: false,
        permission: 'default'
      };
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      return {
        supported: true,
        subscribed: !!subscription,
        permission: Notification.permission,
        subscription: subscription,
        serviceWorkerState: registration.active ? registration.active.state : 'not active'
      };
    } catch (error) {
      console.error("Error getting subscription status:", error);
      return {
        supported: false,
        subscribed: false,
        permission: 'default',
        error: error.message
      };
    }
  }

  // Check and update subscription status
  async checkSubscriptionStatus() {
    const status = await this.getSubscriptionStatus();
    this.isSubscribed = status.subscribed;
    
    if (status.subscribed && status.subscription) {
      this.subscriptionCache = status.subscription;
    }
    
    console.log('Current subscription status:', status);
    return status;
  }

  // Method to handle service worker messages
  setupMessageListener() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        console.log('Received message from service worker:', event.data);
        
        switch (event.data.type) {
          case 'NOTIFICATION_CLICKED':
            console.log('Notification was clicked:', event.data);
            this.handleNotificationClick(event.data);
            break;
          case 'NOTIFICATION_CLOSED':
            console.log('Notification was closed:', event.data);
            break;
          case 'PUSH_RECEIVED':
            console.log('Push message received:', event.data);
            break;
          default:
            console.log('Unknown message type:', event.data.type);
        }
      });
    }
  }

  // Handle notification click events
  handleNotificationClick(data) {
    if (data.url) {
      // Focus the window and navigate to the URL
      if (window.focus) {
        window.focus();
      }
      
      // Navigate based on notification type
      if (data.type === 'story-added') {
        window.location.href = data.url;
      } else {
        window.location.href = data.url;
      }
    }
  }

  // Utility method to check if notifications are supported
  isNotificationSupported() {
    return 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
  }

  // Utility method to get readable permission status
  getPermissionStatus() {
    if (!('Notification' in window)) {
      return 'not-supported';
    }
    return Notification.permission;
  }

  // Method to show notification box when entering login page
  async showNotificationPermissionBox() {
    if (Notification.permission === 'default') {
      const modal = document.createElement('div');
      modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
      `;
      
      const box = document.createElement('div');
      box.style.cssText = `
        background: white;
        padding: 24px;
        border-radius: 8px;
        max-width: 400px;
        margin: 16px;
        text-align: center;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      `;
      
      box.innerHTML = `
        <h3 style="margin: 0 0 16px 0; color: #333;">Aktifkan Notifikasi</h3>
        <p style="margin: 0 0 20px 0; color: #666; line-height: 1.5;">
          Dapatkan notifikasi ketika story baru berhasil ditambahkan atau disinkronkan.
        </p>
        <div style="display: flex; gap: 12px; justify-content: center;">
          <button id="allow-notifications" style="
            background: #6366f1;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 500;
          ">Izinkan</button>
          <button id="deny-notifications" style="
            background: #e5e7eb;
            color: #374151;
            border: none;
            padding: 12px 24px;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 500;
          ">Tidak Sekarang</button>
        </div>
      `;
      
      modal.appendChild(box);
      document.body.appendChild(modal);
      
      return new Promise((resolve) => {
        const allowBtn = box.querySelector('#allow-notifications');
        const denyBtn = box.querySelector('#deny-notifications');
        
        allowBtn.onclick = async () => {
          document.body.removeChild(modal);
          const permission = await this.requestPermission();
          if (permission) {
            await this.subscribeUser();
          }
          resolve(permission);
        };
        
        denyBtn.onclick = () => {
          document.body.removeChild(modal);
          resolve(false);
        };
      });
    }
    
    return Notification.permission === 'granted';
  }
}

// Export untuk digunakan di module lain
if (typeof module !== 'undefined' && module.exports) {
  module.exports = NotificationManager;
} else {
  window.NotificationManager = NotificationManager;
}

// Create instance
const notificationManager = new NotificationManager();

// Export default instance dan function untuk kompatibilitas
export default notificationManager;

// Export function untuk kompatibilitas dengan api.js
export const showNotification = (title, options) => {
  return notificationManager.showLocalNotification(title, options);
};