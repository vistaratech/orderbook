import { OrderItem } from './order';

// ─── Estimate / Quotation ───────────────────────────────────────────

export type EstimateStatus = 'Draft' | 'Sent' | 'Accepted' | 'Rejected' | 'Expired';

export const ESTIMATE_STATUS_STEPS: EstimateStatus[] = [
  'Draft',
  'Sent',
  'Accepted',
  'Rejected',
  'Expired',
];

export interface Estimate {
  id: string;
  estimateNumber: string;
  estimateDate: string;       // ISO date string
  validUntil?: string;        // Expiry date
  customerName: string;
  phoneNumber: string;
  items: OrderItem[];         // Reuse OrderItem type
  customerNote?: string;
  status: EstimateStatus;
  isInterState?: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Total amount for an estimate */
export function estimateTotal(estimate: Pick<Estimate, 'items'>): number {
  return estimate.items.reduce((sum, item) => sum + (item.qty || 0) * (item.price || 0), 0);
}
