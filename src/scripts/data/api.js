import { BASE_URL } from "../../scripts/config.js";
import { showNotification } from "../../utils/notification.js";

// ==================== AUTH FUNCTIONS ====================
// Register
export const register = async (name, email, password) => {
  const response = await fetch(`${BASE_URL}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password }),
  });

  if (!response.ok) {
    const errorData = await response
      .json()
      .catch(() => ({ message: "Registration failed" }));
    throw new Error(errorData.message || "Registrasi gagal");
  }

  const result = await response.json();
  showNotification("Registrasi Berhasil", {
    body: "Silakan login untuk melanjutkan.",
  });

  return result;
};

// Login
export const login = async (email, password) => {
  const response = await fetch(`${BASE_URL}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const errorData = await response
      .json()
      .catch(() => ({ message: "Login failed" }));
    throw new Error(errorData.message || "Login gagal");
  }

  const result = await response.json();
  console.log("Login response:", result);

  const token = result.loginResult?.token || result.data?.token || result.token;
  if (!token) {
    console.error("No token found in response:", result);
    throw new Error("Login gagal: token tidak ditemukan.");
  }

  sessionStorage.setItem("authToken", token);

  const userName = result.loginResult?.name || result.data?.name || "pengguna";
  showNotification("Login Berhasil", {
    body: `Selamat datang kembali, ${userName}!`,
  });

  return result;
};

// Logout
export const logout = () => {
  sessionStorage.removeItem("authToken");
  showNotification("Logout Berhasil", { body: "Sampai jumpa lagi!" });
  window.location.href = "/#/login"; // force redirect
};

// ==================== TOKEN HELPERS ====================
export const getToken = () => sessionStorage.getItem("authToken");

export const isLoggedIn = () => !!getToken();

// ==================== STORY MODEL ====================
export class StoryModel {
  async getStories() {
    const token = getToken();
    const response = await fetch(`${BASE_URL}/stories`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) throw new Error("Failed to fetch stories");

    return await response.json();
  }

  async createStory(storyData) {
    const token = getToken();

    const formData = new FormData();
    formData.append("description", storyData.description);
    formData.append("photo", storyData.photo);

    if (storyData.lat && storyData.lon) {
      formData.append("lat", storyData.lat);
      formData.append("lon", storyData.lon);
    }

    const response = await fetch(`${BASE_URL}/stories`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ message: "Failed to create story" }));
      throw new Error(errorData.message || "Failed to create story");
    }

    return await response.json();
  }

  // ==================== STATIC METHODS ====================
  static async getStories() {
    const instance = new StoryModel();
    return instance.getStories();
  }

  static async createStory(storyData) {
    const instance = new StoryModel();
    return instance.createStory(storyData);
  }
}

// ==================== AUTH SERVICE CLASS ====================
export class AuthService {
  // ==================== STATIC TOKEN METHODS ====================
  static getToken() {
    return getToken();
  }

  static setToken(token) {
    sessionStorage.setItem("authToken", token);
  }

  static removeToken() {
    sessionStorage.removeItem("authToken");
    showNotification("Logout Berhasil", { body: "Sampai jumpa lagi!" });
    window.location.href = "/#/login";
  }

  static isLoggedIn() {
    return isLoggedIn();
  }

  static logout() {
    logout(); // Uses the standalone logout function
  }

  // ==================== INSTANCE METHODS ====================
  async login(email, password) {
    return await login(email, password);
  }

  async register(name, email, password) {
    return await register(name, email, password);
  }

  logout() {
    logout(); // Instance-level logout just redirects
  }
}
