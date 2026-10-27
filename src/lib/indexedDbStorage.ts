/**
 * IndexedDB Storage Engine for PEDALAÊ
 * 
 * Provides unlimited, permanent client-side storage that survives:
 * - Browser tab closures and restarts
 * - Device reboots
 * - LocalStorage 5MB quota errors (photos, signatures, full documents)
 * - Cloud Firestore daily quota limits
 */

const DB_NAME = 'pedalae_offline_vault_v2';
const DB_VERSION = 2;

export const STORES = {
  RESERVATIONS: 'reservations',
  CLIENTS: 'clients',
  BIKES: 'bikes',
  SETTINGS: 'settings',
  BACKUPS: 'backups',
  TRACKING_SESSIONS: 'tracking_sessions',
} as const;

type StoreName = typeof STORES[keyof typeof STORES];

let dbInstance: IDBDatabase | null = null;
let dbPromise: Promise<IDBDatabase> | null = null;

export function openIndexedDB(): Promise<IDBDatabase> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.reject(new Error('IndexedDB is not supported in this environment'));
  }

  if (dbInstance) {
    return Promise.resolve(dbInstance);
  }

  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise((resolve, reject) => {
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object stores if not existing
        if (!db.objectStoreNames.contains(STORES.RESERVATIONS)) {
          const resStore = db.createObjectStore(STORES.RESERVATIONS, { keyPath: 'id' });
          resStore.createIndex('code', 'code', { unique: false });
          resStore.createIndex('customerId', 'customerId', { unique: false });
          resStore.createIndex('date', 'date', { unique: false });
          resStore.createIndex('createdAt', 'createdAt', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.CLIENTS)) {
          const clientStore = db.createObjectStore(STORES.CLIENTS, { keyPath: 'id' });
          clientStore.createIndex('cpfClean', 'cpfClean', { unique: false });
          clientStore.createIndex('whatsapp', 'whatsapp', { unique: false });
          clientStore.createIndex('fullName', 'fullName', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.BIKES)) {
          db.createObjectStore(STORES.BIKES, { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
          db.createObjectStore(STORES.SETTINGS, { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains(STORES.BACKUPS)) {
          db.createObjectStore(STORES.BACKUPS, { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains(STORES.TRACKING_SESSIONS)) {
          const trackStore = db.createObjectStore(STORES.TRACKING_SESSIONS, { keyPath: 'trackingId' });
          trackStore.createIndex('reservationId', 'reservationId', { unique: false });
          trackStore.createIndex('bikeId', 'bikeId', { unique: false });
          trackStore.createIndex('customerId', 'customerId', { unique: false });
          trackStore.createIndex('status', 'status', { unique: false });
        }
      };

      request.onsuccess = (event) => {
        dbInstance = (event.target as IDBOpenDBRequest).result;
        
        // Handle unexpected disconnects
        dbInstance.onversionchange = () => {
          dbInstance?.close();
          dbInstance = null;
          dbPromise = null;
        };

        resolve(dbInstance);
      };

      request.onerror = (event) => {
        console.warn('IndexedDB open error:', (event.target as IDBOpenDBRequest).error);
        reject((event.target as IDBOpenDBRequest).error);
      };
    } catch (err) {
      console.warn('IndexedDB initialization exception:', err);
      reject(err);
    }
  });

  return dbPromise;
}

export async function idbGetAll<T>(storeName: StoreName): Promise<T[]> {
  try {
    const db = await openIndexedDB();
    return new Promise((resolve) => {
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => {
        resolve((request.result as T[]) || []);
      };

      request.onerror = () => {
        console.warn(`IndexedDB getAll error in store ${storeName}`);
        resolve([]);
      };
    });
  } catch (e) {
    console.warn(`IndexedDB unavailable for store ${storeName}:`, e);
    return [];
  }
}

export async function idbGetById<T>(storeName: StoreName, id: string): Promise<T | null> {
  try {
    const db = await openIndexedDB();
    return new Promise((resolve) => {
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(id);

      request.onsuccess = () => {
        resolve((request.result as T) || null);
      };

      request.onerror = () => {
        resolve(null);
      };
    });
  } catch {
    return null;
  }
}

export async function idbPut<T extends { id?: string; trackingId?: string }>(storeName: StoreName, item: T): Promise<void> {
  try {
    const db = await openIndexedDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(item);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.warn(`IndexedDB put error in store ${storeName}:`, e);
  }
}

export async function idbPutMany<T extends { id?: string; trackingId?: string }>(storeName: StoreName, items: T[]): Promise<void> {
  if (!items || items.length === 0) return;
  try {
    const db = await openIndexedDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);

      items.forEach((item) => {
        if (item && (item.id || item.trackingId)) {
          store.put(item);
        }
      });

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } catch (e) {
    console.warn(`IndexedDB putMany error in store ${storeName}:`, e);
  }
}

export async function idbDelete(storeName: StoreName, id: string): Promise<void> {
  try {
    const db = await openIndexedDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.warn(`IndexedDB delete error in store ${storeName}:`, e);
  }
}

export async function idbClear(storeName: StoreName): Promise<void> {
  try {
    const db = await openIndexedDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.warn(`IndexedDB clear error in store ${storeName}:`, e);
  }
}
