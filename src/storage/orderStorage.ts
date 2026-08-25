import AsyncStorage from '@react-native-async-storage/async-storage';
import { Order } from '../types/order';
import { generateId } from '../utils/id';
import { todayIso } from '../utils/format';
import {
  syncItemToCloud,
  deleteItemFromCloud,
  syncValueToCloud,
  pullAllCloudDataToLocal,
} from './firebaseSync';

const ORDERS_KEY = 'order_book:orders';
const SEQ_KEY = 'order_book:order_seq';

async function readAll(): Promise<Order[]> {
  const raw = await AsyncStorage.getItem(ORDERS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as Order[];
  } catch {
    return [];
  }
}

async function writeAll(orders: Order[]): Promise<void> {
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

  const raw = await AsyncStorage.getItem(SEQ_KEY);
  if (raw) {
    const seq = parseInt(raw, 10);
    if (!isNaN(seq) && seq > maxNum) {
      maxNum = seq;
    }
  }

  const next = maxNum + 1;
  await AsyncStorage.setItem(SEQ_KEY, String(next));
  syncValueToCloud('settings/orderSeq', next).catch(() => {});
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
      syncItemToCloud('orders', updated).catch(() => {});
      return updated;
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
  syncItemToCloud('orders', created).catch(() => {});
  return created;
}

export async function deleteOrder(id: string): Promise<void> {
  const orders = await readAll();
  await writeAll(orders.filter((o) => o.id !== id));
  deleteItemFromCloud('orders', id).catch(() => {});
}

export async function setOrderStatus(id: string, status: Order['status']): Promise<void> {
  const orders = await readAll();
  const idx = orders.findIndex((o) => o.id === id);
  if (idx >= 0) {
    orders[idx] = { ...orders[idx], status, updatedAt: todayIso() };
    await writeAll(orders);
    syncItemToCloud('orders', orders[idx]).catch(() => {});
  }
}
