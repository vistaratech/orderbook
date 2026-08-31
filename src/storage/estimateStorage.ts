import AsyncStorage from '@react-native-async-storage/async-storage';
import { Estimate } from '../types/estimate';
import { generateId } from '../utils/id';
import { todayIso } from '../utils/format';
import {
  syncItemToCloud,
  deleteItemFromCloud,
  pullAllCloudDataToLocal,
  getInMemoryItem,
  setInMemoryItem,
} from './firebaseSync';

const KEY = 'order_book:estimates';

async function readAll(): Promise<Estimate[]> {
  const cached = getInMemoryItem<Estimate[]>(KEY);
  if (cached) return cached;

  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Estimate[];
    setInMemoryItem(KEY, parsed);
    return parsed;
  } catch {
    return [];
  }
}

async function writeAll(items: Estimate[]): Promise<void> {
  setInMemoryItem(KEY, items);
  await AsyncStorage.setItem(KEY, JSON.stringify(items));
}

export async function getEstimates(forceSync = false): Promise<Estimate[]> {
  if (forceSync) {
    await pullAllCloudDataToLocal();
  }
  const all = await readAll();
  return all.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function getEstimate(id: string): Promise<Estimate | undefined> {
  const all = await readAll();
  return all.find((e) => e.id === id);
}

export async function nextEstimateNumber(): Promise<string> {
  const all = await readAll();
  let maxNum = 0;

  for (const e of all) {
    if (e.estimateNumber) {
      const match = e.estimateNumber.match(/\d+/);
      if (match) {
        const n = parseInt(match[0], 10);
        if (!isNaN(n) && n > maxNum) {
          maxNum = n;
        }
      }
    }
  }

  const next = maxNum + 1;
  return `EST-${String(next).padStart(4, '0')}`;
}

export async function saveEstimate(
  estimate: Omit<Estimate, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
): Promise<Estimate> {
  const all = await readAll();
  const now = todayIso();

  if (estimate.id) {
    const idx = all.findIndex((e) => e.id === estimate.id);
    if (idx >= 0) {
      const updated: Estimate = { ...all[idx], ...estimate, id: estimate.id, updatedAt: now };
      all[idx] = updated;
      await writeAll(all);
      await syncItemToCloud('estimates', updated);
      return updated;
    }
  }

  const created: Estimate = {
    ...estimate,
    id: generateId('est_'),
    createdAt: now,
    updatedAt: now,
  };
  all.push(created);
  await writeAll(all);
  await syncItemToCloud('estimates', created);
  return created;
}

export async function deleteEstimate(id: string): Promise<void> {
  const all = await readAll();
  await writeAll(all.filter((e) => e.id !== id));
  await deleteItemFromCloud('estimates', id);
}

export async function setEstimateStatus(id: string, status: Estimate['status']): Promise<void> {
  const all = await readAll();
  const idx = all.findIndex((e) => e.id === id);
  if (idx >= 0) {
    all[idx] = { ...all[idx], status, updatedAt: todayIso() };
    await writeAll(all);
    await syncItemToCloud('estimates', all[idx]);
  }
}
