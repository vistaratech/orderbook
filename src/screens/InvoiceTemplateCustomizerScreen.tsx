import React, { useState, useEffect, useContext, useMemo } from 'react';
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
  Switch,
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
import { showAppAlert, confirmAction } from '../utils/dialog';
import { triggerGlobalSubscriptionModal } from '../context/SubscriptionModalContext';
import FadeInView from '../components/FadeInView';

// Sample Order Data for Real Live WYSIWYG Preview
const SAMPLE_ORDER: Order = {
  id: 'sample_ord_1',
  orderNumber: '#0012',
  orderDate: new Date().toISOString(),
  customerName: 'yohesh',
  phoneNumber: '8883388365',
  items: [
    {
      id: 'itm_1',
      name: 'Sengaruppu',
      qty: 3,
      unit: 'pcs',
      price: 7000,
      taxRate: 0,
      discount: 0,
      hsnCode: '',
    },
  ],
  advance: 8000,
  paymentMethod: 'UPI',
  paymentStatus: 'Partial',
  status: 'Placed',
  customerNote: 'Pathu kondu ponum',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

type ActiveCustomizerTab = 'preview' | 'store' | 'columns' | 'payment' | 'terms';

export default function InvoiceTemplateCustomizerScreen() {
  const navigation = useNavigation();
  const { t } = useLanguage();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= 1024;
  const isTablet = Platform.OS === 'web' && width >= 768 && width < 1024;

  const [config, setConfig] = useState<InvoiceTemplateConfig>(DEFAULT_INVOICE_TEMPLATE_CONFIG);
  const [bizProfile, setBizProfile] = useState<BusinessProfile>({
    businessName: 'Sri vaari cotton',
    phone: '8883388365',
    email: 'contact@srivaaricotton.com',
    address: '143a kaliyam puthur vijayamangalam',
    gstin: '33AABCK1234F1Z5',
    tagline: 'Quality Products & Services',
    upiId: 'srivaaricotton@upi',
    bankDetails: 'State Bank of India\nA/C: 9876543210123\nIFSC: SBIN0001234\nBranch: Vijayamangalam',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveCustomizerTab>('preview');
  const [openSection, setOpenSection] = useState<'store' | 'columns' | 'payment' | 'terms'>('store');

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
    if (config.templateId !== 'modern_slate') {
      const isPro = await checkProStatus();
      if (!isPro) {
        triggerGlobalSubscriptionModal({
          title: '👑 Pro Invoice Templates',
          message:
            'Customizing bill presets, colors, custom logos, signatures, and UPI QR codes on invoices is a Pro feature.\n\nUpgrade starting from just ₹99/mo for complete invoice styling & brand freedom!',
          actionName: 'save custom bill designs',
          onUpgrade: () => (navigation as any).navigate('PaywallScreen'),
        });
        return;
      }
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

  // Generate live WYSIWYG HTML exactly identical to the Invoice Preview screen
  const invoiceHtml = useMemo(() => {
    return generatePrintableInvoiceHtml(SAMPLE_ORDER, bizProfile, config);
  }, [bizProfile, config]);

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

  // ─── Render Editor Settings Cards ───
  const renderSettingsContent = () => (
    <View style={styles.settingsScrollContent}>
      {/* 1. Store Profile & Branding Accordion */}
      <View style={styles.settingsCard}>
        <Pressable
          style={styles.settingsCardHeader}
          onPress={() => setOpenSection(openSection === 'store' ? 'columns' : 'store')}
        >
          <View style={styles.settingsCardHeaderLeft}>
            <View style={[styles.sectionIconWrap, { backgroundColor: '#EFF6FF' }]}>
              <Ionicons name="storefront" size={17} color="#2563EB" />
            </View>
            <View>
              <Text style={styles.settingsCardTitle}>Store Profile & Logo</Text>
              <Text style={styles.settingsCardSub}>Shop name, phone, address & GSTIN</Text>
            </View>
          </View>
          <Ionicons
            name={openSection === 'store' ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={colors.inkSoft}
          />
        </Pressable>

        {openSection === 'store' && (
          <View style={styles.settingsCardBody}>
            {/* Logo Uploader */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Store Logo</Text>
              <View style={styles.logoRow}>
                {bizProfile.logoUri ? (
                  <View style={styles.logoPreviewBox}>
                    <Image source={{ uri: bizProfile.logoUri }} style={styles.logoThumb} resizeMode="contain" />
                    <Pressable style={styles.removeLogoBtn} onPress={handleRemoveLogo}>
                      <Ionicons name="trash" size={14} color="#FFFFFF" />
                    </Pressable>
                  </View>
                ) : (
                  <Pressable style={styles.uploadLogoBtn} onPress={handlePickLogo}>
                    <Ionicons name="image-outline" size={20} color={colors.clayDeep} />
                    <Text style={styles.uploadLogoBtnText}>+ Upload Shop Logo</Text>
                  </Pressable>
                )}
                <View style={styles.switchRowInline}>
                  <Text style={styles.switchLabelInline}>Show Logo on Bill</Text>
                  <Switch
                    value={config.showLogo}
                    onValueChange={(v) => setConfig((p) => ({ ...p, showLogo: v }))}
                    trackColor={{ false: '#CBD5E1', true: colors.clayDeep }}
                    thumbColor="#FFFFFF"
                  />
                </View>
              </View>
            </View>

            {/* Shop Name */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Store / Business Name *</Text>
              <TextInput
                style={styles.textInput}
                value={bizProfile.businessName}
                onChangeText={(v) => setBizProfile((p) => ({ ...p, businessName: v }))}
                placeholder="e.g. Sri Vaari Cotton"
                placeholderTextColor={colors.inkSoft}
              />
            </View>

            {/* Tagline */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Tagline / Business Subtitle</Text>
              <TextInput
                style={styles.textInput}
                value={bizProfile.tagline}
                onChangeText={(v) => setBizProfile((p) => ({ ...p, tagline: v }))}
                placeholder="e.g. Quality Products & Services"
                placeholderTextColor={colors.inkSoft}
              />
            </View>

            {/* Address */}
            <View style={styles.inputGroup}>
              <View style={styles.inputLabelRow}>
                <Text style={styles.inputLabel}>Store Address</Text>
                <View style={styles.miniSwitchWrap}>
                  <Text style={styles.miniSwitchLabel}>Show</Text>
                  <Switch
                    value={config.showBusinessAddress}
                    onValueChange={(v) => setConfig((p) => ({ ...p, showBusinessAddress: v }))}
                    trackColor={{ false: '#CBD5E1', true: colors.clayDeep }}
                    thumbColor="#FFFFFF"
                  />
                </View>
              </View>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={bizProfile.address}
                onChangeText={(v) => setBizProfile((p) => ({ ...p, address: v }))}
                placeholder="143a, Kaliyam Puthur, Vijayamangalam"
                placeholderTextColor={colors.inkSoft}
                multiline
                numberOfLines={2}
              />
            </View>

            {/* Phone & GSTIN in 2 Columns */}
            <View style={styles.twoColRow}>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <View style={styles.inputLabelRow}>
                  <Text style={styles.inputLabel}>Phone</Text>
                  <Switch
                    value={config.showBusinessPhone}
                    onValueChange={(v) => setConfig((p) => ({ ...p, showBusinessPhone: v }))}
                    trackColor={{ false: '#CBD5E1', true: colors.clayDeep }}
                    thumbColor="#FFFFFF"
                  />
                </View>
                <TextInput
                  style={styles.textInput}
                  value={bizProfile.phone}
                  onChangeText={(v) => setBizProfile((p) => ({ ...p, phone: v }))}
                  placeholder="8883388365"
                  placeholderTextColor={colors.inkSoft}
                  keyboardType="phone-pad"
                />
              </View>

              <View style={[styles.inputGroup, { flex: 1.2 }]}>
                <View style={styles.inputLabelRow}>
                  <Text style={styles.inputLabel}>GSTIN</Text>
                  <Switch
                    value={config.showGstin}
                    onValueChange={(v) => setConfig((p) => ({ ...p, showGstin: v }))}
                    trackColor={{ false: '#CBD5E1', true: colors.clayDeep }}
                    thumbColor="#FFFFFF"
                  />
                </View>
                <TextInput
                  style={[styles.textInput, { fontFamily: fonts.bodyBold, letterSpacing: 0.5 }]}
                  value={bizProfile.gstin}
                  onChangeText={(v) => setBizProfile((p) => ({ ...p, gstin: v }))}
                  placeholder="33AABCK1234F1Z5"
                  placeholderTextColor={colors.inkSoft}
                  autoCapitalize="characters"
                />
              </View>
            </View>

            {/* Document Title Quick Pills */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Bill Heading / Document Title</Text>
              <TextInput
                style={styles.textInput}
                value={config.invoiceTitle}
                onChangeText={(v) => setConfig((p) => ({ ...p, invoiceTitle: v }))}
                placeholder="TAX INVOICE"
                placeholderTextColor={colors.inkSoft}
                autoCapitalize="characters"
              />
              <View style={styles.quickPillsRow}>
                {['TAX INVOICE', 'CASH BILL', 'RETAIL INVOICE', 'BILL OF SUPPLY', 'ESTIMATE'].map((tName) => (
                  <Pressable
                    key={tName}
                    style={[styles.quickPill, config.invoiceTitle === tName && styles.quickPillActive]}
                    onPress={() => setConfig((p) => ({ ...p, invoiceTitle: tName }))}
                  >
                    <Text
                      style={[
                        styles.quickPillText,
                        config.invoiceTitle === tName && styles.quickPillTextActive,
                      ]}
                    >
                      {tName}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
        )}
      </View>

      {/* 2. Table Columns & Fields Visibility */}
      <View style={styles.settingsCard}>
        <Pressable
          style={styles.settingsCardHeader}
          onPress={() => setOpenSection(openSection === 'columns' ? 'payment' : 'columns')}
        >
          <View style={styles.settingsCardHeaderLeft}>
            <View style={[styles.sectionIconWrap, { backgroundColor: '#FDF2F8' }]}>
              <Ionicons name="grid" size={17} color="#BE123C" />
            </View>
            <View>
              <Text style={styles.settingsCardTitle}>Table Columns & Details</Text>
              <Text style={styles.settingsCardSub}>HSN, Qty, Unit, Rate, GST %, Discount</Text>
            </View>
          </View>
          <Ionicons
            name={openSection === 'columns' ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={colors.inkSoft}
          />
        </Pressable>

        {openSection === 'columns' && (
          <View style={styles.settingsCardBody}>
            <Text style={styles.settingsHelperText}>
              Turn on the columns you need on your printed invoice. Unused columns will be neatly hidden.
            </Text>

            <View style={styles.switchList}>
              {[
                { key: 'showItemSerialNo', label: 'Item Serial Number (#)', desc: 'Show 1, 2, 3 row numbers' },
                { key: 'showRate', label: 'Rate (Unit Price)', desc: 'Show price per item on the row' },
                { key: 'showUnit', label: 'Measurement Unit', desc: 'Show kg, pcs, box, meter' },
                { key: 'showHsn', label: 'HSN / SAC Code', desc: 'Display GST tariff classification' },
                { key: 'showGSTRate', label: 'GST Rate %', desc: 'Display 5%, 12%, 18% tax breakdown' },
                { key: 'showDiscount', label: 'Item Discount', desc: 'Show discount amount column' },
                { key: 'showCustomerPhone', label: 'Customer Mobile Number', desc: 'Show buyer phone under name' },
                { key: 'showNotes', label: 'Customer Notes & Instructions', desc: 'Show delivery note on bill' },
              ].map((item) => {
                const isChecked = Boolean((config as any)[item.key]);
                return (
                  <View key={item.key} style={styles.switchListItem}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.switchListTitle}>{item.label}</Text>
                      <Text style={styles.switchListDesc}>{item.desc}</Text>
                    </View>
                    <Switch
                      value={isChecked}
                      onValueChange={(val) =>
                        setConfig((prev) => ({
                          ...prev,
                          [item.key]: val,
                        }))
                      }
                      trackColor={{ false: '#CBD5E1', true: colors.clayDeep }}
                      thumbColor="#FFFFFF"
                    />
                  </View>
                );
              })}
            </View>
          </View>
        )}
      </View>

      {/* 3. UPI QR & Payment Details */}
      <View style={styles.settingsCard}>
        <Pressable
          style={styles.settingsCardHeader}
          onPress={() => setOpenSection(openSection === 'payment' ? 'terms' : 'payment')}
        >
          <View style={styles.settingsCardHeaderLeft}>
            <View style={[styles.sectionIconWrap, { backgroundColor: '#F0FDF4' }]}>
              <Ionicons name="qr-code" size={17} color="#15803D" />
            </View>
            <View>
              <Text style={styles.settingsCardTitle}>Payment & UPI QR Code</Text>
              <Text style={styles.settingsCardSub}>GPay/PhonePe scan QR & Bank Account info</Text>
            </View>
          </View>
          <Ionicons
            name={openSection === 'payment' ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={colors.inkSoft}
          />
        </Pressable>

        {openSection === 'payment' && (
          <View style={styles.settingsCardBody}>
            <View style={styles.switchListItem}>
              <View style={{ flex: 1 }}>
                <Text style={styles.switchListTitle}>Show UPI Payment QR Code</Text>
                <Text style={styles.switchListDesc}>Generates a scannable UPI QR for instant customer payment</Text>
              </View>
              <Switch
                value={config.showUpiQr}
                onValueChange={(v) => setConfig((p) => ({ ...p, showUpiQr: v }))}
                trackColor={{ false: '#CBD5E1', true: colors.clayDeep }}
                thumbColor="#FFFFFF"
              />
            </View>

            {config.showUpiQr && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>UPI ID (VPA)</Text>
                <TextInput
                  style={styles.textInput}
                  value={config.upiId || bizProfile.upiId}
                  onChangeText={(v) => {
                    setConfig((p) => ({ ...p, upiId: v }));
                    setBizProfile((p) => ({ ...p, upiId: v }));
                  }}
                  placeholder="e.g. 8883388365@upi or store@okaxis"
                  placeholderTextColor={colors.inkSoft}
                  autoCapitalize="none"
                />
              </View>
            )}

            <View style={[styles.switchListItem, { marginTop: 12 }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.switchListTitle}>Show Bank Account Information</Text>
                <Text style={styles.switchListDesc}>Bank Name, Account #, IFSC code for NEFT / RTGS</Text>
              </View>
              <Switch
                value={config.showBankDetails}
                onValueChange={(v) => setConfig((p) => ({ ...p, showBankDetails: v }))}
                trackColor={{ false: '#CBD5E1', true: colors.clayDeep }}
                thumbColor="#FFFFFF"
              />
            </View>

            {config.showBankDetails && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Bank Details</Text>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  value={config.bankDetailsCustom || bizProfile.bankDetails}
                  onChangeText={(v) => {
                    setConfig((p) => ({ ...p, bankDetailsCustom: v }));
                    setBizProfile((p) => ({ ...p, bankDetails: v }));
                  }}
                  placeholder="Bank: State Bank of India&#10;A/C: 9876543210123&#10;IFSC: SBIN0001234&#10;Branch: City Center"
                  placeholderTextColor={colors.inkSoft}
                  multiline
                  numberOfLines={4}
                />
              </View>
            )}
          </View>
        )}
      </View>

      {/* 4. Terms, Footer & Signature */}
      <View style={styles.settingsCard}>
        <Pressable
          style={styles.settingsCardHeader}
          onPress={() => setOpenSection(openSection === 'terms' ? 'store' : 'terms')}
        >
          <View style={styles.settingsCardHeaderLeft}>
            <View style={[styles.sectionIconWrap, { backgroundColor: '#FAF5FF' }]}>
              <Ionicons name="document-text" size={17} color="#7E22CE" />
            </View>
            <View>
              <Text style={styles.settingsCardTitle}>Terms & Signature Seal</Text>
              <Text style={styles.settingsCardSub}>Return policy, greeting & Authorised Signatory</Text>
            </View>
          </View>
          <Ionicons
            name={openSection === 'terms' ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={colors.inkSoft}
          />
        </Pressable>

        {openSection === 'terms' && (
          <View style={styles.settingsCardBody}>
            <View style={styles.switchListItem}>
              <View style={{ flex: 1 }}>
                <Text style={styles.switchListTitle}>Show Terms & Conditions</Text>
                <Text style={styles.switchListDesc}>Print warranty and return policy on bottom of invoice</Text>
              </View>
              <Switch
                value={config.showTerms}
                onValueChange={(v) => setConfig((p) => ({ ...p, showTerms: v }))}
                trackColor={{ false: '#CBD5E1', true: colors.clayDeep }}
                thumbColor="#FFFFFF"
              />
            </View>

            {config.showTerms && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Terms & Conditions Text</Text>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  value={config.termsAndConditions}
                  onChangeText={(v) => setConfig((p) => ({ ...p, termsAndConditions: v }))}
                  placeholder="1. Goods once sold will not be taken back.&#10;2. Subject to local jurisdiction."
                  placeholderTextColor={colors.inkSoft}
                  multiline
                  numberOfLines={3}
                />
              </View>
            )}

            <View style={[styles.switchListItem, { marginTop: 12 }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.switchListTitle}>Show Authorised Signatory</Text>
                <Text style={styles.switchListDesc}>Display signature line & store title stamp</Text>
              </View>
              <Switch
                value={config.showSignatory}
                onValueChange={(v) => setConfig((p) => ({ ...p, showSignatory: v }))}
                trackColor={{ false: '#CBD5E1', true: colors.clayDeep }}
                thumbColor="#FFFFFF"
              />
            </View>

            {config.showSignatory && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Signatory Title</Text>
                <TextInput
                  style={styles.textInput}
                  value={config.signatoryTitle}
                  onChangeText={(v) => setConfig((p) => ({ ...p, signatoryTitle: v }))}
                  placeholder="Authorised Signatory"
                  placeholderTextColor={colors.inkSoft}
                />
              </View>
            )}

            <View style={[styles.inputGroup, { marginTop: 12 }]}>
              <Text style={styles.inputLabel}>Footer Thank You Message</Text>
              <TextInput
                style={styles.textInput}
                value={config.footerMessage}
                onChangeText={(v) => setConfig((p) => ({ ...p, footerMessage: v }))}
                placeholder="Thank you for your business!"
                placeholderTextColor={colors.inkSoft}
              />
            </View>
          </View>
        )}
      </View>
    </View>
  );

  // ─── Render Live WYSIWYG Invoice Stage Canvas (identical to Invoice Preview modal) ───
  const renderLiveInvoiceCanvas = () => (
    <View style={styles.canvasContainer}>
      <View
        style={[
          styles.canvasPaperWrapper,
          config.paperSize.startsWith('thermal') || config.templateId === 'thermal_pos'
            ? { maxWidth: config.paperSize === 'thermal_58mm' ? 240 : 320 }
            : config.paperSize === 'a5'
            ? { maxWidth: 580 }
            : { maxWidth: 740 },
        ]}
      >
        {Platform.OS === 'web' ? (
          <iframe
            key={`${config.templateId}-${config.paperSize}-${config.compactMode}-${JSON.stringify(bizProfile)}-${JSON.stringify(config)}`}
            title="Bill Studio WYSIWYG Preview"
            srcDoc={invoiceHtml}
            style={{
              width: '100%',
              height: '100%',
              minHeight: isDesktop ? '680px' : '560px',
              border: 'none',
              backgroundColor: '#FFFFFF',
              borderRadius: isDesktop ? '10px' : '0px',
              display: 'block',
            }}
          />
        ) : (
          <View style={styles.mobileFallbackCanvas}>
            <Ionicons name="document-text-outline" size={48} color={colors.clayDeep} />
            <Text style={styles.mobileFallbackText}>Live Preview Configured</Text>
            <Pressable style={styles.mobileTestPrintBtn} onPress={handleTestPrint}>
              <Ionicons name="print" size={16} color="#FFFFFF" />
              <Text style={styles.mobileTestPrintBtnText}>Preview & Test Print</Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );

  return (
    <DesktopLayout currentTabName="InvoiceTemplateCustomizer">
      <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
        {/* ─── Top Main Header Bar (Exact alignment with Invoice Preview) ─── */}
        <View style={styles.topHeader}>
          <View style={styles.topHeaderInner}>
            <View style={styles.headerLeftGroup}>
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
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.headerTitleText}>
                    {t('settings.invoiceTemplate', 'Bill & Invoice Studio')}
                  </Text>
                  <View style={styles.proBadge}>
                    <Text style={styles.proBadgeText}>PRO</Text>
                  </View>
                </View>
                <Text style={styles.headerSubtitleText}>
                  WYSIWYG Template & Layout Customizer
                </Text>
              </View>
            </View>

            <View style={styles.headerActions}>
              <Pressable
                style={({ pressed }) => [styles.resetActionBtn, pressed && { opacity: 0.7 }]}
                onPress={handleReset}
              >
                <Ionicons name="refresh-outline" size={14} color={colors.inkSoft} />
                <Text style={styles.resetActionBtnText}>Reset</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [styles.testPrintBtn, pressed && { opacity: 0.85 }]}
                onPress={handleTestPrint}
              >
                <Ionicons name="print-outline" size={14} color={colors.ink} />
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
                    <Text style={styles.saveBtnText}>Save Template</Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        </View>

        {/* ─── Top Theme & Paper Style Switcher Ribbon (Exact layout as Invoice Preview) ─── */}
        <View style={styles.ribbonSection}>
          <View style={styles.ribbonInner}>
            {/* Template Presets Horizontal Scroller */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.templateChipsRow}
            >
              {Object.values(INVOICE_THEME_PRESETS).map((tmpl) => {
                const isSelected = config.templateId === tmpl.id;
                return (
                  <Pressable
                    key={tmpl.id}
                    style={[
                      styles.themeChip,
                      isSelected && styles.themeChipActive,
                      isSelected && {
                        borderColor: tmpl.primaryColor,
                        backgroundColor: tmpl.primaryColor + '14',
                      },
                    ]}
                    onPress={() => handleApplyPreset(tmpl.id as InvoiceTemplateId)}
                  >
                    <View
                      style={[
                        styles.themeDot,
                        { backgroundColor: tmpl.primaryColor },
                        isSelected && { borderColor: '#FFFFFF', borderWidth: 1.5 },
                      ]}
                    />
                    <Text
                      style={[
                        styles.themeChipText,
                        isSelected && {
                          color: tmpl.primaryColor,
                          fontFamily: fonts.bodyBold,
                        },
                      ]}
                    >
                      {tmpl.name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Paper Size & Layout Format Pills */}
            <View style={styles.paperPillsRow}>
              <View style={styles.paperGroup}>
                <Text style={styles.paperLabel}>Format:</Text>
                {[
                  { id: 'a4', label: '📄 A4' },
                  { id: 'a5', label: '📑 A5' },
                  { id: 'thermal_80mm', label: '🧾 80mm POS' },
                  { id: 'thermal_58mm', label: '58mm' },
                ].map((p) => {
                  const isSelected = config.paperSize === p.id;
                  return (
                    <Pressable
                      key={p.id}
                      style={[styles.paperPill, isSelected && styles.paperPillActive]}
                      onPress={() => setConfig((prev) => ({ ...prev, paperSize: p.id as PaperSize }))}
                    >
                      <Text style={[styles.paperPillText, isSelected && styles.paperPillTextActive]}>
                        {p.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Pressable
                style={[styles.compactPill, config.compactMode && styles.compactPillActive]}
                onPress={() => setConfig((prev) => ({ ...prev, compactMode: !prev.compactMode }))}
              >
                <Ionicons
                  name={config.compactMode ? 'contract' : 'expand'}
                  size={12}
                  color={config.compactMode ? colors.white : colors.inkSoft}
                />
                <Text style={[styles.compactPillText, config.compactMode && styles.compactPillTextActive]}>
                  {config.compactMode ? 'Compact: ON' : 'Compact'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* ─── Mobile/Tablet Mode Switcher (Live Preview vs Settings) ─── */}
        {!isDesktop && (
          <View style={styles.mobileTabSegmentBar}>
            <Pressable
              style={[styles.mobileTabBtn, activeTab === 'preview' && styles.mobileTabBtnActive]}
              onPress={() => setActiveTab('preview')}
            >
              <Ionicons
                name="eye-outline"
                size={15}
                color={activeTab === 'preview' ? colors.clayDeep : colors.inkSoft}
              />
              <Text
                style={[styles.mobileTabBtnText, activeTab === 'preview' && styles.mobileTabBtnTextActive]}
              >
                Live Invoice Preview
              </Text>
            </Pressable>

            <Pressable
              style={[styles.mobileTabBtn, activeTab !== 'preview' && styles.mobileTabBtnActive]}
              onPress={() => setActiveTab('store')}
            >
              <Ionicons
                name="options-outline"
                size={15}
                color={activeTab !== 'preview' ? colors.clayDeep : colors.inkSoft}
              />
              <Text
                style={[styles.mobileTabBtnText, activeTab !== 'preview' && styles.mobileTabBtnTextActive]}
              >
                Customize & Shop Info
              </Text>
            </Pressable>
          </View>
        )}

        {/* ─── Main Workspace Canvas ─── */}
        {isDesktop ? (
          /* Desktop Split View: Left Settings Panel + Right Sticky WYSIWYG Invoice Stage */
          <View style={styles.desktopSplitContainer}>
            <ScrollView
              style={styles.desktopLeftSettingsPane}
              contentContainerStyle={{ padding: 18, paddingBottom: 60 }}
              showsVerticalScrollIndicator={false}
            >
              <FadeInView delay={30} translateY={6}>
                <View style={styles.sectionHeaderWrap}>
                  <Text style={styles.sectionMainTitle}>Template & Profile Settings</Text>
                  <Text style={styles.sectionMainSub}>
                    Changes update the invoice on the right in real time.
                  </Text>
                </View>
                {renderSettingsContent()}
              </FadeInView>
            </ScrollView>

            <View style={styles.desktopRightCanvasPane}>
              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ padding: 20, alignItems: 'center' }}
                showsVerticalScrollIndicator={false}
              >
                {renderLiveInvoiceCanvas()}
              </ScrollView>
            </View>
          </View>
        ) : (
          /* Mobile / Tablet Mode View */
          <ScrollView
            style={styles.mobileMainScroll}
            contentContainerStyle={{ paddingBottom: 80 }}
            showsVerticalScrollIndicator={false}
          >
            <FadeInView delay={30} translateY={8}>
              {activeTab === 'preview' ? renderLiveInvoiceCanvas() : renderSettingsContent()}
            </FadeInView>
          </ScrollView>
        )}
      </SafeAreaView>
    </DesktopLayout>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F8FAFC',
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

  // Top Header (Centered Container)
  topHeader: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
    backgroundColor: colors.paperCard,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    zIndex: 10,
  },
  topHeaderInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    maxWidth: 1100,
    width: '100%',
    alignSelf: 'center',
  },
  headerLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTitleWrap: {
    justifyContent: 'center',
  },
  headerTitleText: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    color: colors.ink,
  },
  headerSubtitleText: {
    fontFamily: fonts.body,
    fontSize: 11.5,
    color: colors.inkSoft,
    marginTop: 1,
  },
  proBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  proBadgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 9.5,
    color: '#B45309',
    letterSpacing: 0.5,
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
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: radius.sm,
    backgroundColor: '#F1F5F9',
  },
  resetActionBtnText: {
    fontFamily: fonts.body,
    fontSize: 11.5,
    color: colors.inkSoft,
  },
  testPrintBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.paperCard,
    paddingHorizontal: 12,
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
    paddingHorizontal: 15,
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

  // Ribbon Bar (Identical to OrderDetail invoice preview modal)
  ribbonSection: {
    backgroundColor: colors.paperCard,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    paddingVertical: 8,
  },
  ribbonInner: {
    maxWidth: 1100,
    width: '100%',
    alignSelf: 'center',
  },
  templateChipsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  themeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  themeChipActive: {
    borderWidth: 1.5,
  },
  themeDot: {
    width: 11,
    height: 11,
    borderRadius: 6,
  },
  themeChipText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.ink,
  },
  paperPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  paperGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  paperLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    color: colors.inkSoft,
    marginRight: 2,
  },
  paperPill: {
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: 4,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  paperPillActive: {
    backgroundColor: colors.clayDeep,
    borderColor: colors.clayDeep,
  },
  paperPillText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    color: colors.inkSoft,
  },
  paperPillTextActive: {
    color: colors.white,
    fontFamily: fonts.bodyBold,
  },
  compactPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: 4,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  compactPillActive: {
    backgroundColor: colors.clayDeep,
    borderColor: colors.clayDeep,
  },
  compactPillText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    color: colors.inkSoft,
  },
  compactPillTextActive: {
    color: colors.white,
    fontFamily: fonts.bodyBold,
  },

  // Mobile Segment Bar
  mobileTabSegmentBar: {
    flexDirection: 'row',
    backgroundColor: colors.paperCard,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    paddingHorizontal: 16,
    paddingVertical: 6,
    gap: 10,
  },
  mobileTabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 7,
    borderRadius: radius.sm,
    backgroundColor: '#F1F5F9',
  },
  mobileTabBtnActive: {
    backgroundColor: colors.clayDeep + '18',
    borderWidth: 1,
    borderColor: colors.clayDeep + '55',
  },
  mobileTabBtnText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.inkSoft,
  },
  mobileTabBtnTextActive: {
    fontFamily: fonts.bodyBold,
    color: colors.clayDeep,
  },

  // Desktop Split Layout
  desktopSplitContainer: {
    flex: 1,
    flexDirection: 'row',
    maxWidth: 1300,
    width: '100%',
    alignSelf: 'center',
  },
  desktopLeftSettingsPane: {
    width: 440,
    borderRightWidth: 1,
    borderRightColor: colors.line,
    backgroundColor: '#F8FAFC',
  },
  desktopRightCanvasPane: {
    flex: 1,
    backgroundColor: '#EEF2F6',
  },
  mobileMainScroll: {
    flex: 1,
  },

  // Settings Cards
  sectionHeaderWrap: {
    marginBottom: 12,
  },
  sectionMainTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    color: colors.ink,
  },
  sectionMainSub: {
    fontFamily: fonts.body,
    fontSize: 11.5,
    color: colors.inkSoft,
    marginTop: 2,
  },
  settingsScrollContent: {
    gap: 12,
  },
  settingsCard: {
    backgroundColor: colors.paperCard,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
    ...shadow.card,
  },
  settingsCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: colors.paperCard,
  },
  settingsCardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  sectionIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsCardTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 13.5,
    color: colors.ink,
  },
  settingsCardSub: {
    fontFamily: fonts.body,
    fontSize: 10.5,
    color: colors.inkSoft,
    marginTop: 1,
  },
  settingsCardBody: {
    paddingHorizontal: 14,
    paddingBottom: 16,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: colors.line + '55',
  },
  settingsHelperText: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.inkSoft,
    marginBottom: 10,
  },

  // Input Elements
  inputGroup: {
    marginTop: 10,
  },
  inputLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: colors.ink,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  inputLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  miniSwitchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  miniSwitchLabel: {
    fontFamily: fonts.body,
    fontSize: 10.5,
    color: colors.inkSoft,
  },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontFamily: fonts.body,
    fontSize: 12.5,
    color: colors.ink,
  },
  textArea: {
    minHeight: 54,
    textAlignVertical: 'top',
  },
  twoColRow: {
    flexDirection: 'row',
    gap: 10,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  logoPreviewBox: {
    position: 'relative',
    width: 50,
    height: 50,
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoThumb: {
    width: 44,
    height: 44,
  },
  removeLogoBtn: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#EF4444',
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadLogoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.sm,
    backgroundColor: colors.clayDeep + '12',
    borderWidth: 1,
    borderColor: colors.clayDeep + '44',
    borderStyle: 'dashed',
  },
  uploadLogoBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11.5,
    color: colors.clayDeep,
  },
  switchRowInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  switchLabelInline: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11.5,
    color: colors.inkSoft,
  },
  quickPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  quickPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  quickPillActive: {
    backgroundColor: colors.clayDeep,
    borderColor: colors.clayDeep,
  },
  quickPillText: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.inkSoft,
  },
  quickPillTextActive: {
    fontFamily: fonts.bodyBold,
    color: colors.white,
  },

  // Switch List
  switchList: {
    gap: 10,
  },
  switchListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  switchListTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: colors.ink,
  },
  switchListDesc: {
    fontFamily: fonts.body,
    fontSize: 10.5,
    color: colors.inkSoft,
    marginTop: 1,
  },

  // Canvas Stage Wrapper (Matching Invoice Preview stage)
  canvasContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  canvasPaperWrapper: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    boxShadow: '0 8px 30px rgba(0,0,0,0.08)',
  },
  mobileFallbackCanvas: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: '#FFFFFF',
    gap: 10,
  },
  mobileFallbackText: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.ink,
  },
  mobileTestPrintBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.clayDeep,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.sm,
    marginTop: 8,
  },
  mobileTestPrintBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.white,
  },
});
