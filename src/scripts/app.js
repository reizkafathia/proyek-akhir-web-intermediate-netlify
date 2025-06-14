import { Router } from "./routes/routes.js";
import StoryDBManager from '../components/StoryDBManager.js';
import storyDB from '../utils/indexedDB.js';
import { VAPID_PUBLIC_KEY } from './config.js';

// Constants
const NOTIFICATION_ICON = './icons/icon-192x192.png';
const NOTIFICATION_BADGE = './icons/icon-96x96.png';
const SUBSCRIPTION_ENDPOINT = 'https://api-anda.com/subscribe';

// Initialize global objects
window.storyDB = storyDB;
let globalNotificationManager = null;

class NotificationManager {
  constructor() {
    this.isSupported = 'Notification' in window;
    this.permission = Notification.permission;
    this.serviceWorkerRegistration = null;
  }

  async init() {
    if (!this.isSupported) {
      console.warn('Browser does not support notifications');
      return false;
    }

    try {
      if ('serviceWorker' in navigator) {
        this.serviceWorkerRegistration = await navigator.serviceWorker.ready;
        console.log('Service Worker ready');
      }
      return true;
    } catch (error) {
      console.error('NotificationManager initialization failed:', error);
      return false;
    }
  }

  async requestPermission() {
    if (!this.isSupported) return false;
    if (this.permission === 'granted') return true;

    try {
      this.permission = await Notification.requestPermission();
      if (this.permission === 'granted') {
        await this.subscribeToPushNotifications();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }

  async subscribeToPushNotifications() {
    if (!this.serviceWorkerRegistration || this.permission !== 'granted') {
      return null;
    }

    try {
      let subscription = await this.serviceWorkerRegistration.pushManager.getSubscription();
      
      if (!subscription) {
        subscription = await this._createPushSubscription();
        await this._sendSubscriptionToServer(subscription);
      }
      
      return subscription;
    } catch (error) {
      console.error('Push subscription failed:', error);
      return null;
    }
  }

  async showNotification(title, options = {}) {
    if (!this._validateNotificationRequirements()) {
      return false;
    }

    try {
      await this.serviceWorkerRegistration.showNotification(title, {
        body: options.body || '',
        icon: options.icon || NOTIFICATION_ICON,
        badge: options.badge || NOTIFICATION_BADGE,
        data: options.data || { url: '/' },
        ...options
      });
      return true;
    } catch (error) {
      console.error('Failed to show notification:', error);
      return false;
    }
  }

  // Private methods
  async _createPushSubscription() {
    const applicationServerKey = this._urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
    return await this.serviceWorkerRegistration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey
    });
  }

  async _sendSubscriptionToServer(subscription) {
    try {
      const response = await fetch(SUBSCRIPTION_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription)
      });

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }

      console.log('Subscription successfully saved to server');
      return await response.json();
    } catch (error) {
      console.error('Failed to send subscription:', error);
      throw error;
    }
  }

  _validateNotificationRequirements() {
    if (!this.isSupported) {
      console.warn('Notifications not supported');
      return false;
    }

    if (this.permission !== 'granted') {
      console.warn('Notification permission not granted');
      return false;
    }

    if (!this.serviceWorkerRegistration) {
      console.warn('Service Worker not ready');
      return false;
    }

    return true;
  }

  _urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }
}

// App Initialization
async function initializeApp() {
  console.log('🚀 Initializing application...');

  _createSkipToContentLink();
  
  const router = new Router();
  await router.init();
  
  await _initializeNotificationSystem();
  
  console.log('✅ Application initialized successfully');
}

function _createSkipToContentLink() {
  const skipLink = document.createElement('a');
  skipLink.href = '#main-content';
  skipLink.textContent = 'Skip to main content';
  skipLink.className = 'skip-link';
  document.body.prepend(skipLink);
}

async function _initializeNotificationSystem() {
  try {
    console.log('🔔 Initializing notification system...');
    
    globalNotificationManager = new NotificationManager();
    const initialized = await globalNotificationManager.init();
    
    if (initialized) {
      window.globalNotificationManager = globalNotificationManager;
      _setupNotificationEventListeners();
      console.log('Notification system ready');
    }
  } catch (error) {
    console.error('Failed to initialize notification system:', error);
  }
}

function _setupNotificationEventListeners() {
  document.addEventListener('story-added', async (event) => {
    if (globalNotificationManager) {
      const storyTitle = event.detail?.title || 'New story added';
      await globalNotificationManager.showNotification('New Story', {
        body: storyTitle,
        data: { url: '/stories' }
      });
    }
  });

  document.addEventListener('user-logged-in', () => {
    if (globalNotificationManager?.permission === 'default') {
      setTimeout(() => globalNotificationManager.requestPermission(), 1000);
    }
  });
}

// Debug Utilities
window.debugNotifications = async () => {
  console.group('Notification Debug');
  console.log('Manager instance:', globalNotificationManager);
  console.log('Permission status:', Notification.permission);
  
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      console.log('Push subscription:', sub);
    } catch (error) {
      console.error('Service Worker debug error:', error);
    }
  }
  
  console.groupEnd();
};

window.testNotification = async () => {
  if (globalNotificationManager) {
    return await globalNotificationManager.showNotification('Test Notification', {
      body: 'This is a test notification',
      data: { url: '/' }
    });
  }
  return false;
};

// Start the application
document.addEventListener('DOMContentLoaded', initializeApp);

export { globalNotificationManager };