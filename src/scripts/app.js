import { Router } from "./routes/routes.js";
import StoryDBManager from './views/StoryDBManager.js';
import storyDB from './utils/indexedDB.js';

// Make storyDB available globally for the component
window.storyDB = storyDB;

document.addEventListener("DOMContentLoaded", async () => {
  // Skip to content functionality
  const skipLink = document.createElement("a");
  skipLink.href = "#main-content";
  skipLink.textContent = "Skip to main content";
  skipLink.className = "skip-link";
  document.body.insertBefore(skipLink, document.body.firstChild);

  const router = new Router();
  await router.init();
});
