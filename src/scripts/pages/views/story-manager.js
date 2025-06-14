// src/scripts/pages/views/story-manager.js
import storyDB from "../../../utils/indexedDB.js";

export class StoryDBManagerView {
  constructor() {
    this.title = "Story Database Manager";
    this.storyDB = storyDB;
  }

  render() {
    return `
      <div class="story-manager-container">
        <div id="story-db-manager-root"></div>

        <!-- Loading while component loads -->
        <div id="story-manager-loading" class="loading-placeholder">
          <div class="loading-spinner"></div>
          <p>Loading Story Manager...</p>
        </div>
      </div>

      <style>
        .story-manager-container {
          min-height: 100vh;
          background-color: #f9fafb;
        }
        .loading-placeholder {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 50vh;
          color: #6b7280;
        }
        .loading-spinner {
          width: 40px;
          height: 40px;
          border: 4px solid #e5e7eb;
          border-top: 4px solid #3b82f6;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin-bottom: 16px;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .story-manager-container:has(#story-db-manager-root:not(:empty)) #story-manager-loading {
          display: none;
        }
      </style>
    `;
  }

  async afterRender() {
    try {
      await this.storyDB.openDB();
      await this.mountComponent();
    } catch (error) {
      console.error("Error initializing Story Manager:", error);
      this.showError(error.message);
    }
  }

  async mountComponent() {
    const rootElement = document.getElementById("story-db-manager-root");
    if (!rootElement) throw new Error("Root element not found");

    try {
      // Fixed path: go up to src, then to components
      const { default: StoryDBManager } = await import("../../../components/StoryDBManager.js");
      const manager = new StoryDBManager(rootElement, this.storyDB);
      await manager.render();
    } catch (error) {
      console.error("Error loading component:", error);
      this.renderFallback();
    }
  }

  renderFallback() {
    const rootElement = document.getElementById("story-db-manager-root");
    if (!rootElement) return;

    rootElement.innerHTML = `
      <div class="p-6">
        <h1 class="text-2xl font-bold mb-4">Story Manager Fallback</h1>
        <div class="text-yellow-700 mb-4">
          ⚠️ Fallback mode active. Full functionality may not be available.
        </div>
        <div id="db-status" class="mb-4">Checking database...</div>
        <button id="test-db" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
          Test Database Connection
        </button>
      </div>
    `;

    const statusDiv = rootElement.querySelector("#db-status");
    const button = rootElement.querySelector("#test-db");

    button.addEventListener("click", async () => {
      statusDiv.textContent = "Testing...";
      try {
        await this.storyDB.openDB();
        const stats = await this.storyDB.getStats();
        statusDiv.innerHTML = `
          <div class="text-green-600">
            ✓ Connected<br>
            Total: ${stats.totalStories}, Drafts: ${stats.draftStories}, Favorites: ${stats.favoriteStories}
          </div>
        `;
      } catch (err) {
        statusDiv.innerHTML = `<div class="text-red-600">✗ Failed: ${err.message}</div>`;
      }
    });

    button.click(); // auto-test
  }

  showError(message) {
    const rootElement = document.getElementById("story-db-manager-root");
    if (!rootElement) return;

    rootElement.innerHTML = `
      <div class="p-6 bg-red-50 border border-red-200 rounded-lg max-w-xl mx-auto mt-6">
        <h2 class="text-red-800 font-semibold text-lg mb-2">Error Loading Story Manager</h2>
        <p class="text-red-700 mb-4">${message}</p>
        <button onclick="window.location.reload()" class="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">
          Reload Page
        </button>
      </div>
    `;
  }

  destroy() {
    const rootElement = document.getElementById("story-db-manager-root");
    if (rootElement) rootElement.innerHTML = "";
  }
}