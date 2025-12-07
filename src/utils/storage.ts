// IndexedDB Storage Manager
// Provides ~50MB-unlimited storage vs localStorage's 5MB limit

const DB_NAME = 'neural-nexus-db';
const DB_VERSION = 2;

type StoreName = 'sessions' | 'knowledge' | 'settings' | 'embeddings';

interface DBManager {
  db: IDBDatabase | null;
  init: () => Promise<IDBDatabase>;
  getAll: <T>(storeName: StoreName) => Promise<T[]>;
  get: <T>(storeName: StoreName, key: string | number) => Promise<T | undefined>;
  put: <T extends { id?: number | string; key?: string }>(storeName: StoreName, item: T) => Promise<IDBValidKey>;
  putAll: <T>(storeName: StoreName, items: T[]) => Promise<void>;
  delete: (storeName: StoreName, key: string | number) => Promise<void>;
  clear: (storeName: StoreName) => Promise<void>;
  getStorageEstimate: () => Promise<{ used: number; quota: number; percent: string }>;
}

export const dbManager: DBManager = {
  db: null,
  
  async init() {
    if (this.db) return this.db;
    
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      
      request.onerror = () => reject(request.error);
      
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Sessions store - each session is a separate entry for efficient updates
        if (!db.objectStoreNames.contains('sessions')) {
          db.createObjectStore('sessions', { keyPath: 'id' });
        }
        
        // Knowledge base store
        if (!db.objectStoreNames.contains('knowledge')) {
          db.createObjectStore('knowledge', { keyPath: 'id' });
        }
        
        // Settings store (key-value)
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
        
        // Embeddings cache store (persists embedding vectors across page reloads)
        if (!db.objectStoreNames.contains('embeddings')) {
          db.createObjectStore('embeddings', { keyPath: 'key' });
        }
      };
    });
  },
  
  async getAll<T>(storeName: StoreName): Promise<T[]> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },
  
  async get<T>(storeName: StoreName, key: string | number): Promise<T | undefined> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },
  
  async put<T extends { id?: number | string; key?: string }>(storeName: StoreName, item: T): Promise<IDBValidKey> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(item);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },
  
  async putAll<T>(storeName: StoreName, items: T[]): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      items.forEach(item => store.put(item));
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  },
  
  async delete(storeName: StoreName, key: string | number): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },
  
  async clear(storeName: StoreName): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },
  
  async getStorageEstimate() {
    if (navigator.storage && navigator.storage.estimate) {
      const estimate = await navigator.storage.estimate();
      return {
        used: estimate.usage || 0,
        quota: estimate.quota || 0,
        percent: estimate.quota ? ((estimate.usage! / estimate.quota) * 100).toFixed(1) : '0'
      };
    }
    return { used: 0, quota: 0, percent: '0' };
  }
};

// Migrate from localStorage to IndexedDB (one-time)
export const migrateFromLocalStorage = async (): Promise<void> => {
  try {
    const oldSessions = localStorage.getItem('ollama_sessions');
    const oldKnowledge = localStorage.getItem('ollama_knowledge');
    
    if (oldSessions) {
      const sessions = JSON.parse(oldSessions);
      await dbManager.putAll('sessions', sessions);
      localStorage.removeItem('ollama_sessions');
      console.log('Migrated sessions to IndexedDB');
    }
    
    if (oldKnowledge) {
      const knowledge = JSON.parse(oldKnowledge);
      await dbManager.putAll('knowledge', knowledge);
      localStorage.removeItem('ollama_knowledge');
      console.log('Migrated knowledge to IndexedDB');
    }
  } catch (e) {
    console.error('Migration error:', e);
  }
};
