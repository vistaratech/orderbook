import Purchases, { CustomerInfo, PurchasesPackage, LOG_LEVEL } from 'react-native-purchases';
import { REVENUECAT_API_KEY } from '../config/revenuecat';
import { Platform } from 'react-native';

export const ENTITLEMENT_BASIC = 'basic';
export const ENTITLEMENT_PRO = 'pro';

let isConfiguredState = false;

// Expo Go includes the RevenueCat native module but rejects production API keys.
// We detect this on the first configure() attempt and skip all subsequent calls.
let isExpoGo = false;

export async function initRevenueCat(uid?: string) {
  if (Platform.OS === 'web' || isExpoGo) return;
  
  try {
    const alreadyConfigured = isConfiguredState || (await Purchases.isConfigured());
    if (!alreadyConfigured) {
      await Purchases.setLogLevel(LOG_LEVEL.DEBUG);
      if (uid) {
        Purchases.configure({ apiKey: REVENUECAT_API_KEY, appUserID: uid });
      } else {
        Purchases.configure({ apiKey: REVENUECAT_API_KEY });
      }
      isConfiguredState = true;
      console.log('[RevenueCat] Purchases configured successfully');
    } else if (uid) {
      await Purchases.logIn(uid);
      console.log('[RevenueCat] Logged in user:', uid);
    }
  } catch (error: any) {
    const msg = error?.message || '';
    if (msg.includes('Expo Go') || msg.includes('Invalid API key') || msg.includes('Test Store')) {
      // Expo Go detected — disable all RevenueCat calls for this session
      isExpoGo = true;
      console.log('[RevenueCat] Expo Go detected. Skipping RevenueCat (native store unavailable).');
    } else {
      console.warn('[RevenueCat] Init Error:', error);
    }
  }
}


export async function checkProStatus(): Promise<boolean> {
  if (Platform.OS === 'web' || isExpoGo) return true;
  
  try {
    const configured = isConfiguredState || (await Purchases.isConfigured());
    if (!configured) {
      await initRevenueCat();
    }
    const customerInfo = await Purchases.getCustomerInfo();
    return typeof customerInfo.entitlements.active[ENTITLEMENT_PRO] !== 'undefined';
  } catch (error) {
    console.error('Failed to check Pro status', error);
    return false;
  }
}

export async function checkBasicStatus(): Promise<boolean> {
  if (Platform.OS === 'web' || isExpoGo) return true;
  
  try {
    const configured = isConfiguredState || (await Purchases.isConfigured());
    if (!configured) {
      await initRevenueCat();
    }
    const customerInfo = await Purchases.getCustomerInfo();
    return (
      typeof customerInfo.entitlements.active[ENTITLEMENT_BASIC] !== 'undefined' ||
      typeof customerInfo.entitlements.active[ENTITLEMENT_PRO] !== 'undefined'
    );
  } catch (error) {
    console.error('Failed to check Basic status', error);
    return false;
  }
}

export async function purchaseProPackage(packageToBuy: PurchasesPackage): Promise<boolean> {
  try {
    const { customerInfo } = await Purchases.purchasePackage(packageToBuy);
    return (
      typeof customerInfo.entitlements.active[ENTITLEMENT_BASIC] !== 'undefined' ||
      typeof customerInfo.entitlements.active[ENTITLEMENT_PRO] !== 'undefined'
    );
  } catch (e: any) {
    if (!e.userCancelled) {
      console.error('Purchase error', e);
    }
    return false;
  }
}

export async function restorePurchases(): Promise<boolean> {
  if (Platform.OS === 'web' || isExpoGo) return false;
  try {
    const customerInfo = await Purchases.restorePurchases();
    return (
      typeof customerInfo.entitlements.active[ENTITLEMENT_BASIC] !== 'undefined' ||
      typeof customerInfo.entitlements.active[ENTITLEMENT_PRO] !== 'undefined'
    );
  } catch (e) {
    console.error('Restore error', e);
    return false;
  }
}

export async function getAvailablePackages(): Promise<PurchasesPackage[]> {
  if (Platform.OS === 'web' || isExpoGo) return [];
  
  try {
    const configured = isConfiguredState || (await Purchases.isConfigured());
    if (!configured) {
      console.log('[RevenueCat] Configuring Purchases before fetching packages...');
      await initRevenueCat();
    }

    for (let attempt = 1; attempt <= 4; attempt++) {
      try {
        console.log(`[RevenueCat] Fetching offerings (attempt ${attempt}/4)...`);
        const offerings = await Purchases.getOfferings();
        console.log('[RevenueCat] Offerings current:', offerings.current?.identifier);
        
        const pkgs = offerings.current?.availablePackages ?? [];
        if (pkgs.length > 0) {
          console.log(`[RevenueCat] Found ${pkgs.length} packages in current offering.`);
          return pkgs;
        }

        // Fallback: search all offerings in case 'current' is not mapped
        if (offerings.all) {
          for (const key of Object.keys(offerings.all)) {
            const off = offerings.all[key];
            if (off?.availablePackages && off.availablePackages.length > 0) {
              console.log(`[RevenueCat] Found ${off.availablePackages.length} packages in offering '${key}'`);
              return off.availablePackages;
            }
          }
        }

        console.warn(`[RevenueCat] No available packages returned (attempt ${attempt}/4). Retrying in 1.5s...`);
        if (attempt < 4) {
          await new Promise((res) => setTimeout(res, 1500));
        }
      } catch (err: any) {
        console.error(`[RevenueCat] Offerings error attempt ${attempt}:`, err?.message, err?.underlyingErrorMessage);
        if (attempt < 4) {
          await new Promise((res) => setTimeout(res, 1500));
        }
      }
    }
  } catch (e: any) {
    console.error('[RevenueCat] getAvailablePackages critical error:', e);
  }

  return [];
}
