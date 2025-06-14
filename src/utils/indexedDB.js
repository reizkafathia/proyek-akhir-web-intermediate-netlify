class StoryDB {
  constructor() {
    this.dbName = "StoryShareDB";
    this.version = 3; // Increment version
    this.storyStore = "stories";
    this.draftStore = "drafts";
    this.favoriteStore = "favorites"; // New store for favorites
    this.db = null;
  }

  async openDB() {
    if (this.db) {
      return this.db;
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => {
        console.error('IndexedDB error:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('IndexedDB opened successfully');
        resolve(request.result);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        console.log('Upgrading IndexedDB from version', event.oldVersion, 'to', event.newVersion);

        // Store for published stories from API
        if (!db.objectStoreNames.contains(this.storyStore)) {
          const storyStore = db.createObjectStore(this.storyStore, {
            keyPath: "id",
            autoIncrement: true,
          });
          storyStore.createIndex("apiId", "apiId", { unique: false });
          storyStore.createIndex("createdAt", "createdAt", { unique: false });
          storyStore.createIndex("name", "name", { unique: false });
          console.log('Created stories store');
        }

        // Store for draft stories (offline)
        if (!db.objectStoreNames.contains(this.draftStore)) {
          const draftStore = db.createObjectStore(this.draftStore, {
            keyPath: "id",
            autoIncrement: true,
          });
          draftStore.createIndex("createdAt", "createdAt", { unique: false });
          draftStore.createIndex("name", "name", { unique: false });
          draftStore.createIndex("status", "status", { unique: false });
          console.log('Created drafts store');
        }

        // Store for favorite stories
        if (!db.objectStoreNames.contains(this.favoriteStore)) {
          const favoriteStore = db.createObjectStore(this.favoriteStore, {
            keyPath: "id",
            autoIncrement: true,
          });
          favoriteStore.createIndex("storyId", "storyId", { unique: true });
          favoriteStore.createIndex("savedAt", "savedAt", { unique: false });
          console.log('Created favorites store');
        }
      };
    });
  }

  // === STORY OPERATIONS ===

  async saveStory(storyData, isDraft = false) {
    try {
      const db = await this.openDB();
      const storeName = isDraft ? this.draftStore : this.storyStore;
      const transaction = db.transaction([storeName], "readwrite");
      const store = transaction.objectStore(storeName);

      const data = {
        ...storyData,
        id: isDraft ? undefined : storyData.id, // Let autoIncrement work for drafts
        savedAt: new Date().toISOString(),
        isDraft: isDraft
      };

      return new Promise((resolve, reject) => {
        const request = isDraft ? store.add(data) : store.put(data);
        request.onsuccess = () => {
          console.log(`Story ${isDraft ? 'draft' : 'published'} saved:`, request.result);
          resolve(request.result);
        };
        request.onerror = () => {
          console.error(`Error saving ${isDraft ? 'draft' : 'story'}:`, request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('Error in saveStory:', error);
      throw error;
    }
  }

  async getAllStories() {
    try {
      const db = await this.openDB();
      const stories = await this.getStoriesFromStore(db, this.storyStore);
      const drafts = await this.getStoriesFromStore(db, this.draftStore);

      return {
        stories: stories.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
        drafts: drafts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
        all: [...stories, ...drafts].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
        total: stories.length + drafts.length
      };
    } catch (error) {
      console.error('Error getting all stories:', error);
      return { stories: [], drafts: [], all: [], total: 0 };
    }
  }

  async getStoriesFromStore(db, storeName) {
    const transaction = db.transaction([storeName], "readonly");
    const store = transaction.objectStore(storeName);

    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => {
        console.error(`Error getting stories from ${storeName}:`, request.error);
        reject(request.error);
      };
    });
  }

  async getStoryById(id, isDraft = false) {
    try {
      const db = await this.openDB();
      const storeName = isDraft ? this.draftStore : this.storyStore;
      const transaction = db.transaction([storeName], "readonly");
      const store = transaction.objectStore(storeName);

      return new Promise((resolve, reject) => {
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Error getting story by ID:', error);
      throw error;
    }
  }

  async updateStory(id, updateData, isDraft = false) {
    try {
      const existingStory = await this.getStoryById(id, isDraft);
      if (!existingStory) {
        throw new Error('Story not found');
      }

      const updatedStory = {
        ...existingStory,
        ...updateData,
        updatedAt: new Date().toISOString()
      };

      const db = await this.openDB();
      const storeName = isDraft ? this.draftStore : this.storyStore;
      const transaction = db.transaction([storeName], "readwrite");
      const store = transaction.objectStore(storeName);

      return new Promise((resolve, reject) => {
        const request = store.put(updatedStory);
        request.onsuccess = () => {
          console.log('Story updated:', request.result);
          resolve(updatedStory);
        };
        request.onerror = () => {
          console.error('Error updating story:', request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('Error in updateStory:', error);
      throw error;
    }
  }

  async deleteStory(id, isDraft = false) {
    try {
      const db = await this.openDB();
      const storeName = isDraft ? this.draftStore : this.storyStore;
      const transaction = db.transaction([storeName], "readwrite");
      const store = transaction.objectStore(storeName);

      return new Promise((resolve, reject) => {
        const request = store.delete(id);
        request.onsuccess = () => {
          console.log(`Story deleted from ${storeName}:`, id);
          resolve(true);
        };
        request.onerror = () => {
          console.error('Error deleting story:', request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('Error in deleteStory:', error);
      throw error;
    }
  }

  // === FAVORITE OPERATIONS ===

  async addToFavorites(storyData) {
    try {
      const db = await this.openDB();
      const transaction = db.transaction([this.favoriteStore], "readwrite");
      const store = transaction.objectStore(this.favoriteStore);

      const favoriteData = {
        storyId: storyData.id,
        name: storyData.name,
        description: storyData.description,
        photoUrl: storyData.photoUrl,
        createdAt: storyData.createdAt,
        savedAt: new Date().toISOString(),
        originalData: storyData
      };

      return new Promise((resolve, reject) => {
        const request = store.add(favoriteData);
        request.onsuccess = () => {
          console.log('Added to favorites:', request.result);
          resolve(request.result);
        };
        request.onerror = () => {
          console.error('Error adding to favorites:', request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('Error in addToFavorites:', error);
      throw error;
    }
  }

  async removeFromFavorites(storyId) {
    try {
      const db = await this.openDB();
      const transaction = db.transaction([this.favoriteStore], "readwrite");
      const store = transaction.objectStore(this.favoriteStore);
      const index = store.index("storyId");

      return new Promise((resolve, reject) => {
        const request = index.get(storyId);
        request.onsuccess = () => {
          const favorite = request.result;
          if (favorite) {
            const deleteRequest = store.delete(favorite.id);
            deleteRequest.onsuccess = () => {
              console.log('Removed from favorites:', storyId);
              resolve(true);
            };
            deleteRequest.onerror = () => reject(deleteRequest.error);
          } else {
            resolve(false);
          }
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Error removing from favorites:', error);
      throw error;
    }
  }

  async getFavorites() {
    try {
      const db = await this.openDB();
      const transaction = db.transaction([this.favoriteStore], "readonly");
      const store = transaction.objectStore(this.favoriteStore);

      return new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => {
          const favorites = request.result.sort((a, b) => 
            new Date(b.savedAt) - new Date(a.savedAt)
          );
          resolve(favorites);
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Error getting favorites:', error);
      return [];
    }
  }

  async isFavorite(storyId) {
    try {
      const db = await this.openDB();
      const transaction = db.transaction([this.favoriteStore], "readonly");
      const store = transaction.objectStore(this.favoriteStore);
      const index = store.index("storyId");

      return new Promise((resolve, reject) => {
        const request = index.get(storyId);
        request.onsuccess = () => resolve(!!request.result);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Error checking if favorite:', error);
      return false;
    }
  }

  // === UTILITY METHODS ===

  async getStats() {
    try {
      const stories = await this.getAllStories();
      const favorites = await this.getFavorites();
      
      return {
        totalStories: stories.total,
        publishedStories: stories.stories.length,
        draftStories: stories.drafts.length,
        favoriteStories: favorites.length,
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error getting stats:', error);
      return {
        totalStories: 0,
        publishedStories: 0,
        draftStories: 0,
        favoriteStories: 0,
        error: error.message
      };
    }
  }

  async searchStories(searchTerm) {
    try {
      const allStories = await this.getAllStories();
      const searchLower = searchTerm.toLowerCase();
      
      const filteredStories = allStories.all.filter(story => 
        story.name?.toLowerCase().includes(searchLower) ||
        story.description?.toLowerCase().includes(searchLower)
      );

      return filteredStories;
    } catch (error) {
      console.error('Error searching stories:', error);
      return [];
    }
  }

  async clearAllData() {
    try {
      const db = await this.openDB();
      const stores = [this.storyStore, this.draftStore, this.favoriteStore];
      
      const transaction = db.transaction(stores, "readwrite");
      
      const clearPromises = stores.map(storeName => {
        return new Promise((resolve, reject) => {
          const request = transaction.objectStore(storeName).clear();
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });
      });

      await Promise.all(clearPromises);
      console.log('All data cleared successfully');
      return true;
    } catch (error) {
      console.error('Error clearing all data:', error);
      throw error;
    }
  }

  closeDB() {
    if (this.db) {
      this.db.close();
      this.db = null;
      console.log('Database connection closed');
    }
  }

  static isSupported() {
    return 'indexedDB' in window;
  }
}

// Create singleton instance
const storyDB = new StoryDB();

// Export for ES modules
export default storyDB;
export { StoryDB };