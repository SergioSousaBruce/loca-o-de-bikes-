import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy,
  onSnapshot 
} from 'firebase/firestore';
import { db } from './firebase';
import { 
  Bike, 
  CustomerData, 
  Reservation, 
  SystemSettings, 
  ReservationStatus 
} from '../types';
import { 
  INITIAL_BIKES, 
  INITIAL_SETTINGS, 
  INITIAL_SAMPLE_CLIENTS, 
  INITIAL_SAMPLE_RESERVATIONS 
} from './constants';
import { 
  STORES, 
  idbGetAll, 
  idbPut, 
  idbPutMany, 
  idbDelete, 
  idbClear 
} from './indexedDbStorage';

const SETTINGS_DOC_ID = 'general_settings';

// Storage keys for LocalStorage fast-boot
const STORAGE_KEY_RESERVATIONS = 'pedalae_reservations_db_v2';
const STORAGE_KEY_CLIENTS = 'pedalae_clients_db_v2';
const STORAGE_KEY_BIKES = 'pedalae_bikes_db_v2';
const STORAGE_KEY_SETTINGS = 'pedalae_settings_db_v2';

// In-memory cache
let memReservations: Reservation[] | null = null;
let memClients: CustomerData[] | null = null;
let memBikes: Bike[] | null = null;
let memSettings: SystemSettings | null = null;

// Subscribers
const reservationSubscribers = new Set<(reservations: Reservation[]) => void>();
const clientSubscribers = new Set<(clients: CustomerData[]) => void>();
const bikeSubscribers = new Set<(bikes: Bike[]) => void>();
const settingsSubscribers = new Set<(settings: SystemSettings) => void>();

// Quota state detection
export let isCloudQuotaExceeded = false;
export const CLUSTER_UPGRADE_URL = 'https://console.firebase.google.com/project/divine-tiger-807pf/firestore/databases/ai-studio-3791596f-df98-4a9d-93bb-6434402d8afe/data?openUpgradeDialog=true';

export function getCloudQuotaStatus() {
  return {
    isExceeded: isCloudQuotaExceeded,
    upgradeUrl: CLUSTER_UPGRADE_URL,
  };
}

// Helper to safely serialize without exceeding LocalStorage 5MB quota
function safeLocalStorageSet(key: string, value: any): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err: any) {
    // If quota exceeded, create lightweight version without heavy base64 photos
    try {
      if (Array.isArray(value)) {
        const lightweight = value.map(item => {
          if (item && typeof item === 'object') {
            const copy = { ...item };
            if (copy.photoUrl && typeof copy.photoUrl === 'string' && copy.photoUrl.length > 500) {
              copy.photoUrl = copy.photoUrl.substring(0, 200) + '...[truncated_for_ls]';
            }
            if (copy.customerSnapshot?.photoUrl && copy.customerSnapshot.photoUrl.length > 500) {
              copy.customerSnapshot = {
                ...copy.customerSnapshot,
                photoUrl: copy.customerSnapshot.photoUrl.substring(0, 200) + '...[truncated_for_ls]'
              };
            }
            return copy;
          }
          return item;
        });
        localStorage.setItem(key, JSON.stringify(lightweight));
      }
    } catch {}
  }
}

// ================= MEMORY & LOCAL MIRROR HELPERS =================

function getLocalReservations(): Reservation[] {
  if (memReservations) {
    return memReservations;
  }

  // 1. Try reading from LocalStorage for immediate synchronous UI render
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY_RESERVATIONS) : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        memReservations = parsed;
        return parsed;
      }
    }
  } catch {}

  // 2. Fallback to initial sample reservations
  memReservations = [...INITIAL_SAMPLE_RESERVATIONS];
  safeLocalStorageSet(STORAGE_KEY_RESERVATIONS, memReservations);
  idbPutMany(STORES.RESERVATIONS, memReservations).catch(() => {});
  return memReservations;
}

function setLocalReservations(list: Reservation[]): void {
  memReservations = list;
  safeLocalStorageSet(STORAGE_KEY_RESERVATIONS, list);
  idbPutMany(STORES.RESERVATIONS, list).catch(() => {});
  // Notify all active listeners
  reservationSubscribers.forEach(cb => {
    try { cb(list); } catch {}
  });
}

function getLocalClients(): CustomerData[] {
  if (memClients) {
    return memClients;
  }

  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY_CLIENTS) : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        memClients = parsed;
        return parsed;
      }
    }
  } catch {}

  memClients = [...INITIAL_SAMPLE_CLIENTS];
  safeLocalStorageSet(STORAGE_KEY_CLIENTS, memClients);
  const clientsWithId = memClients.map(c => ({ ...c, id: c.id || c.cpfClean || c.cpf }));
  idbPutMany(STORES.CLIENTS, clientsWithId).catch(() => {});
  return memClients;
}

function setLocalClients(list: CustomerData[]): void {
  memClients = list;
  safeLocalStorageSet(STORAGE_KEY_CLIENTS, list);
  const clientsWithId = list.map(c => ({ ...c, id: c.id || c.cpfClean || c.cpf }));
  idbPutMany(STORES.CLIENTS, clientsWithId).catch(() => {});
  clientSubscribers.forEach(cb => {
    try { cb(list); } catch {}
  });
}

function getLocalBikes(): Bike[] {
  if (memBikes && memBikes.length > 0) {
    return memBikes;
  }

  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY_BIKES) : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        memBikes = parsed;
        return parsed;
      }
    }
  } catch {}

  memBikes = [...INITIAL_BIKES];
  safeLocalStorageSet(STORAGE_KEY_BIKES, memBikes);
  idbPutMany(STORES.BIKES, memBikes).catch(() => {});
  return memBikes;
}

function setLocalBikes(list: Bike[]): void {
  memBikes = list;
  safeLocalStorageSet(STORAGE_KEY_BIKES, list);
  idbPutMany(STORES.BIKES, list).catch(() => {});
  bikeSubscribers.forEach(cb => {
    try { cb(list); } catch {}
  });
}

function getLocalSettings(): SystemSettings {
  if (memSettings !== null) {
    if (memSettings.facebookUrl && (memSettings.facebookUrl.includes('61573909772391') || memSettings.facebookUrl.includes('61594762945870'))) {
      memSettings.facebookUrl = INITIAL_SETTINGS.facebookUrl;
    }
    return memSettings;
  }

  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY_SETTINGS) : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        const loaded: SystemSettings = { ...INITIAL_SETTINGS, ...parsed };
        if (loaded.facebookUrl && (loaded.facebookUrl.includes('61573909772391') || loaded.facebookUrl.includes('61594762945870'))) {
          loaded.facebookUrl = INITIAL_SETTINGS.facebookUrl;
          safeLocalStorageSet(STORAGE_KEY_SETTINGS, loaded);
        }
        memSettings = loaded;
        return loaded;
      }
    }
  } catch {}

  const defaultSt: SystemSettings = { ...INITIAL_SETTINGS };
  memSettings = defaultSt;
  safeLocalStorageSet(STORAGE_KEY_SETTINGS, defaultSt);
  return defaultSt;
}

function setLocalSettings(st: SystemSettings): void {
  memSettings = st;
  safeLocalStorageSet(STORAGE_KEY_SETTINGS, st);
  idbPut(STORES.SETTINGS, { id: SETTINGS_DOC_ID, ...st }).catch(() => {});
  settingsSubscribers.forEach(cb => {
    try { cb(st); } catch {}
  });
}

// ================= ASYNC INDEXEDDB VAULT HYDRATION =================

let isHydratedFromIdb = false;

async function hydrateFromIndexedDB(): Promise<void> {
  if (isHydratedFromIdb || typeof window === 'undefined') return;

  try {
    const [idbReservations, idbClients, idbBikes, idbSettings] = await Promise.all([
      idbGetAll<Reservation>(STORES.RESERVATIONS),
      idbGetAll<CustomerData>(STORES.CLIENTS),
      idbGetAll<Bike>(STORES.BIKES),
      idbGetAll<SystemSettings & { id: string }>(STORES.SETTINGS),
    ]);

    // Merge reservations
    if (idbReservations && idbReservations.length > 0) {
      const current = memReservations || getLocalReservations();
      const resMap = new Map<string, Reservation>();
      current.forEach(r => resMap.set(r.id, r));
      idbReservations.forEach(r => resMap.set(r.id, r));
      const mergedRes = Array.from(resMap.values()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      memReservations = mergedRes;
      safeLocalStorageSet(STORAGE_KEY_RESERVATIONS, mergedRes);
      reservationSubscribers.forEach(cb => { try { cb(mergedRes); } catch {} });
    }

    // Merge clients
    if (idbClients && idbClients.length > 0) {
      const current = memClients || getLocalClients();
      const cliMap = new Map<string, CustomerData>();
      current.forEach(c => cliMap.set(c.id || c.cpfClean || c.cpf, c));
      idbClients.forEach(c => cliMap.set(c.id || c.cpfClean || c.cpf, c));
      const mergedCli = Array.from(cliMap.values()).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      memClients = mergedCli;
      safeLocalStorageSet(STORAGE_KEY_CLIENTS, mergedCli);
      clientSubscribers.forEach(cb => { try { cb(mergedCli); } catch {} });
    }

    // Merge bikes
    if (idbBikes && idbBikes.length > 0) {
      memBikes = idbBikes;
      safeLocalStorageSet(STORAGE_KEY_BIKES, idbBikes);
      bikeSubscribers.forEach(cb => { try { cb(idbBikes); } catch {} });
    }

    // Merge settings
    if (idbSettings && idbSettings.length > 0) {
      const settingDoc = idbSettings.find(s => s.id === SETTINGS_DOC_ID) || idbSettings[0];
      if (settingDoc) {
        const { id, ...rest } = settingDoc;
        memSettings = { ...INITIAL_SETTINGS, ...rest };
        safeLocalStorageSet(STORAGE_KEY_SETTINGS, memSettings);
        settingsSubscribers.forEach(cb => { try { cb(memSettings!); } catch {} });
      }
    }

    isHydratedFromIdb = true;
  } catch (err) {
    console.warn('IndexedDB hydration notice:', err);
  }
}

// ================= INITIALIZATION =================

export async function initializeDatabaseIfEmpty() {
  // 1. Instant sync initialization from local store
  getLocalReservations();
  getLocalClients();
  getLocalBikes();
  getLocalSettings();

  // 2. Hydrate from permanent IndexedDB Vault
  await hydrateFromIndexedDB();

  // 3. Connect to Firestore (with quota and network resilience)
  try {
    const settingsRef = doc(db, 'settings', SETTINGS_DOC_ID);
    const settingsSnap = await getDoc(settingsRef);
    if (!settingsSnap.exists()) {
      await setDoc(settingsRef, INITIAL_SETTINGS);
    }

    const bikesRef = collection(db, 'bikes');
    const bikesSnap = await getDocs(bikesRef);
    if (bikesSnap.empty) {
      for (const bike of INITIAL_BIKES) {
        await setDoc(doc(db, 'bikes', bike.id), bike);
      }
    }
  } catch (error: any) {
    if (error?.message?.includes('Quota') || error?.code === 'resource-exhausted') {
      isCloudQuotaExceeded = true;
      console.warn('Firebase Firestore daily read quota reached. All data safely served from indestructible IndexedDB storage.');
    } else {
      console.warn('Cloud database initialization notice:', error);
    }
  }
}

// ================= SETTINGS =================

export async function getSettings(): Promise<SystemSettings> {
  const local = getLocalSettings();
  try {
    const settingsRef = doc(db, 'settings', SETTINGS_DOC_ID);
    const snap = await getDoc(settingsRef);
    if (snap.exists()) {
      const st = { ...INITIAL_SETTINGS, ...(snap.data() as SystemSettings) };
      if (st.facebookUrl && (st.facebookUrl.includes('61573909772391') || st.facebookUrl.includes('61594762945870'))) {
        st.facebookUrl = INITIAL_SETTINGS.facebookUrl;
      }
      setLocalSettings(st);
      return st;
    }
  } catch (err: any) {
    if (err?.code === 'resource-exhausted') isCloudQuotaExceeded = true;
  }
  return local;
}

export function subscribeSettings(callback: (settings: SystemSettings) => void) {
  settingsSubscribers.add(callback);
  callback(getLocalSettings());

  try {
    const settingsRef = doc(db, 'settings', SETTINGS_DOC_ID);
    const unsub = onSnapshot(settingsRef, (snap) => {
      if (snap.exists()) {
        const st = { ...INITIAL_SETTINGS, ...(snap.data() as SystemSettings) };
        if (st.facebookUrl && (st.facebookUrl.includes('61573909772391') || st.facebookUrl.includes('61594762945870'))) {
          st.facebookUrl = INITIAL_SETTINGS.facebookUrl;
        }
        setLocalSettings(st);
      }
    }, (err) => {
      if (err?.code === 'resource-exhausted') isCloudQuotaExceeded = true;
      callback(getLocalSettings());
    });

    return () => {
      settingsSubscribers.delete(callback);
      try { unsub(); } catch {}
    };
  } catch {
    return () => {
      settingsSubscribers.delete(callback);
    };
  }
}

export async function updateSettings(newSettings: Partial<SystemSettings>): Promise<void> {
  const current = getLocalSettings();
  const merged = { ...current, ...newSettings };
  setLocalSettings(merged);

  try {
    const settingsRef = doc(db, 'settings', SETTINGS_DOC_ID);
    await setDoc(settingsRef, newSettings, { merge: true });
  } catch (e: any) {
    console.warn('Settings cloud update note (saved permanently in IndexedDB):', e);
  }
}

// ================= BIKES =================

export function subscribeBikes(callback: (bikes: Bike[]) => void) {
  bikeSubscribers.add(callback);
  callback(getLocalBikes());

  try {
    const bikesRef = collection(db, 'bikes');
    const unsub = onSnapshot(bikesRef, (snapshot) => {
      if (!snapshot.empty) {
        const bikes: Bike[] = [];
        snapshot.forEach((docSnap) => {
          bikes.push({ id: docSnap.id, ...(docSnap.data() as Omit<Bike, 'id'>) });
        });
        bikes.sort((a, b) => a.code.localeCompare(b.code));
        setLocalBikes(bikes);
      }
    }, (error) => {
      if (error?.code === 'resource-exhausted') isCloudQuotaExceeded = true;
      callback(getLocalBikes());
    });

    return () => {
      bikeSubscribers.delete(callback);
      try { unsub(); } catch {}
    };
  } catch {
    return () => {
      bikeSubscribers.delete(callback);
    };
  }
}

export async function createBike(bikeData: Omit<Bike, 'id'>): Promise<string> {
  const localId = `bike-${Date.now()}`;
  const fullBike: Bike = { ...bikeData, id: localId };
  const current = getLocalBikes();
  current.push(fullBike);
  setLocalBikes(current);

  try {
    const bikesRef = collection(db, 'bikes');
    const res = await addDoc(bikesRef, bikeData);
    fullBike.id = res.id;
    setLocalBikes(current);
    return res.id;
  } catch (e) {
    return localId;
  }
}

export async function updateBike(bikeId: string, updates: Partial<Bike>): Promise<void> {
  const current = getLocalBikes();
  const idx = current.findIndex(b => b.id === bikeId);
  if (idx >= 0) {
    current[idx] = { ...current[idx], ...updates };
    setLocalBikes(current);
  }

  try {
    const bikeRef = doc(db, 'bikes', bikeId);
    await updateDoc(bikeRef, updates);
  } catch {}
}

export async function deleteBike(bikeId: string): Promise<void> {
  const current = getLocalBikes();
  const filtered = current.filter(b => b.id !== bikeId);
  setLocalBikes(filtered);

  try {
    const bikeRef = doc(db, 'bikes', bikeId);
    await deleteDoc(bikeRef);
  } catch {}
}

// ================= CLIENTS =================

export async function getClientByCpf(cpf: string): Promise<CustomerData | null> {
  const cleanCpf = cpf.replace(/\D/g, '');
  if (!cleanCpf) return null;

  // 1. Search memory
  const localClients = getLocalClients();
  const found = localClients.find(c => {
    const cClean = c.cpfClean || (c.cpf || '').replace(/\D/g, '');
    return cClean === cleanCpf;
  });
  if (found) return found;

  // 2. Search reservations customer snapshots
  const localReservations = getLocalReservations();
  for (const r of localReservations) {
    if (r.customerSnapshot) {
      const c = r.customerSnapshot;
      const cClean = c.cpfClean || (c.cpf || '').replace(/\D/g, '');
      if (cClean === cleanCpf) return c;
    }
  }

  // 3. Search IndexedDB directly in case memory was pruned
  try {
    const allIdbClients = await idbGetAll<CustomerData>(STORES.CLIENTS);
    const idbFound = allIdbClients.find(c => {
      const cClean = c.cpfClean || (c.cpf || '').replace(/\D/g, '');
      return cClean === cleanCpf;
    });
    if (idbFound) {
      localClients.unshift(idbFound);
      setLocalClients(localClients);
      return idbFound;
    }
  } catch {}

  // 4. Fallback to Cloud Firestore
  try {
    const clientsRef = collection(db, 'clients');
    const q = query(clientsRef, where('cpfClean', '==', cleanCpf));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const docData = snap.docs[0].data();
      const result = { id: snap.docs[0].id, ...(docData as CustomerData) };
      localClients.unshift(result);
      setLocalClients(localClients);
      return result;
    }
  } catch (e: any) {
    if (e?.code === 'resource-exhausted') isCloudQuotaExceeded = true;
  }

  return null;
}

export async function findClientByCpfOrPhone(queryVal: string): Promise<CustomerData | null> {
  const cleanDigits = queryVal.replace(/\D/g, '');
  if (!cleanDigits || cleanDigits.length < 8) return null;

  // 1. Search in-memory clients
  const localClients = getLocalClients();
  for (const c of localClients) {
    const clientPhoneDigits = (c.whatsapp || '').replace(/\D/g, '');
    const clientCpfDigits = (c.cpf || '').replace(/\D/g, '');
    if (
      clientCpfDigits === cleanDigits ||
      clientPhoneDigits === cleanDigits ||
      (clientPhoneDigits.length >= 8 && cleanDigits.length >= 8 && (clientPhoneDigits.endsWith(cleanDigits) || cleanDigits.endsWith(clientPhoneDigits)))
    ) {
      return c;
    }
  }

  // 2. Search local reservations customer snapshots
  const localReservations = getLocalReservations();
  for (const r of localReservations) {
    if (r.customerSnapshot) {
      const c = r.customerSnapshot;
      const cPhone = (c.whatsapp || '').replace(/\D/g, '');
      const cCpf = (c.cpf || '').replace(/\D/g, '');
      if (
        cCpf === cleanDigits ||
        cPhone === cleanDigits ||
        (cPhone.length >= 8 && cleanDigits.length >= 8 && (cPhone.endsWith(cleanDigits) || cleanDigits.endsWith(cPhone)))
      ) {
        return c;
      }
    }
  }

  // 3. Search IndexedDB permanent vault
  try {
    const allIdbClients = await idbGetAll<CustomerData>(STORES.CLIENTS);
    for (const c of allIdbClients) {
      const cPhone = (c.whatsapp || '').replace(/\D/g, '');
      const cCpf = (c.cpf || '').replace(/\D/g, '');
      if (
        cCpf === cleanDigits ||
        cPhone === cleanDigits ||
        (cPhone.length >= 8 && cleanDigits.length >= 8 && (cPhone.endsWith(cleanDigits) || cleanDigits.endsWith(cPhone)))
      ) {
        localClients.unshift(c);
        setLocalClients(localClients);
        return c;
      }
    }
  } catch {}

  // 4. Cloud Firestore fallback
  try {
    const clientsRef = collection(db, 'clients');
    if (cleanDigits.length === 11) {
      const qCpf = query(clientsRef, where('cpfClean', '==', cleanDigits));
      const snapCpf = await getDocs(qCpf);
      if (!snapCpf.empty) {
        const docData = snapCpf.docs[0].data();
        const res = { id: snapCpf.docs[0].id, ...(docData as CustomerData) };
        localClients.unshift(res);
        setLocalClients(localClients);
        return res;
      }
    }
  } catch (err: any) {
    if (err?.code === 'resource-exhausted') isCloudQuotaExceeded = true;
  }

  return null;
}

export async function saveOrUpdateClient(customer: CustomerData): Promise<string> {
  const cleanCpf = (customer.cpf || '').replace(/\D/g, '');
  const localId = customer.id || `cli-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  const payload: CustomerData = {
    ...customer,
    id: localId,
    cpfClean: cleanCpf,
    updatedAt: Date.now(),
  };

  // 1. Immediately save to persistent local mirrors (Memory + LocalStorage + IndexedDB Vault)
  const clients = getLocalClients();
  const existingIdx = clients.findIndex(c => {
    const cClean = c.cpfClean || (c.cpf || '').replace(/\D/g, '');
    return cClean === cleanCpf;
  });

  if (existingIdx >= 0) {
    const prev = clients[existingIdx];
    payload.id = prev.id || localId;
    payload.totalReservations = (prev.totalReservations || 0) + 1;
    payload.createdAt = prev.createdAt || Date.now();
    payload.lastReservationAt = Date.now();
    clients[existingIdx] = payload;
  } else {
    payload.totalReservations = 1;
    payload.createdAt = Date.now();
    payload.lastReservationAt = Date.now();
    clients.unshift(payload);
  }
  setLocalClients(clients);

  // 2. Sync with Cloud Firestore
  try {
    const clientsRef = collection(db, 'clients');
    const docId = payload.id || localId;
    const docRef = doc(clientsRef, docId);
    await setDoc(docRef, cleanUndefined(payload), { merge: true });
    return docId;
  } catch (err: any) {
    if (err?.code === 'resource-exhausted') isCloudQuotaExceeded = true;
    console.warn('Client cloud sync notice (saved permanently in IndexedDB Vault):', err);
    return localId;
  }
}

export async function deleteClient(clientId: string): Promise<void> {
  // 1. Delete from local mirror immediately
  const localList = getLocalClients();
  const filtered = localList.filter(c => c.id !== clientId && c.cpf !== clientId && c.cpfClean !== clientId);
  setLocalClients(filtered);
  idbDelete(STORES.CLIENTS, clientId).catch(() => {});

  // 2. Sync to Firestore
  try {
    const cliRef = doc(db, 'clients', clientId);
    await deleteDoc(cliRef);
  } catch (err: any) {
    if (err?.code === 'resource-exhausted') isCloudQuotaExceeded = true;
  }
}

export function subscribeClients(callback: (clients: CustomerData[]) => void) {
  clientSubscribers.add(callback);
  callback(getLocalClients());

  try {
    const clientsRef = collection(db, 'clients');
    const unsub = onSnapshot(clientsRef, (snapshot) => {
      if (!snapshot.empty) {
        const cloudList: CustomerData[] = [];
        snapshot.forEach((d) => {
          cloudList.push({ id: d.id, ...(d.data() as CustomerData) });
        });
        
        const localCurrent = getLocalClients();
        const mergedMap = new Map<string, CustomerData>();
        localCurrent.forEach(c => {
          const key = c.id || c.cpfClean || c.cpf;
          mergedMap.set(key, c);
        });
        cloudList.forEach(c => {
          const key = c.id || c.cpfClean || c.cpf;
          mergedMap.set(key, c);
        });

        const mergedList = Array.from(mergedMap.values()).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
        setLocalClients(mergedList);
      }
    }, (err) => {
      if (err?.code === 'resource-exhausted') isCloudQuotaExceeded = true;
      callback(getLocalClients());
    });

    return () => {
      clientSubscribers.delete(callback);
      try { unsub(); } catch {}
    };
  } catch {
    return () => {
      clientSubscribers.delete(callback);
    };
  }
}

// ================= RESERVATIONS =================

export function subscribeReservations(callback: (reservations: Reservation[]) => void) {
  reservationSubscribers.add(callback);
  callback(getLocalReservations());

  try {
    const resRef = collection(db, 'reservations');
    const unsub = onSnapshot(resRef, (snapshot) => {
      if (!snapshot.empty) {
        const cloudList: Reservation[] = [];
        snapshot.forEach((docSnap) => {
          cloudList.push({ id: docSnap.id, ...(docSnap.data() as Omit<Reservation, 'id'>) });
        });

        const localCurrent = getLocalReservations();
        const mergedMap = new Map<string, Reservation>();
        localCurrent.forEach(r => mergedMap.set(r.id, r));
        cloudList.forEach(r => mergedMap.set(r.id, r));

        const mergedList = Array.from(mergedMap.values()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        setLocalReservations(mergedList);
      }
    }, (err) => {
      if (err?.code === 'resource-exhausted') isCloudQuotaExceeded = true;
      callback(getLocalReservations());
    });

    return () => {
      reservationSubscribers.delete(callback);
      try { unsub(); } catch {}
    };
  } catch {
    return () => {
      reservationSubscribers.delete(callback);
    };
  }
}

export async function getReservationsForBikeAndDate(bikeId: string, date: string): Promise<Reservation[]> {
  const localList = getLocalReservations();
  const localFiltered = localList.filter(r => r.bikeId === bikeId && r.date === date && r.status !== 'cancelada');
  if (localFiltered.length > 0) {
    return localFiltered;
  }

  try {
    const resRef = collection(db, 'reservations');
    const q = query(
      resRef,
      where('bikeId', '==', bikeId),
      where('date', '==', date)
    );
    const snap = await getDocs(q);
    const results: Reservation[] = [];
    snap.forEach((d) => {
      const res = { id: d.id, ...(d.data() as Omit<Reservation, 'id'>) };
      if (res.status !== 'cancelada') {
        results.push(res);
      }
    });
    return results;
  } catch (e: any) {
    if (e?.code === 'resource-exhausted') isCloudQuotaExceeded = true;
    return localFiltered;
  }
}

export function timeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const [hours, minutes] = timeStr.split(':').map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

export function minutesToTime(minutesTotal: number): string {
  const h = Math.floor(minutesTotal / 60);
  const m = minutesTotal % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function hasTimeOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string
): boolean {
  const sA = timeToMinutes(startA);
  const eA = timeToMinutes(endA);
  const sB = timeToMinutes(startB);
  const eB = timeToMinutes(endB);
  return sA < eB && eA > sB;
}

export async function checkReservationConflict(
  bikeId: string,
  date: string,
  startTime: string,
  endTime: string,
  excludeReservationId?: string
): Promise<{ conflict: boolean; conflictingReservation?: Reservation }> {
  const activeReservations = await getReservationsForBikeAndDate(bikeId, date);
  for (const res of activeReservations) {
    if (excludeReservationId && res.id === excludeReservationId) continue;
    if (res.status === 'cancelada') continue;

    if (hasTimeOverlap(startTime, endTime, res.startTime, res.endTime)) {
      return { conflict: true, conflictingReservation: res };
    }
  }
  return { conflict: false };
}

export async function generateNextReservationCode(): Promise<string> {
  const localList = getLocalReservations();
  let highestNum = 0;
  localList.forEach((d) => {
    const code = d.code;
    if (typeof code === 'string' && code.startsWith('PED-')) {
      const numPart = parseInt(code.replace('PED-', ''), 10);
      if (!isNaN(numPart) && numPart > highestNum) {
        highestNum = numPart;
      }
    }
  });

  const nextNum = Math.max(highestNum + 1, localList.length + 1);
  return `PED-${String(nextNum).padStart(6, '0')}`;
}

export function cleanUndefined<T extends Record<string, any>>(obj: T): T {
  const result: any = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val !== undefined) {
      if (val !== null && typeof val === 'object' && !Array.isArray(val) && !(val instanceof Date)) {
        result[key] = cleanUndefined(val);
      } else {
        result[key] = val;
      }
    }
  }
  return result;
}

export async function createReservation(
  reservationData: Omit<Reservation, 'id'>
): Promise<string> {
  const { conflict, conflictingReservation } = await checkReservationConflict(
    reservationData.bikeId,
    reservationData.date,
    reservationData.startTime,
    reservationData.endTime
  );

  if (conflict && conflictingReservation) {
    throw new Error(
      `Conflito de horário! A bike já está reservada de ${conflictingReservation.startTime} às ${conflictingReservation.endTime} nesta data.`
    );
  }

  const generatedId = `res-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const fullReservation: Reservation = {
    ...reservationData,
    id: generatedId,
  };

  // 1. SAVE TO PERMANENT LOCAL MIRRORS (Memory + LocalStorage + IndexedDB Vault)
  const currentLocal = getLocalReservations();
  currentLocal.unshift(fullReservation);
  setLocalReservations(currentLocal);

  // Also ensure client record is updated locally and permanently
  if (reservationData.customerSnapshot) {
    saveOrUpdateClient(reservationData.customerSnapshot).catch(() => {});
  }

  // 2. Sync to Firestore in try-catch with specific document ID
  try {
    const resRef = doc(db, 'reservations', generatedId);
    await setDoc(resRef, cleanUndefined(reservationData));
    return generatedId;
  } catch (err: any) {
    if (err?.code === 'resource-exhausted') isCloudQuotaExceeded = true;
    console.warn('Reservation cloud sync note (saved permanently in IndexedDB Vault):', err);
    return generatedId;
  }
}

export async function updateReservationStatus(
  reservationId: string,
  status: ReservationStatus,
  extraUpdates: Partial<Reservation> = {}
): Promise<void> {
  // 1. Update local mirror immediately
  const localList = getLocalReservations();
  const idx = localList.findIndex(r => r.id === reservationId);
  let targetRes: Reservation | null = null;
  if (idx >= 0) {
    localList[idx] = {
      ...localList[idx],
      status,
      updatedAt: Date.now(),
      ...extraUpdates,
    };
    targetRes = localList[idx];
    setLocalReservations(localList);
  }

  // 2. Sync to Firestore
  try {
    const resRef = doc(db, 'reservations', reservationId);
    await updateDoc(resRef, cleanUndefined({
      status,
      updatedAt: Date.now(),
      ...extraUpdates,
    }));
  } catch (err: any) {
    if (err?.code === 'resource-exhausted') isCloudQuotaExceeded = true;
    console.warn('Status update cloud note (saved locally):', err);
  }
}

export async function deleteReservation(reservationId: string): Promise<void> {
  // 1. Delete from local mirror immediately
  const localList = getLocalReservations();
  const filtered = localList.filter(r => r.id !== reservationId);
  setLocalReservations(filtered);
  idbDelete(STORES.RESERVATIONS, reservationId).catch(() => {});

  // 2. Sync to Firestore
  try {
    const resRef = doc(db, 'reservations', reservationId);
    await deleteDoc(resRef);
  } catch (err: any) {
    if (err?.code === 'resource-exhausted') isCloudQuotaExceeded = true;
  }
}

// ================= ACTIVE RIDE TRACKING =================

export async function saveRideTelemetry(
  reservationId: string,
  stats: {
    distanceKm: number;
    avgSpeedKmH: number;
    currentSpeedKmH: number;
    lastRecordedAtEpoch: number;
    pathPoints?: { lat: number; lng: number; timestamp?: number }[];
    selectedRouteId?: string;
  }
): Promise<void> {
  const localList = getLocalReservations();
  const idx = localList.findIndex(r => r.id === reservationId);
  if (idx >= 0) {
    localList[idx] = {
      ...localList[idx],
      rideStats: {
        ...(localList[idx].rideStats || {}),
        distanceKm: stats.distanceKm,
        avgSpeedKmH: stats.avgSpeedKmH,
        currentSpeedKmH: stats.currentSpeedKmH,
        lastRecordedAtEpoch: stats.lastRecordedAtEpoch,
        ...(stats.pathPoints ? { pathPoints: stats.pathPoints } : {}),
        ...(stats.selectedRouteId ? { selectedRouteId: stats.selectedRouteId } : {}),
      },
      updatedAt: Date.now(),
    };
    setLocalReservations(localList);
  }

  try {
    const resRef = doc(db, 'reservations', reservationId);
    await updateDoc(resRef, {
      'rideStats.distanceKm': stats.distanceKm,
      'rideStats.avgSpeedKmH': stats.avgSpeedKmH,
      'rideStats.currentSpeedKmH': stats.currentSpeedKmH,
      'rideStats.lastRecordedAtEpoch': stats.lastRecordedAtEpoch,
      ...(stats.pathPoints ? { 'rideStats.pathPoints': stats.pathPoints } : {}),
      ...(stats.selectedRouteId ? { 'rideStats.selectedRouteId': stats.selectedRouteId } : {}),
      updatedAt: Date.now(),
    });
  } catch (e: any) {
    if (e?.code === 'resource-exhausted') isCloudQuotaExceeded = true;
  }
}

export async function extendReservationDuration(
  reservationId: string,
  addedHours: number,
  additionalPrice: number
): Promise<{ newEndTime: string; newTotalPrice: number }> {
  const localList = getLocalReservations();
  const idx = localList.findIndex(r => r.id === reservationId);
  if (idx < 0) {
    throw new Error('Reserva não encontrada.');
  }

  const data = localList[idx];
  const currentEndMinutes = timeToMinutes(data.endTime);
  const addedMinutes = addedHours * 60;
  const newEndMinutes = currentEndMinutes + addedMinutes;
  const newEndTime = minutesToTime(newEndMinutes);

  const newDuration = (data.durationHours || 1) + addedHours;
  const newTotalPrice = (data.totalPrice || 0) + additionalPrice;
  const extendedHours = ((data.rideStats?.extendedHours || 0) + addedHours);

  localList[idx] = {
    ...data,
    endTime: newEndTime,
    durationHours: newDuration,
    totalPrice: newTotalPrice,
    rideStats: {
      distanceKm: data.rideStats?.distanceKm ?? 0,
      avgSpeedKmH: data.rideStats?.avgSpeedKmH ?? 0,
      currentSpeedKmH: data.rideStats?.currentSpeedKmH ?? 0,
      ...(data.rideStats || {}),
      extendedHours,
    },
    updatedAt: Date.now(),
  };
  setLocalReservations(localList);

  try {
    const resRef = doc(db, 'reservations', reservationId);
    await updateDoc(resRef, {
      endTime: newEndTime,
      durationHours: newDuration,
      totalPrice: newTotalPrice,
      'rideStats.extendedHours': extendedHours,
      updatedAt: Date.now(),
    });
  } catch (e: any) {
    if (e?.code === 'resource-exhausted') isCloudQuotaExceeded = true;
  }

  return { newEndTime, newTotalPrice };
}

// ================= BACKUP & RESTORE =================

export function exportDatabaseBackup(): string {
  const backup = {
    appName: 'PEDALAÊ - Aluguel de Bikes',
    version: '3.0 - Indestructible Vault',
    exportedAt: new Date().toISOString(),
    reservations: getLocalReservations(),
    clients: getLocalClients(),
    bikes: getLocalBikes(),
    settings: getLocalSettings(),
  };
  return JSON.stringify(backup, null, 2);
}

export function importDatabaseBackup(jsonString: string): { success: boolean; message: string; counts?: { reservations: number; clients: number } } {
  try {
    const data = JSON.parse(jsonString);
    if (!data || typeof data !== 'object') {
      return { success: false, message: 'Arquivo de backup inválido.' };
    }

    let resCount = 0;
    let clientCount = 0;

    if (Array.isArray(data.reservations)) {
      setLocalReservations(data.reservations);
      resCount = data.reservations.length;
    }
    if (Array.isArray(data.clients)) {
      setLocalClients(data.clients);
      clientCount = data.clients.length;
    }
    if (Array.isArray(data.bikes)) {
      setLocalBikes(data.bikes);
    }
    if (data.settings && typeof data.settings === 'object') {
      setLocalSettings(data.settings);
    }

    return {
      success: true,
      message: `Backup restaurado com sucesso! ${resCount} reservas e ${clientCount} clientes carregados e protegidos no cofre permanente.`,
      counts: { reservations: resCount, clients: clientCount }
    };
  } catch (err: any) {
    return { success: false, message: `Erro ao importar backup: ${err.message || err}` };
  }
}
