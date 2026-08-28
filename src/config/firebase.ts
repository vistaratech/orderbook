import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, initializeAuth, Auth } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { getAnalytics, isSupported, Analytics } from 'firebase/analytics';
import { Platform } from 'react-native';

export const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || '',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || '',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || '',
};

if (__DEV__ && !firebaseConfig.apiKey) {
  console.warn('⚠️ Missing EXPO_PUBLIC_FIREBASE_API_KEY. Please verify your .env file.');
}

// Initialize Firebase App (prevent re-initializing on hot reload)
export const app: FirebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Auth with React Native AsyncStorage persistence on mobile
let authInstance: Auth;
if (Platform.OS === 'web') {
  authInstance = getAuth(app);
} else {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { getReactNativePersistence } = require('firebase/auth');
    if (getReactNativePersistence) {
      authInstance = initializeAuth(app, {
        persistence: getReactNativePersistence(AsyncStorage),
      });
    } else {
      authInstance = getAuth(app);
    }
  } catch {
    authInstance = getAuth(app);
  }
}

export const auth: Auth = authInstance;

// Initialize Cloud Firestore & Storage
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
