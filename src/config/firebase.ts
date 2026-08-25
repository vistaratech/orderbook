import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { initializeAuth, getAuth, Auth } from 'firebase/auth';
// @ts-ignore
import { getReactNativePersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDatabase, Database } from 'firebase/database';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { getAnalytics, isSupported, Analytics } from 'firebase/analytics';
import { Platform } from 'react-native';

export const firebaseConfig = {
  apiKey: "AIzaSyDMUcAZsBx8h0n1wvcB2n7etYZIOl7SoBY",
  authDomain: "orderbook-0001.firebaseapp.com",
  databaseURL: "https://orderbook-0001-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "orderbook-0001",
  storageBucket: "orderbook-0001.firebasestorage.app",
  messagingSenderId: "665574608894",
  appId: "1:665574608894:web:f4982fa43a21f329fb3aaf",
  measurementId: "G-54S6B1C8QX"
};

// Initialize Firebase App (prevent re-initializing on hot reload)
export const app: FirebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Auth with AsyncStorage persistence for native platforms
export const auth: Auth = (() => {
  if (Platform.OS === 'web') {
    return getAuth(app);
  }
  try {
    return initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    return getAuth(app);
  }
})();

// Initialize Realtime Database & Firestore & Storage
export const rtdb: Database = getDatabase(app);
export const db: Firestore = getFirestore(app);
export const storage: FirebaseStorage = getStorage(app);

// Safe Analytics initialization (only runs in supported browser environments)
export let analytics: Analytics | null = null;
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  isSupported().then((supported) => {
    if (supported) {
      analytics = getAnalytics(app);
    }
  }).catch(() => {
    // Analytics not supported in this environment
  });
}

export default app;
