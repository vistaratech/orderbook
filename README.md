# 📖 KadaiBook — Smart Order Book & Invoice ERP

[![React Native](https://img.shields.io/badge/React_Native-0.86-61DAFB?logo=react&logoColor=black)](https://reactnative.dev/)
[![Expo](https://img.shields.io/badge/Expo-~57.0-000020?logo=expo&logoColor=white)](https://expo.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-~6.0-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Firebase](https://img.shields.io/badge/Firebase-Sync_&_Cloud-FFCA28?logo=firebase&logoColor=black)](https://firebase.google.com/)
[![Platform](https://img.shields.io/badge/Platform-Web_|_Android_|_iOS-4CAF50)](https://expo.dev/)

**KadaiBook** is an all-in-one digital order management, customer CRM, expense tracking, and invoice customization platform built for small-and-medium businesses, merchants, traders, and retail shops. It transitions traditional paper-based order books into a high-speed, modern, multi-device cloud application with instant WhatsApp invoice sharing and thermal print support.

---

## ✨ Key Features

### 📦 1. Order & Fulfillment Management
- **Full Order Lifecycle**: Track stages from **Placed ➔ Packed ➔ Dispatched ➔ Delivered ➔ Returned / Cancelled**.
- **Itemized Billing**: Dynamic row calculation (Quantity × Rate = Total), tax rates, and discount support.
- **Advance & Payment Ledger**: Log multiple partial payments with payment methods (Cash, UPI, Card, Net Banking). Live computation of balance due.
- **Photo Attachments**: Capture and attach reference photos, fabric samples, or custom order images.
- **Dispatch & Tracking**: Record courier/transport details, tracking numbers, and delivery dates.

### 🧾 2. Invoice Studio (8 Customizable Template Engines)
- **8 Built-in Themes**:
  1. **Modern Slate**: Sleek dark gradient header with crisp corporate styling.
  2. **Warm Terracotta**: Earthen craft aesthetic ideal for boutiques, artisans, and cafes.
  3. **Classic Minimal**: Clean high-contrast monochrome design for fast printing.
  4. **Emerald Pro**: Vibrant green theme tailored for organic shops, grocers, and pharmacies.
  5. **Sapphire Corporate**: Deep royal blue palette designed for tech, B2B, and professional services.
  6. **Ruby Retail**: Rich crimson styling crafted for jewelers, lifestyle, and fashion stores.
  7. **POS Thermal Receipt (80mm / 58mm)**: Monospaced compact layout with dotted dividers for thermal receipt printers.
  8. **Official GST Tax Invoice**: Standard 2-column compliance structure with CGST/SGST/IGST tax breakdowns and HSN summaries.
- **Deep Customization**:
  - Custom brand colors (Primary, Accent, Header BG, Border).
  - Business logo upload and tagline display.
  - Dynamic **UPI QR Code** generated on-the-fly for instant customer payments.
  - Bank Account Details (Bank name, Account #, IFSC, Branch).
  - Configurable table columns (toggle S.No, Unit, Price, Tax, Discounts).
  - Custom Terms & Conditions and digital Authorized Signatory block.
  - Paper sizing: A4 Standard, A5 Half Page, and 80mm POS Thermal formats.
- **Instant Live Preview**: Real-time split-screen rendering on desktop and responsive live preview modal on mobile.
- **1-Tap Actions**: Print directly to physical/thermal printers, download PDF, or share via WhatsApp.

### 👥 3. Customer CRM & Dues Tracker
- Centralized customer directory with full contact records and address books.
- Comprehensive customer ledger: Lifetime purchase volume, orders count, and outstanding unpaid balances.
- **1-Click WhatsApp Payment Reminders**: Send formatted payment reminder messages with order numbers and balance totals.
- Quick direct phone calling and WhatsApp messaging shortcuts.

### 📊 4. Financial Reports & Analytics
- **Live Sales Analytics**: Daily, weekly, monthly, and custom date range sales metrics.
- **Payment Inflows vs. Outflows**: Track cash collections against operational expenses.
- **Profit & Loss Estimates**: Automatic calculation of gross revenue and net balance positions.
- **Customer Dues Ranking**: Identification of high-balance accounts for receivables management.

### 💸 5. Expense Management
- Log daily business operational expenses (rent, utilities, salaries, transportation, packaging).
- Category-based breakdown and filtering.
- Cash inflow and outflow balance visualizer.

### 📑 6. Quotations & Estimates
- Create formal estimates and pro-forma quotations.
- Convert approved estimates to active orders in 1 click without re-typing data.

### 🏬 7. Business Profile & Multi-Industry Presets
- Configure Shop Name, Contact Details, Address, GSTIN, and Bank Details.
- Industry presets: Textiles & Garments, Grocery & Supermarkets, Electronics & Hardware, Bakeries & Restaurants, Freelancers & Agencies.

### 🌐 8. Cross-Platform Experience (Mobile + Desktop SaaS)
- **Mobile Experience**: Pinned top headers, fixed bottom navigation bar with a raised central `+ New Order` button, smooth scrolling, and touch-optimized cards.
- **Desktop Web Experience**: Responsive SaaS sidebar navigation, split-pane Invoice Studio (controls on the left, real-time live preview on the right), and multi-column dashboards.
- **Multi-Language Support**: Complete Tamil (தமிழ்) and English localization with instant language toggle.
- **Offline-First & Cloud Sync**: Local persistence with `AsyncStorage` paired with real-time Firebase Cloud Synchronization.

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| **Framework** | [React Native](https://reactnative.dev/) with [Expo](https://expo.dev/) (SDK 57) |
| **Language** | [TypeScript](https://www.typescriptlang.org/) (~6.0) |
| **Navigation** | [React Navigation v7](https://reactnavigation.org/) (Native Stack + Bottom Tabs) |
| **Styling & Design** | Vanilla StyleSheet system with custom design tokens, modern typography (`DM Sans`, `Caveat`), glassmorphism, and responsive breakpoints |
| **Storage & Sync** | [AsyncStorage](https://react-native-async-storage.github.io/async-storage/) (Offline) + [Firebase](https://firebase.google.com/) Realtime Sync |
| **Print & PDF** | [Expo Print](https://docs.expo.dev/versions/latest/sdk/print/) + [Expo Sharing](https://docs.expo.dev/versions/latest/sdk/sharing/) |
| **Icons & Media** | [@expo/vector-icons](https://icons.expo.fyi/) (Ionicons), [Expo Image Picker](https://docs.expo.dev/versions/latest/sdk/imagepicker/) |
| **Internationalization** | Context-driven i18n supporting English and Tamil |

---

## 📁 Project Structure

```text
order-book-app/
├── App.tsx                        # App entry, font initialization & Root Navigator
├── app.json                       # Expo configuration & app metadata
├── package.json                   # Dependencies and npm scripts
├── tsconfig.json                  # TypeScript configuration
│
├── src/
│   ├── components/                # Reusable UI components
│   │   ├── AppLogo.tsx            # Branded logo components
│   │   ├── DesktopLayout.tsx      # Desktop wrapper with SaaS Sidebar integration
│   │   ├── EmptyState.tsx         # Sleek placeholder cards
│   │   ├── GlassBackButton.tsx    # Glassmorphic pill back button
│   │   ├── OrderCard.tsx          # Order list card with badge indicators
│   │   ├── SaaSSidebar.tsx        # Desktop left sidebar with badge indicators
│   │   └── StatusTracker.tsx      # Order fulfillment visual tracker
│   │
│   ├── config/                    # Configuration & presets
│   │   ├── businessTypes.ts       # Industry presets and icons
│   │   └── firebase.ts            # Firebase client initialization
│   │
│   ├── i18n/                      # Internationalization
│   │   ├── LanguageContext.tsx    # Language state provider (EN / TA)
│   │   └── translations.ts        # Localization strings
│   │
│   ├── navigation/                # Navigation architecture
│   │   ├── TabNavigator.tsx       # Bottom navigation dock (Mobile) & Desktop Tab Manager
│   │   └── types.ts               # Screen route parameters & navigation types
│   │
│   ├── screens/                   # Application Screens
│   │   ├── BusinessProfileScreen.tsx          # Business settings, branding & GSTIN
│   │   ├── CustomerDetailScreen.tsx           # Customer profile, ledger & order history
│   │   ├── CustomerListScreen.tsx             # Customer directory & balances
│   │   ├── DashboardScreen.tsx                # Analytics summary & quick actions
│   │   ├── EstimateDetailScreen.tsx           # Quotation viewer & order conversion
│   │   ├── EstimateFormScreen.tsx             # New quotation builder
│   │   ├── EstimateListScreen.tsx             # Quotations list
│   │   ├── ExpensesScreen.tsx                 # Business expense tracker
│   │   ├── HistoryScreen.tsx                  # Completed / archived orders
│   │   ├── InvoiceTemplateCustomizerScreen.tsx# 8-theme Invoice Studio & live preview
│   │   ├── MoreScreen.tsx                     # Settings & additional options
│   │   ├── OrderDetailScreen.tsx              # Order readout, status changer & PDF preview
│   │   ├── OrderFormScreen.tsx                # Order builder with item rows
│   │   ├── OrderListScreen.tsx                # Active orders search & filter
│   │   ├── ProductListScreen.tsx              # Product catalog & stock
│   │   ├── PurchaseListScreen.tsx             # Supplier bills & purchases
│   │   ├── ReportsScreen.tsx                  # Financial reports & graphs
│   │   └── SettingsScreen.tsx                 # Language, backup & system settings
│   │
│   ├── storage/                   # Local & Cloud Data Layer
│   │   ├── authStorage.ts         # User session & credentials
│   │   ├── businessProfileStorage.ts # Business profile & branding storage
│   │   ├── customerStorage.ts     # Customer records CRUD
│   │   ├── estimateStorage.ts     # Quotations CRUD
│   │   ├── expenseStorage.ts      # Expense records CRUD
│   │   ├── firebaseSync.ts        # Cloud synchronization & data listeners
│   │   ├── invoiceTemplateStorage.ts # Invoice customization preferences
│   │   ├── orderStorage.ts        # Orders CRUD & calculation logic
│   │   └── paymentStorage.ts      # Order partial payments ledger
│   │
│   ├── theme/                     # Design system
│   │   └── theme.ts               # Color tokens, fonts, radii, and shadows
│   │
│   ├── types/                     # TypeScript definitions
│   │   ├── invoiceTemplate.ts     # Invoice themes, paper sizes & options
│   │   └── order.ts               # Order, Item, and Payment models
│   │
│   └── utils/                     # Helper utilities
│       ├── dialog.ts              # Cross-platform alerts (Web & Native)
│       ├── format.ts              # Currency (₹ INR), date & time formatting
│       ├── invoiceGenerator.ts    # HTML/CSS invoice template generators & PDF printer
│       └── reminderGenerator.ts   # WhatsApp payment reminder templates
```

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (version 18 or higher recommended)
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)
- [Expo Go](https://expo.dev/client) app on your mobile device (optional for testing on physical device)

### 1. Installation
Clone the repository and install dependencies:
```bash
git clone https://github.com/vistaratech/orderbook.git
cd orderbook
npm install
```

### 2. Running Locally

#### 🌐 Web Browser (Recommended for Desktop view)
```bash
npx expo start --web
```
Or start the dev server and press `w`:
```bash
npx expo start
```
Open [http://localhost:8081](http://localhost:8081) in your browser.

#### 📱 Android
```bash
npx expo start --android
```
*(Or press `a` in the Expo terminal to launch an emulator, or scan the QR code via Expo Go app).*

#### 🍎 iOS
```bash
npx expo start --ios
```
*(Or press `i` in the Expo terminal to launch the iOS Simulator, or scan the QR code using the Camera app on iPhone).*

---

## 📦 Production Builds

### Static Web Export
To generate an optimized, static web bundle ready for hosting on **Vercel**, **Netlify**, or **Cloudflare Pages**:
```bash
npm run build
```
The compiled production assets will be output to the `dist/` directory.

### Native Mobile Builds (EAS)
To build standalone `.apk` / `.aab` for Android or `.ipa` for iOS using Expo Application Services (EAS):
```bash
npm install -g eas-cli
eas login
eas build --platform android
eas build --platform ios
```

---

## 📄 License

This project is licensed under the **MIT License**. Free to use, adapt, and customize for commercial and personal business management.

---

<p align="center">
  Crafted with ❤️ by <b>Vistara Technologies</b> • Empowering Small Businesses Worldwide
</p>
