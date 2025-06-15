import { AuthService } from "../data/api.js";

// ==================== MAIN CLASS ====================
export class LoginPresenter {
  constructor(authService, view) {
    this.authService = authService;
    this.view = view;
  }

  // ==================== INITIALIZATION ====================
  initialize() {
    if (AuthService.isLoggedIn()) {
      this.view.navigateToHome();
      return;
    }
  }

  // ==================== TAB NAVIGATION ====================
  handleTabSwitch(tab) {
    if (tab === "login") {
      this.view.showLoginTab();
    } else if (tab === "register") {
      this.view.showRegisterTab();
    }
  }

  // ==================== LOGIN HANDLING ====================
  async handleLogin(formData) {
    const email = formData.get("email");
    const password = formData.get("password");

    // Validate input
    if (!this.validateLoginInput(email, password)) return;

    this.view.showLoading("Logging in...");
    try {
      await this.authService.login(email, password);
      this.view.showSuccess("Login successful! Redirecting...");
      setTimeout(() => {
        this.view.navigateToHome();
      }, 1000);
    } catch (error) {
      this.view.showError(error.message);
    }
  }

  // ==================== REGISTRATION HANDLING ====================
  async handleRegister(formData) {
    const name = formData.get("name");
    const email = formData.get("email");
    const password = formData.get("password");

    // Validate input
    if (!this.validateRegistrationInput(name, email, password)) return;

    this.view.showLoading("Creating account...");
    try {
      await this.authService.register(name, email, password);
      this.view.showSuccess("Registration successful! Please login with your credentials.");
      this.view.showLoginTab();
      this.view.setLoginEmail(email);
    } catch (error) {
      this.view.showError(error.message);
    }
  }

  // ==================== VALIDATION ====================
  validateLoginInput(email, password) {
    if (!email || !password) {
      this.view.showError("Please fill in all fields");
      return false;
    }
    if (!this.isValidEmail(email)) {
      this.view.showError("Please enter a valid email address");
      return false;
    }
    return true;
  }

  validateRegistrationInput(name, email, password) {
    if (!name || !email || !password) {
      this.view.showError("Please fill in all fields");
      return false;
    }
    if (name.trim().length < 2) {
      this.view.showError("Name must be at least 2 characters long");
      return false;
    }
    if (!this.isValidEmail(email)) {
      this.view.showError("Please enter a valid email address");
      return false;
    }
    if (password.length < 8) {
      this.view.showError("Password must be at least 8 characters long");
      return false;
    }
    return true;
  }

  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}