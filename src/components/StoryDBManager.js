// src/components/StoryDBManager.js
export default class StoryDBManager {
  constructor(rootElement, storyDB) {
    this.root = rootElement;
    this.storyDB = storyDB;
  }

  async render() {
    this.root.innerHTML = `
      <div class="p-6 max-w-4xl mx-auto">
        <h1 class="text-2xl font-bold text-gray-900 mb-4">Story Database Manager</h1>

        <div id="stats-box" class="bg-white rounded shadow p-4 mb-4">
          <h2 class="font-semibold text-lg mb-2">Database Stats</h2>
          <div id="db-status">Loading...</div>
        </div>

        <div class="flex gap-4 mb-6">
          <button id="refresh-btn" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
            Refresh Stats
          </button>
          <button id="clear-data-btn" class="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">
            Clear All Data
          </button>
        </div>

        <div id="stories-section" class="bg-white rounded shadow p-4">
          <h2 class="font-semibold text-lg mb-2">Stories</h2>
          <div id="stories-list">Loading stories...</div>
        </div>
      </div>
    `;

    this.refreshButton = this.root.querySelector('#refresh-btn');
    this.clearDataButton = this.root.querySelector('#clear-data-btn');
    this.statusDiv = this.root.querySelector('#db-status');
    this.storiesListDiv = this.root.querySelector('#stories-list');

    this.refreshButton.addEventListener('click', () => this.loadStats());
    this.clearDataButton.addEventListener('click', () => this.clearAllData());
    
    await this.loadStats();
    await this.loadStories();
  }

  async loadStats() {
    this.statusDiv.textContent = 'Fetching stats...';

    try {
      const stats = await this.storyDB.getStats();
      this.statusDiv.innerHTML = `
        <ul class="list-disc ml-5 text-green-700">
          <li>Total Stories: ${stats.totalStories}</li>
          <li>Published: ${stats.publishedStories}</li>
          <li>Drafts: ${stats.draftStories}</li>
          <li>Favorites: ${stats.favoriteStories}</li>
          <li>Last Updated: ${new Date(stats.lastUpdated).toLocaleString()}</li>
        </ul>
      `;
    } catch (err) {
      this.statusDiv.innerHTML = `<div class="text-red-600">Failed to fetch stats: ${err.message}</div>`;
    }
  }

  async loadStories() {
    this.storiesListDiv.textContent = 'Loading stories...';

    try {
      const data = await this.storyDB.getAllStories();
      
      if (data.total === 0) {
        this.storiesListDiv.innerHTML = '<p class="text-gray-500">No stories found.</p>';
        return;
      }

      let html = '<div class="space-y-4">';
      
      if (data.stories.length > 0) {
        html += '<h3 class="font-medium text-green-700">Published Stories:</h3>';
        data.stories.forEach(story => {
          html += this.renderStoryCard(story, false);
        });
      }

      if (data.drafts.length > 0) {
        html += '<h3 class="font-medium text-yellow-700 mt-4">Draft Stories:</h3>';
        data.drafts.forEach(story => {
          html += this.renderStoryCard(story, true);
        });
      }

      html += '</div>';
      this.storiesListDiv.innerHTML = html;

      // Add event listeners for delete buttons
      this.root.querySelectorAll('.delete-story-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const storyId = parseInt(e.target.dataset.storyId);
          const isDraft = e.target.dataset.isDraft === 'true';
          this.deleteStory(storyId, isDraft);
        });
      });

    } catch (err) {
      this.storiesListDiv.innerHTML = `<div class="text-red-600">Failed to load stories: ${err.message}</div>`;
    }
  }

  renderStoryCard(story, isDraft) {
    return `
      <div class="border rounded p-3 ${isDraft ? 'border-yellow-200 bg-yellow-50' : 'border-green-200 bg-green-50'}">
        <div class="flex justify-between items-start">
          <div>
            <h4 class="font-medium">${story.name || 'Untitled'}</h4>
            <p class="text-sm text-gray-600">${story.description || 'No description'}</p>
            <p class="text-xs text-gray-400 mt-1">
              Created: ${new Date(story.createdAt).toLocaleString()}
              ${story.updatedAt ? ` | Updated: ${new Date(story.updatedAt).toLocaleString()}` : ''}
            </p>
          </div>
          <button 
            class="delete-story-btn px-2 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600"
            data-story-id="${story.id}"
            data-is-draft="${isDraft}"
          >
            Delete
          </button>
        </div>
      </div>
    `;
  }

  async deleteStory(storyId, isDraft) {
    if (!confirm(`Are you sure you want to delete this ${isDraft ? 'draft' : 'story'}?`)) {
      return;
    }

    try {
      await this.storyDB.deleteStory(storyId, isDraft);
      await this.loadStats();
      await this.loadStories();
    } catch (err) {
      alert(`Failed to delete story: ${err.message}`);
    }
  }

  async clearAllData() {
    if (!confirm('Are you sure you want to clear ALL data? This cannot be undone!')) {
      return;
    }

    try {
      await this.storyDB.clearAllData();
      await this.loadStats();
      await this.loadStories();
      alert('All data cleared successfully!');
    } catch (err) {
      alert(`Failed to clear data: ${err.message}`);
    }
  }
}