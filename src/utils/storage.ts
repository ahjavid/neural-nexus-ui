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

// ============================================
// Export/Import Functions
// ============================================

export interface ExportData {
  version: string;
  exportedAt: string;
  sessions?: unknown[];
  knowledge?: unknown[];
  settings?: Record<string, unknown>;
}

/**
 * Export all data (sessions, knowledge, settings) as JSON
 */
export const exportAllData = async (): Promise<ExportData> => {
  const sessions = await dbManager.getAll('sessions');
  const knowledge = await dbManager.getAll('knowledge');
  
  // Get settings from localStorage
  const settings: Record<string, unknown> = {};
  const settingsKeys = [
    'nexus_theme', 'nexus_embedding_model', 'ollama_endpoint',
    'nexus_tavily_key', 'nexus_tools_enabled', 'nexus_tool_states'
  ];
  settingsKeys.forEach(key => {
    const value = localStorage.getItem(key);
    if (value !== null) {
      try {
        settings[key] = JSON.parse(value);
      } catch {
        settings[key] = value;
      }
    }
  });
  
  return {
    version: '1.1.2',
    exportedAt: new Date().toISOString(),
    sessions,
    knowledge,
    settings
  };
};

/**
 * Export data and trigger file download
 */
export const downloadExport = async (options: { 
  includeSessions?: boolean; 
  includeKnowledge?: boolean;
  includeSettings?: boolean;
} = {}): Promise<void> => {
  const { includeSessions = true, includeKnowledge = true, includeSettings = true } = options;
  
  const data: ExportData = {
    version: '1.1.2',
    exportedAt: new Date().toISOString()
  };
  
  if (includeSessions) {
    data.sessions = await dbManager.getAll('sessions');
  }
  if (includeKnowledge) {
    data.knowledge = await dbManager.getAll('knowledge');
  }
  if (includeSettings) {
    const settings: Record<string, unknown> = {};
    const settingsKeys = [
      'nexus_theme', 'nexus_embedding_model', 'ollama_endpoint',
      'nexus_tavily_key', 'nexus_tools_enabled', 'nexus_tool_states'
    ];
    settingsKeys.forEach(key => {
      const value = localStorage.getItem(key);
      if (value !== null) {
        try {
          settings[key] = JSON.parse(value);
        } catch {
          settings[key] = value;
        }
      }
    });
    data.settings = settings;
  }
  
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `neural-nexus-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/**
 * Import data from JSON file
 * Returns summary of what was imported
 */
export const importData = async (
  data: ExportData,
  options: {
    importSessions?: boolean;
    importKnowledge?: boolean;
    importSettings?: boolean;
    mergeMode?: 'replace' | 'merge';
  } = {}
): Promise<{ sessions: number; knowledge: number; settings: number }> => {
  const { 
    importSessions = true, 
    importKnowledge = true, 
    importSettings = true,
    mergeMode = 'merge' 
  } = options;
  
  let sessionsImported = 0;
  let knowledgeImported = 0;
  let settingsImported = 0;
  
  // Import sessions
  if (importSessions && data.sessions && Array.isArray(data.sessions)) {
    if (mergeMode === 'replace') {
      await dbManager.clear('sessions');
    }
    
    if (mergeMode === 'merge') {
      // Get existing IDs
      const existing = await dbManager.getAll<{ id: number }>('sessions');
      const existingIds = new Set(existing.map(s => s.id));
      
      // Find max ID
      let maxId = existing.length > 0 ? Math.max(...existing.map(s => s.id)) : 0;
      
      // Add new sessions with remapped IDs if needed
      for (const session of data.sessions) {
        const s = session as { id: number };
        if (existingIds.has(s.id)) {
          maxId++;
          s.id = maxId;
        }
        await dbManager.put('sessions', s as { id: number });
        sessionsImported++;
      }
    } else {
      await dbManager.putAll('sessions', data.sessions as { id: number }[]);
      sessionsImported = data.sessions.length;
    }
  }
  
  // Import knowledge
  if (importKnowledge && data.knowledge && Array.isArray(data.knowledge)) {
    if (mergeMode === 'replace') {
      await dbManager.clear('knowledge');
    }
    
    if (mergeMode === 'merge') {
      const existing = await dbManager.getAll<{ id: number }>('knowledge');
      const existingIds = new Set(existing.map(k => k.id));
      let maxId = existing.length > 0 ? Math.max(...existing.map(k => k.id)) : 0;
      
      for (const entry of data.knowledge) {
        const k = entry as { id: number };
        if (existingIds.has(k.id)) {
          maxId++;
          k.id = maxId;
        }
        await dbManager.put('knowledge', k as { id: number });
        knowledgeImported++;
      }
    } else {
      await dbManager.putAll('knowledge', data.knowledge as { id: number }[]);
      knowledgeImported = data.knowledge.length;
    }
  }
  
  // Import settings
  if (importSettings && data.settings && typeof data.settings === 'object') {
    for (const [key, value] of Object.entries(data.settings)) {
      if (typeof value === 'string') {
        localStorage.setItem(key, value);
      } else {
        localStorage.setItem(key, JSON.stringify(value));
      }
      settingsImported++;
    }
  }
  
  return { sessions: sessionsImported, knowledge: knowledgeImported, settings: settingsImported };
};

/**
 * Read a JSON file and parse it
 */
export const readImportFile = (file: File): Promise<ExportData> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        if (!data.version || !data.exportedAt) {
          reject(new Error('Invalid backup file format'));
          return;
        }
        resolve(data);
      } catch (err) {
        reject(new Error('Failed to parse backup file'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
};
