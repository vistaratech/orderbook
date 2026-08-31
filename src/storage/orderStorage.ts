import AsyncStorage from '@react-native-async-storage/async-storage';
import { Order } from '../types/order';
import { generateId } from '../utils/id';
import { todayIso } from '../utils/format';
import {
  syncItemToCloud,
  deleteItemFromCloud,
  syncValueToCloud,
  pullAllCloudDataToLocal,
  getInMemoryItem,
  setInMemoryItem,
} from './firebaseSync';

const ORDERS_KEY = 'order_book:orders';
const SEQ_KEY = 'order_book:order_seq';

async function readAll(): Promise<Order[]> {
  const cached = getInMemoryItem<Order[]>(ORDERS_KEY);
  if (cached) return cached;

  const raw = await AsyncStorage.getItem(ORDERS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Order[];
    setInMemoryItem(ORDERS_KEY, parsed);
    return parsed;
  } catch {
    return [];
  }
}

async function writeAll(orders: Order[]): Promise<void> {
  setInMemoryItem(ORDERS_KEY, orders);
  await AsyncStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
}

export async function getOrders(forceSync = false): Promise<Order[]> {
  if (forceSync) {
    await pullAllCloudDataToLocal();
  }
  const orders = await readAll();
  // newest first
  return orders.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function getOrder(id: string): Promise<Order | undefined> {
  const orders = await readAll();
  return orders.find((o) => o.id === id);
}

export async function nextOrderNumber(): Promise<string> {
  const orders = await readAll();
  let maxNum = 0;

  for (const o of orders) {
    if (o.orderNumber) {
      const match = o.orderNumber.match(/\d+/);
      if (match) {
        const n = parseInt(match[0], 10);
        if (!isNaN(n) && n > maxNum) {
          maxNum = n;
        }
      }
    }
  }

  const next = maxNum + 1;
  return `#${String(next).padStart(4, '0')}`;
}

export async function saveOrder(
  order: Omit<Order, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
): Promise<Order> {
  const orders = await readAll();
  const now = todayIso();

  if (order.id) {
    const idx = orders.findIndex((o) => o.id === order.id);
    if (idx >= 0) {
      const updated: Order = { ...orders[idx], ...order, id: order.id, updatedAt: now };
      orders[idx] = updated;
      await writeAll(orders);
      // Sync updated item to cloud atomically
      await syncItemToCloud('orders', updated);
      return updated;
    }
  }

  // Update order sequence for new orders
  if (order.orderNumber) {
    const match = order.orderNumber.match(/\d+/);
    if (match) {
      const n = parseInt(match[0], 10);
      if (!isNaN(n)) {
        const raw = await AsyncStorage.getItem(SEQ_KEY);
        const currentSeq = raw ? parseInt(raw, 10) : 0;
        if (isNaN(currentSeq) || n >= currentSeq) {
          await AsyncStorage.setItem(SEQ_KEY, String(n));
          await syncValueToCloud('settings/orderSeq', n);
        }
      }
    }
  }

  const created: Order = {
    ...order,
    id: generateId('ord_'),
    createdAt: now,
    updatedAt: now,
  };
  orders.push(created);
  await writeAll(orders);
  // Sync new item to cloud atomically
  await syncItemToCloud('orders', created);

  // Auto-deduct stock for items matching catalog products
  if (created.items && created.items.length > 0) {
    try {
      const { adjustStockByName } = await import('./productStorage');
      for (const item of created.items) {
        if (item.name && item.qty > 0) {
          await adjustStockByName(item.name, -item.qty);
        }
      }
    } catch (err) {
      console.warn('Error adjusting stock on order save:', err);
    }
  }

  return created;
}

export async function deleteOrder(id: string): Promise<void> {
  const orders = await readAll();
  await writeAll(orders.filter((o) => o.id !== id));
  await deleteItemFromCloud('orders', id);
}

export async function setOrderStatus(id: string, status: Order['status']): Promise<void> {
  const orders = await readAll();
  const idx = orders.findIndex((o) => o.id === id);
  if (idx >= 0) {
    orders[idx] = { ...orders[idx], status, updatedAt: todayIso() };
    await writeAll(orders);
    await syncItemToCloud('orders', orders[idx]);
  }
}

