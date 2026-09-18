import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Platform,
  useWindowDimensions,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

import {
  InvoiceTemplateConfig,
  InvoiceTemplateId,
  PaperSize,
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

// Sample Order Data for Direct Live Preview
const SAMPLE_ORDER: Order = {
  id: 'sample_ord_1',
  orderNumber: 'INV-2026-0042',
  orderDate: new Date().toISOString(),
  customerName: 'Karthik Subramanian',
  phoneNumber: '9876543210',
  items: [
    {
      id: 'itm_1',
      name: 'Organic Traditional Rice',
      qty: 5,
      unit: 'kg',
      price: 120,
      taxRate: 5,
      hsnCode: '1006',
    },
    {
      id: 'itm_2',
      name: 'Cold Pressed Sesame Oil',
      qty: 2,
      unit: 'L',
      price: 340,
      taxRate: 5,
      hsnCode: '1508',
    },
    {
      id: 'itm_3',
      name: 'Natural Palm Jaggery',
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

export default function InvoiceTemplateCustomizerScreen() {
  const navigation = useNavigation();
  const { t } = useLanguage();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= 768;
  const hasParentSidebar = useContext(DesktopSidebarContext);

  const [config, setConfig] = useState<InvoiceTemplateConfig>(DEFAULT_INVOICE_TEMPLATE_CONFIG);
  const [bizProfile, setBizProfile] = useState<BusinessProfile>({
    businessName: 'KadaiBook Store',
    phone: '9876543210',
    email: 'contact@store.in',
    address: '124, Market Road, Near Clock Tower, City - 600001',
    gstin: '33AABCK1234F1Z5',
    tagline: 'Wholesale & Retail General Merchants',
    upiId: 'store@upi',
    bankDetails: 'State Bank of India\nA/C: 9876543210123\nIFSC: SBIN0001234\nBranch: Main Branch',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

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
          logoUri: bp.logoUri || prev.logoUri,
        }));
      }
    } catch (err) {
      console.error('Error loading template config:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePickLogo = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        showAppAlert(
          'Permission Needed',
          'Please allow photo library access to select a store logo image.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        let uri = asset.uri;
        if (asset.base64) {
          const mime = asset.mimeType || 'image/png';
          uri = `data:${mime};base64,${asset.base64}`;
        }
        setBizProfile((prev) => ({ ...prev, logoUri: uri }));
        setConfig((prev) => ({ ...prev, showLogo: true }));
      }
    } catch (err) {
      console.error('Error picking logo:', err);
      showAppAlert('Error', 'Could not open photo library.');
    }
  };

  const handleRemoveLogo = () => {
    setBizProfile((prev) => ({ ...prev, logoUri: undefined }));
    setConfig((prev) => ({ ...prev, showLogo: false }));
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
      message: 'Restore original standard bill template settings?',
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
            <Text style={styles.loadingText}>Loading Bill Studio…</Text>
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

  const presetsList: { id: InvoiceTemplateId; label: string; color: string }[] = [
    { id: 'modern_slate', label: 'Modern Slate', color: '#0F172A' },
    { id: 'terracotta', label: 'Warm Terracotta', color: '#C25D2C' },
    { id: 'gst_tax_invoice', label: 'GST Tax Invoice', color: '#1E3A8A' },
    { id: 'emerald', label: 'Forest Emerald', color: '#065F46' },
    { id: 'sapphire', label: 'Royal Sapphire', color: '#1D4ED8' },
    { id: 'ruby', label: 'Crimson Ruby', color: '#991B1B' },
    { id: 'classic', label: 'Classic Monochrome', color: '#334155' },
    { id: 'thermal_pos', label: 'POS Thermal (80mm)', color: '#18181B' },
  ];

  return (
    <DesktopLayout currentTabName="InvoiceTemplateCustomizer">
      <SafeAreaView style={styles.screen} edges={['top']}>
        {/* ─── Top Main Header Bar ─── */}
        <View style={styles.headerBar}>
          <GlassBackButton
            label={t('common.back', 'Back')}
            onPress={() => {
              if (navigation.canGoBack && navigation.canGoBack()) {
                navigation.goBack();
              } else {
                (navigation as any).navigate('MainTabs', { screen: 'DashboardTab' });
              }
            }}
          />
          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {t('settings.invoiceTemplate', 'Bill & Invoice Studio')}
            </Text>
          </View>

          <View style={styles.headerActions}>
            <Pressable
              style={({ pressed }) => [styles.resetActionBtn, pressed && { opacity: 0.7 }]}
              onPress={handleReset}
            >
              <Ionicons name="refresh" size={13} color={colors.inkSoft} />
              <Text style={styles.resetActionBtnText}>Reset</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.testPrintBtn, pressed && { opacity: 0.8 }]}
              onPress={handleTestPrint}
            >
              <Ionicons name="print-outline" size={13} color={colors.ink} />
              <Text style={styles.testPrintBtnText}>Test Print</Text>
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
                  <Ionicons name="checkmark-done" size={14} color={colors.white} />
                  <Text style={styles.saveBtnText}>Saved!</Text>
                </>
              ) : (
                <>
                  <Ionicons name="save-outline" size={14} color={colors.white} />
                  <Text style={styles.saveBtnText}>Save</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>

        {/* ─── Top Theme & Paper Style Switcher Ribbon ─── */}
        <View style={styles.paletteRibbon}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.paletteScroll}>
            <Text style={styles.paletteGroupLabel}>Theme:</Text>
            {presetsList.map((preset) => {
              const isSelected = config.templateId === preset.id;
              return (
                <Pressable
                  key={preset.id}
                  style={[
                    styles.themeChip,
                    isSelected && styles.themeChipActive,
                    { borderColor: isSelected ? preset.color : '#CBD5E1' },
                  ]}
                  onPress={() => handleApplyPreset(preset.id)}
                >
                  <View style={[styles.themeDot, { backgroundColor: preset.color }]} />
                  <Text style={[styles.themeChipText, isSelected && { fontFamily: fonts.bodyBold, color: colors.ink }]}>
                    {preset.label}
                  </Text>
                </Pressable>
              );
            })}

            <View style={styles.ribbonDivider} />

            <Text style={styles.paletteGroupLabel}>Paper Size:</Text>
            {[
              { id: 'a4', label: 'A4' },
              { id: 'a5', label: 'A5' },
              { id: 'thermal_80mm', label: '80mm POS' },
              { id: 'thermal_58mm', label: '58mm' },
            ].map((p) => {
              const isSelected = config.paperSize === p.id;
              return (
                <Pressable
                  key={p.id}
                  style={[styles.paperChip, isSelected && styles.paperChipActive]}
                  onPress={() => setConfig((prev) => ({ ...prev, paperSize: p.id as PaperSize }))}
                >
                  <Text style={[styles.paperChipText, isSelected && styles.paperChipTextActive]}>
                    {p.label}
                  </Text>
                </Pressable>
              );
            })}

            <View style={styles.ribbonDivider} />

            <Pressable
              style={[styles.compactTogglePill, config.compactMode && styles.compactTogglePillActive]}
              onPress={() => setConfig((p) => ({ ...p, compactMode: !p.compactMode }))}
            >
              <Ionicons
                name={config.compactMode ? 'contract' : 'expand'}
                size={13}
                color={config.compactMode ? colors.white : colors.inkSoft}
              />
              <Text style={[styles.compactToggleText, config.compactMode && styles.compactToggleTextActive]}>
                {config.compactMode ? 'Compact Margins: ON' : 'Compact Margins: OFF'}
              </Text>
            </Pressable>
          </ScrollView>
        </View>

        {/* ─── Main Direct On-Bill Interactive Canvas ─── */}
        <ScrollView
          style={styles.mainCanvasScroll}
          contentContainerStyle={styles.mainCanvasContent}
          showsVerticalScrollIndicator={false}
        >
          <FadeInView delay={40} translateY={10}>
            {/* ════ THE INTERACTIVE INVOICE SHEET ════ */}
            <View
              style={[
                styles.invoiceSheet,
                {
                  borderColor: config.cardBorderColor || '#CBD5E1',
                },
              ]}
            >
              {/* ───── 1. HEADER SECTION (Direct Editable) ───── */}
              <View
                style={[
                  styles.sheetHeader,
                  {
                    backgroundColor: config.headerBgColor || '#F8FAFC',
                    borderBottomColor: config.primaryColor,
                  },
                ]}
              >
                {/* Store Brand Section: Logo + Name, Tagline, Address, Phone, GSTIN */}
                <View style={styles.brandSectionWrap}>
                  {/* Store Logo Uploader / Preview */}
                  {config.showLogo && (
                    <View style={styles.logoPickerContainer}>
                      {bizProfile.logoUri ? (
                        <View style={styles.logoPreviewWrap}>
                          <Image source={{ uri: bizProfile.logoUri }} style={styles.logoImagePreview} resizeMode="contain" />
                          <View style={styles.logoActionOverlay}>
                            <Pressable style={styles.logoMiniBtn} onPress={handlePickLogo}>
                              <Ionicons name="camera" size={11} color="#FFFFFF" />
                            </Pressable>
                            <Pressable style={[styles.logoMiniBtn, { backgroundColor: '#EF4444' }]} onPress={handleRemoveLogo}>
                              <Ionicons name="close" size={11} color="#FFFFFF" />
                            </Pressable>
                          </View>
                        </View>
                      ) : (
                        <Pressable style={styles.logoPlaceholderBox} onPress={handlePickLogo}>
                          <Ionicons name="image-outline" size={20} color={config.primaryColor} />
                          <Text style={[styles.logoPlaceholderText, { color: config.primaryColor }]}>+ Add Logo</Text>
                        </Pressable>
                      )}
                    </View>
                  )}

                  <View style={{ flex: 1 }}>
                    <View style={styles.fieldWrap}>
                      <View style={styles.fieldHeaderRow}>
                        <Ionicons name="storefront-outline" size={11} color={colors.clayDeep} />
                        <Text style={styles.fieldGuideTag}>SHOP / BUSINESS NAME</Text>
                      </View>
                      <TextInput
                        style={[styles.inlineStoreNameInput, { color: config.headerTextColor || config.primaryColor }]}
                        value={bizProfile.businessName}
                        onChangeText={(v) => setBizProfile((p) => ({ ...p, businessName: v }))}
                        placeholder="Your Store Name"
                        placeholderTextColor="rgba(0,0,0,0.3)"
                      />
                    </View>

                    <View style={[styles.fieldWrap, { marginTop: 4 }]}>
                      <TextInput
                        style={styles.inlineTaglineInput}
                        value={bizProfile.tagline}
                        onChangeText={(v) => setBizProfile((p) => ({ ...p, tagline: v }))}
                        placeholder="Store Tagline / Wholesale & Retail"
                        placeholderTextColor="rgba(0,0,0,0.3)"
                      />
                    </View>

                    {config.showBusinessAddress && (
                      <View style={[styles.fieldWrap, { marginTop: 4 }]}>
                        <TextInput
                          style={styles.inlineAddressInput}
                          value={bizProfile.address}
                          onChangeText={(v) => setBizProfile((p) => ({ ...p, address: v }))}
                          placeholder="Store Address, City, Pincode"
                          placeholderTextColor="rgba(0,0,0,0.3)"
                          multiline
                        />
                      </View>
                    )}

                    <View style={styles.inlineContactsRow}>
                      {config.showBusinessPhone && (
                        <View style={[styles.fieldWrap, { flex: 1 }]}>
                          <TextInput
                            style={styles.inlineContactInput}
                            value={bizProfile.phone}
                            onChangeText={(v) => setBizProfile((p) => ({ ...p, phone: v }))}
                            placeholder="Phone: 9876543210"
                            placeholderTextColor="rgba(0,0,0,0.3)"
                            keyboardType="phone-pad"
                          />
                        </View>
                      )}

                      {config.showGstin && (
                        <View style={[styles.fieldWrap, { flex: 1.2 }]}>
                          <TextInput
                            style={[styles.inlineContactInput, styles.gstinField]}
                            value={bizProfile.gstin}
                            onChangeText={(v) => setBizProfile((p) => ({ ...p, gstin: v }))}
                            placeholder="GSTIN: 33AAAAA0000A1Z5"
                            placeholderTextColor="rgba(0,0,0,0.3)"
                            autoCapitalize="characters"
                          />
                        </View>
                      )}
                    </View>

                    {/* Header Visibility Toggles */}
                    <View style={styles.headerTogglesRow}>
                      <Pressable
                        style={[styles.miniToggleChip, config.showLogo && styles.miniToggleChipActive]}
                        onPress={() => {
                          if (!config.showLogo && !bizProfile.logoUri) {
                            handlePickLogo();
                          } else {
                            setConfig((p) => ({ ...p, showLogo: !p.showLogo }));
                          }
                        }}
                      >
                        <Ionicons
                          name={config.showLogo ? 'checkmark-circle' : 'add-circle-outline'}
                          size={12}
                          color={config.showLogo ? colors.clayDeep : colors.inkSoft}
                        />
                        <Text style={[styles.miniToggleChipText, config.showLogo && styles.miniToggleChipTextActive]}>
                          Logo
                        </Text>
                      </Pressable>

                      <Pressable
                        style={[styles.miniToggleChip, config.showBusinessAddress && styles.miniToggleChipActive]}
                        onPress={() => setConfig((p) => ({ ...p, showBusinessAddress: !p.showBusinessAddress }))}
                      >
                        <Ionicons
                          name={config.showBusinessAddress ? 'checkmark-circle' : 'close-circle'}
                          size={12}
                          color={config.showBusinessAddress ? colors.clayDeep : colors.inkSoft}
                        />
                        <Text style={[styles.miniToggleChipText, config.showBusinessAddress && styles.miniToggleChipTextActive]}>
                          Address
                        </Text>
                      </Pressable>

                      <Pressable
                        style={[styles.miniToggleChip, config.showBusinessPhone && styles.miniToggleChipActive]}
                        onPress={() => setConfig((p) => ({ ...p, showBusinessPhone: !p.showBusinessPhone }))}
                      >
                        <Ionicons
                          name={config.showBusinessPhone ? 'checkmark-circle' : 'close-circle'}
                          size={12}
                          color={config.showBusinessPhone ? colors.clayDeep : colors.inkSoft}
                        />
                        <Text style={[styles.miniToggleChipText, config.showBusinessPhone && styles.miniToggleChipTextActive]}>
                          Phone
                        </Text>
                      </Pressable>

                      <Pressable
                        style={[styles.miniToggleChip, config.showGstin && styles.miniToggleChipActive]}
                        onPress={() => setConfig((p) => ({ ...p, showGstin: !p.showGstin }))}
                      >
                        <Ionicons
                          name={config.showGstin ? 'checkmark-circle' : 'close-circle'}
                          size={12}
                          color={config.showGstin ? colors.clayDeep : colors.inkSoft}
                        />
                        <Text style={[styles.miniToggleChipText, config.showGstin && styles.miniToggleChipTextActive]}>
                          GSTIN
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                </View>

                {/* ───── Right Meta Box (Document Title, Bill #, Date) ───── */}
                <View style={styles.sheetHeaderRight}>
                  {/* Bill Title Badge (Directly Editable or Choice Pills) */}
                  <TextInput
                    style={[styles.inlineTitleBadgeInput, { backgroundColor: config.primaryColor }]}
                    value={config.invoiceTitle}
                    onChangeText={(v) => setConfig((p) => ({ ...p, invoiceTitle: v }))}
                    placeholder="TAX INVOICE"
                    placeholderTextColor="rgba(255,255,255,0.7)"
                    autoCapitalize="characters"
                  />

                  {/* Title Preset Quick Pills */}
                  <View style={styles.titleQuickPills}>
                    {['TAX INVOICE', 'CASH BILL', 'RETAIL INVOICE', 'ESTIMATE'].map((tName) => (
                      <Pressable
                        key={tName}
                        style={[styles.titleChoicePill, config.invoiceTitle === tName && styles.titleChoicePillActive]}
                        onPress={() => setConfig((p) => ({ ...p, invoiceTitle: tName }))}
                      >
                        <Text style={[styles.titleChoicePillText, config.invoiceTitle === tName && styles.titleChoicePillTextActive]}>
                          {tName}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  <View style={styles.invoiceMetaGroup}>
                    <Text style={styles.metaRowText}>
                      <Text style={{ fontFamily: fonts.bodyBold }}>Bill #:</Text> {SAMPLE_ORDER.orderNumber}
                    </Text>
                    <Text style={styles.metaRowText}>
                      <Text style={{ fontFamily: fonts.bodyBold }}>Date:</Text> {formatDate(SAMPLE_ORDER.orderDate)}
                    </Text>
                    <Text style={styles.metaRowText}>
                      <Text style={{ fontFamily: fonts.bodyBold }}>Place:</Text> Tamil Nadu (33)
                    </Text>
                  </View>
                </View>
              </View>

              {/* ───── 2. BUYER & CUSTOMER STRIP ───── */}
              <View style={styles.buyerDetailsStrip}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.buyerHeading}>{t('invoice.buyerDetails', 'BUYER / CUSTOMER DETAILS')}:</Text>
                  <Text style={styles.buyerCustomerName}>{SAMPLE_ORDER.customerName}</Text>
                  {config.showCustomerPhone && (
                    <Text style={styles.buyerCustomerPhone}>Mobile: {SAMPLE_ORDER.phoneNumber}</Text>
                  )}
                </View>

                <View style={styles.buyerStripRight}>
                  <Pressable
                    style={[styles.miniToggleChip, config.showCustomerPhone && styles.miniToggleChipActive]}
                    onPress={() => setConfig((p) => ({ ...p, showCustomerPhone: !p.showCustomerPhone }))}
                  >
                    <Ionicons
                      name={config.showCustomerPhone ? 'checkmark-circle' : 'close-circle'}
                      size={12}
                      color={config.showCustomerPhone ? colors.clayDeep : colors.inkSoft}
                    />
                    <Text style={[styles.miniToggleChipText, config.showCustomerPhone && styles.miniToggleChipTextActive]}>
                      Customer Phone
                    </Text>
                  </Pressable>

                  <View style={styles.partialPaidTag}>
                    <Ionicons name="checkmark-circle" size={12} color="#15803D" />
                    <Text style={styles.partialPaidTagText}>Partially Paid</Text>
                  </View>
                </View>
              </View>

              {/* ───── 3. TABLE COLUMNS QUICK TOGGLE RIBBON ───── */}
              <View style={styles.columnsSwitchBar}>
                <View style={styles.columnsSwitchLabelRow}>
                  <Ionicons name="grid-outline" size={13} color={colors.clayDeep} />
                  <Text style={styles.columnsSwitchTitle}>Table Columns (Tap to add/remove on bill):</Text>
                </View>
                <View style={styles.columnsChipsRow}>
                  {[
                    { key: 'showRate', label: 'Rate (Price)', val: config.showRate },
                    { key: 'showUnit', label: 'Unit (kg, pcs)', val: config.showUnit },
                    { key: 'showGSTRate', label: 'GST %', val: config.showGSTRate },
                    { key: 'showDiscount', label: 'Discount', val: config.showDiscount },
                    { key: 'showHsn', label: 'HSN Code', val: config.showHsn },
                    { key: 'showItemSerialNo', label: 'S.No (#)', val: config.showItemSerialNo },
                  ].map((col) => (
                    <Pressable
                      key={col.key}
                      style={[
                        styles.colChip,
                        col.val && styles.colChipActive,
                      ]}
                      onPress={() =>
                        setConfig((prev) => ({
                          ...prev,
                          [col.key]: !col.val,
                        }))
                      }
                    >
                      <Ionicons
                        name={col.val ? 'checkmark-circle' : 'add-circle-outline'}
                        size={13}
                        color={col.val ? colors.white : colors.inkSoft}
                      />
                      <Text
                        style={[
                          styles.colChipText,
                          col.val && styles.colChipTextActive,
                        ]}
                      >
                        {col.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* ───── 4. PRODUCT ITEMS TABLE ───── */}
              <View style={styles.tableWrap}>
                {/* Table Header Row */}
                <View style={[styles.tableHeader, { backgroundColor: config.primaryColor }]}>
                  {config.showItemSerialNo && (
                    <Text style={[styles.thCell, { width: 30 }]}>#</Text>
                  )}
                  <Text style={[styles.thCell, { flex: 2.2 }]}>Item Description</Text>
                  {config.showHsn && (
                    <Text style={[styles.thCell, { width: 48, textAlign: 'center' }]}>HSN</Text>
                  )}
                  <Text style={[styles.thCell, { width: 38, textAlign: 'center' }]}>Qty</Text>
                  {config.showUnit && (
                    <Text style={[styles.thCell, { width: 38, textAlign: 'center' }]}>Unit</Text>
                  )}
                  {config.showRate && (
                    <Text style={[styles.thCell, { width: 60, textAlign: 'right' }]}>Rate</Text>
                  )}
                  {config.showGSTRate && (
                    <Text style={[styles.thCell, { width: 44, textAlign: 'center' }]}>GST</Text>
                  )}
                  {config.showDiscount && (
                    <Text style={[styles.thCell, { width: 48, textAlign: 'right' }]}>Disc</Text>
                  )}
                  <Text style={[styles.thCell, { width: 70, textAlign: 'right' }]}>Total</Text>
                </View>

                {/* Table Body Rows */}
                {SAMPLE_ORDER.items.map((it, idx) => (
                  <View
                    key={it.id}
                    style={[
                      styles.tableRow,
                      idx % 2 === 1 && { backgroundColor: '#F8FAFC' },
                    ]}
                  >
                    {config.showItemSerialNo && (
                      <Text style={[styles.tdCell, { width: 30, color: colors.inkSoft }]}>{idx + 1}</Text>
                    )}
                    <Text style={[styles.tdCell, { flex: 2.2, fontFamily: fonts.bodyBold }]}>
                      {it.name}
                    </Text>
                    {config.showHsn && (
                      <Text style={[styles.tdCell, { width: 48, textAlign: 'center', fontSize: 10, color: colors.inkSoft }]}>
                        {it.hsnCode || '-'}
                      </Text>
                    )}
                    <Text style={[styles.tdCell, { width: 38, textAlign: 'center' }]}>{it.qty}</Text>
                    {config.showUnit && (
                      <Text style={[styles.tdCell, { width: 38, textAlign: 'center', color: colors.inkSoft }]}>
                        {it.unit || '-'}
                      </Text>
                    )}
                    {config.showRate && (
                      <Text style={[styles.tdCell, { width: 60, textAlign: 'right' }]}>
                        {formatCurrency(it.price)}
                      </Text>
                    )}
                    {config.showGSTRate && (
                      <Text style={[styles.tdCell, { width: 44, textAlign: 'center', fontSize: 10 }]}>
                        {it.taxRate ? `${it.taxRate}%` : '0%'}
                      </Text>
                    )}
                    {config.showDiscount && (
                      <Text style={[styles.tdCell, { width: 48, textAlign: 'right', color: colors.inflow, fontSize: 10 }]}>
                        {it.discount ? `-₹${it.discount}` : '-'}
                      </Text>
                    )}
                    <Text style={[styles.tdCell, { width: 70, textAlign: 'right', fontFamily: fonts.bodyBold }]}>
                      {formatCurrency(it.qty * it.price - (it.discount || 0))}
                    </Text>
                  </View>
                ))}
              </View>

              {/* ───── 5. TOTALS & SUMMARY SECTION ───── */}
              <View style={styles.totalsSection}>
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={styles.amountWordsTitle}>Amount in Words:</Text>
                  <Text style={styles.amountWordsValue}>One Thousand Four Hundred and Forty Rupees Only</Text>

                  {/* Notes / Special Instructions */}
                  <View style={{ marginTop: 10 }}>
                    <Text style={styles.notesTitle}>Customer Note / Instructions:</Text>
                    <Text style={styles.notesText}>{SAMPLE_ORDER.customerNote}</Text>
                  </View>
                </View>

                <View style={styles.totalsCard}>
                  <View style={styles.calcRow}>
                    <Text style={styles.calcLabel}>Subtotal:</Text>
                    <Text style={styles.calcVal}>{formatCurrency(subtotalAmount)}</Text>
                  </View>
                  {discountAmount > 0 && (
                    <View style={styles.calcRow}>
                      <Text style={[styles.calcLabel, { color: colors.inflow }]}>Discount:</Text>
                      <Text style={[styles.calcVal, { color: colors.inflow }]}>-{formatCurrency(discountAmount)}</Text>
                    </View>
                  )}
                  {config.showGSTRate && (
                    <>
                      <View style={styles.calcRow}>
                        <Text style={styles.calcLabel}>CGST (2.5%):</Text>
                        <Text style={styles.calcVal}>+{formatCurrency(cgstAmount)}</Text>
                      </View>
                      <View style={styles.calcRow}>
                        <Text style={styles.calcLabel}>SGST (2.5%):</Text>
                        <Text style={styles.calcVal}>+{formatCurrency(sgstAmount)}</Text>
                      </View>
                    </>
                  )}
                  <View style={styles.calcRowTotal}>
                    <Text style={styles.calcTotalLabel}>Grand Total:</Text>
                    <Text style={styles.calcTotalVal}>{formatCurrency(grandTotal)}</Text>
                  </View>
                  <View style={styles.calcRow}>
                    <Text style={[styles.calcLabel, { color: colors.inflow }]}>Advance Paid:</Text>
                    <Text style={[styles.calcVal, { color: colors.inflow }]}>{formatCurrency(advancePaid)}</Text>
                  </View>
                  <View style={styles.calcRowBalance}>
                    <Text style={styles.calcBalanceLabel}>Balance Due:</Text>
                    <Text style={styles.calcBalanceVal}>{formatCurrency(balanceDue)}</Text>
                  </View>
                </View>
              </View>

              {/* ───── 6. BANK & UPI QR PAYMENT SECTION (Direct Editable) ───── */}
              <View style={styles.paymentContainer}>
                <View style={styles.paymentHeaderRow}>
                  <Text style={styles.paymentSectionHeading}>Payment & Bank Transfer Details</Text>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <Pressable
                      style={[styles.miniToggleChip, config.showUpiQr && styles.miniToggleChipActive]}
                      onPress={() => setConfig((p) => ({ ...p, showUpiQr: !p.showUpiQr }))}
                    >
                      <Ionicons
                        name={config.showUpiQr ? 'checkmark-circle' : 'close-circle'}
                        size={12}
                        color={config.showUpiQr ? colors.clayDeep : colors.inkSoft}
                      />
                      <Text style={[styles.miniToggleChipText, config.showUpiQr && styles.miniToggleChipTextActive]}>
                        UPI QR Code
                      </Text>
                    </Pressable>

                    <Pressable
                      style={[styles.miniToggleChip, config.showBankDetails && styles.miniToggleChipActive]}
                      onPress={() => setConfig((p) => ({ ...p, showBankDetails: !p.showBankDetails }))}
                    >
                      <Ionicons
                        name={config.showBankDetails ? 'checkmark-circle' : 'close-circle'}
                        size={12}
                        color={config.showBankDetails ? colors.clayDeep : colors.inkSoft}
                      />
                      <Text style={[styles.miniToggleChipText, config.showBankDetails && styles.miniToggleChipTextActive]}>
                        Bank A/C
                      </Text>
                    </Pressable>
                  </View>
                </View>

                <View style={styles.paymentInnerRow}>
                  {config.showUpiQr && (
                    <View style={styles.qrCardBox}>
                      <View style={styles.qrIconFrame}>
                        <Ionicons name="qr-code" size={44} color={config.primaryColor} />
                      </View>
                      <Text style={styles.qrLabel}>Scan with GPay / PhonePe</Text>
                      <TextInput
                        style={styles.inlineUpiInput}
                        value={config.upiId || bizProfile.upiId}
                        onChangeText={(v) => {
                          setConfig((p) => ({ ...p, upiId: v }));
                          setBizProfile((p) => ({ ...p, upiId: v }));
                        }}
                        placeholder="yourstore@upi"
                        placeholderTextColor={colors.inkSoft}
                        autoCapitalize="none"
                      />
                    </View>
                  )}

                  {config.showBankDetails && (
                    <View style={styles.bankCardBox}>
                      <Text style={styles.bankBoxTitle}>🏦 Bank Account Information:</Text>
                      <TextInput
                        style={styles.inlineBankInput}
                        value={config.bankDetailsCustom || bizProfile.bankDetails}
                        onChangeText={(v) => {
                          setConfig((p) => ({ ...p, bankDetailsCustom: v }));
                          setBizProfile((p) => ({ ...p, bankDetails: v }));
                        }}
                        placeholder="Bank Name, A/C Number, IFSC Code, Branch"
                        placeholderTextColor={colors.inkSoft}
                        multiline
                      />
                    </View>
                  )}

                  {!config.showUpiQr && !config.showBankDetails && (
                    <Text style={styles.noPaymentText}>
                      UPI QR Code and Bank details are currently turned off. Click the toggle buttons above to enable.
                    </Text>
                  )}
                </View>
              </View>

              {/* ───── 7. TERMS & CONDITIONS AND SIGNATORY (Direct Editable) ───── */}
              <View style={styles.footerTermsSection}>
                <View style={{ flex: 1.4 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={styles.termsBoxTitle}>Terms & Conditions:</Text>
                    <Pressable
                      style={[styles.miniToggleChip, config.showTerms && styles.miniToggleChipActive]}
                      onPress={() => setConfig((p) => ({ ...p, showTerms: !p.showTerms }))}
                    >
                      <Ionicons
                        name={config.showTerms ? 'checkmark-circle' : 'close-circle'}
                        size={12}
                        color={config.showTerms ? colors.clayDeep : colors.inkSoft}
                      />
                      <Text style={[styles.miniToggleChipText, config.showTerms && styles.miniToggleChipTextActive]}>
                        Show Terms
                      </Text>
                    </Pressable>
                  </View>

                  {config.showTerms ? (
                    <TextInput
                      style={styles.inlineTermsInput}
                      value={config.termsAndConditions}
                      onChangeText={(v) => setConfig((p) => ({ ...p, termsAndConditions: v }))}
                      placeholder="1. Goods once sold will not be taken back.\n2. Warranty as per manufacturer terms."
                      placeholderTextColor={colors.inkSoft}
                      multiline
                    />
                  ) : (
                    <Text style={{ fontSize: 10, color: colors.inkSoft, fontStyle: 'italic' }}>Terms are hidden</Text>
                  )}

                  <View style={{ marginTop: 8 }}>
                    <TextInput
                      style={[styles.inlineFooterGreetingInput, { color: config.primaryColor }]}
                      value={config.footerMessage}
                      onChangeText={(v) => setConfig((p) => ({ ...p, footerMessage: v }))}
                      placeholder="Thank you for your business! Visit again."
                      placeholderTextColor={colors.inkSoft}
                    />
                  </View>
                </View>

                {/* Authorized Signatory Card */}
                <View style={styles.signatoryCard}>
                  <Pressable
                    style={[styles.miniToggleChip, config.showSignatory && styles.miniToggleChipActive, { alignSelf: 'center', marginBottom: 4 }]}
                    onPress={() => setConfig((p) => ({ ...p, showSignatory: !p.showSignatory }))}
                  >
                    <Ionicons
                      name={config.showSignatory ? 'checkmark-circle' : 'close-circle'}
                      size={12}
                      color={config.showSignatory ? colors.clayDeep : colors.inkSoft}
                    />
                    <Text style={[styles.miniToggleChipText, config.showSignatory && styles.miniToggleChipTextActive]}>
                      Signatory Seal
                    </Text>
                  </Pressable>

                  {config.showSignatory && (
                    <View style={styles.signatoryBoxInner}>
                      <View style={styles.signatoryLine} />
                      <Text style={styles.signatoryStoreName} numberOfLines={1}>
                        For {bizProfile.businessName || 'Store'}
                      </Text>
                      <TextInput
                        style={styles.inlineSignatoryInput}
                        value={config.signatoryTitle}
                        onChangeText={(v) => setConfig((p) => ({ ...p, signatoryTitle: v }))}
                        placeholder="Authorized Signatory"
                        placeholderTextColor={colors.inkSoft}
                      />
                    </View>
                  )}
                </View>
              </View>
            </View>
          </FadeInView>
        </ScrollView>
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  resetActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 7,
    borderRadius: radius.sm,
  },
  resetActionBtnText: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.inkSoft,
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
  paletteRibbon: {
    backgroundColor: colors.paperCard,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  paletteScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  paletteGroupLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: colors.inkSoft,
    marginRight: 2,
  },
  themeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 14,
    backgroundColor: colors.paper,
    borderWidth: 1,
  },
  themeChipActive: {
    backgroundColor: '#FAF5EE',
  },
  themeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  themeChipText: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.inkSoft,
  },
  ribbonDivider: {
    width: 1,
    height: 18,
    backgroundColor: colors.line,
    marginHorizontal: 4,
  },
  paperChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
  },
  paperChipActive: {
    backgroundColor: colors.clayLight,
    borderColor: colors.clayDeep,
  },
  paperChipText: {
    fontFamily: fonts.body,
    fontSize: 10.5,
    color: colors.ink,
  },
  paperChipTextActive: {
    fontFamily: fonts.bodyBold,
    color: colors.clayDeep,
  },
  compactTogglePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
  },
  compactTogglePillActive: {
    backgroundColor: colors.clayDeep,
    borderColor: colors.clayDeep,
  },
  compactToggleText: {
    fontFamily: fonts.body,
    fontSize: 10.5,
    color: colors.inkSoft,
  },
  compactToggleTextActive: {
    fontFamily: fonts.bodyBold,
    color: colors.white,
  },

  /* ════ CANVAS WORKSPACE ════ */
  mainCanvasScroll: {
    flex: 1,
    backgroundColor: '#EEF2F6',
  },
  mainCanvasContent: {
    padding: 16,
    alignItems: 'center',
    paddingBottom: 60,
  },

  /* ════ REALISTIC INVOICE SHEET ════ */
  invoiceSheet: {
    width: '100%',
    maxWidth: 680,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1.5,
    ...shadow.card,
    elevation: 4,
    overflow: 'hidden',
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 2,
    gap: 12,
  },
  brandSectionWrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    flex: 1.6,
  },
  logoPickerContainer: {
    marginTop: 2,
  },
  logoPreviewWrap: {
    position: 'relative',
    width: 62,
    height: 62,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.card,
  },
  logoImagePreview: {
    width: '100%',
    height: '100%',
  },
  logoActionOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingVertical: 2,
  },
  logoMiniBtn: {
    padding: 3,
    borderRadius: 3,
  },
  logoPlaceholderBox: {
    width: 62,
    height: 62,
    borderRadius: 8,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#94A3B8',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
    ...shadow.card,
  },
  logoPlaceholderText: {
    fontFamily: fonts.bodyBold,
    fontSize: 8,
    textAlign: 'center',
    marginTop: 2,
  },
  fieldWrap: {
    position: 'relative',
  },
  fieldHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  fieldGuideTag: {
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    color: colors.clayDeep,
    letterSpacing: 0.5,
  },
  inlineStoreNameInput: {
    fontFamily: fonts.bodyBold,
    fontSize: 18,
    letterSpacing: 0.3,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    ...shadow.card,
  },
  inlineTaglineInput: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.inkSoft,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  inlineAddressInput: {
    fontFamily: fonts.body,
    fontSize: 10.5,
    color: colors.ink,
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    backgroundColor: 'rgba(255,255,255,0.85)',
    lineHeight: 14,
  },
  inlineContactsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  inlineContactInput: {
    fontFamily: fonts.body,
    fontSize: 10.5,
    color: colors.ink,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  gstinField: {
    fontFamily: fonts.bodyBold,
    color: colors.clayDeep,
  },
  headerTogglesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  miniToggleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  miniToggleChipActive: {
    backgroundColor: '#FAF5EE',
    borderColor: colors.clayDeep,
  },
  miniToggleChipText: {
    fontFamily: fonts.body,
    fontSize: 9.5,
    color: colors.inkSoft,
  },
  miniToggleChipTextActive: {
    fontFamily: fonts.bodyBold,
    color: colors.clayDeep,
  },

  /* Header Right */
  sheetHeaderRight: {
    alignItems: 'flex-end',
    minWidth: 140,
  },
  inlineTitleBadgeInput: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: colors.white,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    textAlign: 'center',
    letterSpacing: 0.8,
  },
  titleQuickPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 3,
    marginTop: 4,
    marginBottom: 6,
    maxWidth: 150,
  },
  titleChoicePill: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  titleChoicePillActive: {
    backgroundColor: colors.clayLight,
    borderColor: colors.clayDeep,
  },
  titleChoicePillText: {
    fontFamily: fonts.body,
    fontSize: 8.5,
    color: colors.ink,
  },
  titleChoicePillTextActive: {
    fontFamily: fonts.bodyBold,
    color: colors.clayDeep,
  },
  invoiceMetaGroup: {
    alignItems: 'flex-end',
    gap: 1,
  },
  metaRowText: {
    fontFamily: fonts.body,
    fontSize: 10.5,
    color: colors.ink,
  },

  /* Buyer Strip */
  buyerDetailsStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  buyerHeading: {
    fontFamily: fonts.body,
    fontSize: 9.5,
    color: colors.inkSoft,
  },
  buyerCustomerName: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: colors.ink,
  },
  buyerCustomerPhone: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.inkSoft,
  },
  buyerStripRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  partialPaidTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  partialPaidTagText: {
    fontFamily: fonts.bodyBold,
    fontSize: 9.5,
    color: '#15803D',
  },

  /* Column Switcher Bar */
  columnsSwitchBar: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  columnsSwitchLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  columnsSwitchTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 10.5,
    color: colors.ink,
  },
  columnsChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  colChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  colChipActive: {
    backgroundColor: colors.clayDeep,
    borderColor: colors.clayDeep,
  },
  colChipText: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.ink,
  },
  colChipTextActive: {
    fontFamily: fonts.bodyBold,
    color: colors.white,
  },

  /* Table */
  tableWrap: {
    padding: 10,
  },
  tableHeader: {
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
  tableRow: {
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

  /* Totals Section */
  totalsSection: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: '#FAFAFA',
  },
  amountWordsTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 9.5,
    color: colors.inkSoft,
  },
  amountWordsValue: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.ink,
    fontStyle: 'italic',
    marginTop: 1,
  },
  notesTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 9.5,
    color: colors.inkSoft,
  },
  notesText: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.ink,
    marginTop: 1,
  },
  totalsCard: {
    width: 220,
    gap: 2,
  },
  calcRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  calcLabel: {
    fontFamily: fonts.body,
    fontSize: 10.5,
    color: colors.ink,
  },
  calcVal: {
    fontFamily: fonts.bodyBold,
    fontSize: 10.5,
    color: colors.ink,
  },
  calcRowTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1.5,
    borderTopColor: '#CBD5E1',
    paddingTop: 4,
    marginTop: 2,
  },
  calcTotalLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 11.5,
    color: colors.ink,
  },
  calcTotalVal: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: colors.ink,
  },
  calcRowBalance: {
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
  calcBalanceLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 10.5,
    color: colors.danger,
  },
  calcBalanceVal: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: colors.danger,
  },

  /* Bank & UPI QR Payment Section */
  paymentContainer: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  paymentHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  paymentSectionHeading: {
    fontFamily: fonts.bodyBold,
    fontSize: 10.5,
    color: colors.ink,
  },
  paymentInnerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 4,
  },
  qrCardBox: {
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    minWidth: 110,
  },
  qrIconFrame: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 8.5,
    color: colors.ink,
    marginTop: 2,
  },
  inlineUpiInput: {
    fontFamily: fonts.body,
    fontSize: 8.5,
    color: colors.clayDeep,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
    marginTop: 2,
    textAlign: 'center',
  },
  bankCardBox: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    padding: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    minWidth: 140,
  },
  bankBoxTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 9.5,
    color: colors.ink,
    marginBottom: 2,
  },
  inlineBankInput: {
    fontFamily: fonts.body,
    fontSize: 9,
    color: colors.ink,
    lineHeight: 13,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
  noPaymentText: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.inkSoft,
    fontStyle: 'italic',
    paddingVertical: 4,
  },

  /* Footer Terms & Signature */
  footerTermsSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    gap: 12,
  },
  termsBoxTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 9.5,
    color: colors.ink,
  },
  inlineTermsInput: {
    fontFamily: fonts.body,
    fontSize: 8.5,
    color: colors.ink,
    lineHeight: 12,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 4,
    backgroundColor: '#F8FAFC',
  },
  inlineFooterGreetingInput: {
    fontFamily: fonts.bodyBold,
    fontSize: 9.5,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 4,
    backgroundColor: '#F8FAFC',
  },
  signatoryCard: {
    width: 130,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  signatoryBoxInner: {
    width: '100%',
    alignItems: 'center',
    marginTop: 4,
  },
  signatoryLine: {
    width: '100%',
    height: 1,
    backgroundColor: '#94A3B8',
    marginBottom: 4,
  },
  signatoryStoreName: {
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    color: colors.ink,
    textAlign: 'center',
  },
  inlineSignatoryInput: {
    fontFamily: fonts.body,
    fontSize: 8,
    color: colors.inkSoft,
    textAlign: 'center',
    paddingHorizontal: 2,
    paddingVertical: 1,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 3,
    backgroundColor: '#F8FAFC',
    marginTop: 2,
  },
});
