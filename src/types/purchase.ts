import { GSTRate } from './order';

// ─── Purchase (Supplier Bills) ──────────────────────────────────────

export type PurchaseStatus = 'Pending' | 'Partial' | 'Paid';

export interface PurchaseItem {
  id: string;
  name: string;
  qty: number;
  price: number;
  unit?: string;
  taxRate?: GSTRate;
  hsnCode?: string;
}

export interface Purchase {
  id: string;
  purchaseNumber: string;
  purchaseDate: string;       // ISO date string
  supplierName: string;
  supplierPhone?: string;
  items: PurchaseItem[];
  paymentStatus: PurchaseStatus;
  paymentMethod: string;
  amountPaid: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

/** Total amount for a purchase */
export function purchaseTotal(purchase: Pick<Purchase, 'items'>): number {
  return purchase.items.reduce((sum, item) => sum + (item.qty || 0) * (item.price || 0), 0);
}

/** Balance due for a purchase */
export function purchaseBalance(purchase: Pick<Purchase, 'items' | 'amountPaid'>): number {
  return purchaseTotal(purchase) - (purchase.amountPaid || 0);
}
