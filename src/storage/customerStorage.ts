import AsyncStorage from '@react-native-async-storage/async-storage';
import { Customer } from '../types/order';
import { generateId } from '../utils/id';
import { todayIso } from '../utils/format';
import {
  syncItemToCloud,
  deleteItemFromCloud,
  pullAllCloudDataToLocal,
} from './firebaseSync';

const KEY = 'order_book:customers';

async function readAll(): Promise<Customer[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as Customer[];
  } catch {
    return [];
  }
}

async function writeAll(items: Customer[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(items));
}

export async function getCustomers(forceSync = false): Promise<Customer[]> {
  if (forceSync) {
    await pullAllCloudDataToLocal();
  }
  const all = await readAll();
  return all.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getCustomer(id: string): Promise<Customer | undefined> {
  const all = await readAll();
  return all.find((c) => c.id === id);
}

export async function saveCustomer(
  customer: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
): Promise<Customer> {
  const all = await readAll();
  const now = todayIso();

  if (customer.id) {
    const idx = all.findIndex((c) => c.id === customer.id);
    if (idx >= 0) {
      const updated: Customer = {
        ...all[idx],
        ...customer,
        id: customer.id,
        updatedAt: now,
      };
      all[idx] = updated;
      await writeAll(all);
      await syncItemToCloud('customers', updated);
      return updated;
    }
  }

  const created: Customer = {
    ...customer,
    id: generateId('cust_'),
    createdAt: now,
    updatedAt: now,
  };
  all.push(created);
  await writeAll(all);
  await syncItemToCloud('customers', created);
  return created;
}

export async function deleteCustomer(id: string): Promise<void> {
  const all = await readAll();
  await writeAll(all.filter((c) => c.id !== id));
  await deleteItemFromCloud('customers', id);
}
