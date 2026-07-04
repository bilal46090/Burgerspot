import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer, enableMultiTabIndexedDbPersistence, initializeFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

// Initialize Firestore with settings to bypass potential network/proxy issues
// We use a try-catch to handle re-initialization during development reloads
let firestoreDb;
try {
  firestoreDb = initializeFirestore(app, {
    experimentalAutoDetectLongPolling: true,
    cacheSizeBytes: 100 * 1024 * 1024, // 100MB local cache
    ignoreUndefinedProperties: true,
  }, (firebaseConfig as any).firestoreDatabaseId);
} catch (e: any) {
  // If already initialized (common during hot-reloads), just get the existing instance
  firestoreDb = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId);
}

export const db = firestoreDb;

export const auth = getAuth(app);

// Enable Offline Persistence
enableMultiTabIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
        console.warn("Firestore Persistence failed: Multiple tabs open");
    } else if (err.code === 'unimplemented') {
        console.warn("Firestore Persistence failed: Browser not supported");
    }
});

// Connectivity state
export let isFirestoreConnected = true;
const connectionListeners: ((status: boolean) => void)[] = [];

export function onConnectionChange(callback: (status: boolean) => void) {
  connectionListeners.push(callback);
  callback(isFirestoreConnected);
  return () => {
    const index = connectionListeners.indexOf(callback);
    if (index > -1) connectionListeners.splice(index, 1);
  };
}

function updateConnectionStatus(status: boolean) {
  if (isFirestoreConnected !== status) {
    isFirestoreConnected = status;
    connectionListeners.forEach(cb => cb(status));
  }
}

// Connectivity Test using getFromServer to bypass cache
async function testConnection() {
  try {
    const testDoc = doc(db, 'system', 'connectivity_check');
    await getDocFromServer(testDoc).catch(e => {
       const reachedServer = ['permission-denied', 'not-found', 'failed-precondition', 'already-exists'].includes(e.code);
       if (reachedServer) return;
       throw e;
    });
    
    updateConnectionStatus(true);
  } catch (error: any) {
    const isOffline = error?.code === 'unavailable' || 
                     error?.code === 'deadline-exceeded' ||
                     error?.message?.toLowerCase().includes('offline') || 
                     error?.message?.toLowerCase().includes('failed to connect') ||
                     error?.message?.toLowerCase().includes('network error');
                     
    if (isOffline) {
      updateConnectionStatus(false);
      console.warn("⚠️ Firestore is unreachable:", error.code || error.message);
    } else {
      console.warn("ℹ️ Firestore Status Check returned unexpected error (likely connected):", error.code || error.message);
    }
  }
}
testConnection();
setInterval(testConnection, 15000);
