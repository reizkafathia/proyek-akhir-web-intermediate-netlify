import { AuthService } from "../data/api.js";
import NotificationManager from "../../utils/notification.js";

export class HomePresenter {
  constructor(model, view) {
    this.model = model;
    this.view = view;
  }

  // Initialization: check login and load stories
  async initialize() {
    if (!AuthService.isLoggedIn()) {
      window.location.hash = "#/login";
      return;
    }
    await this.handleShowStories();
  }

  // Load and show stories
  async handleShowStories() {
    try {
      this.view.showLoading("Loading stories...");
      const response = await this.model.getStories();
      const stories = response.listStory || response.data || response;
      this.view.renderStories(Array.isArray(stories) ? stories : []);
    } catch (error) {
      console.error("Error loading stories:", error);
      this.view.showError("Failed to load stories: " + error.message);
    }
  }

  // Show form to add new story
  handleShowAddStoryForm() {
    this.view.renderAddStoryForm();
  }

  // Logout user and redirect to login page
  handleLogout() {
    try {
      if (confirm("Are you sure you want to logout?")) {
        AuthService.logout();
        NotificationManager.showLocalNotification("Logged out", {
          body: "You have been logged out successfully",
        });
        // Redundant but safe:
        window.location.hash = "#/login";
      }
    } catch (error) {
      console.error("Logout error:", error);
      this.view.showError("Failed to logout");
    }
  }

  // Start or toggle camera view
  async handleCameraToggle() {
    try {
      const success = await this.view.startCamera();
      if (!success) {
        this.view.showError("Failed to access camera");
      }
    } catch (error) {
      console.error("Camera error:", error);
      this.view.showError("Failed to access camera: " + error.message);
    }
  }

  // Add new story with validation
  async handleAddStory(formData) {
    try {
      this.view.showLoading("Adding story...");

      const name = formData.get("name");
      const description = formData.get("description");
      const lat = formData.get("lat");
      const lon = formData.get("lon");
      const photo = formData.get("photo");

      // Validate inputs
      if (!name || name.trim() === "") throw new Error("Story title is required");
      if (!description || description.trim() === "") throw new Error("Description is required");
      if (!lat || !lon) throw new Error("Please select a location on the map");
      if (!photo || photo.size === 0) throw new Error("Please select a photo or capture one with camera");
      if (photo.size > 5 * 1024 * 1024) throw new Error("Photo size must be less than 5MB");
      if (description.length > 1000) throw new Error("Description must be less than 1000 characters");

      const storyData = {
        name: name.trim(),
        description: description.trim(),
        photo: photo,
        lat: parseFloat(lat),
        lon: parseFloat(lon),
      };

      // Save story with model method
      if (typeof this.model.createStory === "function") {
        await this.model.createStory(storyData);
      } else if (typeof this.model.addStory === "function") {
        await this.model.addStory(formData);
      } else {
        throw new Error("Model method to add story is not implemented");
      }

      this.view.showSuccess("Story added successfully!");

      // Reload stories immediately after success
      await this.handleShowStories();
    } catch (error) {
      console.error("Error adding story:", error);
      this.view.showError(error.message || "Failed to add story");
    }
  }
}
