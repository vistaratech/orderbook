/**
 * Firebase Realtime Database Sync Helper
 *
 * Centralised module that all storage files and screens use to:
 * 1. Listen to live real-time changes under `users/{uid}` in Firebase RTDB.
 * 2. Keep local AsyncStorage updated with latest cloud data across all devices.
 * 3. Notify active UI screens whenever data updates on another device (Web <-> Mobile).
 * 4. Perform atomic item updates (prevent whole-collection overwrite race conditions).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { ref, set, get, remove, onValue, Unsubscribe } from 'firebase/database';
import { auth, rtdb } from '../config/firebase';

export function getCurrentUid(): string {
  return auth.currentUser?.uid || 'local_guest';
}

export function isCloudUser(): boolean {
  return !!auth.currentUser;
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

let activeRtdbUnsubscribe: Unsubscribe | null = null;
let isSyncingIncoming = false;

/**
 * Start live real-time synchronization for the authenticated user.
 * Connects Firebase RTDB live listener -> auto-updates AsyncStorage -> notifies UI screens.
 */
export function setupRealtimeSync(uid: string): () => void {
  stopRealtimeSync();

  if (!uid || uid === 'local_guest') {
    return () => {};
  }

  const userRootRef = ref(rtdb, `users/${uid}`);

  activeRtdbUnsubscribe = onValue(
    userRootRef,
    async (snapshot) => {
      if (!snapshot.exists()) return;

      const data = snapshot.val();
      if (!data) return;

      isSyncingIncoming = true;
      try {
        const updates: [string, string][] = [];

        if (data.orders) {
          const ordersList = Object.values(data.orders);
          updates.push(['order_book:orders', JSON.stringify(ordersList)]);
        }
        if (data.customers) {
          const custList = Object.values(data.customers);
          updates.push(['order_book:customers', JSON.stringify(custList)]);
        }
        if (data.expenses) {
          const expList = Object.values(data.expenses);
          updates.push(['order_book:expenses', JSON.stringify(expList)]);
        }
        if (data.products) {
          const prodList = Object.values(data.products);
          updates.push(['order_book:products', JSON.stringify(prodList)]);
        }
        if (data.payments) {
          const payList = Object.values(data.payments);
          updates.push(['order_book:payments', JSON.stringify(payList)]);
        }
        if (data.settings) {
          if (data.settings.orderSeq !== undefined) {
            updates.push(['order_book:order_seq', String(data.settings.orderSeq)]);
          }
          if (data.settings.businessProfile) {
            updates.push([
              'order_book:business_profile',
              JSON.stringify(data.settings.businessProfile),
            ]);
          }
        }

        if (updates.length > 0) {
          await AsyncStorage.multiSet(updates);
          // Notify all active screens to reload fresh data
          notifyDataListeners();
        }
      } catch (err) {
        console.warn('[firebaseSync] Error processing RTDB snapshot:', err);
      } finally {
        isSyncingIncoming = false;
      }
    },
    (error) => {
      console.warn('[firebaseSync] RTDB onValue error:', error);
    }
  );

  return stopRealtimeSync;
}

export function stopRealtimeSync(): void {
  if (activeRtdbUnsubscribe) {
    try {
      activeRtdbUnsubscribe();
    } catch {}
    activeRtdbUnsubscribe = null;
  }
}

// ─── Direct Cloud Read/Write Helpers ────────────────────────────────

/**
 * Fetch a full collection from `users/{uid}/{collection}`
 */
export async function readCollectionFromCloud<T>(collection: string): Promise<T[]> {
  if (!isCloudUser()) return [];

  try {
    const uid = getCurrentUid();
    const collectionRef = ref(rtdb, `users/${uid}/${collection}`);
    const snapshot = await get(collectionRef);
    if (!snapshot.exists()) return [];

    const dataMap = snapshot.val() as Record<string, T>;
    return Object.values(dataMap);
  } catch (err) {
    console.warn(`[firebaseSync] readCollectionFromCloud(${collection}) failed:`, err);
    return [];
  }
}

/**
 * Sync an individual item to `users/{uid}/{collection}/{item.id}`
 */
export async function syncItemToCloud<T extends { id: string }>(
  collection: string,
  item: T
): Promise<void> {
  if (!isCloudUser() || isSyncingIncoming) return;

  try {
    const uid = getCurrentUid();
    const itemRef = ref(rtdb, `users/${uid}/${collection}/${item.id}`);
    await set(itemRef, item);
  } catch (err) {
    console.warn(`[firebaseSync] syncItemToCloud(${collection}/${item.id}) failed:`, err);
  }
}

/**
 * Delete a single item from `users/{uid}/{collection}/{id}`
 */
export async function deleteItemFromCloud(collection: string, id: string): Promise<void> {
  if (!isCloudUser() || isSyncingIncoming) return;

  try {
    const uid = getCurrentUid();
    const itemRef = ref(rtdb, `users/${uid}/${collection}/${id}`);
    await remove(itemRef);
  } catch (err) {
    console.warn(`[firebaseSync] deleteItemFromCloud(${collection}/${id}) failed:`, err);
  }
}

/**
 * Sync entire collection (used during migrations / full export imports)
 */
export async function syncCollectionToCloud<T extends { id: string }>(
  collection: string,
  items: T[]
): Promise<void> {
  if (!isCloudUser() || isSyncingIncoming) return;

  try {
    const uid = getCurrentUid();
    const collectionRef = ref(rtdb, `users/${uid}/${collection}`);
    const dataMap: Record<string, T> = {};
    for (const item of items) {
      dataMap[item.id] = item;
    }
    await set(collectionRef, dataMap);
  } catch (err) {
    console.warn(`[firebaseSync] syncCollectionToCloud(${collection}) failed:`, err);
  }
}

/**
 * Write a scalar / object value to `users/{uid}/{path}`
 */
export async function syncValueToCloud(path: string, value: any): Promise<void> {
  if (!isCloudUser() || isSyncingIncoming) return;

  try {
    const uid = getCurrentUid();
    const valRef = ref(rtdb, `users/${uid}/${path}`);
    await set(valRef, value);
  } catch (err) {
    console.warn(`[firebaseSync] syncValueToCloud(${path}) failed:`, err);
  }
}

/**
 * Read a scalar / object value from `users/{uid}/{path}`
 */
export async function readValueFromCloud<T = any>(path: string): Promise<T | null> {
  if (!isCloudUser()) return null;

  try {
    const uid = getCurrentUid();
    const valRef = ref(rtdb, `users/${uid}/${path}`);
    const snapshot = await get(valRef);
    return snapshot.exists() ? (snapshot.val() as T) : null;
  } catch (err) {
    console.warn(`[firebaseSync] readValueFromCloud(${path}) failed:`, err);
    return null;
  }
}

/**
 * Pull ALL cloud data for current user into local AsyncStorage.
 * Call on login, app start, and on pull-to-refresh.
 */
export async function pullAllCloudDataToLocal(): Promise<void> {
  if (!isCloudUser()) return;

  const uid = getCurrentUid();
  try {
    const userRootRef = ref(rtdb, `users/${uid}`);
    const snapshot = await get(userRootRef);
    if (!snapshot.exists()) return;

    const data = snapshot.val();
    if (!data) return;

    const updates: [string, string][] = [];
    if (data.orders) {
      updates.push(['order_book:orders', JSON.stringify(Object.values(data.orders))]);
    }
    if (data.customers) {
      updates.push(['order_book:customers', JSON.stringify(Object.values(data.customers))]);
    }
    if (data.expenses) {
      updates.push(['order_book:expenses', JSON.stringify(Object.values(data.expenses))]);
    }
    if (data.products) {
      updates.push(['order_book:products', JSON.stringify(Object.values(data.products))]);
    }
    if (data.payments) {
      updates.push(['order_book:payments', JSON.stringify(Object.values(data.payments))]);
    }
    if (data.settings) {
      if (data.settings.orderSeq !== undefined) {
        updates.push(['order_book:order_seq', String(data.settings.orderSeq)]);
      }
      if (data.settings.businessProfile) {
        updates.push([
          'order_book:business_profile',
          JSON.stringify(data.settings.businessProfile),
        ]);
      }
    }

    if (updates.length > 0) {
      await AsyncStorage.multiSet(updates);
      notifyDataListeners();
    }
  } catch (err) {
    console.warn('[firebaseSync] pullAllCloudDataToLocal failed:', err);
  }
}
