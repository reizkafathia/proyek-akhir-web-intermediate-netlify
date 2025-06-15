// ==================== NOTIFICATION UTILITY ====================

// Main notification function
export async function showNotification(title, options = {}) {
  try {
    // Check if global notification manager is available
    if (window.globalNotificationManager) {
      return await window.globalNotificationManager.showLocalNotification(
        title,
        options
      );
    }

    // Check if trigger function is available
    if (window.triggerNotification) {
      return await window.triggerNotification(title, options);
    }

    // Fallback to browser notification
    return await showBrowserNotification(title, options);
  } catch (error) {
    console.error("Error showing notification:", error);
    return await showBrowserNotification(title, options);
  }
}

// ==================== BROWSER NOTIFICATION FALLBACK ====================

async function showBrowserNotification(title, options = {}) {
  // Check browser support
  if (!("Notification" in window)) {
    console.warn("Browser does not support notifications");
    return false;
  }

  try {
    // Request permission if needed
    if (Notification.permission === "default") {
      const permission = await Notification.requestPermission();

      if (permission !== "granted") {
        console.warn("Notification permission denied");
        return false;
      }
    }

    // Show notification if permission granted
    if (Notification.permission === "granted") {
      const notification = new Notification(title, {
        body: options.body || "",
        icon: options.icon || "./icons/icon-192x192.png",
        badge: options.badge || "./icons/icon-96x96.png",
        tag: options.tag || "default",
        requireInteraction: options.requireInteraction || false,
        silent: options.silent || false,
        ...options,
      });

      // Handle click events
      notification.onclick = (event) => {
        event.preventDefault();
        window.focus();
        notification.close();

        if (options.onClick) {
          options.onClick(event);
        }
      };

      // Handle errors
      notification.onerror = (event) => {
        console.error("Notification error:", event);
      };

      return true;
    } else {
      console.warn(
        "Notification permission not granted:",
        Notification.permission
      );
      return false;
    }
  } catch (error) {
    console.error("Browser notification error:", error);
    return false;
  }
}

// ==================== SPECIFIC NOTIFICATION FUNCTIONS ====================

export async function notifyStoryAdded(storyTitle) {
  return await showNotification("📖 Story Added Successfully!", {
    body: `"${storyTitle}" has been shared successfully`,
    tag: "story-added",
    requireInteraction: true,
    icon: "./icons/icon-192x192.png",
  });
}

export async function notifyOfflineSave(message) {
  return await showNotification("💾 Saved for Later", {
    body: message || "Your story has been saved offline",
    tag: "offline-save",
    icon: "./icons/icon-192x192.png",
  });
}

export async function notifySync(message) {
  return await showNotification("🔄 Sync Complete", {
    body: message || "Your offline stories have been synchronized",
    tag: "sync-complete",
    icon: "./icons/icon-192x192.png",
  });
}

export async function testNotification() {
  return await showNotification("🧪 Test Notification", {
    body: "This is a test notification from your PWA!",
    tag: "test-notification",
    requireInteraction: true,
    icon: "./icons/icon-192x192.png",
  });
}

// ==================== PERMISSION MANAGEMENT ====================

export async function requestNotificationPermission() {
  if (!("Notification" in window)) {
    console.warn("Notifications not supported");
    return false;
  }

  if (Notification.permission === "granted") {
    return true;
  }

  try {
    const permission = await Notification.requestPermission();
    return permission === "granted";
  } catch (error) {
    console.error("Error requesting permission:", error);
    return false;
  }
}

export function getNotificationStatus() {
  if (!("Notification" in window)) {
    return {
      supported: false,
      permission: "not-supported",
      message: "Browser does not support notifications",
    };
  }

  return {
    supported: true,
    permission: Notification.permission,
    message: getPermissionMessage(Notification.permission),
  };
}

function getPermissionMessage(permission) {
  switch (permission) {
    case "granted":
      return "Notifications allowed";
    case "denied":
      return "Notifications denied";
    case "default":
      return "Permission not requested yet";
    default:
      return "Unknown status";
  }
}

// ==================== EXPORT ====================

export default {
  showNotification,
  notifyStoryAdded,
  notifyOfflineSave,
  notifySync,
  testNotification,
  requestNotificationPermission,
  getNotificationStatus,
};

// ==================== DEVELOPMENT MODE ====================

// Auto-setup for development
if (
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1"
) {
  // Expose functions for debugging
  window.notificationUtils = {
    showNotification,
    testNotification,
    requestNotificationPermission,
    getNotificationStatus,
  };
}
