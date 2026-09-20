import { checkProStatus, checkBasicStatus } from '../storage/subscriptionStorage';
import { getOrders } from '../storage/orderStorage';
import { getCustomers } from '../storage/customerStorage';
import { getProducts } from '../storage/productStorage';
import { triggerGlobalSubscriptionModal } from '../context/SubscriptionModalContext';
import { navigate } from '../navigation/navigationRef';

export interface SubscriptionGuardOptions {
  type: 'order' | 'customer' | 'product';
  actionName: string; // e.g. "create a new order", "save this order", "edit this order", "add customer", "record payments"
  navigation?: any;
}

/**
 * Centrally verifies whether the user is within their active plan limits (Free/Basic/Pro).
 * If the user has reached or exceeded their limit, displays a rich in-app modal overlay
 * and seamlessly redirects to the PaywallScreen upon tapping "Upgrade to Pro".
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

    const handleUpgrade = () => {
      if (navigation && navigation.navigate) {
        navigation.navigate('PaywallScreen');
      } else {
        navigate('PaywallScreen');
      }
    };

    if (type === 'order') {
      const orders = await getOrders();
      const limit = isBasic ? 150 : 30;
      if (orders.length >= limit) {
        triggerGlobalSubscriptionModal({
          type: 'order',
          title: '🚨 Free Order Limit Reached',
          message: `You have reached your ${isBasic ? 'Basic' : 'Free'} plan limit (${orders.length}/${limit} orders).\n\nUpgrade to KadaiBook Pro to ${actionName} and manage unlimited orders, invoices, payments, and reports!`,
          currentCount: orders.length,
          limit,
          planName: isBasic ? 'Basic' : 'Free',
          actionName,
          onUpgrade: handleUpgrade,
        });
        return false;
      }
    } else if (type === 'customer') {
      const customers = await getCustomers();
      const limit = isBasic ? 60 : 30;
      if (customers.length >= limit) {
        triggerGlobalSubscriptionModal({
          type: 'customer',
          title: '🚨 Customer Limit Reached',
          message: `You have reached your ${isBasic ? 'Basic' : 'Free'} plan limit (${customers.length}/${limit} customers).\n\nUpgrade to KadaiBook Pro to ${actionName} and manage unlimited customer contacts!`,
          currentCount: customers.length,
          limit,
          planName: isBasic ? 'Basic' : 'Free',
          actionName,
          onUpgrade: handleUpgrade,
        });
        return false;
      }
    } else if (type === 'product') {
      const products = await getProducts();
      const limit = 20;
      if (products.length >= limit) {
        triggerGlobalSubscriptionModal({
          type: 'product',
          title: '🚨 Product Limit Reached',
          message: `You have reached your Free plan limit (${products.length}/${limit} products).\n\nUpgrade to KadaiBook Pro to ${actionName} and add unlimited products!`,
          currentCount: products.length,
          limit,
          planName: 'Free',
          actionName,
          onUpgrade: handleUpgrade,
        });
        return false;
      }
    }
  } catch (e) {
    console.warn('[assertSubscriptionLimit] error checking plan limits:', e);
  }

  return true;
}

