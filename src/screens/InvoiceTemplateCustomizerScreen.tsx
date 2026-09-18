import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  StyleSheet,
  Switch,
  ActivityIndicator,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import {
  InvoiceTemplateConfig,
  InvoiceTemplateId,
  PaperSize,
  LogoSize,
  DEFAULT_INVOICE_TEMPLATE_CONFIG,
  INVOICE_THEME_PRESETS,
} from '../types/invoiceTemplate';
import {
  getInvoiceTemplateConfig,
  saveInvoiceTemplateConfig,
  resetInvoiceTemplateConfig,
} from '../storage/invoiceTemplateStorage';
import { checkProStatus } from '../storage/subscriptionStorage';
import { getBusinessProfile, saveBusinessProfile, BusinessProfile } from '../storage/businessProfileStorage';
import {
  generatePrintableInvoiceHtml,
  printPdfInvoice,
} from '../utils/invoiceGenerator';
import { Order } from '../types/order';
import { colors, fonts, radius, shadow } from '../theme/theme';
import { useLanguage } from '../i18n/LanguageContext';
import GlassBackButton from '../components/GlassBackButton';
import DesktopLayout, { DesktopSidebarContext } from '../components/DesktopLayout';
import { formatCurrency, formatDate } from '../utils/format';
import { showAppAlert, confirmAction } from '../utils/dialog';
import { triggerGlobalSubscriptionModal } from '../context/SubscriptionModalContext';
import FadeInView from '../components/FadeInView';

// Standard Indian Sample Order for Live Realistic Invoicing
const SAMPLE_ORDER: Order = {
  id: 'sample_ord_1',
  orderNumber: 'INV-2026-0042',
  orderDate: new Date().toISOString(),
  customerName: 'Karthik Subramanian',
  phoneNumber: '9876543210',
  items: [
    {
      id: 'itm_1',
      name: 'Organic Traditional Rice (பொன்னி அரிசி)',
      qty: 5,
      unit: 'kg',
      price: 120,
      taxRate: 5,
      hsnCode: '1006',
    },
    {
      id: 'itm_2',
      name: 'Cold Pressed Sesame Oil (நல்லெண்ணெய்)',
      qty: 2,
      unit: 'L',
      price: 340,
      taxRate: 5,
      hsnCode: '1508',
    },
    {
      id: 'itm_3',
      name: 'Natural Palm Jaggery (பனங்கருப்பட்டி)',
      qty: 1,
      unit: 'kg',
      price: 220,
      taxRate: 0,
      discount: 20,
      hsnCode: '1701',
    },
  ],
  advance: 500,
  paymentMethod: 'UPI',
  paymentStatus: 'Partial',
  status: 'Placed',
  customerNote: 'Doorstep delivery before 5:00 PM requested.',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

type StudioTab = 'header' | 'title' | 'columns' | 'payments' | 'terms' | 'theme';

export default function InvoiceTemplateCustomizerScreen() {
  const navigation = useNavigation();
  const { t, language } = useLanguage();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= 768;
  const hasParentSidebar = useContext(DesktopSidebarContext);

  const [config, setConfig] = useState<InvoiceTemplateConfig>(DEFAULT_INVOICE_TEMPLATE_CONFIG);
  const [bizProfile, setBizProfile] = useState<BusinessProfile>({
    businessName: 'SRI MURUGAN TRADERS',
    phone: '9876543210',
    email: 'contact@srimurugantraders.in',
    address: '124, West Masi Street, Madurai - 625001, Tamil Nadu',
    gstin: '33AABCS1234F1Z5',
    tagline: 'Wholesale & Retail Commercial Merchants',
    upiId: 'srimurugan@upi',
    bankDetails: 'State Bank of India\nA/C: 9876543210123\nIFSC: SBIN0001234\nBranch: Madurai Main',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<StudioTab>('header');
  const [mobileMode, setMobileMode] = useState<'editor' | 'preview'>('editor');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [savedConfig, bp] = await Promise.all([
        getInvoiceTemplateConfig(),
        getBusinessProfile(),
      ]);
      setConfig(savedConfig);
      if (bp && bp.businessName) {
        setBizProfile((prev) => ({
          ...prev,
          ...bp,
          businessName: bp.businessName || prev.businessName,
          phone: bp.phone || prev.phone,
          address: bp.address || prev.address,
          gstin: bp.gstin || prev.gstin,
          tagline: bp.tagline || prev.tagline,
          upiId: bp.upiId || prev.upiId,
          bankDetails: bp.bankDetails || prev.bankDetails,
        }));
      }
    } catch (err) {
      console.error('Error loading template config:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyPreset = (presetId: InvoiceTemplateId) => {
    const preset = INVOICE_THEME_PRESETS[presetId];
    if (!preset) return;

    setConfig((prev) => ({
      ...prev,
      templateId: preset.id,
      primaryColor: preset.primaryColor,
      accentColor: preset.accentColor,
      headerBgColor: preset.headerBgColor,
      headerTextColor: preset.headerTextColor,
      cardBorderColor: preset.cardBorderColor,
      fontFamily: preset.fontFamily,
      paperSize: preset.paperSize,
    }));
  };

  const handleSave = async () => {
    const isPro = await checkProStatus();
    if (!isPro) {
      triggerGlobalSubscriptionModal({
        title: '👑 Pro Invoice Templates',
        message: 'Customizing bill presets, colors, custom logos, signatures, and UPI QR codes on invoices is a Pro feature.\n\nUpgrade starting from just ₹99/mo for complete invoice styling & brand freedom!',
        actionName: 'save custom bill designs',
        onUpgrade: () => (navigation as any).navigate('PaywallScreen'),
      });
      return;
    }

    setSaving(true);
    setSaveSuccess(false);
    try {
      await Promise.all([
        saveInvoiceTemplateConfig(config),
        saveBusinessProfile(bizProfile),
      ]);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3500);
      showAppAlert(
        t('common.success', 'Success'),
        'Invoice template & bill customizations saved and applied to all orders!'
      );
    } catch (err) {
      console.error('Save failed:', err);
      showAppAlert(t('common.error', 'Error'), 'Could not save invoice template settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    confirmAction({
      title: 'Reset to Defaults?',
      message: 'Restore original standard Indian bill template settings?',
      confirmText: 'Reset',
      destructive: true,
      onConfirm: async () => {
        const def = await resetInvoiceTemplateConfig();
        setConfig(def);
        showAppAlert('Reset', 'Template settings restored to default.');
      },
    });
  };

  const handleTestPrint = async () => {
    if (!bizProfile) return;
    await printPdfInvoice(SAMPLE_ORDER, bizProfile, config);
  };

  if (loading) {
    return (
      <DesktopLayout currentTabName="InvoiceTemplateCustomizer">
        <SafeAreaView style={styles.screen} edges={['top']}>
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={colors.clayDeep} />
            <Text style={styles.loadingText}>Loading Indian Bill Studio…</Text>
          </View>
        </SafeAreaView>
      </DesktopLayout>
    );
  }

  // Calculations for live bill display
  const subtotalAmount = 1440;
  const discountAmount = config.showDiscount ? 20 : 0;
  const taxableAmount = subtotalAmount - discountAmount;
  const cgstAmount = config.showGSTRate ? 20 : 0;
  const sgstAmount = config.showGSTRate ? 20 : 0;
  const grandTotal = taxableAmount + cgstAmount + sgstAmount;
  const advancePaid = 500;
  const balanceDue = grandTotal - advancePaid;

  const tabs: { id: StudioTab; label: string; subLabel: string; icon: any }[] = [
    { id: 'header', label: '1. Store & Header', subLabel: 'கடை விபரம் & லோகோ', icon: 'storefront-outline' },
    { id: 'title', label: '2. Bill Title & Series', subLabel: 'பில் வகை & எண்', icon: 'document-text-outline' },
    { id: 'columns', label: '3. Items & Columns', subLabel: 'அட்டவணை காலம்கள்', icon: 'grid-outline' },
    { id: 'payments', label: '4. Bank & UPI QR', subLabel: 'வங்கி & QR குறியீடு', icon: 'qr-code-outline' },
    { id: 'terms', label: '5. Terms & Sign', subLabel: 'விதிகள் & கையொப்பம்', icon: 'shield-checkmark-outline' },
    { id: 'theme', label: '6. Colors & Paper', subLabel: 'நிறம் & பிரிண்ட் அளவு', icon: 'color-palette-outline' },
  ];

  return (
    <DesktopLayout currentTabName="InvoiceTemplateCustomizer">
      <SafeAreaView style={styles.screen} edges={['top']}>
        {/* ─── Top Studio App Bar ─── */}
        <View style={styles.headerBar}>
          <GlassBackButton
            label={t('common.back', 'Back')}
            onPress={hasParentSidebar ? () => (navigation as any).navigate('MainTabs', { screen: 'DashboardTab' }) : undefined}
          />
          <View style={styles.headerTitleWrap}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {language === 'ta' ? 'வணிக பில் & இன்வாய்ஸ் ஸ்டுடியோ' : 'Universal Bill & Invoice Studio'}
              </Text>
              <View style={styles.countryBadge}>
                <Text style={styles.countryBadgeText}>🇮🇳 Indian Standard GST & Retail</Text>
              </View>
            </View>
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {language === 'ta' ? 'இங்கு சேமிக்கும் மாற்றங்கள் அனைத்து ஆர்டர் பில்கள் மற்றும் PDF பிரிண்டுகளிலும் உடனடியாக பிரதிபலிக்கும்' : 'Saved customizations automatically apply to all order invoices, PDF downloads & WhatsApp shares'}
            </Text>
          </View>

          <View style={styles.headerActions}>
            <Pressable
              style={({ pressed }) => [styles.testPrintBtn, pressed && { opacity: 0.8 }]}
              onPress={handleTestPrint}
            >
              <Ionicons name="print-outline" size={15} color={colors.ink} />
              <Text style={styles.testPrintBtnText}>PDF Print</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.saveBtn,
                saveSuccess && styles.saveBtnSuccess,
                pressed && { opacity: 0.85 },
                saving && { opacity: 0.6 },
              ]}
              disabled={saving}
              onPress={handleSave}
            >
              {saving ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : saveSuccess ? (
                <>
                  <Ionicons name="checkmark-done" size={16} color={colors.white} />
                  <Text style={styles.saveBtnText}>Applied & Saved!</Text>
                </>
              ) : (
                <>
                  <Ionicons name="save-outline" size={15} color={colors.white} />
                  <Text style={styles.saveBtnText}>Save & Apply</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>

        {/* ─── Mobile View Toggle (Editor vs Live Bill) ─── */}
        {!isDesktop && (
          <View style={styles.mobileModeBar}>
            <Pressable
              style={[styles.mobileModeTab, mobileMode === 'editor' && styles.mobileModeTabActive]}
              onPress={() => setMobileMode('editor')}
            >
              <Ionicons
                name="options-outline"
                size={16}
                color={mobileMode === 'editor' ? colors.clayDeep : colors.inkSoft}
              />
              <Text
                style={[
                  styles.mobileModeTabText,
                  mobileMode === 'editor' && styles.mobileModeTabTextActive,
                ]}
              >
                ⚙️ Configure Settings ({activeTab})
              </Text>
            </Pressable>

            <Pressable
              style={[styles.mobileModeTab, mobileMode === 'preview' && styles.mobileModeTabActive]}
              onPress={() => setMobileMode('preview')}
            >
              <Ionicons
                name="document-text"
                size={16}
                color={mobileMode === 'preview' ? colors.clayDeep : colors.inkSoft}
              />
              <Text
                style={[
                  styles.mobileModeTabText,
                  mobileMode === 'preview' && styles.mobileModeTabTextActive,
                ]}
              >
                📄 Live Indian Bill Preview
              </Text>
            </Pressable>
          </View>
        )}

        {/* ─── Quick Presets Bar (GST, Retail, Thermal, Modern) ─── */}
        <View style={styles.presetsToolbar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presetsScroll}>
            <Text style={styles.presetToolbarLabel}>Standard Layouts:</Text>
            {[
              { id: 'gst_tax_invoice', label: '🏛️ GST Tax Invoice', sub: 'வரி பில் (B2B/B2C)' },
              { id: 'terracotta', label: '🧾 Retail Cash Bill', sub: 'கடை ரொக்க பில்' },
              { id: 'thermal_pos', label: '🖨️ Thermal POS Slip', sub: '80mm தெர்மல் பில்' },
              { id: 'modern_slate', label: '📜 Modern Executive', sub: 'நவீன இன்வாய்ஸ்' },
              { id: 'classic', label: '🏛️ Classic Bordered', sub: 'பாரம்பரிய பில்' },
              { id: 'emerald', label: '🌲 Forest Emerald', sub: 'பச்சை தீம்' },
            ].map((p) => {
              const isSelected = config.templateId === p.id;
              return (
                <Pressable
                  key={p.id}
                  style={[
                    styles.presetPill,
                    isSelected && styles.presetPillActive,
                  ]}
                  onPress={() => handleApplyPreset(p.id as InvoiceTemplateId)}
                >
                  <Text style={[styles.presetPillTitle, isSelected && styles.presetPillTitleActive]}>
                    {p.label}
                  </Text>
                  <Text style={[styles.presetPillSub, isSelected && styles.presetPillSubActive]}>
                    {p.sub}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* ─── Main Two-Column Layout ─── */}
        <View style={styles.studioBody}>
          {/* ════ LEFT COLUMN: Structured Configuration Inspector ════ */}
          {(isDesktop || mobileMode === 'editor') && (
            <View style={[styles.editorColumn, isDesktop && { width: '48%' }]}>
              {/* Category Tabs Header */}
              <View style={styles.tabsHeader}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsScroll}>
                  {tabs.map((tab) => {
                    const isSelected = activeTab === tab.id;
                    return (
                      <Pressable
                        key={tab.id}
                        style={[styles.tabButton, isSelected && styles.tabButtonActive]}
                        onPress={() => setActiveTab(tab.id)}
                      >
                        <Ionicons
                          name={tab.icon}
                          size={15}
                          color={isSelected ? colors.white : colors.ink}
                        />
                        <View>
                          <Text style={[styles.tabButtonText, isSelected && styles.tabButtonTextActive]}>
                            {tab.label}
                          </Text>
                          <Text style={[styles.tabButtonSub, isSelected && styles.tabButtonSubActive]}>
                            {tab.subLabel}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Form Controls Scroll */}
              <ScrollView
                style={styles.formScroll}
                contentContainerStyle={styles.formContent}
                showsVerticalScrollIndicator={false}
              >
                {/* ── 1. STORE & HEADER ── */}
                {activeTab === 'header' && (
                  <FadeInView delay={20} translateY={6}>
                    <View style={styles.sectionHeaderBox}>
                      <Text style={styles.sectionTitle}>1. Store Profile & Bill Header</Text>
                      <Text style={styles.sectionDesc}>கடையின் பெயர், முகவரி, போன் எண், GSTIN மற்றும் லோகோ விவரங்கள்</Text>
                    </View>

                    <View style={styles.inputCard}>
                      <Text style={styles.inputLabel}>Shop / Business Name (கடையின் பெயர்) *</Text>
                      <TextInput
                        style={styles.inputField}
                        value={bizProfile.businessName}
                        onChangeText={(v) => setBizProfile((p) => ({ ...p, businessName: v }))}
                        placeholder="e.g. Sri Murugan Stores"
                        placeholderTextColor={colors.inkSoft}
                      />

                      <Text style={[styles.inputLabel, { marginTop: 12 }]}>Tagline / Business Nature (தொழில் வாசகம்)</Text>
                      <TextInput
                        style={styles.inputField}
                        value={bizProfile.tagline}
                        onChangeText={(v) => setBizProfile((p) => ({ ...p, tagline: v }))}
                        placeholder="e.g. Quality Groceries & Wholesaler"
                        placeholderTextColor={colors.inkSoft}
                      />

                      <Text style={[styles.inputLabel, { marginTop: 12 }]}>Phone / Mobile Number (தொடர்பு எண்)</Text>
                      <TextInput
                        style={styles.inputField}
                        value={bizProfile.phone}
                        onChangeText={(v) => setBizProfile((p) => ({ ...p, phone: v }))}
                        placeholder="e.g. 9876543210"
                        placeholderTextColor={colors.inkSoft}
                        keyboardType="phone-pad"
                      />

                      <Text style={[styles.inputLabel, { marginTop: 12 }]}>Full Store Address (கடை முகவரி)</Text>
                      <TextInput
                        style={[styles.inputField, { height: 60 }]}
                        value={bizProfile.address}
                        onChangeText={(v) => setBizProfile((p) => ({ ...p, address: v }))}
                        placeholder="e.g. 124, West Masi Street, Madurai - 625001"
                        placeholderTextColor={colors.inkSoft}
                        multiline
                      />

                      <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                        <View style={{ flex: 1.5 }}>
                          <Text style={styles.inputLabel}>GSTIN / Tax ID (வரி எண்)</Text>
                          <TextInput
                            style={styles.inputField}
                            value={bizProfile.gstin}
                            onChangeText={(v) => setBizProfile((p) => ({ ...p, gstin: v }))}
                            placeholder="33AAAAA0000A1Z5"
                            placeholderTextColor={colors.inkSoft}
                            autoCapitalize="characters"
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.inputLabel}>State Code</Text>
                          <TextInput
                            style={[styles.inputField, { backgroundColor: '#F1F5F9' }]}
                            value="33 - TN"
                            editable={false}
                          />
                        </View>
                      </View>
                    </View>

                    <View style={styles.inputCard}>
                      <Text style={styles.cardHeaderSmall}>Display Toggles on Bill</Text>
                      <View style={styles.toggleRow}>
                        <Text style={styles.toggleLabel}>Show Business Logo</Text>
                        <Switch
                          value={config.showLogo}
                          onValueChange={(v) => setConfig((p) => ({ ...p, showLogo: v }))}
                          trackColor={{ false: colors.line, true: colors.clayLight }}
                          thumbColor={config.showLogo ? colors.clayDeep : '#f4f3f4'}
                        />
                      </View>
                      <View style={styles.toggleRow}>
                        <Text style={styles.toggleLabel}>Show Store Address on Bill</Text>
                        <Switch
                          value={config.showBusinessAddress}
                          onValueChange={(v) => setConfig((p) => ({ ...p, showBusinessAddress: v }))}
                          trackColor={{ false: colors.line, true: colors.clayLight }}
                          thumbColor={config.showBusinessAddress ? colors.clayDeep : '#f4f3f4'}
                        />
                      </View>
                      <View style={styles.toggleRow}>
                        <Text style={styles.toggleLabel}>Show GSTIN on Bill</Text>
                        <Switch
                          value={config.showGstin}
                          onValueChange={(v) => setConfig((p) => ({ ...p, showGstin: v }))}
                          trackColor={{ false: colors.line, true: colors.clayLight }}
                          thumbColor={config.showGstin ? colors.clayDeep : '#f4f3f4'}
                        />
                      </View>
                    </View>
                  </FadeInView>
                )}

                {/* ── 2. BILL TITLE & SERIES ── */}
                {activeTab === 'title' && (
                  <FadeInView delay={20} translateY={6}>
                    <View style={styles.sectionHeaderBox}>
                      <Text style={styles.sectionTitle}>2. Bill Title & Numbering Series</Text>
                      <Text style={styles.sectionDesc}>பில்லின் தலைப்பு (வரி பில் / ரொக்க பில் / மதிப்பீடு) மற்றும் பில் எண் முன்னொட்டு</Text>
                    </View>

                    <View style={styles.inputCard}>
                      <Text style={styles.inputLabel}>Invoice Document Title (பில் தலைப்பு)</Text>
                      <TextInput
                        style={styles.inputField}
                        value={config.invoiceTitle}
                        onChangeText={(v) => setConfig((p) => ({ ...p, invoiceTitle: v }))}
                        placeholder="e.g. TAX INVOICE, CASH BILL"
                        placeholderTextColor={colors.inkSoft}
                      />

                      <Text style={[styles.inputLabel, { marginTop: 12 }]}>1-Tap Quick Suggestions:</Text>
                      <View style={styles.chipRow}>
                        {[
                          'TAX INVOICE',
                          'CASH BILL',
                          'RETAIL INVOICE',
                          'BILL OF SUPPLY',
                          'ESTIMATE / QUOTE',
                          'DELIVERY CHALLAN',
                        ].map((tName) => (
                          <Pressable
                            key={tName}
                            style={[
                              styles.choiceChip,
                              config.invoiceTitle === tName && styles.choiceChipActive,
                            ]}
                            onPress={() => setConfig((p) => ({ ...p, invoiceTitle: tName }))}
                          >
                            <Text
                              style={[
                                styles.choiceChipText,
                                config.invoiceTitle === tName && styles.choiceChipTextActive,
                              ]}
                            >
                              {tName}
                            </Text>
                          </Pressable>
                        ))}
                      </View>

                      <Text style={[styles.inputLabel, { marginTop: 14 }]}>Invoice Number Prefix (எண் முன்னொட்டு)</Text>
                      <TextInput
                        style={styles.inputField}
                        value={config.invoicePrefix}
                        onChangeText={(v) => setConfig((p) => ({ ...p, invoicePrefix: v }))}
                        placeholder="e.g. INV-, BILL-, ORD-"
                        placeholderTextColor={colors.inkSoft}
                      />
                    </View>

                    <View style={styles.inputCard}>
                      <Text style={styles.cardHeaderSmall}>Date & Buyer Information</Text>
                      <View style={styles.toggleRow}>
                        <Text style={styles.toggleLabel}>Show Due Date on Invoice</Text>
                        <Switch
                          value={config.showDueDate}
                          onValueChange={(v) => setConfig((p) => ({ ...p, showDueDate: v }))}
                          trackColor={{ false: colors.line, true: colors.clayLight }}
                          thumbColor={config.showDueDate ? colors.clayDeep : '#f4f3f4'}
                        />
                      </View>
                      <View style={styles.toggleRow}>
                        <Text style={styles.toggleLabel}>Show Customer Phone on Bill</Text>
                        <Switch
                          value={config.showCustomerPhone}
                          onValueChange={(v) => setConfig((p) => ({ ...p, showCustomerPhone: v }))}
                          trackColor={{ false: colors.line, true: colors.clayLight }}
                          thumbColor={config.showCustomerPhone ? colors.clayDeep : '#f4f3f4'}
                        />
                      </View>
                    </View>
                  </FadeInView>
                )}

                {/* ── 3. TABLE COLUMNS ── */}
                {activeTab === 'columns' && (
                  <FadeInView delay={20} translateY={6}>
                    <View style={styles.sectionHeaderBox}>
                      <Text style={styles.sectionTitle}>3. Product Table Columns</Text>
                      <Text style={styles.sectionDesc}>பில் அட்டவணையில் எந்தெந்த காலம்கள் தோன்ற வேண்டும் என்பதை தேர்வு செய்யவும்</Text>
                    </View>

                    <View style={styles.inputCard}>
                      {[
                        { key: 'showRate', title: 'Rate / Price (விலை)', desc: 'பொருளின் யூனிட் விலை காலம்' },
                        { key: 'showUnit', title: 'Unit of Measure (அளவு/எடை)', desc: 'kg, pcs, box, liters அலகு காலம்' },
                        { key: 'showGSTRate', title: 'GST Tax % (வரி விகிதம்)', desc: '5%, 12%, 18% ஜிஎஸ்டி வரி விகிதம்' },
                        { key: 'showDiscount', title: 'Discount (தள்ளுபடி தொகை)', desc: 'ஒவ்வொரு பொருளுக்கும் தள்ளுபடி கழிவு' },
                        { key: 'showHsn', title: 'HSN / SAC Code', desc: 'ஜிஎஸ்டி தணிக்கைக்கான HSN குறியீடு' },
                        { key: 'showItemSerialNo', title: 'Serial Number (வ.எண்)', desc: 'வரிசை எண் (1, 2, 3...)' },
                      ].map((col) => {
                        const isChecked = Boolean(config[col.key as keyof InvoiceTemplateConfig]);
                        return (
                          <View key={col.key} style={styles.columnOptionRow}>
                            <View style={{ flex: 1, paddingRight: 8 }}>
                              <Text style={styles.columnOptionTitle}>{col.title}</Text>
                              <Text style={styles.columnOptionDesc}>{col.desc}</Text>
                            </View>
                            <Switch
                              value={isChecked}
                              onValueChange={(val) =>
                                setConfig((prev) => ({ ...prev, [col.key]: val }))
                              }
                              trackColor={{ false: colors.line, true: colors.clayLight }}
                              thumbColor={isChecked ? colors.clayDeep : '#f4f3f4'}
                            />
                          </View>
                        );
                      })}
                    </View>
                  </FadeInView>
                )}

                {/* ── 4. BANK & UPI QR ── */}
                {activeTab === 'payments' && (
                  <FadeInView delay={20} translateY={6}>
                    <View style={styles.sectionHeaderBox}>
                      <Text style={styles.sectionTitle}>4. UPI Dynamic QR Code & Bank Details</Text>
                      <Text style={styles.sectionDesc}>வாடிக்கையாளர் பில்லில் உள்ள QR ஸ்கேன் செய்து கூகுள்பே/போன்பே மூலம் உடனடியாக பணம் செலுத்த</Text>
                    </View>

                    <View style={styles.inputCard}>
                      <View style={styles.toggleRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.toggleLabel}>Show Dynamic UPI QR Code</Text>
                          <Text style={styles.toggleSub}>Calculates exact balance due in QR</Text>
                        </View>
                        <Switch
                          value={config.showUpiQr}
                          onValueChange={(v) => setConfig((p) => ({ ...p, showUpiQr: v }))}
                          trackColor={{ false: colors.line, true: colors.clayLight }}
                          thumbColor={config.showUpiQr ? colors.clayDeep : '#f4f3f4'}
                        />
                      </View>

                      {config.showUpiQr && (
                        <View style={{ marginTop: 12 }}>
                          <Text style={styles.inputLabel}>UPI VPA ID (ஜிபே / போன்பே UPI ஐடி) *</Text>
                          <TextInput
                            style={styles.inputField}
                            value={config.upiId || bizProfile.upiId}
                            onChangeText={(val) => {
                              setConfig((p) => ({ ...p, upiId: val }));
                              setBizProfile((p) => ({ ...p, upiId: val }));
                            }}
                            placeholder="e.g. srimurugan@okhdfcbank"
                            placeholderTextColor={colors.inkSoft}
                            autoCapitalize="none"
                          />
                        </View>
                      )}
                    </View>

                    <View style={styles.inputCard}>
                      <View style={styles.toggleRow}>
                        <Text style={styles.toggleLabel}>Show Bank Account Transfer Info</Text>
                        <Switch
                          value={config.showBankDetails}
                          onValueChange={(v) => setConfig((p) => ({ ...p, showBankDetails: v }))}
                          trackColor={{ false: colors.line, true: colors.clayLight }}
                          thumbColor={config.showBankDetails ? colors.clayDeep : '#f4f3f4'}
                        />
                      </View>

                      {config.showBankDetails && (
                        <View style={{ marginTop: 12 }}>
                          <Text style={styles.inputLabel}>Bank Account Details (வங்கி கணக்கு விவரம்)</Text>
                          <TextInput
                            style={[styles.inputField, { height: 75 }]}
                            value={config.bankDetailsCustom || bizProfile.bankDetails}
                            onChangeText={(val) => {
                              setConfig((p) => ({ ...p, bankDetailsCustom: val }));
                              setBizProfile((p) => ({ ...p, bankDetails: val }));
                            }}
                            placeholder="Bank Name, Account Number, IFSC Code, Branch"
                            placeholderTextColor={colors.inkSoft}
                            multiline
                          />
                        </View>
                      )}
                    </View>
                  </FadeInView>
                )}

                {/* ── 5. TERMS & SIGNATURE ── */}
                {activeTab === 'terms' && (
                  <FadeInView delay={20} translateY={6}>
                    <View style={styles.sectionHeaderBox}>
                      <Text style={styles.sectionTitle}>5. Terms, Notes & Authorized Signature</Text>
                      <Text style={styles.sectionDesc}>பில்லின் அடியில் வரக்கூடிய விதிகள், நன்றி செய்தி மற்றும் கையொப்ப முத்திரை</Text>
                    </View>

                    <View style={styles.inputCard}>
                      <View style={styles.toggleRow}>
                        <Text style={styles.toggleLabel}>Show Terms & Conditions (விதிமுறைகள்)</Text>
                        <Switch
                          value={config.showTerms}
                          onValueChange={(v) => setConfig((p) => ({ ...p, showTerms: v }))}
                          trackColor={{ false: colors.line, true: colors.clayLight }}
                          thumbColor={config.showTerms ? colors.clayDeep : '#f4f3f4'}
                        />
                      </View>

                      {config.showTerms && (
                        <View style={{ marginTop: 12 }}>
                          <Text style={styles.inputLabel}>Terms & Conditions Text</Text>
                          <TextInput
                            style={[styles.inputField, { height: 70 }]}
                            value={config.termsAndConditions}
                            onChangeText={(val) => setConfig((p) => ({ ...p, termsAndConditions: val }))}
                            placeholder="1. சரக்கு திரும்ப பெறப்பட மாட்டாது.\n2. Goods once sold will not be taken back."
                            placeholderTextColor={colors.inkSoft}
                            multiline
                          />
                        </View>
                      )}
                    </View>

                    <View style={styles.inputCard}>
                      <View style={styles.toggleRow}>
                        <Text style={styles.toggleLabel}>Show Authorized Signatory Box (கையொப்பம்)</Text>
                        <Switch
                          value={config.showSignatory}
                          onValueChange={(v) => setConfig((p) => ({ ...p, showSignatory: v }))}
                          trackColor={{ false: colors.line, true: colors.clayLight }}
                          thumbColor={config.showSignatory ? colors.clayDeep : '#f4f3f4'}
                        />
                      </View>

                      {config.showSignatory && (
                        <View style={{ marginTop: 12 }}>
                          <Text style={styles.inputLabel}>Signatory Title Label</Text>
                          <TextInput
                            style={styles.inputField}
                            value={config.signatoryTitle}
                            onChangeText={(val) => setConfig((p) => ({ ...p, signatoryTitle: val }))}
                            placeholder="Authorized Signatory / மேலாளர்"
                            placeholderTextColor={colors.inkSoft}
                          />
                        </View>
                      )}

                      <Text style={[styles.inputLabel, { marginTop: 14 }]}>Footer Thank You Note (நன்றி செய்தி)</Text>
                      <TextInput
                        style={styles.inputField}
                        value={config.footerMessage}
                        onChangeText={(val) => setConfig((p) => ({ ...p, footerMessage: val }))}
                        placeholder="நன்றி! மீண்டும் வருக! / Thank you for your business!"
                        placeholderTextColor={colors.inkSoft}
                      />
                    </View>
                  </FadeInView>
                )}

                {/* ── 6. COLORS & PAPER SIZE ── */}
                {activeTab === 'theme' && (
                  <FadeInView delay={20} translateY={6}>
                    <View style={styles.sectionHeaderBox}>
                      <Text style={styles.sectionTitle}>6. Color Palette & Printer Paper Size</Text>
                      <Text style={styles.sectionDesc}>பில்லின் கலர் தீம் மற்றும் பிரிண்ட் பேப்பர் அளவை தேர்வு செய்யவும்</Text>
                    </View>

                    <View style={styles.inputCard}>
                      <Text style={styles.inputLabel}>Paper Sizing (பிரிண்டர் தாள் அளவு)</Text>
                      <View style={styles.chipRow}>
                        {[
                          { id: 'a4', label: '📄 A4 Full Page' },
                          { id: 'a5', label: '📑 A5 Half Page' },
                          { id: 'thermal_80mm', label: '🧾 80mm POS Thermal (3-inch)' },
                          { id: 'thermal_58mm', label: '🧾 58mm Thermal (2-inch)' },
                        ].map((p) => (
                          <Pressable
                            key={p.id}
                            style={[
                              styles.choiceChip,
                              config.paperSize === p.id && styles.choiceChipActive,
                            ]}
                            onPress={() => setConfig((prev) => ({ ...prev, paperSize: p.id as PaperSize }))}
                          >
                            <Text
                              style={[
                                styles.choiceChipText,
                                config.paperSize === p.id && styles.choiceChipTextActive,
                              ]}
                            >
                              {p.label}
                            </Text>
                          </Pressable>
                        ))}
                      </View>

                      <View style={[styles.toggleRow, { marginTop: 14 }]}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.toggleLabel}>Compact Margins (Space Saver)</Text>
                          <Text style={styles.toggleSub}>Tighter layout for thermal and small slips</Text>
                        </View>
                        <Switch
                          value={config.compactMode}
                          onValueChange={(v) => setConfig((p) => ({ ...p, compactMode: v }))}
                          trackColor={{ false: colors.line, true: colors.clayLight }}
                          thumbColor={config.compactMode ? colors.clayDeep : '#f4f3f4'}
                        />
                      </View>
                    </View>

                    <View style={styles.inputCard}>
                      <Text style={styles.cardHeaderSmall}>Reset Configuration</Text>
                      <Pressable
                        style={({ pressed }) => [styles.resetBtn, pressed && { opacity: 0.8 }]}
                        onPress={handleReset}
                      >
                        <Ionicons name="refresh-outline" size={15} color={colors.danger} />
                        <Text style={styles.resetBtnText}>Restore Standard Indian Bill Template</Text>
                      </Pressable>
                    </View>
                  </FadeInView>
                )}
              </ScrollView>
            </View>
          )}

          {/* ════ RIGHT COLUMN: Live Authentic Indian Bill Preview ════ */}
          {(isDesktop || mobileMode === 'preview') && (
            <View style={[styles.previewColumn, isDesktop && { width: '52%' }]}>
              <View style={styles.previewHeaderStrip}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="eye" size={16} color={colors.clayDeep} />
                  <Text style={styles.previewTitle}>Live Bill View (நேரடி பில் தோற்றம்)</Text>
                </View>
                <Text style={styles.previewBadge}>{config.paperSize.toUpperCase()}</Text>
              </View>

              <ScrollView
                style={styles.previewScroll}
                contentContainerStyle={styles.previewContent}
                showsVerticalScrollIndicator={false}
              >
                <FadeInView delay={60} translateY={8}>
                  {/* The Authentic Indian Invoice Sheet */}
                  <View
                    style={[
                      styles.invoiceSheet,
                      {
                        borderColor: config.cardBorderColor || '#CBD5E1',
                      },
                    ]}
                  >
                    {/* Header Banner */}
                    <View
                      style={[
                        styles.invoiceHeaderBanner,
                        {
                          backgroundColor: config.headerBgColor || '#F8FAFC',
                          borderBottomColor: config.primaryColor,
                        },
                      ]}
                    >
                      <View style={{ flex: 1.5 }}>
                        <Text style={[styles.invoiceStoreTitle, { color: config.headerTextColor || config.primaryColor }]}>
                          {bizProfile.businessName || 'MY BUSINESS NAME'}
                        </Text>
                        {config.showTagline && bizProfile.tagline ? (
                          <Text style={styles.invoiceTagline}>{bizProfile.tagline}</Text>
                        ) : null}

                        {config.showBusinessAddress && bizProfile.address ? (
                          <Text style={styles.invoiceAddress} numberOfLines={2}>
                            {bizProfile.address}
                          </Text>
                        ) : null}

                        <View style={styles.invoiceMetaInlineRow}>
                          {config.showBusinessPhone && bizProfile.phone ? (
                            <Text style={styles.invoiceContactText}>Ph: {bizProfile.phone}</Text>
                          ) : null}
                          {config.showGstin && bizProfile.gstin ? (
                            <Text style={[styles.invoiceContactText, styles.gstinText]}>
                              GSTIN: {bizProfile.gstin}
                            </Text>
                          ) : null}
                        </View>
                      </View>

                      {/* Right Meta Column */}
                      <View style={styles.invoiceRightMeta}>
                        <View style={[styles.invoiceTitleBadge, { backgroundColor: config.primaryColor }]}>
                          <Text style={styles.invoiceTitleBadgeText}>{config.invoiceTitle || 'TAX INVOICE'}</Text>
                        </View>
                        <Text style={styles.invoiceMetaDetail}>
                          <Text style={{ fontFamily: fonts.bodyBold }}>Bill #:</Text> {SAMPLE_ORDER.orderNumber}
                        </Text>
                        <Text style={styles.invoiceMetaDetail}>
                          <Text style={{ fontFamily: fonts.bodyBold }}>Date:</Text> {formatDate(SAMPLE_ORDER.orderDate)}
                        </Text>
                        <Text style={styles.invoiceMetaDetail}>
                          <Text style={{ fontFamily: fonts.bodyBold }}>State:</Text> Tamil Nadu (33)
                        </Text>
                      </View>
                    </View>

                    {/* Buyer / Customer Details Strip */}
                    <View style={styles.invoiceBuyerRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.buyerLabel}>BUYER / CUSTOMER (வாங்குபவர் விபரம்):</Text>
                        <Text style={styles.buyerName}>{SAMPLE_ORDER.customerName}</Text>
                        {config.showCustomerPhone && (
                          <Text style={styles.buyerMeta}>Mobile: {SAMPLE_ORDER.phoneNumber}</Text>
                        )}
                      </View>
                      <View style={styles.statusPillSmall}>
                        <Ionicons name="checkmark-circle" size={12} color="#15803D" />
                        <Text style={styles.statusPillSmallText}>Partially Paid</Text>
                      </View>
                    </View>

                    {/* Products Table */}
                    <View style={styles.invoiceTable}>
                      {/* Table Header */}
                      <View style={[styles.tableHeaderRow, { backgroundColor: config.primaryColor }]}>
                        {config.showItemSerialNo && (
                          <Text style={[styles.thCell, { width: 28 }]}>#</Text>
                        )}
                        <Text style={[styles.thCell, { flex: 2.2 }]}>Item Description (பொருட்கள்)</Text>
                        {config.showHsn && (
                          <Text style={[styles.thCell, { width: 44, textAlign: 'center' }]}>HSN</Text>
                        )}
                        <Text style={[styles.thCell, { width: 36, textAlign: 'center' }]}>Qty</Text>
                        {config.showUnit && (
                          <Text style={[styles.thCell, { width: 36, textAlign: 'center' }]}>Unit</Text>
                        )}
                        {config.showRate && (
                          <Text style={[styles.thCell, { width: 55, textAlign: 'right' }]}>Rate (₹)</Text>
                        )}
                        {config.showGSTRate && (
                          <Text style={[styles.thCell, { width: 44, textAlign: 'center' }]}>GST</Text>
                        )}
                        {config.showDiscount && (
                          <Text style={[styles.thCell, { width: 45, textAlign: 'right' }]}>Disc</Text>
                        )}
                        <Text style={[styles.thCell, { width: 65, textAlign: 'right' }]}>Amount (₹)</Text>
                      </View>

                      {/* Item Rows */}
                      {SAMPLE_ORDER.items.map((it, idx) => (
                        <View
                          key={it.id}
                          style={[
                            styles.tableBodyRow,
                            idx % 2 === 1 && { backgroundColor: '#F8FAFC' },
                          ]}
                        >
                          {config.showItemSerialNo && (
                            <Text style={[styles.tdCell, { width: 28, color: colors.inkSoft }]}>{idx + 1}</Text>
                          )}
                          <Text style={[styles.tdCell, { flex: 2.2, fontFamily: fonts.bodyBold }]}>
                            {it.name}
                          </Text>
                          {config.showHsn && (
                            <Text style={[styles.tdCell, { width: 44, textAlign: 'center', fontSize: 10, color: colors.inkSoft }]}>
                              {it.hsnCode || '-'}
                            </Text>
                          )}
                          <Text style={[styles.tdCell, { width: 36, textAlign: 'center' }]}>{it.qty}</Text>
                          {config.showUnit && (
                            <Text style={[styles.tdCell, { width: 36, textAlign: 'center', color: colors.inkSoft }]}>
                              {it.unit || '-'}
                            </Text>
                          )}
                          {config.showRate && (
                            <Text style={[styles.tdCell, { width: 55, textAlign: 'right' }]}>
                              {formatCurrency(it.price)}
                            </Text>
                          )}
                          {config.showGSTRate && (
                            <Text style={[styles.tdCell, { width: 44, textAlign: 'center', fontSize: 10 }]}>
                              {it.taxRate ? `${it.taxRate}%` : '0%'}
                            </Text>
                          )}
                          {config.showDiscount && (
                            <Text style={[styles.tdCell, { width: 45, textAlign: 'right', color: colors.inflow, fontSize: 10 }]}>
                              {it.discount ? `-₹${it.discount}` : '-'}
                            </Text>
                          )}
                          <Text style={[styles.tdCell, { width: 65, textAlign: 'right', fontFamily: fonts.bodyBold }]}>
                            {formatCurrency(it.qty * it.price - (it.discount || 0))}
                          </Text>
                        </View>
                      ))}
                    </View>

                    {/* Calculation Totals & GST Summary Box */}
                    <View style={styles.invoiceSummaryRow}>
                      <View style={{ flex: 1, paddingRight: 10 }}>
                        <Text style={styles.amountWordsLabel}>Amount in Words (எழுத்தால்):</Text>
                        <Text style={styles.amountWordsText}>One Thousand Four Hundred and Forty Rupees Only</Text>
                      </View>

                      <View style={styles.totalsTableBox}>
                        <View style={styles.summaryLine}>
                          <Text style={styles.summaryLineLabel}>Subtotal (மொத்த விலை):</Text>
                          <Text style={styles.summaryLineVal}>{formatCurrency(subtotalAmount)}</Text>
                        </View>
                        {discountAmount > 0 && (
                          <View style={styles.summaryLine}>
                            <Text style={[styles.summaryLineLabel, { color: colors.inflow }]}>Discount (தள்ளுபடி):</Text>
                            <Text style={[styles.summaryLineVal, { color: colors.inflow }]}>-{formatCurrency(discountAmount)}</Text>
                          </View>
                        )}
                        {config.showGSTRate && (
                          <>
                            <View style={styles.summaryLine}>
                              <Text style={styles.summaryLineLabel}>CGST (2.5%):</Text>
                              <Text style={styles.summaryLineVal}>+{formatCurrency(cgstAmount)}</Text>
                            </View>
                            <View style={styles.summaryLine}>
                              <Text style={styles.summaryLineLabel}>SGST (2.5%):</Text>
                              <Text style={styles.summaryLineVal}>+{formatCurrency(sgstAmount)}</Text>
                            </View>
                          </>
                        )}
                        <View style={styles.summaryLineTotal}>
                          <Text style={styles.summaryLineTotalLabel}>Grand Total (நிகர மொத்தம்):</Text>
                          <Text style={styles.summaryLineTotalVal}>{formatCurrency(grandTotal)}</Text>
                        </View>
                        <View style={styles.summaryLine}>
                          <Text style={[styles.summaryLineLabel, { color: colors.inflow }]}>Advance Paid (முன்பணம்):</Text>
                          <Text style={[styles.summaryLineVal, { color: colors.inflow }]}>{formatCurrency(advancePaid)}</Text>
                        </View>
                        <View style={styles.summaryLineBalance}>
                          <Text style={styles.summaryLineBalanceLabel}>Balance Due (மீதி தொகை):</Text>
                          <Text style={styles.summaryLineBalanceVal}>{formatCurrency(balanceDue)}</Text>
                        </View>
                      </View>
                    </View>

                    {/* Bank & UPI QR Payment Box */}
                    {(config.showUpiQr || config.showBankDetails) && (
                      <View style={styles.invoicePaymentBox}>
                        {config.showUpiQr && (
                          <View style={styles.invoiceQrCard}>
                            <View style={styles.qrIconWrap}>
                              <Ionicons name="qr-code" size={44} color={config.primaryColor} />
                            </View>
                            <Text style={styles.qrCaption}>Scan to Pay via UPI</Text>
                            <Text style={styles.qrVpa}>{config.upiId || bizProfile.upiId || 'store@upi'}</Text>
                          </View>
                        )}

                        {config.showBankDetails && (
                          <View style={styles.invoiceBankCard}>
                            <Text style={styles.bankCardTitle}>🏦 Bank Account Details (வங்கி விபரம்):</Text>
                            <Text style={styles.bankCardBody}>
                              {config.bankDetailsCustom || bizProfile.bankDetails || 'State Bank of India\nA/C: 9876543210123\nIFSC: SBIN0001234'}
                            </Text>
                          </View>
                        )}
                      </View>
                    )}

                    {/* Terms & Conditions and Signature Strip */}
                    <View style={styles.invoiceFooterRow}>
                      <View style={{ flex: 1.4 }}>
                        {config.showTerms && (
                          <View style={{ marginBottom: 6 }}>
                            <Text style={styles.termsTitle}>{config.termsHeading || 'Terms & Conditions (விதிமுறைகள்)'}:</Text>
                            <Text style={styles.termsText}>
                              {config.termsAndConditions || '1. சரக்கு திரும்ப பெறப்பட மாட்டாது.\n2. Goods once sold will not be taken back.'}
                            </Text>
                          </View>
                        )}
                        <Text style={styles.footerGreeting}>
                          {config.footerMessage || 'நன்றி! மீண்டும் வருக! / Thank you for your business!'}
                        </Text>
                      </View>

                      {config.showSignatory && (
                        <View style={styles.signatoryCard}>
                          <View style={styles.signDivider} />
                          <Text style={styles.signBusinessName}>For {bizProfile.businessName || 'Store'}</Text>
                          <Text style={styles.signDesignation}>{config.signatoryTitle || 'Authorized Signatory'}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </FadeInView>
              </ScrollView>
            </View>
          )}
        </View>
      </SafeAreaView>
    </DesktopLayout>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.inkSoft,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    backgroundColor: colors.paper,
    gap: 10,
  },
  headerTitleWrap: {
    flex: 1,
    minWidth: 0,
  },
  headerTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    color: colors.ink,
  },
  headerSubtitle: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.inkSoft,
    marginTop: 1,
  },
  countryBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  countryBadgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    color: '#92400E',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  testPrintBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.paperCard,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.line,
  },
  testPrintBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11.5,
    color: colors.ink,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.clayDeep,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.sm,
    ...shadow.card,
  },
  saveBtnSuccess: {
    backgroundColor: '#16A34A',
  },
  saveBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: colors.white,
  },
  mobileModeBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    backgroundColor: colors.paperCard,
  },
  mobileModeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  mobileModeTabActive: {
    borderBottomColor: colors.clayDeep,
    backgroundColor: colors.paper,
  },
  mobileModeTabText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.inkSoft,
  },
  mobileModeTabTextActive: {
    fontFamily: fonts.bodyBold,
    color: colors.clayDeep,
  },
  presetsToolbar: {
    backgroundColor: colors.paperCard,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  presetsScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  presetToolbarLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: colors.inkSoft,
    marginRight: 2,
  },
  presetPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
  },
  presetPillActive: {
    backgroundColor: '#FAF5EE',
    borderColor: colors.clayDeep,
  },
  presetPillTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: colors.ink,
  },
  presetPillTitleActive: {
    color: colors.clayDeep,
  },
  presetPillSub: {
    fontFamily: fonts.body,
    fontSize: 9.5,
    color: colors.inkSoft,
  },
  presetPillSubActive: {
    color: colors.clayDeep,
  },
  studioBody: {
    flex: 1,
    flexDirection: 'row',
    overflow: 'hidden',
  },

  /* ════ LEFT EDITOR PANE ════ */
  editorColumn: {
    flex: 1,
    height: '100%',
    backgroundColor: colors.paper,
    borderRightWidth: 1,
    borderRightColor: colors.line,
  },
  tabsHeader: {
    backgroundColor: colors.paperCard,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    paddingVertical: 6,
  },
  tabsScroll: {
    paddingHorizontal: 12,
    gap: 6,
    flexDirection: 'row',
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.sm,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
  },
  tabButtonActive: {
    backgroundColor: colors.clayDeep,
    borderColor: colors.clayDeep,
  },
  tabButtonText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: colors.ink,
  },
  tabButtonTextActive: {
    color: colors.white,
  },
  tabButtonSub: {
    fontFamily: fonts.body,
    fontSize: 9,
    color: colors.inkSoft,
  },
  tabButtonSubActive: {
    color: 'rgba(255,255,255,0.85)',
  },
  formScroll: {
    flex: 1,
  },
  formContent: {
    padding: 16,
    paddingBottom: 60,
  },
  sectionHeaderBox: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 14.5,
    color: colors.ink,
  },
  sectionDesc: {
    fontFamily: fonts.body,
    fontSize: 11.5,
    color: colors.inkSoft,
    marginTop: 2,
  },
  inputCard: {
    backgroundColor: colors.paperCard,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 14,
    marginBottom: 14,
    ...shadow.card,
  },
  cardHeaderSmall: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: colors.ink,
    marginBottom: 8,
  },
  inputLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 11.5,
    color: colors.ink,
    marginBottom: 4,
  },
  inputField: {
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.ink,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  toggleLabel: {
    fontFamily: fonts.body,
    fontSize: 12.5,
    color: colors.ink,
  },
  toggleSub: {
    fontFamily: fonts.body,
    fontSize: 10.5,
    color: colors.inkSoft,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  choiceChip: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: radius.sm,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
  },
  choiceChipActive: {
    backgroundColor: colors.clayLight,
    borderColor: colors.clayDeep,
  },
  choiceChipText: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.ink,
  },
  choiceChipTextActive: {
    fontFamily: fonts.bodyBold,
    color: colors.clayDeep,
  },
  columnOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  columnOptionTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: colors.ink,
  },
  columnOptionDesc: {
    fontFamily: fonts.body,
    fontSize: 10.5,
    color: colors.inkSoft,
    marginTop: 1,
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: '#FEF2F2',
  },
  resetBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11.5,
    color: colors.danger,
  },

  /* ════ RIGHT PREVIEW PANE ════ */
  previewColumn: {
    flex: 1,
    height: '100%',
    backgroundColor: '#F1F5F9',
  },
  previewHeaderStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.paperCard,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  previewTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: colors.ink,
  },
  previewBadge: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    backgroundColor: '#E2E8F0',
    color: colors.ink,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  previewScroll: {
    flex: 1,
  },
  previewContent: {
    padding: 16,
    alignItems: 'center',
    paddingBottom: 60,
  },

  /* 🇮🇳 REALISTIC INDIAN BILL SHEET STYLES */
  invoiceSheet: {
    width: '100%',
    maxWidth: 580,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1.5,
    ...shadow.card,
    elevation: 4,
    overflow: 'hidden',
  },
  invoiceHeaderBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 14,
    borderBottomWidth: 2,
    gap: 12,
  },
  invoiceStoreTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    letterSpacing: 0.5,
  },
  invoiceTagline: {
    fontFamily: fonts.body,
    fontSize: 10.5,
    color: colors.inkSoft,
    marginTop: 1,
  },
  invoiceAddress: {
    fontFamily: fonts.body,
    fontSize: 10.5,
    color: colors.ink,
    marginTop: 4,
    lineHeight: 14,
  },
  invoiceMetaInlineRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  invoiceContactText: {
    fontFamily: fonts.body,
    fontSize: 10.5,
    color: colors.ink,
  },
  gstinText: {
    fontFamily: fonts.bodyBold,
    color: colors.clayDeep,
  },
  invoiceRightMeta: {
    alignItems: 'flex-end',
    minWidth: 130,
  },
  invoiceTitleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginBottom: 4,
  },
  invoiceTitleBadgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 10.5,
    color: colors.white,
    letterSpacing: 0.8,
  },
  invoiceMetaDetail: {
    fontFamily: fonts.body,
    fontSize: 10.5,
    color: colors.ink,
    marginTop: 1,
  },
  invoiceBuyerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  buyerLabel: {
    fontFamily: fonts.body,
    fontSize: 9.5,
    color: colors.inkSoft,
  },
  buyerName: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: colors.ink,
  },
  buyerMeta: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.inkSoft,
  },
  statusPillSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  statusPillSmallText: {
    fontFamily: fonts.bodyBold,
    fontSize: 9.5,
    color: '#15803D',
  },
  invoiceTable: {
    padding: 10,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderRadius: 4,
    marginBottom: 4,
  },
  thCell: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    color: colors.white,
  },
  tableBodyRow: {
    flexDirection: 'row',
    paddingHorizontal: 6,
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    alignItems: 'center',
  },
  tdCell: {
    fontFamily: fonts.body,
    fontSize: 10.5,
    color: colors.ink,
  },
  invoiceSummaryRow: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: '#FAFAFA',
  },
  amountWordsLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 9.5,
    color: colors.inkSoft,
  },
  amountWordsText: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.ink,
    fontStyle: 'italic',
    marginTop: 2,
  },
  totalsTableBox: {
    width: 220,
    gap: 2,
  },
  summaryLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryLineLabel: {
    fontFamily: fonts.body,
    fontSize: 10.5,
    color: colors.ink,
  },
  summaryLineVal: {
    fontFamily: fonts.bodyBold,
    fontSize: 10.5,
    color: colors.ink,
  },
  summaryLineTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1.5,
    borderTopColor: '#CBD5E1',
    paddingTop: 4,
    marginTop: 2,
  },
  summaryLineTotalLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 11.5,
    color: colors.ink,
  },
  summaryLineTotalVal: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: colors.ink,
  },
  summaryLineBalance: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    marginTop: 4,
  },
  summaryLineBalanceLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 10.5,
    color: colors.danger,
  },
  summaryLineBalanceVal: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: colors.danger,
  },
  invoicePaymentBox: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  invoiceQrCard: {
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    minWidth: 100,
  },
  qrIconWrap: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrCaption: {
    fontFamily: fonts.bodyBold,
    fontSize: 8.5,
    color: colors.ink,
    marginTop: 2,
  },
  qrVpa: {
    fontFamily: fonts.body,
    fontSize: 8,
    color: colors.clayDeep,
  },
  invoiceBankCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    padding: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    minWidth: 140,
  },
  bankCardTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 9.5,
    color: colors.ink,
    marginBottom: 2,
  },
  bankCardBody: {
    fontFamily: fonts.body,
    fontSize: 9,
    color: colors.inkSoft,
    lineHeight: 13,
  },
  invoiceFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    gap: 12,
  },
  termsTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 9.5,
    color: colors.ink,
  },
  termsText: {
    fontFamily: fonts.body,
    fontSize: 8.5,
    color: colors.inkSoft,
    lineHeight: 12,
  },
  footerGreeting: {
    fontFamily: fonts.bodyBold,
    fontSize: 9.5,
    color: colors.clayDeep,
    marginTop: 4,
  },
  signatoryCard: {
    width: 130,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  signDivider: {
    width: '100%',
    height: 1,
    backgroundColor: '#94A3B8',
    marginBottom: 4,
  },
  signBusinessName: {
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    color: colors.ink,
    textAlign: 'center',
  },
  signDesignation: {
    fontFamily: fonts.body,
    fontSize: 8,
    color: colors.inkSoft,
    textAlign: 'center',
  },
});
