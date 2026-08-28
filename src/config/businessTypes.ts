/**
 * Business Type Presets — Adapts the app experience per business category.
 * Each preset defines default units, expense categories, and sample products.
 */

export type BusinessType =
  | 'textile'
  | 'grocery'
  | 'restaurant'
  | 'electronics'
  | 'wholesale'
  | 'jewelry'
  | 'pharmacy'
  | 'hardware'
  | 'printing'
  | 'salon'
  | 'freelancer'
  | 'general';

export interface BusinessTypePreset {
  key: BusinessType;
  label: string;
  icon: string; // Ionicons name
  defaultUnit: string;
  expenseCategories: string[];
  sampleProducts: { name: string; price: number; unit: string }[];
  invoiceItemLabel: string; // Column header for items table in invoice
}

export const BUSINESS_TYPE_PRESETS: Record<BusinessType, BusinessTypePreset> = {
  textile: {
    key: 'textile',
    label: 'Textile & Clothing',
    icon: 'shirt-outline',
    defaultUnit: 'Meters',
    expenseCategories: [
      'Fabric Purchase',
      'Dyeing & Processing',
      'Stitching & Tailoring',
      'Transport',
      'Rent',
      'Salary',
      'Packaging',
      'Marketing',
      'Utilities',
      'Miscellaneous',
    ],
    sampleProducts: [
      { name: 'Cotton Fabric', price: 250, unit: 'Meters' },
      { name: 'Silk Material', price: 800, unit: 'Meters' },
      { name: 'Ready-made Shirt', price: 450, unit: 'Pcs' },
    ],
    invoiceItemLabel: 'Item Particulars',
  },
  grocery: {
    key: 'grocery',
    label: 'Grocery & Kirana',
    icon: 'cart-outline',
    defaultUnit: 'Kg',
    expenseCategories: [
      'Stock Purchase',
      'Transport',
      'Packaging',
      'Rent',
      'Salary',
      'Utilities',
      'Refrigeration',
      'Marketing',
      'Miscellaneous',
    ],
    sampleProducts: [
      { name: 'Rice (Ponni)', price: 55, unit: 'Kg' },
      { name: 'Cooking Oil', price: 180, unit: 'Liters' },
      { name: 'Sugar', price: 42, unit: 'Kg' },
    ],
    invoiceItemLabel: 'Item Particulars',
  },
  restaurant: {
    key: 'restaurant',
    label: 'Restaurant & Food',
    icon: 'restaurant-outline',
    defaultUnit: 'Pcs',
    expenseCategories: [
      'Ingredients & Groceries',
      'Gas & Fuel',
      'Staff Wages',
      'Packaging & Containers',
      'Rent',
      'Utilities',
      'Equipment Maintenance',
      'Marketing',
      'Miscellaneous',
    ],
    sampleProducts: [
      { name: 'Meals Combo', price: 120, unit: 'Pcs' },
      { name: 'Biryani', price: 180, unit: 'Pcs' },
      { name: 'Parcel Box', price: 250, unit: 'Pcs' },
    ],
    invoiceItemLabel: 'Item / Dish',
  },
  electronics: {
    key: 'electronics',
    label: 'Electronics & Mobile',
    icon: 'phone-portrait-outline',
    defaultUnit: 'Pcs',
    expenseCategories: [
      'Spare Parts',
      'Repairs & Service',
      'Warranty Claims',
      'Transport',
      'Rent',
      'Salary',
      'Utilities',
      'Marketing',
      'Miscellaneous',
    ],
    sampleProducts: [
      { name: 'Mobile Screen Guard', price: 150, unit: 'Pcs' },
      { name: 'Charger Cable', price: 200, unit: 'Pcs' },
      { name: 'Battery Replacement', price: 800, unit: 'Pcs' },
    ],
    invoiceItemLabel: 'Item / Service',
  },
  wholesale: {
    key: 'wholesale',
    label: 'Wholesale & Distribution',
    icon: 'cube-outline',
    defaultUnit: 'Box',
    expenseCategories: [
      'Bulk Purchase',
      'Freight & Logistics',
      'Warehouse Rent',
      'Labour',
      'Salary',
      'Packaging',
      'Utilities',
      'Marketing',
      'Miscellaneous',
    ],
    sampleProducts: [
      { name: 'Carton Pack (12 Units)', price: 600, unit: 'Box' },
      { name: 'Bulk Bag (50 Kg)', price: 2500, unit: 'Bags' },
      { name: 'Pallet Load', price: 8000, unit: 'Pcs' },
    ],
    invoiceItemLabel: 'Item Particulars',
  },
  jewelry: {
    key: 'jewelry',
    label: 'Jewelry & Gold',
    icon: 'diamond-outline',
    defaultUnit: 'Grams',
    expenseCategories: [
      'Gold / Silver Purchase',
      'Stones & Gems',
      'Hallmarking',
      'Insurance',
      'Making Charges',
      'Rent',
      'Salary',
      'Utilities',
      'Marketing',
      'Miscellaneous',
    ],
    sampleProducts: [
      { name: 'Gold Chain 22K', price: 45000, unit: 'Grams' },
      { name: 'Silver Ring', price: 1200, unit: 'Grams' },
      { name: 'Earring Pair', price: 8500, unit: 'Pairs' },
    ],
    invoiceItemLabel: 'Item Particulars',
  },
  pharmacy: {
    key: 'pharmacy',
    label: 'Pharmacy & Medical',
    icon: 'medkit-outline',
    defaultUnit: 'Pcs',
    expenseCategories: [
      'Medicine Stock',
      'License & Compliance',
      'Refrigeration',
      'Rent',
      'Salary',
      'Utilities',
      'Insurance',
      'Marketing',
      'Miscellaneous',
    ],
    sampleProducts: [
      { name: 'Paracetamol Strip', price: 25, unit: 'Pcs' },
      { name: 'Cough Syrup', price: 85, unit: 'Pcs' },
      { name: 'Vitamin Tablets', price: 150, unit: 'Pcs' },
    ],
    invoiceItemLabel: 'Medicine / Item',
  },
  hardware: {
    key: 'hardware',
    label: 'Hardware & Building',
    icon: 'hammer-outline',
    defaultUnit: 'Pcs',
    expenseCategories: [
      'Cement & Sand',
      'Steel & Iron',
      'Transport & Loading',
      'Labour',
      'Rent',
      'Salary',
      'Utilities',
      'Marketing',
      'Miscellaneous',
    ],
    sampleProducts: [
      { name: 'Cement (50 Kg Bag)', price: 380, unit: 'Bags' },
      { name: 'TMT Steel Bar', price: 550, unit: 'Kg' },
      { name: 'PVC Pipe (10ft)', price: 120, unit: 'Pcs' },
    ],
    invoiceItemLabel: 'Item Particulars',
  },
  printing: {
    key: 'printing',
    label: 'Printing & Stationery',
    icon: 'print-outline',
    defaultUnit: 'Pcs',
    expenseCategories: [
      'Paper & Card Stock',
      'Ink & Toner',
      'Machine Maintenance',
      'Rent',
      'Salary',
      'Utilities',
      'Marketing',
      'Miscellaneous',
    ],
    sampleProducts: [
      { name: 'Visiting Cards (100 pcs)', price: 200, unit: 'Pcs' },
      { name: 'Banner Print (per sqft)', price: 15, unit: 'Sqft' },
      { name: 'A4 Xerox', price: 1.5, unit: 'Pcs' },
    ],
    invoiceItemLabel: 'Print Job / Item',
  },
  salon: {
    key: 'salon',
    label: 'Beauty & Salon',
    icon: 'cut-outline',
    defaultUnit: 'Pcs',
    expenseCategories: [
      'Beauty Products',
      'Equipment & Tools',
      'Rent',
      'Salary',
      'Utilities',
      'Towels & Consumables',
      'Marketing',
      'Miscellaneous',
    ],
    sampleProducts: [
      { name: 'Haircut (Men)', price: 150, unit: 'Pcs' },
      { name: 'Facial Treatment', price: 500, unit: 'Pcs' },
      { name: 'Hair Colouring', price: 1200, unit: 'Pcs' },
    ],
    invoiceItemLabel: 'Service / Item',
  },
  freelancer: {
    key: 'freelancer',
    label: 'Freelancer & Services',
    icon: 'briefcase-outline',
    defaultUnit: 'Hours',
    expenseCategories: [
      'Travel & Commute',
      'Software & Tools',
      'Marketing',
      'Internet & Phone',
      'Office Supplies',
      'Rent',
      'Utilities',
      'Miscellaneous',
    ],
    sampleProducts: [
      { name: 'Consultation (1 Hour)', price: 500, unit: 'Hours' },
      { name: 'Project Delivery', price: 5000, unit: 'Pcs' },
      { name: 'Monthly Retainer', price: 15000, unit: 'Pcs' },
    ],
    invoiceItemLabel: 'Service Description',
  },
  general: {
    key: 'general',
    label: 'General / Other',
    icon: 'storefront-outline',
    defaultUnit: 'Pcs',
    expenseCategories: [
      'Raw Materials',
      'Shipping',
      'Packaging',
      'Rent',
      'Utilities',
      'Salary',
      'Marketing',
      'Miscellaneous',
    ],
    sampleProducts: [
      { name: 'Product A', price: 100, unit: 'Pcs' },
      { name: 'Product B', price: 250, unit: 'Pcs' },
      { name: 'Service Fee', price: 500, unit: 'Pcs' },
    ],
    invoiceItemLabel: 'Item Particulars',
  },
};

/** Ordered list for rendering UI grids */
export const BUSINESS_TYPES_LIST: BusinessType[] = [
  'textile',
  'grocery',
  'restaurant',
  'electronics',
  'wholesale',
  'jewelry',
  'pharmacy',
  'hardware',
  'printing',
  'salon',
  'freelancer',
  'general',
];

/** Get preset for a business type (with fallback to 'general') */
export function getBusinessPreset(type?: BusinessType): BusinessTypePreset {
  if (type && BUSINESS_TYPE_PRESETS[type]) {
    return BUSINESS_TYPE_PRESETS[type];
  }
  return BUSINESS_TYPE_PRESETS.general;
}
