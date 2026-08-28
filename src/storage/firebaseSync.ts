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

export function setCurrentUidCache(uid: string | null): void {
  cachedUid = uid;
}

export function getCurrentUid(): string {
  return auth.currentUser?.uid || cachedUid || 'local_guest';
}

export function isCloudUser(): boolean {
  return !!auth.currentUser && auth.currentUser.uid !== 'local_guest';
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
 * 2-Way Union Merge helper to prevent local data loss.
 * Combines local items with cloud items by ID.
 * Returns merged array and any local items missing in cloud so they can be uploaded.
 */
export function mergeItemLists<T extends { id: string; updatedAt?: string }>(
  localItems: T[],
  cloudItems: T[]
): { merged: T[]; missingInCloud: T[] } {
  const itemMap = new Map<string, T>();
  const cloudIds = new Set(cloudItems.map((c) => c.id));
  const missingInCloud: T[] = [];

  for (const item of localItems) {
    if (item && item.id) {
      itemMap.set(item.id, item);
      if (!cloudIds.has(item.id)) {
        missingInCloud.push(item);
      }
    }
  }

  for (const item of cloudItems) {
    if (item && item.id) {
      itemMap.set(item.id, item);
    }
  }

  return {
    merged: Array.from(itemMap.values()),
    missingInCloud,
  };
}

/**
 * Start live real-time synchronization for the authenticated user with Firestore.
 * Connects Firestore live snapshot listeners -> auto-merges with AsyncStorage -> notifies UI screens.
 */
export function setupRealtimeSync(uid: string): () => void {
  stopRealtimeSync();

  if (!auth.currentUser || !uid || uid === 'local_guest') {
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
            const rawLocal = await AsyncStorage.getItem(key);
            let localItems: any[] = [];
            if (rawLocal) {
              try { localItems = JSON.parse(rawLocal); } catch {}
            }

            const { merged, missingInCloud } = mergeItemLists(localItems, cloudItems);
            await AsyncStorage.setItem(key, JSON.stringify(merged));
            notifyDataListeners();

            // Push any local items missing from cloud up to Firestore
            if (missingInCloud.length > 0) {
              for (const item of missingInCloud) {
                const itemDoc = doc(db, 'users', uid, name, item.id);
                await setDoc(itemDoc, item, { merge: true }).catch(() => {});
              }
            }
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
  if (!isCloudUser()) return [];

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
  if (!isCloudUser()) return;

  try {
    const uid = getCurrentUid();
    const itemDoc = doc(db, 'users', uid, collectionName, item.id);
    await setDoc(itemDoc, item, { merge: true });
  } catch (err) {
    console.warn(`[firebaseSync] syncItemToCloud(${collectionName}/${item.id}) failed:`, err);
  }
}

/**
 * Delete a single item from `users/{uid}/{collection}/{id}`
 */
export async function deleteItemFromCloud(collectionName: string, id: string): Promise<void> {
  if (!isCloudUser()) return;

  try {
    const uid = getCurrentUid();
    const itemDoc = doc(db, 'users', uid, collectionName, id);
    await deleteDoc(itemDoc);
  } catch (err) {
    console.warn(`[firebaseSync] deleteItemFromCloud(${collectionName}/${id}) failed:`, err);
  }
}

/**
 * Sync entire collection (used during migrations / full export imports)
 */
export async function syncCollectionToCloud<T extends { id: string }>(
  collectionName: string,
  items: T[]
): Promise<void> {
  if (!isCloudUser()) return;

  try {
    const uid = getCurrentUid();
    for (const item of items) {
      const itemDoc = doc(db, 'users', uid, collectionName, item.id);
      await setDoc(itemDoc, item, { merge: true });
    }
  } catch (err) {
    console.warn(`[firebaseSync] syncCollectionToCloud(${collectionName}) failed:`, err);
  }
}

/**
 * Write a setting value to `users/{uid}/settings/app`
 */
export async function syncValueToCloud(path: string, value: any): Promise<void> {
  if (!isCloudUser()) return;

  try {
    const uid = getCurrentUid();
    const settingsDoc = doc(db, 'users', uid, 'settings', 'app');
    if (path === 'settings/orderSeq') {
      await setDoc(settingsDoc, { orderSeq: value }, { merge: true });
    } else if (path === 'settings/businessProfile') {
      await setDoc(settingsDoc, { businessProfile: value }, { merge: true });
    } else {
      await setDoc(settingsDoc, { [path]: value }, { merge: true });
    }
  } catch (err) {
    console.warn(`[firebaseSync] syncValueToCloud(${path}) failed:`, err);
  }
}

/**
 * Read a scalar / object value from `users/{uid}/settings/app`
 */
export async function readValueFromCloud<T = any>(path: string): Promise<T | null> {
  if (!isCloudUser()) return null;

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
  if (!isCloudUser()) return;

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
        const rawLocal = await AsyncStorage.getItem(key);
        let localItems: any[] = [];
        if (rawLocal) {
          try { localItems = JSON.parse(rawLocal); } catch {}
        }

        const { merged, missingInCloud } = mergeItemLists(localItems, cloudItems);
        await AsyncStorage.setItem(key, JSON.stringify(merged));

        // Push any local items missing from cloud up to Firestore
        if (missingInCloud.length > 0) {
          for (const item of missingInCloud) {
            const itemDoc = doc(db, 'users', uid, name, item.id);
            await setDoc(itemDoc, item, { merge: true }).catch(() => {});
          }
        }
      } catch (err) {
        console.warn(`[firebaseSync] Error pulling ${name}:`, err);
      }
    }

    // Pull business profile (prioritize business_profile collection containing logo photo & full details)
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

    // Notify UI screens that fresh cloud data has arrived
    notifyDataListeners();
  } catch (err) {
    console.warn('[firebaseSync] pullAllCloudDataToLocal failed:', err);
  }
}
