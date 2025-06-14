import { StoryModel, AuthService } from "../../data/api.js";
import { HomePresenter } from "../../presenters/home-presenters.js";

export class HomeView {
  constructor() {
    this.presenter = null;
    this.mapInstance = null;
    this.addMapInstance = null;
  }

  render() {
    return `
      <div class="header">
        <div class="hero">
          <h1>Story Share</h1>
          <p>Share your stories with the world</p>
        </div>
        
        <div class="user-info">
          <span>Welcome back!</span>
          <button id="logout-btn" class="logout-btn">Logout</button>
        </div>
      </div>
      
      <nav class="nav-buttons">
        <button id="stories-btn">View Stories</button>
        <button id="add-story-btn">Add Story</button>
      </nav>
      
      <div id="content"></div>
    `;
  }

  async afterRender() {
    const model = new StoryModel();
    this.presenter = new HomePresenter(model, this);

    this.setupEventListeners();
    await this.presenter.initialize();
  }

  setupEventListeners() {
    document.getElementById("stories-btn").addEventListener("click", () => {
      this.presenter.handleShowStories();
    });

    document.getElementById("add-story-btn").addEventListener("click", () => {
      this.presenter.handleShowAddStoryForm();
    });

    document.getElementById("logout-btn").addEventListener("click", () => {
      this.presenter.handleLogout();
    });
  }

  renderStories(stories) {
    const content = document.getElementById("content");
    content.innerHTML = `
      <h2>Stories</h2>
      <div id="map" style="height: 400px; margin: 20px 0;"></div>
      <div class="stories-grid">
        ${stories.map(story => `
          <div class="story-card">
            <img src="${story.photoUrl}" alt="${story.name}" loading="lazy">
            <h3>${story.name}</h3>
            <p>${story.description}</p>
            <small>Created: ${new Date(story.createdAt).toLocaleDateString()}</small>
          </div>
        `).join("")}
      </div>
    `;

    this.initMap(stories);
  }

  renderAddStoryForm() {
    const content = document.getElementById("content");
    content.innerHTML = `
      <h2>Add New Story</h2>
      <form id="story-form" class="story-form">
        <div class="form-group">
          <label for="story-name">Story Title:</label>
          <input type="text" id="story-name" name="name" required>
        </div>
        
        <div class="form-group">
          <label for="story-description">Description:</label>
          <textarea id="story-description" name="description" required></textarea>
        </div>
        
        <div class="form-group">
          <label for="photo-input">Photo:</label>
          <input type="file" id="photo-input" name="photo" accept="image/*" required>
          <button type="button" id="camera-btn">Use Camera</button>
        </div>
        
        <div id="camera-container" style="display: none;">
          <video id="camera-preview" style="width: 100%; max-width: 300px; border-radius: 10px;"></video>
          <div class="camera-controls" style="margin-top: 10px;">
            <button type="button" id="capture-btn" class="capture-btn">📸 Capture Photo</button>
            <button type="button" id="stop-camera-btn" class="stop-camera-btn">❌ Close Camera</button>
          </div>
        </div>
        
        <canvas id="photo-canvas" style="display: none;"></canvas>
        
        <div class="form-group">
          <label>Location (click on map):</label>
          <div id="add-map" style="height: 300px; margin: 10px 0;"></div>
          <input type="hidden" id="lat-input" name="lat">
          <input type="hidden" id="lon-input" name="lon">
        </div>
        
        <button type="submit">Add Story</button>
        <button type="button" id="cancel-btn">Cancel</button>
      </form>
    `;

    this.setupFormEventListeners();
    this.initAddForm();
  }

  setupFormEventListeners() {
    document.getElementById("story-form").addEventListener("submit", (e) => {
      e.preventDefault();
      this.presenter.handleAddStory(new FormData(e.target));
    });

    document.getElementById("cancel-btn").addEventListener("click", () => {
      this.presenter.handleShowStories();
    });

    document.getElementById("camera-btn").addEventListener("click", () => {
      this.presenter.handleCameraToggle();
    });
  }

  initMap(stories) {
    if (this.mapInstance) {
      this.mapInstance.remove();
    }

    const map = L.map("map").setView([-6.2088, 106.8456], 10);
    this.mapInstance = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
    }).addTo(map);

    stories.forEach(story => {
      if (story.lat && story.lon) {
        L.marker([story.lat, story.lon])
          .addTo(map)
          .bindPopup(`
            <strong>${story.name}</strong><br>
            ${story.description}<br>
            <img src="${story.photoUrl}" style="width: 100px; height: auto;">
          `);
      }
    });
  }

  initAddForm() {
    if (this.addMapInstance) {
      this.addMapInstance.remove();
    }

    const map = L.map("add-map").setView([-6.2088, 106.8456], 10);
    this.addMapInstance = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
    }).addTo(map);

    let marker;

    map.on("click", (e) => {
      const { lat, lng } = e.latlng;

      if (marker) {
        map.removeLayer(marker);
      }

      marker = L.marker([lat, lng]).addTo(map);
      document.getElementById("lat-input").value = lat;
      document.getElementById("lon-input").value = lng;
    });
  }

  async startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      const video = document.getElementById("camera-preview");
      const container = document.getElementById("camera-container");

      video.srcObject = stream;
      container.style.display = "block";
      video.play();

      this.setupCameraControls(stream);
      return true;
    } catch (error) {
      this.showError("Camera access denied or not available");
      return false;
    }
  }

  setupCameraControls(stream) {
    document.getElementById("capture-btn").addEventListener("click", () => {
      this.capturePhoto();
    });

    document.getElementById("stop-camera-btn").addEventListener("click", () => {
      this.stopCamera(stream);
    });
  }

  capturePhoto() {
    const video = document.getElementById("camera-preview");
    const canvas = document.getElementById("photo-canvas");
    const photoInput = document.getElementById("photo-input");

    const context = canvas.getContext("2d");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0);

    canvas.toBlob((blob) => {
      const file = new File([blob], "camera-photo.jpg", { type: "image/jpeg" });
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      photoInput.files = dataTransfer.files;

      this.showSuccess("Photo captured successfully!");
    });

    const stream = video.srcObject;
    this.stopCamera(stream);
  }

  stopCamera(stream) {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
    document.getElementById("camera-container").style.display = "none";
  }

  showLoading(message = "Loading...") {
    const content = document.getElementById("content");
    content.innerHTML = `<div class="loading">${message}</div>`;
  }

  showError(message) {
    const content = document.getElementById("content");
    content.innerHTML = `<div class="error">Error: ${message}</div>`;
  }

  showSuccess(message) {
    const successDiv = document.createElement("div");
    successDiv.className = "success-message";
    successDiv.textContent = message;
    successDiv.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #4CAF50;
      color: white;
      padding: 15px 20px;
      border-radius: 5px;
      z-index: 1000;
      animation: slideInRight 0.3s ease;
    `;

    document.body.appendChild(successDiv);

    setTimeout(() => {
      successDiv.remove();
    }, 3000);
  }
}
