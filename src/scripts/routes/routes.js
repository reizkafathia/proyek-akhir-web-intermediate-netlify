import { HomeView } from "../pages/views/home.js";
import { StoryDBManagerView } from "../pages/views/story-manager.js";
import { LoginView } from "../pages/views/login.js";

// ==================== ROUTES CONFIGURATION ====================
const routes = {
  "/": HomeView,
  "/story-manager": StoryDBManagerView,
  "/login": LoginView,
  "/offline": () => "<h1>You're offline. Please check your connection.</h1>",
};

// ==================== ROUTER CLASS ====================
export class Router {
  constructor() {
    this.routes = routes;
    this.app = document.getElementById("app");
  }

  // ==================== INITIALIZATION ====================
  async init() {
    // Handle initial route
    this.handleRoute(location.hash);

    // Listen for hash changes
    window.addEventListener("hashchange", () => {
      this.handleRoute(location.hash);
    });
  }

  // ==================== ROUTE HANDLER ====================
  handleRoute(hash) {
    const path = hash.replace("#", "") || "/";
    const ViewClass = this.routes[path];

    // Handle 404 - Route not found
    if (!ViewClass) {
      this.app.innerHTML = "<h2>404 - Page Not Found</h2>";
      return;
    }

    // Render the view
    const viewInstance = new ViewClass();
    this.app.innerHTML = viewInstance.render();

    // Execute post-render logic if available
    if (typeof viewInstance.afterRender === "function") {
      viewInstance.afterRender();
    }
  }
}