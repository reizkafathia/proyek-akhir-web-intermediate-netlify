import { AuthService } from "../data/api.js";

export class LoginPresenter {
  constructor(authService, view) {
    this.authService = authService;
    this.view = view;
  }

  initialize() {
    if (AuthService.isLoggedIn()) {
      this.view.navigateToHome();
      return;
    }
  }

  handleTabSwitch(tab) {
    if (tab === "login") {
      this.view.showLoginTab();
    } else if (tab === "register") {
      this.view.showRegisterTab();
    }
  }

  async handleLogin(formData) {
    const email = formData.get("email");
    const password = formData.get("password");

    if (!email || !password) {
      this.view.showError("Please fill in all fields");
      return;
    }

    if (!this.isValidEmail(email)) {
      this.view.showError("Please enter a valid email address");
      return;
    }

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

  async handleRegister(formData) {
    const name = formData.get("name");
    const email = formData.get("email");
    const password = formData.get("password");

    if (!name || !email || !password) {
      this.view.showError("Please fill in all fields");
      return;
    }

    if (name.trim().length < 2) {
      this.view.showError("Name must be at least 2 characters long");
      return;
    }

    if (!this.isValidEmail(email)) {
      this.view.showError("Please enter a valid email address");
      return;
    }

    if (password.length < 8) {
      this.view.showError("Password must be at least 8 characters long");
      return;
    }

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

  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}
