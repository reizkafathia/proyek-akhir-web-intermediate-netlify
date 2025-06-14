class PWAInstaller {
  constructor() {
    this.deferredPrompt = null;
    this.init();
  }

  init() {
    // Listen for beforeinstallprompt event
    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      this.deferredPrompt = e;
      this.showInstallButton();
    });

    // Listen for app installed event
    window.addEventListener("appinstalled", () => {
      console.log("PWA was installed");
      this.hideInstallButton();
      this.showInstalledMessage();
    });
  }

  showInstallButton() {
    const installBtn = document.createElement("button");
    installBtn.id = "install-btn";
    installBtn.className = "install-btn";
    installBtn.innerHTML = "📱 Install App";
    installBtn.setAttribute("aria-label", "Install Story Share App");

    installBtn.addEventListener("click", () => {
      this.promptInstall();
    });

    // Add to page
    const body = document.body;
    body.appendChild(installBtn);
  }

  hideInstallButton() {
    const installBtn = document.getElementById("install-btn");
    if (installBtn) {
      installBtn.remove();
    }
  }

  async promptInstall() {
    if (!this.deferredPrompt) return;

    this.deferredPrompt.prompt();
    const { outcome } = await this.deferredPrompt.userChoice;

    console.log(`User response to install prompt: ${outcome}`);
    this.deferredPrompt = null;
    this.hideInstallButton();
  }

  showInstalledMessage() {
    const message = document.createElement("div");
    message.className = "install-success";
    message.innerHTML = `
      <p>✅ App installed successfully!</p>
      <button onclick="this.parentElement.remove()">OK</button>
    `;
    document.body.appendChild(message);

    setTimeout(() => {
      if (message.parentElement) {
        message.remove();
      }
    }, 5000);
  }
}

// Initialize PWA installer
new PWAInstaller();
