// ==================== PWA INSTALLER CLASS ====================

class PWAInstaller {
  constructor() {
    this.deferredPrompt = null;
    this.isInstalled = false;
    this.installButton = null;
    
    this.init();
  }

  // ==================== INITIALIZATION ====================

  init() {
    this.checkInstallStatus();
    
    // Listen for install prompt event
    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      this.deferredPrompt = e;
      
      if (!this.isInstalled) {
        this.showInstallButton();
      }
    });

    // Listen for app installed event
    window.addEventListener("appinstalled", (e) => {
      this.isInstalled = true;
      this.hideInstallButton();
      this.showInstalledMessage();
      this.deferredPrompt = null;
    });

    // Listen for service worker updates
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        this.showUpdateMessage();
      });
    }

    this.checkForUpdates();
  }

  checkInstallStatus() {
    // Check if running in standalone mode (installed)
    if (window.matchMedia('(display-mode: standalone)').matches) {
      this.isInstalled = true;
      return;
    }

    // Check if running as PWA on iOS
    if (window.navigator.standalone === true) {
      this.isInstalled = true;
      return;
    }

    // Check if install prompt was previously dismissed
    if (localStorage.getItem('pwa-install-dismissed')) {
      return;
    }
  }

  // ==================== INSTALL BUTTON MANAGEMENT ====================

  showInstallButton() {
    this.hideInstallButton();

    this.installButton = document.createElement("button");
    this.installButton.id = "pwa-install-btn";
    this.installButton.className = "pwa-install-btn";
    this.installButton.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7,10 12,15 17,10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
      Install App
    `;
    
    this.installButton.setAttribute("aria-label", "Install Story Share App");
    this.installButton.setAttribute("title", "Install app for better experience");
    
    this.installButton.addEventListener("click", () => {
      this.promptInstall();
    });

    this.addInstallButtonStyles();

    // Show with delay for better UX
    setTimeout(() => {
      document.body.appendChild(this.installButton);
      
      setTimeout(() => {
        this.installButton.classList.add('show');
      }, 100);
    }, 2000);
  }

  hideInstallButton() {
    if (this.installButton) {
      this.installButton.classList.remove('show');
      setTimeout(() => {
        if (this.installButton && this.installButton.parentElement) {
          this.installButton.remove();
        }
        this.installButton = null;
      }, 300);
    }
  }

  async promptInstall() {
    if (!this.deferredPrompt) {
      return;
    }

    try {
      this.hideInstallButton();
      this.deferredPrompt.prompt();
      
      const { outcome } = await this.deferredPrompt.userChoice;
      
      if (outcome === 'dismissed') {
        localStorage.setItem('pwa-install-dismissed', Date.now().toString());
      }
      
      this.deferredPrompt = null;
    } catch (error) {
      console.error('Error during install prompt:', error);
      this.showInstallButton();
    }
  }

  // ==================== SUCCESS MESSAGE ====================

  showInstalledMessage() {
    const message = document.createElement("div");
    message.className = "pwa-success-message";
    message.innerHTML = `
      <div class="success-content">
        <div class="success-icon">✅</div>
        <h3>App Installed Successfully!</h3>
        <p>Story Share has been installed on your device. You can now access it from your home screen.</p>
        <button class="close-btn" onclick="this.closest('.pwa-success-message').remove()">
          Got it!
        </button>
      </div>
    `;

    this.addSuccessMessageStyles();
    document.body.appendChild(message);

    // Auto remove after 8 seconds
    setTimeout(() => {
      if (message.parentElement) {
        message.remove();
      }
    }, 8000);
  }

  // ==================== UPDATE MESSAGE ====================

  showUpdateMessage() {
    const message = document.createElement("div");
    message.className = "pwa-update-message";
    message.innerHTML = `
      <div class="update-content">
        <div class="update-icon">🔄</div>
        <h3>Update Available</h3>
        <p>A new version of Story Share is available. Refresh to get the latest features.</p>
        <div class="update-actions">
          <button class="refresh-btn" onclick="window.location.reload()">
            Refresh Now
          </button>
          <button class="dismiss-btn" onclick="this.closest('.pwa-update-message').remove()">
            Later
          </button>
        </div>
      </div>
    `;

    this.addUpdateMessageStyles();
    document.body.appendChild(message);

    // Auto remove after 10 seconds
    setTimeout(() => {
      if (message.parentElement) {
        message.remove();
      }
    }, 10000);
  }

  // ==================== UPDATE CHECKING ====================

  checkForUpdates() {
    if ('serviceWorker' in navigator) {
      // Check for updates every 30 minutes
      setInterval(() => {
        navigator.serviceWorker.getRegistration().then(registration => {
          if (registration) {
            registration.update();
          }
        });
      }, 30 * 60 * 1000);
    }
  }

  // ==================== STYLES ====================

  addInstallButtonStyles() {
    if (document.getElementById('pwa-install-styles')) return;

    const style = document.createElement('style');
    style.id = 'pwa-install-styles';
    style.textContent = `
      .pwa-install-btn {
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 1000;
        
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border: none;
        border-radius: 50px;
        padding: 12px 20px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        
        display: flex;
        align-items: center;
        gap: 8px;
        
        box-shadow: 0 4px 20px rgba(0,0,0,0.15);
        transition: all 0.3s ease;
        transform: translateY(100px);
        opacity: 0;
      }
      
      .pwa-install-btn.show {
        transform: translateY(0);
        opacity: 1;
      }
      
      .pwa-install-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 25px rgba(0,0,0,0.2);
        background: linear-gradient(135deg, #764ba2 0%, #667eea 100%);
      }
      
      .pwa-install-btn:active {
        transform: translateY(0);
      }
      
      .pwa-install-btn svg {
        flex-shrink: 0;
      }
      
      @media (max-width: 768px) {
        .pwa-install-btn {
          bottom: 80px;
          right: 16px;
          left: 16px;
          width: auto;
          justify-content: center;
        }
      }
    `;
    
    document.head.appendChild(style);
  }

  addSuccessMessageStyles() {
    if (document.getElementById('pwa-success-styles')) return;

    const style = document.createElement('style');
    style.id = 'pwa-success-styles';
    style.textContent = `
      .pwa-success-message {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 10000;
        
        background: rgba(0,0,0,0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        
        animation: fadeIn 0.3s ease;
      }
      
      .success-content {
        background: white;
        border-radius: 12px;
        padding: 30px;
        max-width: 400px;
        text-align: center;
        box-shadow: 0 10px 40px rgba(0,0,0,0.2);
      }
      
      .success-icon {
        font-size: 48px;
        margin-bottom: 16px;
      }
      
      .success-content h3 {
        margin: 0 0 12px 0;
        color: #333;
        font-size: 20px;
      }
      
      .success-content p {
        margin: 0 0 24px 0;
        color: #666;
        line-height: 1.5;
      }
      
      .close-btn {
        background: #4CAF50;
        color: white;
        border: none;
        border-radius: 6px;
        padding: 12px 24px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.2s ease;
      }
      
      .close-btn:hover {
        background: #45a049;
      }
      
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
    `;
    
    document.head.appendChild(style);
  }

  addUpdateMessageStyles() {
    if (document.getElementById('pwa-update-styles')) return;

    const style = document.createElement('style');
    style.id = 'pwa-update-styles';
    style.textContent = `
      .pwa-update-message {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 9999;
        
        background: white;
        border-radius: 8px;
        padding: 20px;
        max-width: 320px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.15);
        border-left: 4px solid #2196F3;
        
        animation: slideIn 0.3s ease;
      }
      
      .update-content {
        text-align: left;
      }
      
      .update-icon {
        font-size: 20px;
        margin-bottom: 8px;
      }
      
      .update-content h3 {
        margin: 0 0 8px 0;
        color: #333;
        font-size: 16px;
      }
      
      .update-content p {
        margin: 0 0 16px 0;
        color: #666;
        font-size: 14px;
        line-height: 1.4;
      }
      
      .update-actions {
        display: flex;
        gap: 8px;
      }
      
      .refresh-btn {
        background: #2196F3;
        color: white;
        border: none;
        border-radius: 4px;
        padding: 8px 16px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        flex: 1;
        transition: background 0.2s ease;
      }
      
      .refresh-btn:hover {
        background: #1976D2;
      }
      
      .dismiss-btn {
        background: #f5f5f5;
        color: #666;
        border: none;
        border-radius: 4px;
        padding: 8px 16px;
        font-size: 13px;
        cursor: pointer;
        transition: background 0.2s ease;
      }
      
      .dismiss-btn:hover {
        background: #e0e0e0;
      }
      
      @keyframes slideIn {
        from { 
          transform: translateX(100%);
          opacity: 0;
        }
        to { 
          transform: translateX(0);
          opacity: 1;
        }
      }
      
      @media (max-width: 768px) {
        .pwa-update-message {
          top: 10px;
          right: 10px;
          left: 10px;
          max-width: none;
        }
      }
    `;
    
    document.head.appendChild(style);
  }
}

// ==================== INITIALIZATION ====================

// Initialize PWA installer when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new PWAInstaller();
  });
} else {
  new PWAInstaller();
}