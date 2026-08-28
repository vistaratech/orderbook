import AsyncStorage from '@react-native-async-storage/async-storage';
import { PaymentEntry } from '../types/order';
import { generateId } from '../utils/id';
import { todayIso } from '../utils/format';
import {
  syncItemToCloud,
  deleteItemFromCloud,
  pullAllCloudDataToLocal,
  getInMemoryItem,
  setInMemoryItem,
} from './firebaseSync';

const KEY = 'order_book:payments';

async function readAll(): Promise<PaymentEntry[]> {
  const cached = getInMemoryItem<PaymentEntry[]>(KEY);
  if (cached) return cached;

  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as PaymentEntry[];
    setInMemoryItem(KEY, parsed);
    return parsed;
  } catch {
    return [];
  }
}

async function writeAll(items: PaymentEntry[]): Promise<void> {
  setInMemoryItem(KEY, items);
  await AsyncStorage.setItem(KEY, JSON.stringify(items));
}

export async function getPaymentsForOrder(
  orderId: string,
  forceSync = false
): Promise<PaymentEntry[]> {
  if (forceSync) {
    await pullAllCloudDataToLocal();
  }
  const all = await readAll();
  return all
    .filter((p) => p.orderId === orderId)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

export async function getAllPayments(forceSync = false): Promise<PaymentEntry[]> {
  if (forceSync) {
    await pullAllCloudDataToLocal();
  }
  const all = await readAll();
  return all.sort((a, b) => (a.date < b.date ? 1 : -1));
}

export async function addPayment(
  payment: Omit<PaymentEntry, 'id' | 'createdAt'>
): Promise<PaymentEntry> {
  const all = await readAll();
  const created: PaymentEntry = {
    ...payment,
    id: generateId('pay_'),
    createdAt: todayIso(),
  };
  all.push(created);
  await writeAll(all);
  await syncItemToCloud('payments', created);
  return created;
}

export async function deletePayment(id: string): Promise<void> {
  const all = await readAll();
  await writeAll(all.filter((p) => p.id !== id));
  deleteItemFromCloud('payments', id).catch(() => {});
}
