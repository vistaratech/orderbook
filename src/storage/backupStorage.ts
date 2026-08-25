import AsyncStorage from '@react-native-async-storage/async-storage';
import { ref, set, get } from 'firebase/database';
import { auth, rtdb } from '../config/firebase';
import { isCloudUser, getCurrentUid } from './firebaseSync';

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

export async function clearAllData(): Promise<void> {
  await AsyncStorage.multiRemove([
    'order_book:orders',
    'order_book:order_seq',
    'order_book:expenses',
    'order_book:customers',
    'order_book:products',
    'order_book:payments',
  ]);
}

/**
 * Backup all local orders, customers, expenses to Firebase Realtime Database
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
    const backupRef = ref(rtdb, `users/${uid}/backup`);

    await set(backupRef, {
      updatedAt: new Date().toISOString(),
      userEmail: auth.currentUser?.email || 'unknown',
      data: parsed.data,
    });

    return { success: true, timestamp: new Date().toLocaleTimeString() };
  } catch (err: any) {
    console.error('Firebase cloud backup failed:', err);
    return {
      success: false,
      error: err?.message || 'Cloud backup failed. Check internet and Firebase DB rules.',
    };
  }
}

/**
 * Restore data from Firebase Realtime Database backup.
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
    const backupRef = ref(rtdb, `users/${uid}/backup`);
    const snapshot = await get(backupRef);

    if (!snapshot.exists()) {
      return {
        success: false,
        error: 'No cloud backup found for this account.',
      };
    }

    const cloudData = snapshot.val();
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
