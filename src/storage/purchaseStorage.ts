import AsyncStorage from '@react-native-async-storage/async-storage';
import { Purchase } from '../types/purchase';
import { generateId } from '../utils/id';
import { todayIso } from '../utils/format';
import {
  syncItemToCloud,
  deleteItemFromCloud,
  pullAllCloudDataToLocal,
  getInMemoryItem,
  setInMemoryItem,
} from './firebaseSync';

const KEY = 'order_book:purchases';
const SEQ_KEY = 'order_book:purchase_seq';

async function readAll(): Promise<Purchase[]> {
  const cached = getInMemoryItem<Purchase[]>(KEY);
  if (cached) return cached;

  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Purchase[];
    setInMemoryItem(KEY, parsed);
    return parsed;
  } catch {
    return [];
  }
}

async function writeAll(items: Purchase[]): Promise<void> {
  setInMemoryItem(KEY, items);
  await AsyncStorage.setItem(KEY, JSON.stringify(items));
}

export async function getPurchases(forceSync = false): Promise<Purchase[]> {
  if (forceSync) {
    await pullAllCloudDataToLocal();
  }
  const all = await readAll();
  return all.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function getPurchase(id: string): Promise<Purchase | undefined> {
  const all = await readAll();
  return all.find((p) => p.id === id);
}

export async function nextPurchaseNumber(): Promise<string> {
  const all = await readAll();
  let maxNum = 0;

  for (const p of all) {
    if (p.purchaseNumber) {
      const match = p.purchaseNumber.match(/\d+/);
      if (match) {
        const n = parseInt(match[0], 10);
        if (!isNaN(n) && n > maxNum) {
          maxNum = n;
        }
      }
    }
  }

  const next = maxNum + 1;
  return `PUR-${String(next).padStart(4, '0')}`;
}

export async function savePurchase(
  purchase: Omit<Purchase, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
): Promise<Purchase> {
  const all = await readAll();
  const now = todayIso();

  if (purchase.id) {
    const idx = all.findIndex((p) => p.id === purchase.id);
    if (idx >= 0) {
      const updated: Purchase = { ...all[idx], ...purchase, id: purchase.id, updatedAt: now };
      all[idx] = updated;
      await writeAll(all);
      await syncItemToCloud('purchases', updated);
      return updated;
    }
  }

  const created: Purchase = {
    ...purchase,
    id: generateId('pur_'),
    createdAt: now,
    updatedAt: now,
  };
  all.push(created);
  await writeAll(all);
  await syncItemToCloud('purchases', created);
  return created;
}

export async function deletePurchase(id: string): Promise<void> {
  const all = await readAll();
  await writeAll(all.filter((p) => p.id !== id));
  await deleteItemFromCloud('purchases', id);
}
