import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  doc,
  setDoc,
  getDoc,
  collection,
  getDocs,
  deleteDoc,
  writeBatch,
} from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { isCloudUser, getCurrentUid, notifyDataListeners } from './firebaseSync';

const USER_DATA_KEYS = [
  'order_book:orders',
  'order_book:order_seq',
  'order_book:expenses',
  'order_book:customers',
  'order_book:products',
  'order_book:payments',
  'order_book:business_profile',
];

export async function exportAllData(): Promise<string> {
  const entries = await AsyncStorage.multiGet(USER_DATA_KEYS);
  const data: Record<string, any> = {};
  for (const [k, v] of entries) {
    try {
      data[k] = v ? JSON.parse(v) : null;
    } catch {
      data[k] = v;
    }
  }
  return JSON.stringify(
    {
      version: '2.0',
      timestamp: new Date().toISOString(),
      userId: getCurrentUid(),
      userEmail: auth.currentUser?.email || 'local',
      data,
    },
    null,
    2
  );
}

export async function importAllData(jsonString: string): Promise<boolean> {
  try {
    const parsed = JSON.parse(jsonString);
    if (!parsed.data) return false;
    const entries: [string, string][] = [];
    for (const [k, v] of Object.entries(parsed.data)) {
      if (v !== null && v !== undefined) {
        entries.push([k, typeof v === 'string' ? v : JSON.stringify(v)]);
      }
    }
    if (entries.length > 0) {
      await AsyncStorage.multiSet(entries);
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Clear all local data AND cloud data for the authenticated user.
 */
export async function clearAllData(): Promise<void> {
  // Clear local AsyncStorage
  await AsyncStorage.multiRemove([
    'order_book:orders',
    'order_book:order_seq',
    'order_book:expenses',
    'order_book:customers',
    'order_book:products',
    'order_book:payments',
  ]);

  // Also clear cloud Firestore collections for the user
  if (isCloudUser()) {
    const uid = getCurrentUid();
    const collectionsToDelete = ['orders', 'customers', 'expenses', 'products', 'payments'];

    for (const colName of collectionsToDelete) {
      try {
        const colRef = collection(db, 'users', uid, colName);
        const snapshot = await getDocs(colRef);
        // Firestore doesn't support collection deletion, delete each doc
        const batch = writeBatch(db);
        snapshot.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
      } catch (err) {
        console.warn(`[backupStorage] clearAllData: failed to clear cloud ${colName}:`, err);
      }
    }

    // Reset settings
    try {
      const settingsDoc = doc(db, 'users', uid, 'settings', 'app');
      await setDoc(settingsDoc, { orderSeq: 0 }, { merge: true });
    } catch {}
  }
}

/**
 * Backup all local orders, customers, expenses to Firebase Cloud Firestore
 * under the current user's path.
 */
export async function backupToFirebaseCloud(): Promise<{
  success: boolean;
  error?: string;
  timestamp?: string;
}> {
  if (!isCloudUser()) {
    return {
      success: false,
      error: 'You must be logged in with email/password to use cloud backup. Guest mode does not support cloud sync.',
    };
  }

  try {
    const jsonStr = await exportAllData();
    const parsed = JSON.parse(jsonStr);
    const uid = getCurrentUid();
    const backupDoc = doc(db, 'users', uid, 'backup', 'latest');

    await setDoc(backupDoc, {
      updatedAt: new Date().toISOString(),
      userEmail: auth.currentUser?.email || 'unknown',
      data: parsed.data,
    });

    // Also push individual documents to Firestore collections so live listeners on other devices receive them
    const collections = [
      { name: 'orders', items: parsed.data['order_book:orders'] },
      { name: 'customers', items: parsed.data['order_book:customers'] },
      { name: 'expenses', items: parsed.data['order_book:expenses'] },
      { name: 'products', items: parsed.data['order_book:products'] },
      { name: 'payments', items: parsed.data['order_book:payments'] },
    ];
    for (const { name, items } of collections) {
      if (Array.isArray(items)) {
        for (const item of items) {
          if (item && item.id) {
            const itemDoc = doc(db, 'users', uid, name, item.id);
            await setDoc(itemDoc, item, { merge: true }).catch(() => {});
          }
        }
      }
    }

    notifyDataListeners();

    return { success: true, timestamp: new Date().toLocaleTimeString() };
  } catch (err: any) {
    console.error('Firebase cloud backup failed:', err);
    return {
      success: false,
      error: err?.message || 'Cloud backup failed. Check internet and Firestore rules.',
    };
  }
}

/**
 * Restore data from Firebase Cloud Firestore backup.
 */
export async function restoreFromFirebaseCloud(): Promise<{
  success: boolean;
  error?: string;
}> {
  if (!isCloudUser()) {
    return {
      success: false,
      error: 'You must be logged in with email/password to restore from cloud.',
    };
  }

  try {
    const uid = getCurrentUid();
    const backupDoc = doc(db, 'users', uid, 'backup', 'latest');
    const snapshot = await getDoc(backupDoc);

    if (!snapshot.exists()) {
      return {
        success: false,
        error: 'No cloud backup found for this account.',
      };
    }

    const cloudData = snapshot.data();
    if (!cloudData.data) {
      return { success: false, error: 'Cloud backup contains no data.' };
    }

    const entries: [string, string][] = [];
    for (const [k, v] of Object.entries(cloudData.data)) {
      if (v !== null && v !== undefined) {
        entries.push([k, typeof v === 'string' ? v : JSON.stringify(v)]);
      }
    }
    if (entries.length > 0) {
      await AsyncStorage.multiSet(entries);
      notifyDataListeners();
    }
    return { success: true };
  } catch (err: any) {
    console.error('Firebase cloud restore failed:', err);
    return {
      success: false,
      error: err?.message || 'Could not fetch cloud data.',
    };
  }
}
