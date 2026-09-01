export type InvoiceTemplateId =
  | 'modern_slate'
  | 'terracotta'
  | 'classic'
  | 'emerald'
  | 'sapphire'
  | 'ruby'
  | 'thermal_pos'
  | 'gst_tax_invoice';

export type PaperSize = 'a4' | 'a5' | 'thermal_80mm' | 'thermal_58mm';

export type LogoPosition = 'left' | 'center' | 'right';
export type LogoSize = 'small' | 'medium' | 'large';

export interface InvoiceTemplateConfig {
  templateId: InvoiceTemplateId;
  paperSize: PaperSize;
  
  // Color & Theme Styling
  primaryColor: string;
  accentColor: string;
  headerBgColor: string;
  headerTextColor: string;
  cardBorderColor: string;
  fontFamily: 'system' | 'serif' | 'monospace' | 'sans-serif';
  compactMode: boolean;

  // Header & Title
  invoiceTitle: string;        // e.g. "TAX INVOICE", "CASH BILL", "RETAIL INVOICE", "ESTIMATE"
  invoicePrefix: string;       // e.g. "INV-", "BILL-", "ORD-"
  showLogo: boolean;
  logoPosition: LogoPosition;
  logoSize: LogoSize;
  
  // Business Info Toggles
  showBusinessAddress: boolean;
  showBusinessPhone: boolean;
  showBusinessEmail: boolean;
  showGstin: boolean;
  showTagline: boolean;

  // Customer Info Toggles
  showCustomerPhone: boolean;
  showCustomerAddress: boolean;
  showDueDate: boolean;

  // Table Columns Visibility
  showItemSerialNo: boolean;
  showHsn: boolean;
  showUnit: boolean;
  showGSTRate: boolean;
  showDiscount: boolean;
  showRate: boolean;

  // Payments & QR Code
  showUpiQr: boolean;
  upiId?: string;
  upiPayeeName?: string;
  showBankDetails: boolean;
  bankDetailsCustom?: string;

  // Notes, Terms & Signatory
  showNotes: boolean;
  notesHeading: string;
  defaultNotes: string;
  showTerms: boolean;
  termsHeading: string;
  termsAndConditions: string;
  showSignatory: boolean;
  signatoryTitle: string;
  signatoryBusinessName: string;
  footerMessage: string;
  showWatermark: boolean;
  watermarkText: string;
}

export interface InvoiceThemePreset {
  id: InvoiceTemplateId;
  name: string;
  tamilName: string;
  description: string;
  primaryColor: string;
  accentColor: string;
  headerBgColor: string;
  headerTextColor: string;
  cardBorderColor: string;
  badgeBg: string;
  badgeText: string;
  fontFamily: 'system' | 'serif' | 'monospace' | 'sans-serif';
  paperSize: PaperSize;
  icon: string;
}

export const INVOICE_THEME_PRESETS: Record<InvoiceTemplateId, InvoiceThemePreset> = {
  modern_slate: {
    id: 'modern_slate',
    name: 'Modern Slate',
    tamilName: 'நவீன ஸ்லேட்',
    description: 'Executive dark slate gradient header with clean structured cards',
    primaryColor: '#0F172A',
    accentColor: '#3B82F6',
    headerBgColor: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
    headerTextColor: '#FFFFFF',
    cardBorderColor: '#E2E8F0',
    badgeBg: '#10B981',
    badgeText: '#FFFFFF',
    fontFamily: 'sans-serif',
    paperSize: 'a4',
    icon: 'sparkles',
  },
  terracotta: {
    id: 'terracotta',
    name: 'Warm Terracotta',
    tamilName: 'டெர்ராகோட்டா பாரம்பரியம்',
    description: 'Warm earthen tones, perfect for Indian retail, boutiques & crafts',
    primaryColor: '#B96659',
    accentColor: '#8C4337',
    headerBgColor: 'linear-gradient(135deg, #B96659 0%, #8C4337 100%)',
    headerTextColor: '#FFFFFF',
    cardBorderColor: '#F0D6D0',
    badgeBg: '#4E8A54',
    badgeText: '#FFFFFF',
    fontFamily: 'sans-serif',
    paperSize: 'a4',
    icon: 'flame',
  },
  classic: {
    id: 'classic',
    name: 'Classic Minimal',
    tamilName: 'கிளாசிக் எளிய முறை',
    description: 'High contrast monochrome corporate layout, ink saver design',
    primaryColor: '#0F172A',
    accentColor: '#475569',
    headerBgColor: '#FFFFFF',
    headerTextColor: '#0F172A',
    cardBorderColor: '#0F172A',
    badgeBg: '#0F172A',
    badgeText: '#FFFFFF',
    fontFamily: 'serif',
    paperSize: 'a4',
    icon: 'document-text',
  },
  emerald: {
    id: 'emerald',
    name: 'Emerald Pro',
    tamilName: 'மரகத பச்சை',
    description: 'Fresh emerald green header for organic stores, grocers & pharmacies',
    primaryColor: '#15803D',
    accentColor: '#166534',
    headerBgColor: 'linear-gradient(135deg, #15803D 0%, #166534 100%)',
    headerTextColor: '#FFFFFF',
    cardBorderColor: '#DCFCE7',
    badgeBg: '#166534',
    badgeText: '#FFFFFF',
    fontFamily: 'sans-serif',
    paperSize: 'a4',
    icon: 'leaf',
  },
  sapphire: {
    id: 'sapphire',
    name: 'Sapphire Corporate',
    tamilName: 'நீல கார்ப்பரேட்',
    description: 'Deep navy blue header, ideal for IT, professional services & B2B',
    primaryColor: '#1E40AF',
    accentColor: '#2563EB',
    headerBgColor: 'linear-gradient(135deg, #1E3A8A 0%, #1E40AF 100%)',
    headerTextColor: '#FFFFFF',
    cardBorderColor: '#DBEAFE',
    badgeBg: '#2563EB',
    badgeText: '#FFFFFF',
    fontFamily: 'sans-serif',
    paperSize: 'a4',
    icon: 'shield-checkmark',
  },
  ruby: {
    id: 'ruby',
    name: 'Ruby Retail',
    tamilName: 'ரூபி சிகப்பு',
    description: 'Vibrant crimson red header for fashion, jewelers & lifestyle retail',
    primaryColor: '#BE123C',
    accentColor: '#9F1239',
    headerBgColor: 'linear-gradient(135deg, #9F1239 0%, #E11D48 100%)',
    headerTextColor: '#FFFFFF',
    cardBorderColor: '#FFE4E6',
    badgeBg: '#BE123C',
    badgeText: '#FFFFFF',
    fontFamily: 'sans-serif',
    paperSize: 'a4',
    icon: 'diamond',
  },
  thermal_pos: {
    id: 'thermal_pos',
    name: 'POS Thermal Receipt (80mm/58mm)',
    tamilName: 'POS தெர்மல் ரசீது',
    description: 'Compact monospaced receipt format with dotted dividers for thermal printers',
    primaryColor: '#000000',
    accentColor: '#333333',
    headerBgColor: '#FFFFFF',
    headerTextColor: '#000000',
    cardBorderColor: '#000000',
    badgeBg: '#000000',
    badgeText: '#FFFFFF',
    fontFamily: 'monospace',
    paperSize: 'thermal_80mm',
    icon: 'receipt',
  },
  gst_tax_invoice: {
    id: 'gst_tax_invoice',
    name: 'Official GST Tax Invoice',
    tamilName: 'அரசு GST வரி ரசீது',
    description: 'Standard 2-column GST structure with CGST/SGST/IGST breakdown & HSN summary',
    primaryColor: '#1E293B',
    accentColor: '#0369A1',
    headerBgColor: '#0F172A',
    headerTextColor: '#FFFFFF',
    cardBorderColor: '#CBD5E1',
    badgeBg: '#0369A1',
    badgeText: '#FFFFFF',
    fontFamily: 'sans-serif',
    paperSize: 'a4',
    icon: 'newspaper',
  },
};

export const DEFAULT_INVOICE_TEMPLATE_CONFIG: InvoiceTemplateConfig = {
  templateId: 'modern_slate',
  paperSize: 'a4',
  primaryColor: '#0F172A',
  accentColor: '#3B82F6',
  headerBgColor: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
  headerTextColor: '#FFFFFF',
  cardBorderColor: '#E2E8F0',
  fontFamily: 'sans-serif',
  compactMode: false,

  invoiceTitle: 'TAX INVOICE',
  invoicePrefix: 'INV-',
  showLogo: true,
  logoPosition: 'left',
  logoSize: 'medium',

  showBusinessAddress: true,
  showBusinessPhone: true,
  showBusinessEmail: true,
  showGstin: true,
  showTagline: true,

  showCustomerPhone: true,
  showCustomerAddress: true,
  showDueDate: true,

  showItemSerialNo: true,
  showHsn: true,
  showUnit: true,
  showGSTRate: true,
  showDiscount: true,
  showRate: true,

  showUpiQr: true,
  upiId: '',
  upiPayeeName: '',
  showBankDetails: true,
  bankDetailsCustom: '',

  showNotes: true,
  notesHeading: 'Special Instructions / Notes',
  defaultNotes: 'Thank you for your business. Please retain this invoice for your records.',
  showTerms: true,
  termsHeading: 'Terms & Conditions',
  termsAndConditions:
    '1. Goods once sold will not be taken back or exchanged.\n2. All disputes are subject to local jurisdiction.\n3. This is a computer generated invoice.',
  showSignatory: true,
  signatoryTitle: 'Authorized Signatory',
  signatoryBusinessName: '',
  footerMessage: 'Thank you for your business! Have a great day.',
  showWatermark: false,
  watermarkText: 'PAID',
};
