export type PaymentStatus = 'Paid' | 'Partial' | 'Pending';

export type OrderStatus = 'Placed' | 'Packed' | 'Dispatched' | 'Delivered';

export const ORDER_STATUS_STEPS: OrderStatus[] = [
  'Placed',
  'Packed',
  'Dispatched',
  'Delivered',
];

export interface OrderItem {
  id: string;
  name: string;
  qty: number;
  price: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  orderDate: string; // ISO date string
  paymentMethod: string;
  paymentStatus: PaymentStatus;
  trackingNumber?: string;

  customerName: string;
  phoneNumber: string;
  dispatchMethod?: string;
  dispatchDate?: string;

  items: OrderItem[];
  customerNote?: string;
  advance: number;

  status: OrderStatus;

  createdAt: string;
  updatedAt: string;
}

export function orderTotal(order: Pick<Order, 'items'>): number {
  return order.items.reduce((sum, item) => sum + item.qty * item.price, 0);
}

export function orderBalance(order: Pick<Order, 'items' | 'advance'>): number {
  return orderTotal(order) - (order.advance || 0);
}

// ─── Expense ────────────────────────────────────────────────────────

export type ExpenseCategory =
  | 'Raw Materials'
  | 'Shipping'
  | 'Packaging'
  | 'Rent'
  | 'Utilities'
  | 'Salary'
  | 'Marketing'
  | 'Miscellaneous';

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'Raw Materials',
  'Shipping',
  'Packaging',
  'Rent',
  'Utilities',
  'Salary',
  'Marketing',
  'Miscellaneous',
];

export interface Expense {
  id: string;
  date: string;
  amount: number;
  category: ExpenseCategory;
  description: string;
  paymentMethod: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Customer ───────────────────────────────────────────────────────

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Product Catalog ────────────────────────────────────────────────

export type ProductUnit = 'pcs' | 'kg' | 'meter' | 'liter' | 'box' | 'set';

export const PRODUCT_UNITS: ProductUnit[] = ['pcs', 'kg', 'meter', 'liter', 'box', 'set'];

export interface Product {
  id: string;
  name: string;
  defaultPrice: number;
  unit: ProductUnit;
  createdAt: string;
  updatedAt: string;
}

// ─── Payment Ledger ─────────────────────────────────────────────────

export interface PaymentEntry {
  id: string;
  orderId: string;
  date: string;
  amount: number;
  method: string;
  note?: string;
  createdAt: string;
}
