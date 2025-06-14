export class LoginPresenter {
  constructor(authService, view) {
    this.authService = authService;
    this.view = view;
  }

  // Handle initialization logic
  initialize() {
    // Business logic: Check if already logged in
    if (this.authService.constructor.isLoggedIn()) {
      this.view.navigateToHome();
      return;
    }
  }

  // Handle tab switching logic
  handleTabSwitch(tab) {
    if (tab === "login") {
      this.view.showLoginTab();
    } else if (tab === "register") {
      this.view.showRegisterTab();
    }
  }

  // Handle login business logic
  async handleLogin(formData) {
    const email = formData.get("email");
    const password = formData.get("password");

    // Validation logic
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
      // Call model/service
      await this.authService.login(email, password);

      // Success handling
      this.view.showSuccess("Login successful! Redirecting...");

      setTimeout(() => {
        this.view.navigateToHome();
      }, 1000);
    } catch (error) {
      this.view.showError(error.message);
    }
  }

  // Handle registration business logic
  async handleRegister(formData) {
    const name = formData.get("name");
    const email = formData.get("email");
    const password = formData.get("password");

    // Validation logic
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
      // Call model/service
      await this.authService.register(name, email, password);

      // Success handling
      this.view.showSuccess(
        "Registration successful! Please login with your credentials."
      );

      // Switch to login tab and prefill email
      this.view.showLoginTab();
      this.view.setLoginEmail(email);
    } catch (error) {
      this.view.showError(error.message);
    }
  }

  // Utility method for email validation
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}
