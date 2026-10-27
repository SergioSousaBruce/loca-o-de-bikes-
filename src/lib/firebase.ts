import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  initializeFirestore, 
  persistentLocalCache, 
  persistentSingleTabManager 
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Configure Firestore with persistent local cache (IndexedDB)
// Using persistentSingleTabManager avoids clock-skew timestamp warnings ("Detected an update time that is in the future")
// that occur when multiple tabs or iframes synchronize leases with sub-millisecond clock jitter.
let firestoreDb;
try {
  firestoreDb = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentSingleTabManager({})
    })
  }, firebaseConfig.firestoreDatabaseId);
} catch {
  firestoreDb = getFirestore(app, firebaseConfig.firestoreDatabaseId);
}

export const db = firestoreDb;
export const auth = getAuth(app);
export default app;


