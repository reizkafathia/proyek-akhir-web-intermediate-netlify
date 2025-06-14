import { LoginPresenter } from "../../presenters/login-presenters.js";
import { AuthService } from "../../data/api.js";

export class LoginView {
  constructor() {
    this.presenter = null;
  }

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

  async afterRender() {
    this.presenter = new LoginPresenter(new AuthService(), this);
    document.body.classList.add("login-page"); // Hide hero section
    this.setupEventListeners();
    this.presenter.initialize();
  }

  setupEventListeners() {
    document.getElementById("login-tab").addEventListener("click", () =>
      this.presenter.handleTabSwitch("login")
    );

    document.getElementById("register-tab").addEventListener("click", () =>
      this.presenter.handleTabSwitch("register")
    );

    document.getElementById("login-form").addEventListener("submit", (e) => {
      e.preventDefault();
      this.presenter.handleLogin(new FormData(e.target));
    });

    document.getElementById("register-form").addEventListener("submit", (e) => {
      e.preventDefault();
      this.presenter.handleRegister(new FormData(e.target));
    });
  }

  // View update helpers
  showLoginTab() {
    this.toggleTabs(true);
    this.clearMessage();
  }

  showRegisterTab() {
    this.toggleTabs(false);
    this.clearMessage();
  }

  toggleTabs(showLogin) {
    document.getElementById("login-tab").classList.toggle("active", showLogin);
    document.getElementById("register-tab").classList.toggle("active", !showLogin);
    document.getElementById("login-form").style.display = showLogin ? "block" : "none";
    document.getElementById("register-form").style.display = showLogin ? "none" : "block";
  }

  showLoading(message) {
    this.showMessage(message, "loading");
  }

  showSuccess(message) {
    this.showMessage(message, "success");
  }

  showError(message) {
    this.showMessage(message, "error");
  }

  clearMessage() {
    this.showMessage("", "");
  }

  showMessage(text, type) {
    const msg = document.getElementById("auth-message");
    msg.className = `message ${type}`;
    msg.textContent = text;
  }

  setLoginEmail(email) {
    document.getElementById("login-email").value = email;
  }

  navigateToHome() {
    document.body.classList.remove("login-page"); // Show hero again
    window.location.hash = "#/";
  }
}
