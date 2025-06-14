import { HomeView } from "../pages/views/home.js";
import { StoryDBManagerView } from "../pages/views/story-manager.js";
import { LoginView } from "../pages/views/login.js"; // pastikan path ini benar

const routes = {
  "/": HomeView,
  "/story-manager": StoryDBManagerView,
  "/login": LoginView,
  "/offline": () => "<h1>You're offline. Please check your connection.</h1>",
};

export class Router {
  constructor() {
    this.routes = routes;
    this.app = document.getElementById("app");
  }

  async init() {
    // Jalankan routing pertama kali
    this.handleRoute(location.hash);

    // Dengarkan perubahan hash
    window.addEventListener("hashchange", () => {
      this.handleRoute(location.hash);
    });
  }

  handleRoute(hash) {
    const path = hash.replace("#", "") || "/";
    const ViewClass = this.routes[path];

    if (!ViewClass) {
      this.app.innerHTML = "<h2>404 - Page Not Found</h2>";
      return;
    }

    const viewInstance = new ViewClass();
    this.app.innerHTML = viewInstance.render();

    if (typeof viewInstance.afterRender === "function") {
      viewInstance.afterRender();
    }
  }
}
