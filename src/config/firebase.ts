import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, initializeAuth, Auth } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { getAnalytics, isSupported, Analytics } from 'firebase/analytics';
import { Platform } from 'react-native';

export const firebaseConfig = {
  apiKey:
    process.env.EXPO_PUBLIC_FIREBASE_API_KEY ||
    'AIzaSyBjSi9tfH3s3cEbS1p2xSY4LE45yp9PReE',
  authDomain:
    process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ||
    'orderbook-0.firebaseapp.com',
  projectId:
    process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ||
    'orderbook-0',
  storageBucket:
    process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ||
    'orderbook-0.firebasestorage.app',
  messagingSenderId:
    process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ||
    '79850824559',
  appId:
    process.env.EXPO_PUBLIC_FIREBASE_APP_ID ||
    '1:79850824559:android:6d7399a394a75ca1dabe9a',
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
