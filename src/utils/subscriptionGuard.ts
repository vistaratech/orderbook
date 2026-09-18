import { checkProStatus, checkBasicStatus } from '../storage/subscriptionStorage';
import { getOrders } from '../storage/orderStorage';
import { getCustomers } from '../storage/customerStorage';
import { getProducts } from '../storage/productStorage';
import { confirmAction } from './dialog';

export interface SubscriptionGuardOptions {
  type: 'order' | 'customer' | 'product';
  actionName: string; // e.g. "create a new order", "edit this order", "add customer", "record payments"
  navigation: any;
}

/**
 * Centrally verifies whether the user is within their active plan limits (Free/Basic/Pro).
 * If the user has reached or exceeded their limit, displays an upgrade confirmation modal
 * and redirects to the PaywallScreen upon confirmation.
 *
 * Returns `true` if allowed, `false` if blocked.
 */
export async function assertSubscriptionLimit({
  type,
  actionName,
  navigation,
}: SubscriptionGuardOptions): Promise<boolean> {
  try {
    const isPro = await checkProStatus();
    if (isPro) return true;

    const isBasic = await checkBasicStatus();

    if (type === 'order') {
      const orders = await getOrders();
      const limit = isBasic ? 150 : 10;
      if (orders.length >= limit) {
        confirmAction({
          title: '🔒 Pro Plan Upgrade Required',
          message: `You have reached your ${isBasic ? 'Basic' : 'Free'} plan limit (${orders.length}/${limit} orders).\n\nUpgrade to Pro to ${actionName} and unlock unlimited orders, invoices, and reports!`,
          confirmText: 'Upgrade to Pro',
          cancelText: 'Cancel',
          onConfirm: () => {
            if (navigation) {
              navigation.navigate('PaywallScreen');
            }
          },
        });
        return false;
      }
    } else if (type === 'customer') {
      const customers = await getCustomers();
      const limit = isBasic ? 60 : 10;
      if (customers.length >= limit) {
        confirmAction({
          title: '🔒 Pro Plan Upgrade Required',
          message: `You have reached your ${isBasic ? 'Basic' : 'Free'} plan limit (${customers.length}/${limit} customers).\n\nUpgrade to Pro to ${actionName} and manage unlimited customer contacts!`,
          confirmText: 'Upgrade to Pro',
          cancelText: 'Cancel',
          onConfirm: () => {
            if (navigation) {
              navigation.navigate('PaywallScreen');
            }
          },
        });
        return false;
      }
    } else if (type === 'product') {
      const products = await getProducts();
      const limit = 20;
      if (products.length >= limit) {
        confirmAction({
          title: '🔒 Pro Plan Upgrade Required',
          message: `You have reached your Free plan limit (${products.length}/${limit} products).\n\nUpgrade to Pro to ${actionName} and add unlimited products!`,
          confirmText: 'Upgrade to Pro',
          cancelText: 'Cancel',
          onConfirm: () => {
            if (navigation) {
              navigation.navigate('PaywallScreen');
            }
          },
        });
        return false;
      }
    }
  } catch (e) {
    console.warn('[assertSubscriptionLimit] error checking plan limits:', e);
  }

  return true;
}
