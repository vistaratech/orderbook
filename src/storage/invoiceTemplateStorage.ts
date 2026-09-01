import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  InvoiceTemplateConfig,
  InvoiceTemplateId,
  DEFAULT_INVOICE_TEMPLATE_CONFIG,
  INVOICE_THEME_PRESETS,
} from '../types/invoiceTemplate';
import { syncValueToCloud } from './firebaseSync';

const STORAGE_KEY = 'order_book:invoice_template_config';

/**
 * Loads the active Invoice Template Configuration from local AsyncStorage
 * with cloud sync fallback and safe defaults.
 */
export async function getInvoiceTemplateConfig(): Promise<InvoiceTemplateConfig> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_INVOICE_TEMPLATE_CONFIG,
        ...parsed,
      };
    }
    return DEFAULT_INVOICE_TEMPLATE_CONFIG;
  } catch (err) {
    console.error('Error loading invoice template config:', err);
    return DEFAULT_INVOICE_TEMPLATE_CONFIG;
  }
}

/**
 * Saves and updates the Invoice Template Configuration in local storage
 * and automatically synchronizes to Firebase cloud settings.
 */
export async function saveInvoiceTemplateConfig(
  updates: Partial<InvoiceTemplateConfig>
): Promise<InvoiceTemplateConfig> {
  try {
    const current = await getInvoiceTemplateConfig();
    const merged: InvoiceTemplateConfig = {
      ...current,
      ...updates,
    };

    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(merged));

    // Sync to cloud settings path
    syncValueToCloud('settings/invoiceTemplate', merged).catch((e) => {
      console.warn('Cloud sync error for invoice template config:', e);
    });

    return merged;
  } catch (err) {
    console.error('Error saving invoice template config:', err);
    throw err;
  }
}

/**
 * Applies a theme preset while preserving custom business notes, UPI, bank, and terms.
 */
export async function applyThemePreset(
  presetId: InvoiceTemplateId
): Promise<InvoiceTemplateConfig> {
  const preset = INVOICE_THEME_PRESETS[presetId];
  if (!preset) return await getInvoiceTemplateConfig();

  return await saveInvoiceTemplateConfig({
    templateId: preset.id,
    primaryColor: preset.primaryColor,
    accentColor: preset.accentColor,
    headerBgColor: preset.headerBgColor,
    headerTextColor: preset.headerTextColor,
    cardBorderColor: preset.cardBorderColor,
    fontFamily: preset.fontFamily,
    paperSize: preset.paperSize,
  });
}

/**
 * Resets the Invoice Template Configuration back to original default settings.
 */
export async function resetInvoiceTemplateConfig(): Promise<InvoiceTemplateConfig> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_INVOICE_TEMPLATE_CONFIG));
    syncValueToCloud('settings/invoiceTemplate', DEFAULT_INVOICE_TEMPLATE_CONFIG).catch(() => {});
    return DEFAULT_INVOICE_TEMPLATE_CONFIG;
  } catch (err) {
    console.error('Error resetting invoice template config:', err);
    return DEFAULT_INVOICE_TEMPLATE_CONFIG;
  }
}
