import AsyncStorage from '@react-native-async-storage/async-storage';
import { Product } from '../types/order';
import { generateId } from '../utils/id';
import { todayIso } from '../utils/format';
import {
  syncItemToCloud,
  deleteItemFromCloud,
  pullAllCloudDataToLocal,
  getInMemoryItem,
  setInMemoryItem,
} from './firebaseSync';

const KEY = 'order_book:products';

async function readAll(): Promise<Product[]> {
  const cached = getInMemoryItem<Product[]>(KEY);
  if (cached) return cached;

  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Product[];
    setInMemoryItem(KEY, parsed);
    return parsed;
  } catch {
    return [];
  }
}

async function writeAll(items: Product[]): Promise<void> {
  setInMemoryItem(KEY, items);
  await AsyncStorage.setItem(KEY, JSON.stringify(items));
}

export async function getProducts(forceSync = false): Promise<Product[]> {
  if (forceSync) {
    await pullAllCloudDataToLocal();
  }
  const all = await readAll();
  return all.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getProduct(id: string): Promise<Product | undefined> {
  const all = await readAll();
  return all.find((p) => p.id === id);
}

export async function saveProduct(
  product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
): Promise<Product> {
  const all = await readAll();
  const now = todayIso();

  if (product.id) {
    const idx = all.findIndex((p) => p.id === product.id);
    if (idx >= 0) {
      const updated: Product = {
        ...all[idx],
        ...product,
        id: product.id,
        updatedAt: now,
      };
      all[idx] = updated;
      await writeAll(all);
      await syncItemToCloud('products', updated);
      return updated;
    }
  }

  const created: Product = {
    ...product,
    id: generateId('prod_'),
    createdAt: now,
    updatedAt: now,
  };
  all.push(created);
  await writeAll(all);
  await syncItemToCloud('products', created);
  return created;
}

export async function deleteProduct(id: string): Promise<void> {
  const all = await readAll();
  await writeAll(all.filter((p) => p.id !== id));
  await deleteItemFromCloud('products', id);
}

/** Adjust stock quantity for a product by delta (positive = add, negative = deduct) */
export async function adjustStock(productId: string, delta: number): Promise<void> {
  const all = await readAll();
  const idx = all.findIndex((p) => p.id === productId);
  if (idx >= 0 && all[idx].stockQty !== undefined) {
    const newQty = Math.max(0, (all[idx].stockQty || 0) + delta);
    all[idx] = { ...all[idx], stockQty: newQty, updatedAt: todayIso() };
    await writeAll(all);
    await syncItemToCloud('products', all[idx]);
  }
}

/** Adjust stock by product name match (case-insensitive). Used when saving orders/purchases. */
export async function adjustStockByName(productName: string, delta: number): Promise<void> {
  const all = await readAll();
  const idx = all.findIndex(
    (p) => p.name.toLowerCase().trim() === productName.toLowerCase().trim()
  );
  if (idx >= 0 && all[idx].stockQty !== undefined) {
    const newQty = Math.max(0, (all[idx].stockQty || 0) + delta);
    all[idx] = { ...all[idx], stockQty: newQty, updatedAt: todayIso() };
    await writeAll(all);
    await syncItemToCloud('products', all[idx]);
  }
}

/** Get all products with stock below their low stock threshold */
export async function getLowStockProducts(): Promise<Product[]> {
  const all = await readAll();
  return all.filter(
    (p) =>
      p.stockQty !== undefined &&
      p.lowStockThreshold !== undefined &&
      p.stockQty <= p.lowStockThreshold
  );
}

/** Find product by barcode */
export async function getProductByBarcode(barcode: string): Promise<Product | undefined> {
  const all = await readAll();
  return all.find((p) => p.barcode && p.barcode === barcode);
}

