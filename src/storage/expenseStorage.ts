import AsyncStorage from '@react-native-async-storage/async-storage';
import { Expense } from '../types/order';
import { generateId } from '../utils/id';
import { todayIso } from '../utils/format';
import {
  syncItemToCloud,
  deleteItemFromCloud,
  pullAllCloudDataToLocal,
} from './firebaseSync';

const KEY = 'order_book:expenses';

async function readAll(): Promise<Expense[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as Expense[];
  } catch {
    return [];
  }
}

async function writeAll(items: Expense[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(items));
}

export async function getExpenses(forceSync = false): Promise<Expense[]> {
  if (forceSync) {
    await pullAllCloudDataToLocal();
  }
  const all = await readAll();
  return all.sort((a, b) => (a.date < b.date ? 1 : -1));
}

export async function getExpense(id: string): Promise<Expense | undefined> {
  const all = await readAll();
  return all.find((e) => e.id === id);
}

export async function saveExpense(
  expense: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
): Promise<Expense> {
  const all = await readAll();
  const now = todayIso();

  if (expense.id) {
    const idx = all.findIndex((e) => e.id === expense.id);
    if (idx >= 0) {
      const updated: Expense = {
        ...all[idx],
        ...expense,
        id: expense.id,
        updatedAt: now,
      };
      all[idx] = updated;
      await writeAll(all);
      await syncItemToCloud('expenses', updated);
      return updated;
    }
  }

  const created: Expense = {
    ...expense,
    id: generateId('exp_'),
    createdAt: now,
    updatedAt: now,
  };
  all.push(created);
  await writeAll(all);
  await syncItemToCloud('expenses', created);
  return created;
}

export async function deleteExpense(id: string): Promise<void> {
  const all = await readAll();
  await writeAll(all.filter((e) => e.id !== id));
  await deleteItemFromCloud('expenses', id);
}
