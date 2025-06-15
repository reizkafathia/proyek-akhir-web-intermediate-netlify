import { LoginPresenter } from "../../presenters/login-presenters.js";
import { AuthService } from "../../data/api.js";

// ==================== LOGIN VIEW CLASS ====================
export class LoginView {
  // ==================== CONSTRUCTOR ====================
  constructor() {
    this.presenter = null;
  }

  // ==================== MAIN RENDER ====================
  render() {
    return `
      <div class="auth-container">
        <div class="auth-form">
          <h1>Story Share</h1>
          <p>Please login to continue</p>

          <div class="tab-buttons">
            <button id="login-tab" class="tab-btn active">Login</button>
            <button id="register-tab" class="tab-btn">Register</button>
          </div>

          <form id="login-form" class="auth-form-content">
            <div class="form-group">
              <label for="login-email">Email:</label>
              <input type="email" id="login-email" name="email" required>
            </div>

            <div class="form-group">
              <label for="login-password">Password:</label>
              <input type="password" id="login-password" name="password" required>
            </div>

            <button type="submit" class="auth-btn">Login</button>
          </form>

          <form id="register-form" class="auth-form-content" style="display: none;">
            <div class="form-group">
              <label for="register-name">Name:</label>
              <input type="text" id="register-name" name="name" required>
            </div>

            <div class="form-group">
              <label for="register-email">Email:</label>
              <input type="email" id="register-email" name="email" required>
            </div>

            <div class="form-group">
              <label for="register-password">Password:</label>
              <input type="password" id="register-password" name="password" required minlength="8">
            </div>

            <button type="submit" class="auth-btn">Register</button>
          </form>

          <div id="auth-message" class="message"></div>
        </div>
      </div>
    `;
  }

  // ==================== AFTER RENDER SETUP ====================
  async afterRender() {
    // Initialize presenter with AuthService
    this.presenter = new LoginPresenter(new AuthService(), this);
    
    // Add login page styling class
    document.body.classList.add("login-page"); 
    
    // Setup event listeners and initialize presenter
    this.setupEventListeners();
    this.presenter.initialize();
  }

  // ==================== EVENT LISTENERS SETUP ====================
  setupEventListeners() {
    // Login tab click handler
    document.getElementById("login-tab").addEventListener("click", () =>
      this.presenter.handleTabSwitch("login")
    );

    // Register tab click handler
    document.getElementById("register-tab").addEventListener("click", () =>
      this.presenter.handleTabSwitch("register")
    );

    // Login form submission handler
    document.getElementById("login-form").addEventListener("submit", (e) => {
      e.preventDefault();
      this.presenter.handleLogin(new FormData(e.target));
    });

    // Register form submission handler
    document.getElementById("register-form").addEventListener("submit", (e) => {
      e.preventDefault();
      this.presenter.handleRegister(new FormData(e.target));
    });
  }

  // ==================== TAB SWITCHING METHODS ====================

  // Show Login Tab
  showLoginTab() {
    this.toggleTabs(true);
    this.clearMessage();
  }

  // Show Register Tab
  showRegisterTab() {
    this.toggleTabs(false);
    this.clearMessage();
  }

  // Toggle Between Login and Register Tabs
  toggleTabs(showLogin) {
    // Update tab button states
    document.getElementById("login-tab").classList.toggle("active", showLogin);
    document.getElementById("register-tab").classList.toggle("active", !showLogin);
    
    // Toggle form visibility
    document.getElementById("login-form").style.display = showLogin ? "block" : "none";
    document.getElementById("register-form").style.display = showLogin ? "none" : "block";
  }

  // ==================== MESSAGE DISPLAY METHODS ====================

  // Show Loading Message
  showLoading(message) {
    this.showMessage(message, "loading");
  }

  // Show Success Message
  showSuccess(message) {
    this.showMessage(message, "success");
  }

  // Show Error Message
  showError(message) {
    this.showMessage(message, "error");
  }

  // Clear Message Display
  clearMessage() {
    this.showMessage("", "");
  }

  // Generic Message Display
  showMessage(text, type) {
    const msg = document.getElementById("auth-message");
    msg.className = `message ${type}`;
    msg.textContent = text;
  }

  // ==================== FORM HELPER METHODS ====================

  // Set Login Email Field Value
  setLoginEmail(email) {
    document.getElementById("login-email").value = email;
  }

  // ==================== NAVIGATION METHODS ====================

  // Navigate to Home Page
  navigateToHome() {
    // Remove login page styling
    document.body.classList.remove("login-page");
    
    // Navigate to home route
    window.location.hash = "#/";
  }
}