import AsyncStorage from '@react-native-async-storage/async-storage';
import { syncItemToCloud, syncValueToCloud, readCollectionFromCloud } from './firebaseSync';
import { updateUserBusinessName } from './authStorage';
import { todayIso } from '../utils/format';
import { BusinessType } from '../config/businessTypes';

export interface BusinessProfile {
  businessName: string;
  phone: string;
  email?: string;
  address?: string;
  gstin?: string;
  tagline?: string;
  logoUri?: string;
  bankDetails?: string;
  businessType?: BusinessType;
  updatedAt?: string;
}

const STORAGE_KEY = 'order_book:business_profile';

const DEFAULT_PROFILE: BusinessProfile = {
  businessName: 'KadaiBook Store',
  phone: '',
  email: '',
  address: '',
  gstin: '',
  tagline: 'Quality Products & Services',
  logoUri: '',
  bankDetails: '',
};

export async function getBusinessProfile(): Promise<BusinessProfile> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_PROFILE, ...parsed };
    }
    
    // Check cloud sync fallback
    const cloudRecords = await readCollectionFromCloud<BusinessProfile>('business_profile');
    if (cloudRecords && cloudRecords.length > 0) {
      const profile = cloudRecords[0];
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
      return { ...DEFAULT_PROFILE, ...profile };
    }

    return DEFAULT_PROFILE;
  } catch (err) {
    console.error('Error reading business profile:', err);
    return DEFAULT_PROFILE;
  }
}

export async function saveBusinessProfile(
  profile: Partial<BusinessProfile>
): Promise<BusinessProfile> {
  try {
    const current = await getBusinessProfile();
    const updated: BusinessProfile = {
      ...current,
      ...profile,
      updatedAt: todayIso(),
    };

    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

    if (updated.businessName) {
      await updateUserBusinessName(updated.businessName);
    }
    
    // Sync to Firestore collection (for realtime sync across devices)
    syncItemToCloud('business_profile', { id: 'default_profile', ...updated }).catch(() => {});

    // Also sync to settings/businessProfile path (for login pull restore)
    syncValueToCloud('settings/businessProfile', updated).catch(() => {});

    return updated;
  } catch (err) {
    console.error('Error saving business profile:', err);
    throw err;
  }
}
