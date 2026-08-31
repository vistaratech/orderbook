export type PaymentStatus = 'Paid' | 'Partial' | 'Pending';

export type OrderStatus = 'Placed' | 'Packed' | 'Dispatched' | 'Delivered';

export const ORDER_STATUS_STEPS: OrderStatus[] = [
  'Placed',
  'Packed',
  'Dispatched',
  'Delivered',
];

// ─── GST Tax Rates ──────────────────────────────────────────────────

export const GST_RATES = [0, 5, 12, 18, 28] as const;
export type GSTRate = typeof GST_RATES[number];

export interface CustomColumn {
  id: string;
  name: string;
  type?: 'text' | 'number';
}

export interface OrderItem {
  id: string;
  name: string;
  qty: number;
  price: number;
  unit?: string;
  discount?: number;
  tax?: number;
  taxRate?: GSTRate;        // GST rate: 0, 5, 12, 18, 28
  hsnCode?: string;         // HSN/SAC code for GST
  customValues?: Record<string, string>;
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

  customColumns?: CustomColumn[];
  items: OrderItem[];
  customerNote?: string;
  advance: number;

  status: OrderStatus;

  photos?: string[];        // Photo attachment URIs
  estimateId?: string;      // Linked estimate ID (if converted from estimate)
  isInterState?: boolean;   // true = IGST, false = CGST+SGST

  createdAt: string;
  updatedAt: string;
}

// ─── Tax Calculation Helpers ────────────────────────────────────────

/** Taxable value for a single item (qty × price - discount) */
export function itemTaxableValue(item: OrderItem): number {
  const subtotal = (item.qty || 0) * (item.price || 0);
  return subtotal - (item.discount || 0);
}

/** Tax amount for a single item */
export function itemTaxAmount(item: OrderItem): number {
  const taxable = itemTaxableValue(item);
  const rate = item.taxRate || 0;
  return Math.round((taxable * rate) / 100 * 100) / 100;
}

/** Subtotal before tax (all items) */
export function orderSubtotal(order: Pick<Order, 'items'>): number {
  return order.items.reduce((sum, item) => sum + itemTaxableValue(item), 0);
}

/** Total tax amount across all items */
export function orderTotalTax(order: Pick<Order, 'items'>): number {
  return order.items.reduce((sum, item) => sum + itemTaxAmount(item), 0);
}

/** CGST amount (half of total tax, for intra-state) */
export function orderCGST(order: Pick<Order, 'items'>): number {
  return Math.round(orderTotalTax(order) / 2 * 100) / 100;
}

/** SGST amount (half of total tax, for intra-state) */
export function orderSGST(order: Pick<Order, 'items'>): number {
  return Math.round(orderTotalTax(order) / 2 * 100) / 100;
}

/** IGST amount (full tax, for inter-state) */
export function orderIGST(order: Pick<Order, 'items'>): number {
  return orderTotalTax(order);
}

export function orderTotal(order: Pick<Order, 'items'>): number {
  return order.items.reduce((sum, item) => sum + (item.qty || 0) * (item.price || 0), 0);
}

/** Grand total including tax */
export function orderGrandTotal(order: Pick<Order, 'items'>): number {
  return orderSubtotal(order) + orderTotalTax(order);
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
  | 'Miscellaneous'
  | (string & {});

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

export type ProductUnit = 'pcs' | 'kg' | 'meter' | 'liter' | 'box' | 'set' | 'grams' | 'hours' | 'pairs' | 'bags' | 'sqft';

export const PRODUCT_UNITS: ProductUnit[] = ['pcs', 'kg', 'meter', 'liter', 'box', 'set', 'grams', 'hours', 'pairs', 'bags', 'sqft'];

export interface Product {
  id: string;
  name: string;
  defaultPrice: number;
  unit: ProductUnit;
  stockQty?: number;              // Current stock quantity
  lowStockThreshold?: number;     // Alert when stock falls below this
  hsnCode?: string;               // HSN code for GST
  taxRate?: GSTRate;              // Default GST rate
  barcode?: string;               // Barcode/SKU number
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
