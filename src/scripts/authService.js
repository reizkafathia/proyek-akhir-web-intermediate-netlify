import { BASE_URL } from "./config.js";
import NotificationManager from "../utils/notification.js";

export class AuthService {
  static getToken() {
    return sessionStorage.getItem("authToken");
  }

  static setToken(token) {
    sessionStorage.setItem("authToken", token);
  }

  static removeToken() {
    sessionStorage.removeItem("authToken");
  }

  static isLoggedIn() {
    return !!this.getToken();
  }

  async login(email, password) {
    const response = await fetch(`${BASE_URL}/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        password,
      }),
    });

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ message: "Login failed" }));
      throw new Error(error.message || "Login failed");
    }

    const result = await response.json();
    console.log("Login response:", result);

    const token =
      result.loginResult?.token || result.data?.token || result.token;

    if (!token) {
      console.error("No token found in response:", result);
      throw new Error("Invalid response from server");
    }

    AuthService.setToken(token);

    const userName =
      result.loginResult?.name || result.data?.name || "pengguna";
    NotificationManager.showLocalNotification("Login Berhasil", {
      body: `Selamat datang kembali, ${userName}!`,
    });

    return result;
  }

  async register(name, email, password) {
    const response = await fetch(`${BASE_URL}/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        email,
        password,
      }),
    });

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ message: "Registration failed" }));
      throw new Error(error.message || "Registration failed");
    }

    const result = await response.json();
    console.log("Register response:", result);

    NotificationManager.showLocalNotification("Registrasi Berhasil", {
      body: "Silakan login untuk melanjutkan.",
    });

    return result;
  }

  logout() {
    AuthService.removeToken();
    NotificationManager.showLocalNotification("Logout Berhasil", {
      body: "Sampai jumpa lagi!",
    });
    window.location.hash = "#/login";
  }
}
