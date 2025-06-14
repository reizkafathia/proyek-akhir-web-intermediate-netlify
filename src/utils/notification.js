// utils/notification.js - Simple notification utility

// Main function yang digunakan di api.js
export async function showNotification(title, options = {}) {
  console.log('📢 Showing notification:', title, options);
  
  try {
    // Cek apakah global notification manager tersedia
    if (window.globalNotificationManager) {
      console.log('Using global NotificationManager');
      return await window.globalNotificationManager.showLocalNotification(title, options);
    }
    
    // Cek apakah trigger function tersedia
    if (window.triggerNotification) {
      console.log('Using global trigger function');
      return await window.triggerNotification(title, options);
    }
    
    // Fallback ke browser notification langsung
    console.log('Using fallback browser notification');
    return await showBrowserNotification(title, options);
    
  } catch (error) {
    console.error('Error in showNotification:', error);
    // Ultimate fallback
    return await showBrowserNotification(title, options);
  }
}

// Browser notification fallback
async function showBrowserNotification(title, options = {}) {
  // Check support
  if (!('Notification' in window)) {
    console.warn('❌ Browser tidak support notifications');
    return false;
  }

  try {
    // Request permission jika belum ada
    if (Notification.permission === 'default') {
      console.log('🔔 Requesting notification permission...');
      const permission = await Notification.requestPermission();
      console.log('Permission result:', permission);
      
      if (permission !== 'granted') {
        console.warn('⚠️ Notification permission denied');
        return false;
      }
    }

    // Check permission
    if (Notification.permission === 'granted') {
      console.log('✅ Showing browser notification');
      
      const notification = new Notification(title, {
        body: options.body || '',
        icon: options.icon || './icons/icon-192x192.png',
        badge: options.badge || './icons/icon-96x96.png',
        tag: options.tag || 'default',
        requireInteraction: options.requireInteraction || false,
        silent: options.silent || false,
        ...options
      });

      // Handle clicks
      notification.onclick = (event) => {
        console.log('Notification clicked');
        event.preventDefault();
        window.focus();
        notification.close();
        
        if (options.onClick) {
          options.onClick(event);
        }
      };

      // Handle errors
      notification.onerror = (event) => {
        console.error('Notification error:', event);
      };

      return true;
    } else {
      console.warn('⚠️ Notification permission not granted:', Notification.permission);
      return false;
    }
    
  } catch (error) {
    console.error('❌ Browser notification error:', error);
    return false;
  }
}

// Specific notification functions
export async function notifyStoryAdded(storyTitle) {
  return await showNotification("📖 Story Berhasil Ditambahkan!", {
    body: `"${storyTitle}" telah berhasil dibagikan`,
    tag: "story-added",
    requireInteraction: true,
    icon: './icons/icon-192x192.png'
  });
}

export async function notifyOfflineSave(message) {
  return await showNotification("💾 Disimpan untuk Nanti", {
    body: message || "Story Anda telah disimpan secara offline",
    tag: "offline-save",
    icon: './icons/icon-192x192.png'
  });
}

export async function notifySync(message) {
  return await showNotification("🔄 Sinkronisasi Selesai", {
    body: message || "Story offline Anda telah disinkronkan",
    tag: "sync-complete",
    icon: './icons/icon-192x192.png'
  });
}

export async function testNotification() {
  return await showNotification("🧪 Test Notification", {
    body: "Ini adalah test notification dari PWA Anda!",
    tag: "test-notification",
    requireInteraction: true,
    icon: './icons/icon-192x192.png'
  });
}

// Function untuk request permission secara manual
export async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    console.warn('Notifications not supported');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  try {
    const permission = await Notification.requestPermission();
    console.log('Permission result:', permission);
    return permission === 'granted';
  } catch (error) {
    console.error('Error requesting permission:', error);
    return false;
  }
}

// Function untuk check status notification
export function getNotificationStatus() {
  if (!('Notification' in window)) {
    return {
      supported: false,
      permission: 'not-supported',
      message: 'Browser tidak support notifications'
    };
  }

  return {
    supported: true,
    permission: Notification.permission,
    message: getPermissionMessage(Notification.permission)
  };
}

function getPermissionMessage(permission) {
  switch (permission) {
    case 'granted':
      return 'Notifikasi diizinkan';
    case 'denied':
      return 'Notifikasi ditolak';
    case 'default':
      return 'Belum meminta izin notifikasi';
    default:
      return 'Status tidak diketahui';
  }
}

// Export default object
export default {
  showNotification,
  notifyStoryAdded,
  notifyOfflineSave,
  notifySync,
  testNotification,
  requestNotificationPermission,
  getNotificationStatus
};

// Auto-test notification jika di development mode
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
  console.log('🔧 Development mode - notification utils loaded');
  
  // Expose functions untuk debugging
  window.notificationUtils = {
    showNotification,
    testNotification,
    requestNotificationPermission,
    getNotificationStatus
  };
}