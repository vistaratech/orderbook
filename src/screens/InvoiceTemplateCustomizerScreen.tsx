import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  StyleSheet,
  Switch,
  Alert,
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
import { getBusinessProfile, BusinessProfile } from '../storage/businessProfileStorage';
import {
  generatePrintableInvoiceHtml,
  printPdfInvoice,
} from '../utils/invoiceGenerator';
import { Order } from '../types/order';
import { colors, fonts, radius, shadow } from '../theme/theme';
import { useLanguage } from '../i18n/LanguageContext';
import GlassBackButton from '../components/GlassBackButton';
import { formatCurrency, formatDate } from '../utils/format';

// Mock sample order for real-time live preview
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
      name: 'Pure Cold Pressed Sesame Oil',
      qty: 2,
      unit: 'L',
      price: 340,
      taxRate: 5,
      hsnCode: '1508',
    },
    {
      id: 'itm_3',
      name: 'Natural Palm Jaggery (Karupatti)',
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

type ActiveTab = 'presets' | 'branding' | 'columns' | 'payments' | 'terms';

export default function InvoiceTemplateCustomizerScreen() {
  const navigation = useNavigation();
  const { t, language } = useLanguage();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= 900;

  const [config, setConfig] = useState<InvoiceTemplateConfig>(DEFAULT_INVOICE_TEMPLATE_CONFIG);
  const [bizProfile, setBizProfile] = useState<BusinessProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('presets');
  const [mobileView, setMobileView] = useState<'editor' | 'preview'>('editor');

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
      setBizProfile(bp);
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
    setSaving(true);
    try {
      await saveInvoiceTemplateConfig(config);
      Alert.alert(
        t('common.success', 'Success'),
        'Invoice template & bill customizations saved successfully!'
      );
    } catch {
      Alert.alert(t('common.error', 'Error'), 'Could not save invoice template settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    Alert.alert(
      'Reset to Defaults?',
      'Are you sure you want to restore original template settings?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            const def = await resetInvoiceTemplateConfig();
            setConfig(def);
            Alert.alert('Reset', 'Template settings restored to default.');
          },
        },
      ]
    );
  };

  const handleTestPrint = async () => {
    if (!bizProfile) return;
    await printPdfInvoice(SAMPLE_ORDER, bizProfile, config);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.clayDeep} />
          <Text style={styles.loadingText}>Loading Template Studio…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const sampleHtml = generatePrintableInvoiceHtml(SAMPLE_ORDER, bizProfile || undefined, config);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      {/* Top App Bar */}
      <View style={styles.headerBar}>
        <GlassBackButton label={t('common.back', 'Back')} />
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Bill & Invoice Templates</Text>
          <Text style={styles.headerSubtitle}>Customize bills, styling & print layout</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            style={({ pressed }) => [styles.testPrintBtn, pressed && { opacity: 0.8 }]}
            onPress={handleTestPrint}
          >
            <Ionicons name="print-outline" size={16} color={colors.ink} />
            <Text style={styles.testPrintBtnText}>Test Print</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.saveBtn,
              pressed && { opacity: 0.85 },
              saving && { opacity: 0.6 },
            ]}
            disabled={saving}
            onPress={handleSave}
          >
            {saving ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <>
                <Ionicons name="checkmark-sharp" size={16} color={colors.white} />
                <Text style={styles.saveBtnText}>{t('common.save', 'Save')}</Text>
              </>
            )}
          </Pressable>
        </View>
      </View>

      {/* Mobile Mode Switcher (Customize vs Live Preview) */}
      {!isDesktop && (
        <View style={styles.mobileModeBar}>
          <Pressable
            style={[styles.mobileModeTab, mobileView === 'editor' && styles.mobileModeTabActive]}
            onPress={() => setMobileView('editor')}
          >
            <Ionicons
              name="options-outline"
              size={16}
              color={mobileView === 'editor' ? colors.clayDeep : colors.inkSoft}
            />
            <Text
              style={[
                styles.mobileModeTabText,
                mobileView === 'editor' && styles.mobileModeTabTextActive,
              ]}
            >
              Customize
            </Text>
          </Pressable>
          <Pressable
            style={[styles.mobileModeTab, mobileView === 'preview' && styles.mobileModeTabActive]}
            onPress={() => setMobileView('preview')}
          >
            <Ionicons
              name="eye-outline"
              size={16}
              color={mobileView === 'preview' ? colors.clayDeep : colors.inkSoft}
            />
            <Text
              style={[
                styles.mobileModeTabText,
                mobileView === 'preview' && styles.mobileModeTabTextActive,
              ]}
            >
              Live Preview
            </Text>
          </Pressable>
        </View>
      )}

      {/* Main Studio Body (Split on Desktop, Tabbed on Mobile) */}
      <View style={styles.studioContainer}>
        {/* Left Side: Controls (Visible if desktop or mobile editor mode) */}
        {(isDesktop || mobileView === 'editor') && (
          <View style={[styles.controlsPane, isDesktop && { width: '48%' }]}>
            {/* Customizer Section Nav Tabs */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.sectionTabsRow}
            >
              {[
                { id: 'presets', label: 'Styles & Themes', icon: 'color-palette-outline' },
                { id: 'branding', label: 'Header & Title', icon: 'business-outline' },
                { id: 'columns', label: 'Table Columns', icon: 'grid-outline' },
                { id: 'payments', label: 'UPI QR & Bank', icon: 'qr-code-outline' },
                { id: 'terms', label: 'Terms & Sign', icon: 'document-text-outline' },
              ].map((tab) => (
                <Pressable
                  key={tab.id}
                  style={[
                    styles.sectionTab,
                    activeTab === tab.id && styles.sectionTabActive,
                  ]}
                  onPress={() => setActiveTab(tab.id as ActiveTab)}
                >
                  <Ionicons
                    name={tab.icon as any}
                    size={15}
                    color={activeTab === tab.id ? colors.clayDeep : colors.inkSoft}
                  />
                  <Text
                    style={[
                      styles.sectionTabText,
                      activeTab === tab.id && styles.sectionTabTextActive,
                    ]}
                  >
                    {tab.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            <ScrollView
              style={styles.controlsScroll}
              contentContainerStyle={styles.controlsContent}
              showsVerticalScrollIndicator={false}
            >
              {/* TAB 1: PRESETS & THEMES */}
              {activeTab === 'presets' && (
                <View>
                  <Text style={styles.sectionTitle}>Select Template Theme</Text>
                  <Text style={styles.sectionDesc}>
                    Choose from 8 distinct professional bill & invoice layouts.
                  </Text>

                  <View style={styles.presetGrid}>
                    {Object.values(INVOICE_THEME_PRESETS).map((preset) => {
                      const isSelected = config.templateId === preset.id;
                      return (
                        <Pressable
                          key={preset.id}
                          style={({ pressed }) => [
                            styles.presetCard,
                            isSelected && styles.presetCardActive,
                            pressed && { opacity: 0.9 },
                          ]}
                          onPress={() => handleApplyPreset(preset.id)}
                        >
                          <View style={styles.presetCardTop}>
                            <View
                              style={[
                                styles.presetColorDot,
                                { backgroundColor: preset.primaryColor },
                              ]}
                            />
                            <View style={{ flex: 1 }}>
                              <Text
                                style={[
                                  styles.presetName,
                                  isSelected && { color: colors.clayDeep, fontFamily: fonts.bodyBold },
                                ]}
                              >
                                {language === 'ta' ? preset.tamilName : preset.name}
                              </Text>
                              <Text style={styles.presetDesc} numberOfLines={2}>
                                {preset.description}
                              </Text>
                            </View>
                            {isSelected && (
                              <Ionicons
                                name="checkmark-circle"
                                size={20}
                                color={colors.clayDeep}
                              />
                            )}
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>

                  <View style={styles.cardBox}>
                    <Text style={styles.cardBoxTitle}>Paper Sizing & Print Format</Text>

                    <View style={styles.chipOptionRow}>
                      {[
                        { id: 'a4', label: 'A4 Standard' },
                        { id: 'a5', label: 'A5 Half Page' },
                        { id: 'thermal_80mm', label: '80mm POS Thermal' },
                        { id: 'thermal_58mm', label: '58mm POS Thermal' },
                      ].map((p) => (
                        <Pressable
                          key={p.id}
                          style={[
                            styles.chipOption,
                            config.paperSize === p.id && styles.chipOptionActive,
                          ]}
                          onPress={() =>
                            setConfig((prev) => ({ ...prev, paperSize: p.id as PaperSize }))
                          }
                        >
                          <Text
                            style={[
                              styles.chipOptionText,
                              config.paperSize === p.id && styles.chipOptionTextActive,
                            ]}
                          >
                            {p.label}
                          </Text>
                        </Pressable>
                      ))}
                    </View>

                    <View style={styles.toggleRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.toggleLabel}>Compact Margin Mode</Text>
                        <Text style={styles.toggleSub}>Saves paper space for tighter prints</Text>
                      </View>
                      <Switch
                        value={config.compactMode}
                        onValueChange={(val) => setConfig((p) => ({ ...p, compactMode: val }))}
                        trackColor={{ false: colors.line, true: colors.clayLight }}
                        thumbColor={config.compactMode ? colors.clayDeep : '#f4f3f4'}
                      />
                    </View>
                  </View>
                </View>
              )}

              {/* TAB 2: BRANDING & HEADER */}
              {activeTab === 'branding' && (
                <View>
                  <Text style={styles.sectionTitle}>Document Header & Branding</Text>
                  <Text style={styles.sectionDesc}>
                    Customize title, numbering, and store details on the bill.
                  </Text>

                  <View style={styles.cardBox}>
                    <Text style={styles.fieldLabel}>Invoice Document Title</Text>
                    <TextInput
                      style={styles.textInput}
                      value={config.invoiceTitle}
                      onChangeText={(val) => setConfig((p) => ({ ...p, invoiceTitle: val }))}
                      placeholder="e.g. TAX INVOICE, CASH BILL, ESTIMATE"
                      placeholderTextColor={colors.inkSoft}
                    />

                    {/* Quick Title Presets */}
                    <View style={styles.quickTagsRow}>
                      {[
                        'TAX INVOICE',
                        'CASH BILL',
                        'RETAIL INVOICE',
                        'BILL OF SUPPLY',
                        'ESTIMATE / QUOTE',
                      ].map((title) => (
                        <Pressable
                          key={title}
                          style={[
                            styles.quickTag,
                            config.invoiceTitle === title && styles.quickTagActive,
                          ]}
                          onPress={() => setConfig((p) => ({ ...p, invoiceTitle: title }))}
                        >
                          <Text
                            style={[
                              styles.quickTagText,
                              config.invoiceTitle === title && styles.quickTagTextActive,
                            ]}
                          >
                            {title}
                          </Text>
                        </Pressable>
                      ))}
                    </View>

                    <View style={{ marginTop: 14 }}>
                      <Text style={styles.fieldLabel}>Invoice Prefix</Text>
                      <TextInput
                        style={styles.textInput}
                        value={config.invoicePrefix}
                        onChangeText={(val) => setConfig((p) => ({ ...p, invoicePrefix: val }))}
                        placeholder="e.g. INV-, BILL-, ORD-"
                        placeholderTextColor={colors.inkSoft}
                      />
                    </View>
                  </View>

                  <View style={styles.cardBox}>
                    <Text style={styles.cardBoxTitle}>Store Information Visibility</Text>

                    <View style={styles.toggleRow}>
                      <Text style={styles.toggleLabel}>Show Business Logo</Text>
                      <Switch
                        value={config.showLogo}
                        onValueChange={(val) => setConfig((p) => ({ ...p, showLogo: val }))}
                        trackColor={{ false: colors.line, true: colors.clayLight }}
                        thumbColor={config.showLogo ? colors.clayDeep : '#f4f3f4'}
                      />
                    </View>

                    {config.showLogo && (
                      <View style={{ marginTop: 8, marginBottom: 8 }}>
                        <Text style={styles.fieldLabel}>Logo Size</Text>
                        <View style={styles.chipOptionRow}>
                          {(['small', 'medium', 'large'] as LogoSize[]).map((sz) => (
                            <Pressable
                              key={sz}
                              style={[
                                styles.chipOption,
                                config.logoSize === sz && styles.chipOptionActive,
                              ]}
                              onPress={() => setConfig((p) => ({ ...p, logoSize: sz }))}
                            >
                              <Text
                                style={[
                                  styles.chipOptionText,
                                  config.logoSize === sz && styles.chipOptionTextActive,
                                ]}
                              >
                                {sz.toUpperCase()}
                              </Text>
                            </Pressable>
                          ))}
                        </View>
                      </View>
                    )}

                    <View style={styles.toggleRow}>
                      <Text style={styles.toggleLabel}>Show Tagline</Text>
                      <Switch
                        value={config.showTagline}
                        onValueChange={(val) => setConfig((p) => ({ ...p, showTagline: val }))}
                        trackColor={{ false: colors.line, true: colors.clayLight }}
                        thumbColor={config.showTagline ? colors.clayDeep : '#f4f3f4'}
                      />
                    </View>

                    <View style={styles.toggleRow}>
                      <Text style={styles.toggleLabel}>Show Store Address</Text>
                      <Switch
                        value={config.showBusinessAddress}
                        onValueChange={(val) =>
                          setConfig((p) => ({ ...p, showBusinessAddress: val }))
                        }
                        trackColor={{ false: colors.line, true: colors.clayLight }}
                        thumbColor={config.showBusinessAddress ? colors.clayDeep : '#f4f3f4'}
                      />
                    </View>

                    <View style={styles.toggleRow}>
                      <Text style={styles.toggleLabel}>Show Phone & Email</Text>
                      <Switch
                        value={config.showBusinessPhone}
                        onValueChange={(val) =>
                          setConfig((p) => ({
                            ...p,
                            showBusinessPhone: val,
                            showBusinessEmail: val,
                          }))
                        }
                        trackColor={{ false: colors.line, true: colors.clayLight }}
                        thumbColor={config.showBusinessPhone ? colors.clayDeep : '#f4f3f4'}
                      />
                    </View>

                    <View style={styles.toggleRow}>
                      <Text style={styles.toggleLabel}>Show GSTIN / Tax ID</Text>
                      <Switch
                        value={config.showGstin}
                        onValueChange={(val) => setConfig((p) => ({ ...p, showGstin: val }))}
                        trackColor={{ false: colors.line, true: colors.clayLight }}
                        thumbColor={config.showGstin ? colors.clayDeep : '#f4f3f4'}
                      />
                    </View>

                    <View style={styles.toggleRow}>
                      <Text style={styles.toggleLabel}>Show Customer Phone Number</Text>
                      <Switch
                        value={config.showCustomerPhone}
                        onValueChange={(val) =>
                          setConfig((p) => ({ ...p, showCustomerPhone: val }))
                        }
                        trackColor={{ false: colors.line, true: colors.clayLight }}
                        thumbColor={config.showCustomerPhone ? colors.clayDeep : '#f4f3f4'}
                      />
                    </View>
                  </View>
                </View>
              )}

              {/* TAB 3: TABLE COLUMNS */}
              {activeTab === 'columns' && (
                <View>
                  <Text style={styles.sectionTitle}>Invoice Item Table Columns</Text>
                  <Text style={styles.sectionDesc}>
                    Enable or disable specific table columns based on your trade.
                  </Text>

                  <View style={styles.cardBox}>
                    <View style={styles.toggleRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.toggleLabel}>Item S.No (#)</Text>
                        <Text style={styles.toggleSub}>Sequential serial numbering</Text>
                      </View>
                      <Switch
                        value={config.showItemSerialNo}
                        onValueChange={(val) =>
                          setConfig((p) => ({ ...p, showItemSerialNo: val }))
                        }
                        trackColor={{ false: colors.line, true: colors.clayLight }}
                        thumbColor={config.showItemSerialNo ? colors.clayDeep : '#f4f3f4'}
                      />
                    </View>

                    <View style={styles.toggleRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.toggleLabel}>HSN / SAC Code Column</Text>
                        <Text style={styles.toggleSub}>Useful for GST statutory compliance</Text>
                      </View>
                      <Switch
                        value={config.showHsn}
                        onValueChange={(val) => setConfig((p) => ({ ...p, showHsn: val }))}
                        trackColor={{ false: colors.line, true: colors.clayLight }}
                        thumbColor={config.showHsn ? colors.clayDeep : '#f4f3f4'}
                      />
                    </View>

                    <View style={styles.toggleRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.toggleLabel}>Unit of Measure (kg, pcs, box)</Text>
                        <Text style={styles.toggleSub}>Displays item units next to quantity</Text>
                      </View>
                      <Switch
                        value={config.showUnit}
                        onValueChange={(val) => setConfig((p) => ({ ...p, showUnit: val }))}
                        trackColor={{ false: colors.line, true: colors.clayLight }}
                        thumbColor={config.showUnit ? colors.clayDeep : '#f4f3f4'}
                      />
                    </View>

                    <View style={styles.toggleRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.toggleLabel}>Rate / Unit Price Column</Text>
                        <Text style={styles.toggleSub}>Show item base rate</Text>
                      </View>
                      <Switch
                        value={config.showRate}
                        onValueChange={(val) => setConfig((p) => ({ ...p, showRate: val }))}
                        trackColor={{ false: colors.line, true: colors.clayLight }}
                        thumbColor={config.showRate ? colors.clayDeep : '#f4f3f4'}
                      />
                    </View>

                    <View style={styles.toggleRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.toggleLabel}>Discount Column</Text>
                        <Text style={styles.toggleSub}>Shows per-item discount deductions</Text>
                      </View>
                      <Switch
                        value={config.showDiscount}
                        onValueChange={(val) => setConfig((p) => ({ ...p, showDiscount: val }))}
                        trackColor={{ false: colors.line, true: colors.clayLight }}
                        thumbColor={config.showDiscount ? colors.clayDeep : '#f4f3f4'}
                      />
                    </View>

                    <View style={styles.toggleRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.toggleLabel}>GST Tax Rate (%) Column</Text>
                        <Text style={styles.toggleSub}>Shows tax percentage breakdown</Text>
                      </View>
                      <Switch
                        value={config.showGSTRate}
                        onValueChange={(val) => setConfig((p) => ({ ...p, showGSTRate: val }))}
                        trackColor={{ false: colors.line, true: colors.clayLight }}
                        thumbColor={config.showGSTRate ? colors.clayDeep : '#f4f3f4'}
                      />
                    </View>
                  </View>
                </View>
              )}

              {/* TAB 4: PAYMENTS & UPI QR */}
              {activeTab === 'payments' && (
                <View>
                  <Text style={styles.sectionTitle}>Payments & Instant UPI QR</Text>
                  <Text style={styles.sectionDesc}>
                    Add dynamic QR codes so customers can pay directly with GPay, PhonePe, or Paytm.
                  </Text>

                  <View style={styles.cardBox}>
                    <View style={styles.toggleRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.toggleLabel}>Show UPI QR Code (Scan to Pay)</Text>
                        <Text style={styles.toggleSub}>
                          Generates scannable QR on bill with balance due
                        </Text>
                      </View>
                      <Switch
                        value={config.showUpiQr}
                        onValueChange={(val) => setConfig((p) => ({ ...p, showUpiQr: val }))}
                        trackColor={{ false: colors.line, true: colors.clayLight }}
                        thumbColor={config.showUpiQr ? colors.clayDeep : '#f4f3f4'}
                      />
                    </View>

                    {config.showUpiQr && (
                      <View style={{ marginTop: 12 }}>
                        <Text style={styles.fieldLabel}>Store UPI VPA / ID</Text>
                        <TextInput
                          style={styles.textInput}
                          value={config.upiId ?? bizProfile?.upiId ?? ''}
                          onChangeText={(val) => setConfig((p) => ({ ...p, upiId: val }))}
                          placeholder="e.g. yourstore@okaxis or 9876543210@upi"
                          placeholderTextColor={colors.inkSoft}
                        />
                      </View>
                    )}
                  </View>

                  <View style={styles.cardBox}>
                    <View style={styles.toggleRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.toggleLabel}>Show Bank Details Section</Text>
                        <Text style={styles.toggleSub}>Display bank A/C, IFSC & Branch</Text>
                      </View>
                      <Switch
                        value={config.showBankDetails}
                        onValueChange={(val) =>
                          setConfig((p) => ({ ...p, showBankDetails: val }))
                        }
                        trackColor={{ false: colors.line, true: colors.clayLight }}
                        thumbColor={config.showBankDetails ? colors.clayDeep : '#f4f3f4'}
                      />
                    </View>

                    {config.showBankDetails && (
                      <View style={{ marginTop: 12 }}>
                        <Text style={styles.fieldLabel}>Custom Bank Details</Text>
                        <TextInput
                          style={[styles.textInput, { height: 70, textAlignVertical: 'top' }]}
                          value={config.bankDetailsCustom ?? bizProfile?.bankDetails ?? ''}
                          onChangeText={(val) =>
                            setConfig((p) => ({ ...p, bankDetailsCustom: val }))
                          }
                          multiline
                          placeholder="Bank: SBI&#10;A/C: 123456789012&#10;IFSC: SBIN0001234"
                          placeholderTextColor={colors.inkSoft}
                        />
                      </View>
                    )}
                  </View>
                </View>
              )}

              {/* TAB 5: TERMS, NOTES & SIGNATURE */}
              {activeTab === 'terms' && (
                <View>
                  <Text style={styles.sectionTitle}>Terms, Notes & Legal Signature</Text>
                  <Text style={styles.sectionDesc}>
                    Custom terms, notes, and authorized signatory declaration.
                  </Text>

                  <View style={styles.cardBox}>
                    <View style={styles.toggleRow}>
                      <Text style={styles.toggleLabel}>Show Terms & Conditions</Text>
                      <Switch
                        value={config.showTerms}
                        onValueChange={(val) => setConfig((p) => ({ ...p, showTerms: val }))}
                        trackColor={{ false: colors.line, true: colors.clayLight }}
                        thumbColor={config.showTerms ? colors.clayDeep : '#f4f3f4'}
                      />
                    </View>

                    {config.showTerms && (
                      <View style={{ marginTop: 12 }}>
                        <Text style={styles.fieldLabel}>Terms & Conditions Text</Text>
                        <TextInput
                          style={[styles.textInput, { height: 80, textAlignVertical: 'top' }]}
                          value={config.termsAndConditions}
                          onChangeText={(val) =>
                            setConfig((p) => ({ ...p, termsAndConditions: val }))
                          }
                          multiline
                          placeholder="1. Goods once sold will not be returned.&#10;2. Subject to local jurisdiction."
                          placeholderTextColor={colors.inkSoft}
                        />
                      </View>
                    )}
                  </View>

                  <View style={styles.cardBox}>
                    <View style={styles.toggleRow}>
                      <Text style={styles.toggleLabel}>Show Customer Notes Box</Text>
                      <Switch
                        value={config.showNotes}
                        onValueChange={(val) => setConfig((p) => ({ ...p, showNotes: val }))}
                        trackColor={{ false: colors.line, true: colors.clayLight }}
                        thumbColor={config.showNotes ? colors.clayDeep : '#f4f3f4'}
                      />
                    </View>

                    {config.showNotes && (
                      <View style={{ marginTop: 12 }}>
                        <Text style={styles.fieldLabel}>Default Notes / Greeting</Text>
                        <TextInput
                          style={styles.textInput}
                          value={config.defaultNotes}
                          onChangeText={(val) => setConfig((p) => ({ ...p, defaultNotes: val }))}
                          placeholder="Thank you for your business!"
                          placeholderTextColor={colors.inkSoft}
                        />
                      </View>
                    )}
                  </View>

                  <View style={styles.cardBox}>
                    <View style={styles.toggleRow}>
                      <Text style={styles.toggleLabel}>Show Authorized Signatory</Text>
                      <Switch
                        value={config.showSignatory}
                        onValueChange={(val) =>
                          setConfig((p) => ({ ...p, showSignatory: val }))
                        }
                        trackColor={{ false: colors.line, true: colors.clayLight }}
                        thumbColor={config.showSignatory ? colors.clayDeep : '#f4f3f4'}
                      />
                    </View>

                    {config.showSignatory && (
                      <View style={{ marginTop: 12 }}>
                        <Text style={styles.fieldLabel}>Signatory Stamp Label</Text>
                        <TextInput
                          style={styles.textInput}
                          value={config.signatoryTitle}
                          onChangeText={(val) =>
                            setConfig((p) => ({ ...p, signatoryTitle: val }))
                          }
                          placeholder="Authorized Signatory"
                          placeholderTextColor={colors.inkSoft}
                        />
                      </View>
                    )}

                    <View style={{ marginTop: 14 }}>
                      <Text style={styles.fieldLabel}>Footer Greeting Message</Text>
                      <TextInput
                        style={styles.textInput}
                        value={config.footerMessage}
                        onChangeText={(val) =>
                          setConfig((p) => ({ ...p, footerMessage: val }))
                        }
                        placeholder="Thank you for shopping with us!"
                        placeholderTextColor={colors.inkSoft}
                      />
                    </View>
                  </View>
                </View>
              )}

              {/* Reset to Defaults Action */}
              <Pressable
                style={({ pressed }) => [styles.resetBtn, pressed && { opacity: 0.8 }]}
                onPress={handleReset}
              >
                <Ionicons name="refresh-outline" size={16} color={colors.danger} />
                <Text style={styles.resetBtnText}>Reset to Default Template</Text>
              </Pressable>
            </ScrollView>
          </View>
        )}

        {/* Right Side: Live HTML / Native Preview (Visible if desktop or mobile preview mode) */}
        {(isDesktop || mobileView === 'preview') && (
          <View style={[styles.previewPane, isDesktop && { width: '52%' }]}>
            <View style={styles.previewHeaderBar}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="eye" size={16} color={colors.clayDeep} />
                <Text style={styles.previewHeaderTitle}>Live Bill Preview</Text>
              </View>
              <View style={styles.previewTag}>
                <Text style={styles.previewTagText}>
                  {config.templateId === 'thermal_pos' ? 'POS 80mm' : config.paperSize.toUpperCase()}
                </Text>
              </View>
            </View>

            {Platform.OS === 'web' ? (
              <iframe
                title="Invoice Template Live Preview"
                srcDoc={sampleHtml}
                style={{
                  width: '100%',
                  height: '100%',
                  border: 'none',
                  backgroundColor: '#FFFFFF',
                }}
              />
            ) : (
              <ScrollView
                style={styles.mobilePreviewScroll}
                contentContainerStyle={styles.mobilePreviewContent}
              >
                {/* Visual Native Card Preview on Mobile */}
                <View style={styles.nativeMockInvoiceCard}>
                  <View
                    style={[
                      styles.nativeMockHeader,
                      {
                        backgroundColor:
                          config.templateId === 'classic' ? '#0F172A' : config.primaryColor,
                      },
                    ]}
                  >
                    <View>
                      <Text style={styles.nativeMockBrand}>
                        {(bizProfile?.businessName || 'KADAIBOOK STORE').toUpperCase()}
                      </Text>
                      <Text style={styles.nativeMockSub}>
                        {bizProfile?.tagline || 'Commercial Tax Invoice'}
                      </Text>
                    </View>
                    <View style={styles.nativeMockDocBadge}>
                      <Text style={styles.nativeMockDocText}>{config.invoiceTitle}</Text>
                    </View>
                  </View>

                  <View style={styles.nativeMockBody}>
                    <View style={styles.nativeMockRow}>
                      <Text style={styles.nativeMockMeta}>Bill #{SAMPLE_ORDER.orderNumber}</Text>
                      <Text style={styles.nativeMockMeta}>{formatDate(SAMPLE_ORDER.orderDate)}</Text>
                    </View>

                    <View style={styles.nativeMockDivider} />

                    <Text style={styles.nativeMockCustomer}>
                      Billed to: {SAMPLE_ORDER.customerName}
                    </Text>

                    <View style={styles.nativeMockTable}>
                      {SAMPLE_ORDER.items.map((item, idx) => (
                        <View key={item.id} style={styles.nativeMockItemRow}>
                          <Text style={{ flex: 2, fontFamily: fonts.bodyBold, fontSize: 12 }}>
                            {idx + 1}. {item.name}
                          </Text>
                          <Text style={{ flex: 1, textAlign: 'center', fontSize: 11 }}>
                            {item.qty} {item.unit}
                          </Text>
                          <Text style={{ flex: 1, textAlign: 'right', fontFamily: fonts.bodyBold, fontSize: 12 }}>
                            {formatCurrency(item.qty * item.price)}
                          </Text>
                        </View>
                      ))}
                    </View>

                    <View style={styles.nativeMockDivider} />

                    <View style={styles.nativeMockSummaryRow}>
                      <Text style={{ fontSize: 12 }}>Grand Total:</Text>
                      <Text style={{ fontSize: 14, fontFamily: fonts.bodyBold }}>
                        {formatCurrency(1440)}
                      </Text>
                    </View>
                    <View style={styles.nativeMockSummaryRow}>
                      <Text style={{ fontSize: 12 }}>Advance Paid:</Text>
                      <Text style={{ fontSize: 12, color: colors.inflow, fontFamily: fonts.bodyBold }}>
                        {formatCurrency(500)}
                      </Text>
                    </View>
                    <View style={styles.nativeMockSummaryRow}>
                      <Text style={{ fontSize: 12, color: colors.danger, fontFamily: fonts.bodyBold }}>
                        Balance Due:
                      </Text>
                      <Text style={{ fontSize: 13, color: colors.danger, fontFamily: fonts.bodyBold }}>
                        {formatCurrency(940)}
                      </Text>
                    </View>
                  </View>
                </View>
              </ScrollView>
            )}
          </View>
        )}
      </View>
    </SafeAreaView>
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
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    backgroundColor: colors.paper,
    gap: 12,
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 18,
    color: colors.ink,
  },
  headerSubtitle: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.inkSoft,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  testPrintBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.paperCard,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
  },
  testPrintBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: colors.ink,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.clayDeep,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.md,
    ...shadow.card,
  },
  saveBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
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
    fontSize: 13,
    color: colors.inkSoft,
  },
  mobileModeTabTextActive: {
    fontFamily: fonts.bodyBold,
    color: colors.clayDeep,
  },
  studioContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  controlsPane: {
    flex: 1,
    borderRightWidth: 1,
    borderRightColor: colors.line,
    backgroundColor: colors.paper,
  },
  sectionTabsRow: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  sectionTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.paperCard,
    borderWidth: 1,
    borderColor: colors.line,
  },
  sectionTabActive: {
    backgroundColor: colors.clayLight,
    borderColor: colors.clayDeep,
  },
  sectionTabText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.inkSoft,
  },
  sectionTabTextActive: {
    fontFamily: fonts.bodyBold,
    color: colors.clayDeep,
  },
  controlsScroll: {
    flex: 1,
  },
  controlsContent: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    color: colors.ink,
    marginBottom: 2,
  },
  sectionDesc: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.inkSoft,
    marginBottom: 14,
  },
  presetGrid: {
    gap: 8,
    marginBottom: 16,
  },
  presetCard: {
    backgroundColor: colors.paperCard,
    borderRadius: radius.md,
    padding: 12,
    borderWidth: 1.5,
    borderColor: colors.line,
  },
  presetCardActive: {
    borderColor: colors.clayDeep,
    backgroundColor: '#FAF4EF',
  },
  presetCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  presetColorDot: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  presetName: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.ink,
  },
  presetDesc: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.inkSoft,
    marginTop: 2,
  },
  cardBox: {
    backgroundColor: colors.paperCard,
    borderRadius: radius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: 14,
  },
  cardBoxTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.ink,
    marginBottom: 10,
  },
  chipOptionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  chipOption: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.sm,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
  },
  chipOptionActive: {
    backgroundColor: colors.clayDeep,
    borderColor: colors.clayDeep,
  },
  chipOptionText: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.inkSoft,
  },
  chipOptionTextActive: {
    fontFamily: fonts.bodyBold,
    color: colors.white,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  toggleLabel: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.ink,
  },
  toggleSub: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.inkSoft,
    marginTop: 2,
  },
  fieldLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: colors.ink,
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.ink,
  },
  quickTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  quickTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.sm,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
  },
  quickTagActive: {
    backgroundColor: colors.clayLight,
    borderColor: colors.clayDeep,
  },
  quickTagText: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.inkSoft,
  },
  quickTagTextActive: {
    fontFamily: fonts.bodyBold,
    color: colors.clayDeep,
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: radius.md,
    backgroundColor: '#FEF2F2',
  },
  resetBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: colors.danger,
  },
  previewPane: {
    flex: 1,
    backgroundColor: '#1E293B',
  },
  previewHeaderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#0F172A',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  previewHeaderTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: '#F8FAFC',
  },
  previewTag: {
    backgroundColor: '#334155',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  previewTagText: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    color: '#94A3B8',
  },
  mobilePreviewScroll: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  mobilePreviewContent: {
    padding: 16,
    paddingBottom: 40,
  },
  nativeMockInvoiceCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    overflow: 'hidden',
    ...shadow.card,
  },
  nativeMockHeader: {
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  nativeMockBrand: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: '#FFFFFF',
  },
  nativeMockSub: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: 'rgba(255,255,255,0.8)',
  },
  nativeMockDocBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  nativeMockDocText: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    color: '#FFFFFF',
  },
  nativeMockBody: {
    padding: 16,
  },
  nativeMockRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  nativeMockMeta: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.inkSoft,
  },
  nativeMockCustomer: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: colors.ink,
    marginBottom: 8,
  },
  nativeMockDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 10,
  },
  nativeMockTable: {
    gap: 6,
  },
  nativeMockItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  nativeMockSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
});
