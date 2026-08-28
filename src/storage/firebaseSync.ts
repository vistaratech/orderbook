/**
 * Firebase Cloud Firestore & Realtime Sync Helper
 *
 * Centralised module that all storage files and screens use to:
 * 1. Listen to live real-time changes under `users/{uid}` in Cloud Firestore.
 * 2. Keep local AsyncStorage updated with latest cloud data across all devices.
 * 3. Notify active UI screens whenever data updates on another device (Web <-> Mobile).
 * 4. Perform atomic item updates (prevent whole-collection overwrite race conditions).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { auth, db } from '../config/firebase';

let cachedUid: string | null = null;

// In-memory store for instant zero-latency UI re-renders across all screens
const inMemoryStore = new Map<string, any>();

export function getInMemoryItem<T>(key: string): T | null {
  return inMemoryStore.get(key) || null;
}

export function setInMemoryItem<T>(key: string, data: T): void {
  inMemoryStore.set(key, data);
}

export function clearInMemoryStore(): void {
  inMemoryStore.clear();
}

// Pending writes queue: items queued when auth isn't ready yet, flushed on auth ready
interface PendingWrite {
  type: 'item' | 'delete' | 'value';
  collectionName: string;
  item?: any;
  id?: string;
  path?: string;
  value?: any;
}
const pendingWrites: PendingWrite[] = [];

export function setCurrentUidCache(uid: string | null): void {
  cachedUid = uid;
}

export function getCurrentUid(): string {
  return auth.currentUser?.uid || cachedUid || 'local_guest';
}

/** Returns true if we have a valid cloud user UID */
export function isCloudUser(): boolean {
  const uid = getCurrentUid();
  return uid !== 'local_guest' && uid.length > 0;
}

/** Returns true if Firebase Auth user is actively initialized in SDK */
export function hasActiveAuth(): boolean {
  return !!auth.currentUser && auth.currentUser.uid !== 'local_guest';
}

/**
 * Recursively strips `undefined` properties from an object so Firestore JS SDK setDoc accepts it without throwing errors.
 */
export function sanitizeForFirestore<T>(obj: T): T {
  if (obj === null || obj === undefined) return null as any;
  if (typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeForFirestore(item)) as any;
  }

  const cleaned: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      cleaned[key] = typeof value === 'object' && value !== null
        ? sanitizeForFirestore(value)
        : value;
    }
  }
  return cleaned as T;
}

/** Flush any pending writes that were queued before auth was ready */
export async function flushPendingWrites(): Promise<void> {
  if (!isCloudUser() || pendingWrites.length === 0) return;
  const uid = getCurrentUid();
  const writes = [...pendingWrites];
  pendingWrites.length = 0;
  for (const w of writes) {
    try {
      if (w.type === 'item' && w.item) {
        const itemDoc = doc(db, 'users', uid, w.collectionName, w.item.id);
        await setDoc(itemDoc, sanitizeForFirestore(w.item), { merge: true });
      } else if (w.type === 'delete' && w.id) {
        const itemDoc = doc(db, 'users', uid, w.collectionName, w.id);
        await deleteDoc(itemDoc);
      } else if (w.type === 'value' && w.path) {
        const settingsDocRef = doc(db, 'users', uid, 'settings', 'app');
        const cleanVal = sanitizeForFirestore(w.value);
        if (w.path === 'settings/orderSeq') {
          await setDoc(settingsDocRef, { orderSeq: cleanVal }, { merge: true });
        } else if (w.path === 'settings/businessProfile') {
          await setDoc(settingsDocRef, { businessProfile: cleanVal }, { merge: true });
        } else {
          await setDoc(settingsDocRef, { [w.path]: cleanVal }, { merge: true });
        }
      }
    } catch (err) {
      console.warn('[firebaseSync] flushPendingWrites error:', err);
    }
  }
}

// ─── Realtime Listener & Event Emitter ──────────────────────────────
type DataListener = () => void;
const listeners = new Set<DataListener>();

export function addDataListener(callback: DataListener): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

export interface LiveSyncInfo {
  isConnected: boolean;
  email: string | null;
  uid: string | null;
  isGuest: boolean;
}

export function getLiveSyncInfo(): LiveSyncInfo {
  const currentAuth = auth.currentUser;
  const uid = getCurrentUid();
  const isGuest = uid === 'local_guest';
  const isConnected = !!currentAuth && !isGuest && activeUnsubscribers.length > 0;
  return {
    isConnected,
    email: currentAuth?.email || null,
    uid: currentAuth?.uid || (isGuest ? 'guest' : cachedUid),
    isGuest,
  };
}

export function notifyDataListeners(): void {
  listeners.forEach((cb) => {
    try {
      cb();
    } catch (e) {
      console.warn('[firebaseSync] listener error:', e);
    }
  });
}

let activeUnsubscribers: Unsubscribe[] = [];

/**
 * Helper to safely convert an ISO timestamp string or Date into epoch milliseconds
 */
function parseTimestamp(ts?: string): number {
  if (!ts) return 0;
  const parsed = new Date(ts).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * 2-Way Union Merge helper to prevent local data loss.
 * Combines local items with cloud items by ID.
 * Returns merged array and any local items that need to be uploaded to cloud.
 */
export function mergeItemLists<T extends { id: string; updatedAt?: string }>(
  localItems: T[],
  cloudItems: T[]
): { merged: T[]; needsCloudUpload: T[] } {
  const itemMap = new Map<string, T>();
  const cloudMap = new Map<string, T>();
  const needsCloudUpload: T[] = [];

  for (const c of cloudItems) {
    if (c && c.id) {
      cloudMap.set(c.id, c);
    }
  }

  for (const local of localItems) {
    if (local && local.id) {
      itemMap.set(local.id, local);
      const cloud = cloudMap.get(local.id);
      if (!cloud) {
        // Item exists locally but is missing in cloud -> upload!
        needsCloudUpload.push(local);
      } else {
        const localMs = parseTimestamp(local.updatedAt);
        const cloudMs = parseTimestamp(cloud.updatedAt);
        // Only upload local item if it is strictly newer by > 1 second
        if (localMs > cloudMs && localMs - cloudMs > 1000) {
          needsCloudUpload.push(local);
        }
      }
    }
  }

  for (const cloud of cloudItems) {
    if (cloud && cloud.id) {
      const local = itemMap.get(cloud.id);
      if (!local) {
        itemMap.set(cloud.id, cloud);
      } else {
        const cloudMs = parseTimestamp(cloud.updatedAt);
        const localMs = parseTimestamp(local.updatedAt);
        // If cloud item timestamp is equal or newer (or within clock drift threshold), cloud wins!
        if (cloudMs >= localMs - 1000) {
          itemMap.set(cloud.id, cloud);
        }
      }
    }
  }

  return {
    merged: Array.from(itemMap.values()),
    needsCloudUpload,
  };
}

/**
 * Start live real-time synchronization for the authenticated user with Firestore.
 * Connects Firestore live snapshot listeners -> auto-merges with AsyncStorage -> notifies UI screens.
 */
export function setupRealtimeSync(uid: string): () => void {
  stopRealtimeSync();

  if (!hasActiveAuth() || !uid || uid === 'local_guest') {
    return () => {};
  }

  const collections = [
    { name: 'orders', key: 'order_book:orders' },
    { name: 'customers', key: 'order_book:customers' },
    { name: 'expenses', key: 'order_book:expenses' },
    { name: 'products', key: 'order_book:products' },
    { name: 'payments', key: 'order_book:payments' },
  ];

  collections.forEach(({ name, key }) => {
    try {
      const colRef = collection(db, 'users', uid, name);
      const unsub = onSnapshot(
        colRef,
        async (snapshot) => {
          try {
            const cloudItems = snapshot.docs.map((d) => d.data() as any);
            setInMemoryItem(key, cloudItems);
            await AsyncStorage.setItem(key, JSON.stringify(cloudItems));
            notifyDataListeners();
          } catch (err) {
            console.warn(`[firebaseSync] Error processing snapshot for ${name}:`, err);
          }
        },
        (error) => {
          console.warn(`[firebaseSync] Firestore snapshot error on ${name}:`, error);
        }
      );
      activeUnsubscribers.push(unsub);
    } catch (e) {
      console.warn(`[firebaseSync] Failed to setup listener for ${name}:`, e);
    }
  });

  // Settings listener
  try {
    const settingsDocRef = doc(db, 'users', uid, 'settings', 'app');
    const unsubSettings = onSnapshot(settingsDocRef, async (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        const updates: [string, string][] = [];
        if (data.orderSeq !== undefined) {
          updates.push(['order_book:order_seq', String(data.orderSeq)]);
        }
        if (data.businessProfile) {
          updates.push([
            'order_book:business_profile',
            JSON.stringify(data.businessProfile),
          ]);
        }
        if (updates.length > 0) {
          await AsyncStorage.multiSet(updates);
          notifyDataListeners();
        }
      }
    });
    activeUnsubscribers.push(unsubSettings);
  } catch (e) {
    console.warn('[firebaseSync] Failed to setup settings listener:', e);
  }

  // Business Profile collection listener
  try {
    const bpColRef = collection(db, 'users', uid, 'business_profile');
    const unsubBp = onSnapshot(bpColRef, async (snapshot) => {
      if (!snapshot.empty) {
        const profile = snapshot.docs[0].data();
        if (profile) {
          await AsyncStorage.setItem('order_book:business_profile', JSON.stringify(profile));
          notifyDataListeners();
        }
      }
    });
    activeUnsubscribers.push(unsubBp);
  } catch (e) {
    console.warn('[firebaseSync] Failed to setup business_profile listener:', e);
  }

  return stopRealtimeSync;
}

export function stopRealtimeSync(): void {
  activeUnsubscribers.forEach((unsub) => {
    try {
      unsub();
    } catch {}
  });
  activeUnsubscribers = [];
}

// ─── Direct Cloud Read/Write Helpers ────────────────────────────────

/**
 * Fetch a full collection from `users/{uid}/{collection}`
 */
export async function readCollectionFromCloud<T>(collectionName: string): Promise<T[]> {
  if (!hasActiveAuth()) return [];

  try {
    const uid = getCurrentUid();
    const colRef = collection(db, 'users', uid, collectionName);
    const snapshot = await getDocs(colRef);
    return snapshot.docs.map((d) => d.data() as T);
  } catch (err) {
    console.warn(`[firebaseSync] readCollectionFromCloud(${collectionName}) failed:`, err);
    return [];
  }
}

/**
 * Sync an individual item to `users/{uid}/{collection}/{item.id}`
 */
export async function syncItemToCloud<T extends { id: string }>(
  collectionName: string,
  item: T
): Promise<void> {
  if (!hasActiveAuth()) {
    pendingWrites.push({ type: 'item', collectionName, item });
    return;
  }

  const uid = getCurrentUid();
  try {
    const itemDoc = doc(db, 'users', uid, collectionName, item.id);
    await setDoc(itemDoc, sanitizeForFirestore(item), { merge: true });
  } catch (err) {
    console.warn(`[firebaseSync] syncItemToCloud(${collectionName}/${item.id}) failed, queuing write:`, err);
    pendingWrites.push({ type: 'item', collectionName, item });
  }
}

/**
 * Delete a single item from `users/{uid}/{collection}/{id}`
 */
export async function deleteItemFromCloud(collectionName: string, id: string): Promise<void> {
  if (!hasActiveAuth()) {
    pendingWrites.push({ type: 'delete', collectionName, id });
    return;
  }

  const uid = getCurrentUid();
  try {
    const itemDoc = doc(db, 'users', uid, collectionName, id);
    await deleteDoc(itemDoc);
  } catch (err) {
    console.warn(`[firebaseSync] deleteItemFromCloud(${collectionName}/${id}) failed, queuing write:`, err);
    pendingWrites.push({ type: 'delete', collectionName, id });
  }
}

/**
 * Sync entire collection (used during migrations / full export imports)
 */
export async function syncCollectionToCloud<T extends { id: string }>(
  collectionName: string,
  items: T[]
): Promise<void> {
  if (!hasActiveAuth()) return;

  try {
    const uid = getCurrentUid();
    for (const item of items) {
      const itemDoc = doc(db, 'users', uid, collectionName, item.id);
      await setDoc(itemDoc, sanitizeForFirestore(item), { merge: true });
    }
  } catch (err) {
    console.warn(`[firebaseSync] syncCollectionToCloud(${collectionName}) failed:`, err);
  }
}

/**
 * Write a setting value to `users/{uid}/settings/app`
 */
export async function syncValueToCloud(path: string, value: any): Promise<void> {
  if (!hasActiveAuth()) {
    pendingWrites.push({ type: 'value', collectionName: 'settings', path, value });
    return;
  }

  const uid = getCurrentUid();
  try {
    const settingsDoc = doc(db, 'users', uid, 'settings', 'app');
    const cleanVal = sanitizeForFirestore(value);
    if (path === 'settings/orderSeq') {
      await setDoc(settingsDoc, { orderSeq: cleanVal }, { merge: true });
    } else if (path === 'settings/businessProfile') {
      await setDoc(settingsDoc, { businessProfile: cleanVal }, { merge: true });
    } else {
      await setDoc(settingsDoc, { [path]: cleanVal }, { merge: true });
    }
  } catch (err) {
    console.warn(`[firebaseSync] syncValueToCloud(${path}) failed, queuing write:`, err);
    pendingWrites.push({ type: 'value', collectionName: 'settings', path, value });
  }
}

/**
 * Read a scalar / object value from `users/{uid}/settings/app`
 */
export async function readValueFromCloud<T = any>(path: string): Promise<T | null> {
  if (!hasActiveAuth()) return null;

  try {
    const uid = getCurrentUid();
    const settingsDoc = doc(db, 'users', uid, 'settings', 'app');
    const snapshot = await getDoc(settingsDoc);
    if (!snapshot.exists()) return null;
    const data = snapshot.data();
    if (path === 'settings/orderSeq') return (data.orderSeq as T) ?? null;
    if (path === 'settings/businessProfile') return (data.businessProfile as T) ?? null;
    return (data[path] as T) ?? null;
  } catch (err) {
    console.warn(`[firebaseSync] readValueFromCloud(${path}) failed:`, err);
    return null;
  }
}

/**
 * Pull ALL cloud data for current user into local AsyncStorage.
 * Uses 2-way union merge so local unsynced data is never lost.
 * Call on login, app start, and on pull-to-refresh.
 */
export async function pullAllCloudDataToLocal(): Promise<void> {
  if (!hasActiveAuth()) return;

  const uid = getCurrentUid();
  try {
    const collections = [
      { name: 'orders', key: 'order_book:orders' },
      { name: 'customers', key: 'order_book:customers' },
      { name: 'expenses', key: 'order_book:expenses' },
      { name: 'products', key: 'order_book:products' },
      { name: 'payments', key: 'order_book:payments' },
    ];

    for (const { name, key } of collections) {
      try {
        const colRef = collection(db, 'users', uid, name);
        const snapshot = await getDocs(colRef);
        const cloudItems = snapshot.docs.map((d) => d.data() as any);
        setInMemoryItem(key, cloudItems);
        await AsyncStorage.setItem(key, JSON.stringify(cloudItems));
      } catch (err) {
        console.warn(`[firebaseSync] Error pulling ${name}:`, err);
      }
    }

    // Pull business profile
    try {
      const bpColRef = collection(db, 'users', uid, 'business_profile');
      const bpSnap = await getDocs(bpColRef);
      if (!bpSnap.empty) {
        const bpData = bpSnap.docs[0].data();
        await AsyncStorage.setItem('order_book:business_profile', JSON.stringify(bpData));
      } else {
        const settingsDocRef = doc(db, 'users', uid, 'settings', 'app');
        const snapshot = await getDoc(settingsDocRef);
        if (snapshot.exists()) {
          const data = snapshot.data();
          if (data.businessProfile) {
            await AsyncStorage.setItem('order_book:business_profile', JSON.stringify(data.businessProfile));
          }
        }
      }
    } catch {}

    // Pull order sequence
    try {
      const settingsDocRef = doc(db, 'users', uid, 'settings', 'app');
      const snapshot = await getDoc(settingsDocRef);
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data.orderSeq !== undefined) {
          await AsyncStorage.setItem('order_book:order_seq', String(data.orderSeq));
        }
      }
    } catch {}

    notifyDataListeners();
  } catch (err) {
    console.warn('[firebaseSync] pullAllCloudDataToLocal failed:', err);
  }
}


