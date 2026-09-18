import React, { useState, useEffect, useContext, useRef } from 'react';
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
  Modal,
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

type ActiveSection = 'header' | 'title' | 'columns' | 'payments' | 'terms' | 'theme';

export default function InvoiceTemplateCustomizerScreen() {
  const navigation = useNavigation();
  const { t, language } = useLanguage();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= 768;
  const hasParentSidebar = useContext(DesktopSidebarContext);

  const [config, setConfig] = useState<InvoiceTemplateConfig>(DEFAULT_INVOICE_TEMPLATE_CONFIG);
  const [bizProfile, setBizProfile] = useState<BusinessProfile>({
    businessName: 'KadaiBook Store',
    phone: '9876543210',
    email: 'contact@kadaibook.in',
    address: '124, Market Road, Near Gandhi Statue, Chennai - 600001',
    gstin: '33AABCK1234F1Z5',
    tagline: 'Quality Products & Reliable Service',
    upiId: 'kadaibook@upi',
    bankDetails: 'State Bank of India\nA/C: 9876543210123\nIFSC: SBIN0001234',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [activeSection, setActiveSection] = useState<ActiveSection>('header');
  const [mobileTab, setMobileTab] = useState<'visual' | 'inspector' | 'print'>('visual');
  const [fullPrintModal, setFullPrintModal] = useState(false);

  const controlsScrollRef = useRef<ScrollView>(null);

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

  const handleSelectSection = (section: ActiveSection) => {
    setActiveSection(section);
    if (!isDesktop) {
      setMobileTab('inspector');
    }
  };

  const handleSave = async () => {
    const isPro = await checkProStatus();
    if (!isPro) {
      triggerGlobalSubscriptionModal({
        title: '👑 Pro Invoice Templates',
        message: 'Customizing bill presets, colors, custom logos, signatures, and UPI QR codes on invoices is a Pro feature.\n\nUpgrade to KadaiBook Pro for complete invoice styling & brand freedom!',
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
        'Invoice template & bill customizations saved successfully!'
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
      message: 'Are you sure you want to restore original template settings?',
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
            <Text style={styles.loadingText}>Loading Invoice Studio…</Text>
          </View>
        </SafeAreaView>
      </DesktopLayout>
    );
  }

  const activePreset = INVOICE_THEME_PRESETS[config.templateId] || INVOICE_THEME_PRESETS.modern_slate;
  const sampleHtml = generatePrintableInvoiceHtml(SAMPLE_ORDER, bizProfile, config);

  // Totals calculation
  const subtotal = 1440;
  const advance = SAMPLE_ORDER.advance || 0;
  const balance = subtotal - advance;

  return (
    <DesktopLayout currentTabName="InvoiceTemplateCustomizer">
      <SafeAreaView style={styles.screen} edges={['top']}>
        {/* ─── Top Studio Bar ─── */}
        <View style={styles.headerBar}>
          <GlassBackButton
            label={t('common.back', 'Back')}
            onPress={hasParentSidebar ? () => (navigation as any).navigate('MainTabs', { screen: 'DashboardTab' }) : undefined}
          />
          <View style={styles.headerTitleWrap}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {language === 'ta' ? 'பில் டிசைனர்' : 'Live Bill Studio'}
              </Text>
              <View style={styles.liveTag}>
                <View style={styles.liveTagDot} />
                <Text style={styles.liveTagText}>Interactive WYSIWYG</Text>
              </View>
            </View>
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {language === 'ta' ? 'பில்லிலேயே நேரடியாக கிளிக் செய்து மாற்றங்களை செய்யவும்' : 'Click on any section of the bill to customize in real-time'}
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
                  <Text style={styles.saveBtnText}>Saved!</Text>
                </>
              ) : (
                <>
                  <Ionicons name="checkmark-sharp" size={15} color={colors.white} />
                  <Text style={styles.saveBtnText}>{t('common.save', 'Save')}</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>

        {/* ─── Mobile View Tabs (Visual Bill vs Section Inspector) ─── */}
        {!isDesktop && (
          <View style={styles.mobileModeBar}>
            <Pressable
              style={[styles.mobileModeTab, mobileTab === 'visual' && styles.mobileModeTabActive]}
              onPress={() => setMobileTab('visual')}
            >
              <Ionicons
                name="document-text"
                size={16}
                color={mobileTab === 'visual' ? colors.clayDeep : colors.inkSoft}
              />
              <Text
                style={[
                  styles.mobileModeTabText,
                  mobileTab === 'visual' && styles.mobileModeTabTextActive,
                ]}
              >
                📄 Live Interactive Bill
              </Text>
            </Pressable>

            <Pressable
              style={[styles.mobileModeTab, mobileTab === 'inspector' && styles.mobileModeTabActive]}
              onPress={() => setMobileTab('inspector')}
            >
              <Ionicons
                name="options-outline"
                size={16}
                color={mobileTab === 'inspector' ? colors.clayDeep : colors.inkSoft}
              />
              <Text
                style={[
                  styles.mobileModeTabText,
                  mobileTab === 'inspector' && styles.mobileModeTabTextActive,
                ]}
              >
                ⚙️ {activeSection.toUpperCase()} Editor
              </Text>
            </Pressable>
          </View>
        )}

        {/* ─── Main Interactive Studio Workspace ─── */}
        <View style={styles.studioContainer}>
          {/* ════ LEFT COLUMN: Live Interactive Bill Canvas ════ */}
          {(isDesktop || mobileTab === 'visual') && (
            <View style={[styles.canvasPane, isDesktop && { width: '56%' }]}>
              {/* Quick Preset Swatches Bar */}
              <View style={styles.quickPresetBar}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickPresetScroll}>
                  <Text style={styles.presetBarLabel}>Styles:</Text>
                  {Object.values(INVOICE_THEME_PRESETS).map((preset) => {
                    const isSelected = config.templateId === preset.id;
                    return (
                      <Pressable
                        key={preset.id}
                        style={[
                          styles.quickThemeChip,
                          isSelected && styles.quickThemeChipActive,
                          { borderColor: isSelected ? config.primaryColor : colors.line },
                        ]}
                        onPress={() => handleApplyPreset(preset.id)}
                      >
                        <View style={[styles.quickThemeDot, { backgroundColor: preset.primaryColor }]} />
                        <Text
                          style={[
                            styles.quickThemeText,
                            isSelected && { fontFamily: fonts.bodyBold, color: colors.ink },
                          ]}
                        >
                          {language === 'ta' ? preset.tamilName : preset.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Bill Viewport */}
              <ScrollView
                style={styles.canvasScroll}
                contentContainerStyle={styles.canvasContent}
                showsVerticalScrollIndicator={false}
              >
                <FadeInView delay={40} translateY={10}>
                  {/* Paper Card Container */}
                  <View
                    style={[
                      styles.interactivePaper,
                      {
                        borderColor: config.cardBorderColor || '#E2E8F0',
                      },
                    ]}
                  >
                    {/* ───── SECTION 1: HEADER & STORE DETAILS ───── */}
                    <Pressable
                      style={[
                        styles.billSectionWrap,
                        activeSection === 'header' && styles.billSectionActive,
                        {
                          backgroundColor: config.headerBgColor || '#F8FAFC',
                          borderTopLeftRadius: 10,
                          borderTopRightRadius: 10,
                        },
                      ]}
                      onPress={() => handleSelectSection('header')}
                    >
                      <View style={styles.sectionEditHint}>
                        <Ionicons name="pencil" size={11} color={colors.clayDeep} />
                        <Text style={styles.sectionEditHintText}>Store Info & Header (Click to edit)</Text>
                      </View>

                      <View style={styles.billHeaderRow}>
                        <View style={{ flex: 1 }}>
                          {config.showLogo && (
                            <View style={styles.mockLogoBadge}>
                              <Ionicons name="storefront" size={config.logoSize === 'large' ? 24 : config.logoSize === 'small' ? 14 : 18} color={config.primaryColor} />
                              <Text style={[styles.mockLogoText, { color: config.primaryColor }]}>LOGO</Text>
                            </View>
                          )}
                          <Text style={[styles.billStoreName, { color: config.headerTextColor || config.primaryColor }]}>
                            {bizProfile.businessName || 'MY BUSINESS NAME'}
                          </Text>
                          {config.showTagline && bizProfile.tagline ? (
                            <Text style={styles.billStoreTagline}>{bizProfile.tagline}</Text>
                          ) : null}

                          <View style={styles.billContactBlock}>
                            {config.showBusinessAddress && bizProfile.address ? (
                              <Text style={styles.billContactLine} numberOfLines={2}>
                                📍 {bizProfile.address}
                              </Text>
                            ) : null}
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 }}>
                              {config.showBusinessPhone && bizProfile.phone ? (
                                <Text style={styles.billContactLine}>📞 {bizProfile.phone}</Text>
                              ) : null}
                              {config.showGstin && bizProfile.gstin ? (
                                <Text style={[styles.billContactLine, styles.gstinHighlight]}>
                                  GSTIN: {bizProfile.gstin}
                                </Text>
                              ) : null}
                            </View>
                          </View>
                        </View>

                        {/* Document Title Banner */}
                        <View style={styles.billTitleBox}>
                          <Pressable
                            style={[
                              styles.billTitlePill,
                              { backgroundColor: config.primaryColor },
                            ]}
                            onPress={() => handleSelectSection('title')}
                          >
                            <Text style={styles.billTitleText}>{config.invoiceTitle || 'TAX INVOICE'}</Text>
                          </Pressable>

                          <Text style={styles.billMetaLine}>
                            <Text style={{ fontFamily: fonts.bodyBold }}>Bill #:</Text> {SAMPLE_ORDER.orderNumber}
                          </Text>
                          <Text style={styles.billMetaLine}>
                            <Text style={{ fontFamily: fonts.bodyBold }}>Date:</Text> {formatDate(SAMPLE_ORDER.orderDate)}
                          </Text>
                          {config.showDueDate && (
                            <Text style={[styles.billMetaLine, { color: colors.pending }]}>
                              <Text style={{ fontFamily: fonts.bodyBold }}>Due:</Text> Immediate
                            </Text>
                          )}
                        </View>
                      </View>
                    </Pressable>

                    {/* Quick Title Switcher Strip */}
                    <View style={styles.quickTitleStrip}>
                      <Text style={styles.quickStripLabel}>Title:</Text>
                      {['TAX INVOICE', 'CASH BILL', 'RETAIL INVOICE', 'BILL OF SUPPLY', 'ESTIMATE'].map((tName) => (
                        <Pressable
                          key={tName}
                          style={[
                            styles.quickTitleChip,
                            config.invoiceTitle === tName && styles.quickTitleChipActive,
                          ]}
                          onPress={() => setConfig((p) => ({ ...p, invoiceTitle: tName }))}
                        >
                          <Text
                            style={[
                              styles.quickTitleChipText,
                              config.invoiceTitle === tName && styles.quickTitleChipTextActive,
                            ]}
                          >
                            {tName}
                          </Text>
                        </Pressable>
                      ))}
                    </View>

                    {/* Customer Info Strip */}
                    <View style={styles.billCustomerStrip}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.billCustomerLabel}>Billed To (Customer):</Text>
                        <Text style={styles.billCustomerName}>{SAMPLE_ORDER.customerName}</Text>
                        {config.showCustomerPhone && (
                          <Text style={styles.billCustomerSub}>Ph: {SAMPLE_ORDER.phoneNumber}</Text>
                        )}
                      </View>
                      <View style={styles.statusPaidPill}>
                        <Ionicons name="checkmark-circle" size={13} color="#15803D" />
                        <Text style={styles.statusPaidText}>Partially Paid</Text>
                      </View>
                    </View>

                    {/* ───── SECTION 2: INTERACTIVE TABLE COLUMNS ───── */}
                    <View style={styles.columnsToolbarWrap}>
                      <View style={styles.columnsToolbarHeader}>
                        <Ionicons name="grid-outline" size={13} color={colors.clayDeep} />
                        <Text style={styles.columnsToolbarTitle}>Table Columns (Tap to Show/Hide on Bill):</Text>
                      </View>
                      <View style={styles.columnsChipsRow}>
                        {[
                          { key: 'showRate', label: 'Rate (விலை)', val: config.showRate },
                          { key: 'showUnit', label: 'Unit (அளவு)', val: config.showUnit },
                          { key: 'showGSTRate', label: 'GST % (வரி)', val: config.showGSTRate },
                          { key: 'showDiscount', label: 'Discount (தள்ளுபடி)', val: config.showDiscount },
                          { key: 'showHsn', label: 'HSN Code', val: config.showHsn },
                          { key: 'showItemSerialNo', label: 'S.No (#)', val: config.showItemSerialNo },
                        ].map((col) => (
                          <Pressable
                            key={col.key}
                            style={[
                              styles.colToggleChip,
                              col.val && styles.colToggleChipActive,
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
                                styles.colToggleChipText,
                                col.val && styles.colToggleChipTextActive,
                              ]}
                            >
                              {col.label}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>

                    {/* Table Render */}
                    <Pressable
                      style={[
                        styles.billSectionWrap,
                        activeSection === 'columns' && styles.billSectionActive,
                      ]}
                      onPress={() => handleSelectSection('columns')}
                    >
                      <View style={[styles.billTableHead, { backgroundColor: config.primaryColor }]}>
                        {config.showItemSerialNo && (
                          <Text style={[styles.billTh, { width: 28, color: colors.white }]}>#</Text>
                        )}
                        <Text style={[styles.billTh, { flex: 2.2, color: colors.white }]}>Item Description</Text>
                        {config.showHsn && (
                          <Text style={[styles.billTh, { width: 44, color: colors.white }]}>HSN</Text>
                        )}
                        <Text style={[styles.billTh, { width: 38, textAlign: 'center', color: colors.white }]}>Qty</Text>
                        {config.showUnit && (
                          <Text style={[styles.billTh, { width: 36, textAlign: 'center', color: colors.white }]}>Unit</Text>
                        )}
                        {config.showRate && (
                          <Text style={[styles.billTh, { width: 55, textAlign: 'right', color: colors.white }]}>Rate</Text>
                        )}
                        {config.showGSTRate && (
                          <Text style={[styles.billTh, { width: 45, textAlign: 'center', color: colors.white }]}>GST</Text>
                        )}
                        {config.showDiscount && (
                          <Text style={[styles.billTh, { width: 45, textAlign: 'right', color: colors.white }]}>Disc</Text>
                        )}
                        <Text style={[styles.billTh, { width: 65, textAlign: 'right', color: colors.white }]}>Amount</Text>
                      </View>

                      {SAMPLE_ORDER.items.map((it, idx) => (
                        <View
                          key={it.id}
                          style={[
                            styles.billTableRow,
                            idx % 2 === 1 && { backgroundColor: '#F8FAFC' },
                          ]}
                        >
                          {config.showItemSerialNo && (
                            <Text style={[styles.billTd, { width: 28, color: colors.inkSoft }]}>{idx + 1}</Text>
                          )}
                          <Text style={[styles.billTd, { flex: 2.2, fontFamily: fonts.bodyBold }]}>
                            {it.name}
                          </Text>
                          {config.showHsn && (
                            <Text style={[styles.billTd, { width: 44, color: colors.inkSoft, fontSize: 10 }]}>
                              {it.hsnCode || '-'}
                            </Text>
                          )}
                          <Text style={[styles.billTd, { width: 38, textAlign: 'center' }]}>{it.qty}</Text>
                          {config.showUnit && (
                            <Text style={[styles.billTd, { width: 36, textAlign: 'center', color: colors.inkSoft }]}>
                              {it.unit || '-'}
                            </Text>
                          )}
                          {config.showRate && (
                            <Text style={[styles.billTd, { width: 55, textAlign: 'right' }]}>
                              ₹{it.price}
                            </Text>
                          )}
                          {config.showGSTRate && (
                            <Text style={[styles.billTd, { width: 45, textAlign: 'center', fontSize: 10 }]}>
                              {it.taxRate ? `${it.taxRate}%` : '0%'}
                            </Text>
                          )}
                          {config.showDiscount && (
                            <Text style={[styles.billTd, { width: 45, textAlign: 'right', color: colors.inflow, fontSize: 10 }]}>
                              {it.discount ? `-₹${it.discount}` : '-'}
                            </Text>
                          )}
                          <Text style={[styles.billTd, { width: 65, textAlign: 'right', fontFamily: fonts.bodyBold }]}>
                            ₹{it.qty * it.price - (it.discount || 0)}
                          </Text>
                        </View>
                      ))}
                    </Pressable>

                    {/* ───── SECTION 3: SUMMARY & TOTALS ───── */}
                    <View style={styles.billSummaryBlock}>
                      <View style={{ flex: 1 }} />
                      <View style={styles.billTotalsCard}>
                        <View style={styles.billTotalRow}>
                          <Text style={styles.billTotalLabel}>Grand Total:</Text>
                          <Text style={styles.billTotalVal}>{formatCurrency(subtotal)}</Text>
                        </View>
                        <View style={styles.billTotalRow}>
                          <Text style={[styles.billTotalLabel, { color: colors.inflow }]}>Advance Paid:</Text>
                          <Text style={[styles.billTotalVal, { color: colors.inflow }]}>
                            {formatCurrency(advance)}
                          </Text>
                        </View>
                        <View style={[styles.billTotalRow, styles.balanceDueHighlight]}>
                          <Text style={[styles.billTotalLabel, { color: colors.danger, fontFamily: fonts.bodyBold }]}>
                            Balance Due:
                          </Text>
                          <Text style={[styles.billTotalVal, { color: colors.danger, fontFamily: fonts.bodyBold, fontSize: 14 }]}>
                            {formatCurrency(balance)}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* ───── SECTION 4: UPI QR & BANK DETAILS ───── */}
                    <Pressable
                      style={[
                        styles.billSectionWrap,
                        activeSection === 'payments' && styles.billSectionActive,
                        styles.paymentSectionBox,
                      ]}
                      onPress={() => handleSelectSection('payments')}
                    >
                      <View style={styles.sectionEditHint}>
                        <Ionicons name="qr-code" size={11} color={colors.clayDeep} />
                        <Text style={styles.sectionEditHintText}>UPI QR & Bank Details (Click to edit)</Text>
                      </View>

                      <View style={styles.paymentSectionInner}>
                        {config.showUpiQr && (
                          <View style={styles.qrMockCard}>
                            <View style={styles.qrPlaceholder}>
                              <Ionicons name="qr-code" size={44} color={config.primaryColor} />
                            </View>
                            <Text style={styles.qrText}>Scan to Pay via UPI</Text>
                            <Text style={styles.qrVpaText}>{config.upiId || bizProfile.upiId || 'store@upi'}</Text>
                          </View>
                        )}

                        {config.showBankDetails && (
                          <View style={styles.bankMockCard}>
                            <Text style={styles.bankMockTitle}>🏦 Bank Account Transfer</Text>
                            <Text style={styles.bankMockText}>
                              {config.bankDetailsCustom || bizProfile.bankDetails || 'State Bank of India\nA/C: 9876543210\nIFSC: SBIN0001234'}
                            </Text>
                          </View>
                        )}

                        {!config.showUpiQr && !config.showBankDetails && (
                          <View style={styles.emptyPaymentNotice}>
                            <Ionicons name="information-circle-outline" size={15} color={colors.inkSoft} />
                            <Text style={styles.emptyPaymentText}>
                              UPI QR and Bank details are currently hidden. Tap here to enable.
                            </Text>
                          </View>
                        )}
                      </View>
                    </Pressable>

                    {/* ───── SECTION 5: TERMS, NOTES & SIGNATURE ───── */}
                    <Pressable
                      style={[
                        styles.billSectionWrap,
                        activeSection === 'terms' && styles.billSectionActive,
                        styles.termsSectionBox,
                      ]}
                      onPress={() => handleSelectSection('terms')}
                    >
                      <View style={styles.sectionEditHint}>
                        <Ionicons name="document-text" size={11} color={colors.clayDeep} />
                        <Text style={styles.sectionEditHintText}>Terms & Signature (Click to edit)</Text>
                      </View>

                      <View style={styles.termsRow}>
                        <View style={{ flex: 1.4 }}>
                          {config.showTerms && (
                            <View style={{ marginBottom: 6 }}>
                              <Text style={styles.termsHeading}>{config.termsHeading || 'Terms & Conditions'}:</Text>
                              <Text style={styles.termsBody}>
                                {config.termsAndConditions || '1. Goods once sold will not be taken back.\n2. Warranty as per manufacturer norms.'}
                              </Text>
                            </View>
                          )}
                          <Text style={styles.footerNote}>{config.footerMessage || 'Thank you for your business!'}</Text>
                        </View>

                        {config.showSignatory && (
                          <View style={styles.signatureBox}>
                            <View style={styles.signLine} />
                            <Text style={styles.signTitle}>
                              For {bizProfile.businessName || 'Store'}
                            </Text>
                            <Text style={styles.signSub}>{config.signatoryTitle || 'Authorized Signatory'}</Text>
                          </View>
                        )}
                      </View>
                    </Pressable>
                  </View>
                </FadeInView>
              </ScrollView>
            </View>
          )}

          {/* ════ RIGHT COLUMN: Active Section Inspector & Controls ════ */}
          {(isDesktop || mobileTab === 'inspector') && (
            <View style={[styles.inspectorPane, isDesktop && { width: '44%' }]}>
              {/* Section Tabs Navigator */}
              <View style={styles.inspectorTabsHeader}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.inspectorTabsScroll}>
                  {[
                    { id: 'header', label: 'Store & Logo', icon: 'storefront-outline' },
                    { id: 'title', label: 'Title & Prefix', icon: 'document-outline' },
                    { id: 'columns', label: 'Columns', icon: 'grid-outline' },
                    { id: 'payments', label: 'UPI & Bank', icon: 'qr-code-outline' },
                    { id: 'terms', label: 'Terms & Sign', icon: 'pencil-outline' },
                    { id: 'theme', label: 'Colors & Paper', icon: 'color-palette-outline' },
                  ].map((sec) => {
                    const isSelected = activeSection === sec.id;
                    return (
                      <Pressable
                        key={sec.id}
                        style={[
                          styles.inspectorTab,
                          isSelected && styles.inspectorTabActive,
                        ]}
                        onPress={() => setActiveSection(sec.id as ActiveSection)}
                      >
                        <Ionicons
                          name={sec.icon as any}
                          size={14}
                          color={isSelected ? colors.white : colors.ink}
                        />
                        <Text
                          style={[
                            styles.inspectorTabText,
                            isSelected && styles.inspectorTabTextActive,
                          ]}
                        >
                          {sec.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>

              <ScrollView
                ref={controlsScrollRef}
                style={styles.inspectorScroll}
                contentContainerStyle={styles.inspectorContent}
                showsVerticalScrollIndicator={false}
              >
                {/* ── SECTION 1: HEADER & BUSINESS INFO ── */}
                {activeSection === 'header' && (
                  <View>
                    <View style={styles.inspectorHeaderTitleRow}>
                      <Ionicons name="storefront" size={18} color={colors.clayDeep} />
                      <Text style={styles.inspectorSectionTitle}>Store Details & Header</Text>
                    </View>
                    <Text style={styles.inspectorSectionDesc}>
                      {language === 'ta' ? 'பில்லில் தெரியும் உங்கள் கடையின் பெயர், முகவரி, போன் எண் மற்றும் லோகோ விவரங்கள்' : 'Edit your shop details and choose which contact lines appear on the bill.'}
                    </Text>

                    <View style={styles.formCard}>
                      <Text style={styles.inputLabel}>Shop / Business Name (கடையின் பெயர்) *</Text>
                      <TextInput
                        style={styles.inputField}
                        value={bizProfile.businessName}
                        onChangeText={(val) => setBizProfile((p) => ({ ...p, businessName: val }))}
                        placeholder="e.g. Sri Murugan Stores"
                        placeholderTextColor={colors.inkSoft}
                      />

                      <Text style={[styles.inputLabel, { marginTop: 12 }]}>Tagline / Subheading</Text>
                      <TextInput
                        style={styles.inputField}
                        value={bizProfile.tagline}
                        onChangeText={(val) => setBizProfile((p) => ({ ...p, tagline: val }))}
                        placeholder="e.g. Quality Groceries & Wholesaler"
                        placeholderTextColor={colors.inkSoft}
                      />

                      <Text style={[styles.inputLabel, { marginTop: 12 }]}>Phone Number (போன் எண்)</Text>
                      <TextInput
                        style={styles.inputField}
                        value={bizProfile.phone}
                        onChangeText={(val) => setBizProfile((p) => ({ ...p, phone: val }))}
                        placeholder="e.g. 9876543210"
                        placeholderTextColor={colors.inkSoft}
                        keyboardType="phone-pad"
                      />

                      <Text style={[styles.inputLabel, { marginTop: 12 }]}>Store Address (முகவரி)</Text>
                      <TextInput
                        style={[styles.inputField, { height: 60 }]}
                        value={bizProfile.address}
                        onChangeText={(val) => setBizProfile((p) => ({ ...p, address: val }))}
                        placeholder="e.g. 12, Main Bazaar Street, Madurai"
                        placeholderTextColor={colors.inkSoft}
                        multiline
                      />

                      <Text style={[styles.inputLabel, { marginTop: 12 }]}>GSTIN / Tax ID (வரி எண்)</Text>
                      <TextInput
                        style={styles.inputField}
                        value={bizProfile.gstin}
                        onChangeText={(val) => setBizProfile((p) => ({ ...p, gstin: val }))}
                        placeholder="e.g. 33AAAAA0000A1Z5"
                        placeholderTextColor={colors.inkSoft}
                        autoCapitalize="characters"
                      />
                    </View>

                    <View style={styles.formCard}>
                      <Text style={styles.cardHeaderSmall}>Visibility Toggles</Text>
                      <View style={styles.toggleRow}>
                        <Text style={styles.toggleText}>Show Store Logo</Text>
                        <Switch
                          value={config.showLogo}
                          onValueChange={(v) => setConfig((p) => ({ ...p, showLogo: v }))}
                          trackColor={{ false: colors.line, true: colors.clayLight }}
                          thumbColor={config.showLogo ? colors.clayDeep : '#f4f3f4'}
                        />
                      </View>
                      {config.showLogo && (
                        <View style={{ marginTop: 8, marginBottom: 8 }}>
                          <Text style={styles.inputLabel}>Logo Size</Text>
                          <View style={styles.chipRow}>
                            {(['small', 'medium', 'large'] as LogoSize[]).map((sz) => (
                              <Pressable
                                key={sz}
                                style={[
                                  styles.sizeChip,
                                  config.logoSize === sz && styles.sizeChipActive,
                                ]}
                                onPress={() => setConfig((p) => ({ ...p, logoSize: sz }))}
                              >
                                <Text
                                  style={[
                                    styles.sizeChipText,
                                    config.logoSize === sz && styles.sizeChipTextActive,
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
                        <Text style={styles.toggleText}>Show Address on Bill</Text>
                        <Switch
                          value={config.showBusinessAddress}
                          onValueChange={(v) => setConfig((p) => ({ ...p, showBusinessAddress: v }))}
                          trackColor={{ false: colors.line, true: colors.clayLight }}
                          thumbColor={config.showBusinessAddress ? colors.clayDeep : '#f4f3f4'}
                        />
                      </View>

                      <View style={styles.toggleRow}>
                        <Text style={styles.toggleText}>Show GSTIN on Bill</Text>
                        <Switch
                          value={config.showGstin}
                          onValueChange={(v) => setConfig((p) => ({ ...p, showGstin: v }))}
                          trackColor={{ false: colors.line, true: colors.clayLight }}
                          thumbColor={config.showGstin ? colors.clayDeep : '#f4f3f4'}
                        />
                      </View>
                    </View>
                  </View>
                )}

                {/* ── SECTION 2: TITLE & NUMBERING ── */}
                {activeSection === 'title' && (
                  <View>
                    <View style={styles.inspectorHeaderTitleRow}>
                      <Ionicons name="document-text" size={18} color={colors.clayDeep} />
                      <Text style={styles.inspectorSectionTitle}>Bill Title & Numbering</Text>
                    </View>
                    <Text style={styles.inspectorSectionDesc}>
                      {language === 'ta' ? 'பில்லின் தலைப்பு (Tax Invoice, Cash Bill) மற்றும் எண் வகை' : 'Customize document header title, bill numbering prefix, and due dates.'}
                    </Text>

                    <View style={styles.formCard}>
                      <Text style={styles.inputLabel}>Invoice Title Text</Text>
                      <TextInput
                        style={styles.inputField}
                        value={config.invoiceTitle}
                        onChangeText={(val) => setConfig((p) => ({ ...p, invoiceTitle: val }))}
                        placeholder="e.g. TAX INVOICE, CASH BILL"
                        placeholderTextColor={colors.inkSoft}
                      />

                      <View style={styles.quickTagsContainer}>
                        <Text style={styles.quickTagsHeader}>Quick Suggestions:</Text>
                        <View style={styles.chipRow}>
                          {[
                            'TAX INVOICE',
                            'CASH BILL',
                            'RETAIL INVOICE',
                            'BILL OF SUPPLY',
                            'ESTIMATE / QUOTE',
                          ].map((tName) => (
                            <Pressable
                              key={tName}
                              style={[
                                styles.quickTagPill,
                                config.invoiceTitle === tName && styles.quickTagPillActive,
                              ]}
                              onPress={() => setConfig((p) => ({ ...p, invoiceTitle: tName }))}
                            >
                              <Text
                                style={[
                                  styles.quickTagPillText,
                                  config.invoiceTitle === tName && styles.quickTagPillTextActive,
                                ]}
                              >
                                {tName}
                              </Text>
                            </Pressable>
                          ))}
                        </View>
                      </View>

                      <Text style={[styles.inputLabel, { marginTop: 14 }]}>Invoice Number Prefix</Text>
                      <TextInput
                        style={styles.inputField}
                        value={config.invoicePrefix}
                        onChangeText={(val) => setConfig((p) => ({ ...p, invoicePrefix: val }))}
                        placeholder="e.g. INV-, BILL-, ORD-"
                        placeholderTextColor={colors.inkSoft}
                      />
                    </View>

                    <View style={styles.formCard}>
                      <Text style={styles.cardHeaderSmall}>Date & Customer Info</Text>
                      <View style={styles.toggleRow}>
                        <Text style={styles.toggleText}>Show Due Date</Text>
                        <Switch
                          value={config.showDueDate}
                          onValueChange={(v) => setConfig((p) => ({ ...p, showDueDate: v }))}
                          trackColor={{ false: colors.line, true: colors.clayLight }}
                          thumbColor={config.showDueDate ? colors.clayDeep : '#f4f3f4'}
                        />
                      </View>
                      <View style={styles.toggleRow}>
                        <Text style={styles.toggleText}>Show Customer Phone Number</Text>
                        <Switch
                          value={config.showCustomerPhone}
                          onValueChange={(v) => setConfig((p) => ({ ...p, showCustomerPhone: v }))}
                          trackColor={{ false: colors.line, true: colors.clayLight }}
                          thumbColor={config.showCustomerPhone ? colors.clayDeep : '#f4f3f4'}
                        />
                      </View>
                    </View>
                  </View>
                )}

                {/* ── SECTION 3: TABLE COLUMNS ── */}
                {activeSection === 'columns' && (
                  <View>
                    <View style={styles.inspectorHeaderTitleRow}>
                      <Ionicons name="grid" size={18} color={colors.clayDeep} />
                      <Text style={styles.inspectorSectionTitle}>Bill Table Columns</Text>
                    </View>
                    <Text style={styles.inspectorSectionDesc}>
                      {language === 'ta' ? 'பில் அட்டவணையில் எந்தெந்த காலம்கள் தோன்ற வேண்டும் என்பதை தேர்வு செய்யவும்' : 'Toggle item table columns to match your business type and bill size.'}
                    </Text>

                    <View style={styles.formCard}>
                      {[
                        { key: 'showRate', title: 'Unit Price / Rate (விலை)', desc: 'Displays unit price for each item' },
                        { key: 'showUnit', title: 'Unit of Measure (அளவு/எடை)', desc: 'Displays kg, pcs, box, liters, etc.' },
                        { key: 'showGSTRate', title: 'GST Tax % (வரி விகிதம்)', desc: 'Displays 5%, 12%, 18% tax breakdown per item' },
                        { key: 'showDiscount', title: 'Item Discount (தள்ளுபடி)', desc: 'Displays discounted rupees per item' },
                        { key: 'showHsn', title: 'HSN / SAC Code', desc: 'Displays HSN code for GST compliance' },
                        { key: 'showItemSerialNo', title: 'Serial Number (#)', desc: 'Numbered item rows (1, 2, 3...)' },
                      ].map((col) => {
                        const isChecked = Boolean(config[col.key as keyof InvoiceTemplateConfig]);
                        return (
                          <View key={col.key} style={styles.columnToggleItem}>
                            <View style={{ flex: 1, paddingRight: 8 }}>
                              <Text style={styles.columnToggleTitle}>{col.title}</Text>
                              <Text style={styles.columnToggleDesc}>{col.desc}</Text>
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
                  </View>
                )}

                {/* ── SECTION 4: PAYMENTS & UPI QR ── */}
                {activeSection === 'payments' && (
                  <View>
                    <View style={styles.inspectorHeaderTitleRow}>
                      <Ionicons name="qr-code" size={18} color={colors.clayDeep} />
                      <Text style={styles.inspectorSectionTitle}>UPI QR Code & Bank Info</Text>
                    </View>
                    <Text style={styles.inspectorSectionDesc}>
                      {language === 'ta' ? 'வாடிக்கையாளர் பில்லில் உள்ள QR ஸ்கேன் செய்து உடனடியாக பணம் செலுத்த' : 'Enable automated UPI payment QR codes on every invoice for instant collections.'}
                    </Text>

                    <View style={styles.formCard}>
                      <View style={styles.toggleRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.toggleText}>Show Dynamic UPI QR Code</Text>
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
                            placeholder="e.g. yourstore@okhdfcbank"
                            placeholderTextColor={colors.inkSoft}
                            autoCapitalize="none"
                          />
                        </View>
                      )}
                    </View>

                    <View style={styles.formCard}>
                      <View style={styles.toggleRow}>
                        <Text style={styles.toggleText}>Show Bank Account Details</Text>
                        <Switch
                          value={config.showBankDetails}
                          onValueChange={(v) => setConfig((p) => ({ ...p, showBankDetails: v }))}
                          trackColor={{ false: colors.line, true: colors.clayLight }}
                          thumbColor={config.showBankDetails ? colors.clayDeep : '#f4f3f4'}
                        />
                      </View>

                      {config.showBankDetails && (
                        <View style={{ marginTop: 12 }}>
                          <Text style={styles.inputLabel}>Bank Details (வங்கி விபரம்)</Text>
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
                  </View>
                )}

                {/* ── SECTION 5: TERMS & SIGNATURE ── */}
                {activeSection === 'terms' && (
                  <View>
                    <View style={styles.inspectorHeaderTitleRow}>
                      <Ionicons name="document-text" size={18} color={colors.clayDeep} />
                      <Text style={styles.inspectorSectionTitle}>Terms, Notes & Signature</Text>
                    </View>
                    <Text style={styles.inspectorSectionDesc}>
                      {language === 'ta' ? 'பில்லின் அடியில் வரக்கூடிய விதிகள், நன்றி செய்தி மற்றும் கையொப்பம்' : 'Customize return policy terms, footer message, and authorized signatory seal.'}
                    </Text>

                    <View style={styles.formCard}>
                      <View style={styles.toggleRow}>
                        <Text style={styles.toggleText}>Show Terms & Conditions</Text>
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
                            placeholder="1. Goods once sold cannot be returned.\n2. 18% interest on overdue bills."
                            placeholderTextColor={colors.inkSoft}
                            multiline
                          />
                        </View>
                      )}
                    </View>

                    <View style={styles.formCard}>
                      <View style={styles.toggleRow}>
                        <Text style={styles.toggleText}>Show Authorized Signatory Box</Text>
                        <Switch
                          value={config.showSignatory}
                          onValueChange={(v) => setConfig((p) => ({ ...p, showSignatory: v }))}
                          trackColor={{ false: colors.line, true: colors.clayLight }}
                          thumbColor={config.showSignatory ? colors.clayDeep : '#f4f3f4'}
                        />
                      </View>

                      {config.showSignatory && (
                        <View style={{ marginTop: 12 }}>
                          <Text style={styles.inputLabel}>Signatory Label</Text>
                          <TextInput
                            style={styles.inputField}
                            value={config.signatoryTitle}
                            onChangeText={(val) => setConfig((p) => ({ ...p, signatoryTitle: val }))}
                            placeholder="e.g. Authorized Signatory / Manager"
                            placeholderTextColor={colors.inkSoft}
                          />
                        </View>
                      )}

                      <Text style={[styles.inputLabel, { marginTop: 14 }]}>Footer Thank You Note</Text>
                      <TextInput
                        style={styles.inputField}
                        value={config.footerMessage}
                        onChangeText={(val) => setConfig((p) => ({ ...p, footerMessage: val }))}
                        placeholder="e.g. Thank you for your business! Visit Again."
                        placeholderTextColor={colors.inkSoft}
                      />
                    </View>
                  </View>
                )}

                {/* ── SECTION 6: COLORS & PAPER SIZE ── */}
                {activeSection === 'theme' && (
                  <View>
                    <View style={styles.inspectorHeaderTitleRow}>
                      <Ionicons name="color-palette" size={18} color={colors.clayDeep} />
                      <Text style={styles.inspectorSectionTitle}>Color Themes & Paper Size</Text>
                    </View>
                    <Text style={styles.inspectorSectionDesc}>
                      {language === 'ta' ? 'பில்லின் கலர் தீம் மற்றும் பிரிண்ட் பேப்பர் அளவை மாற்றலாம்' : 'Select print paper format and custom color accents.'}
                    </Text>

                    <View style={styles.formCard}>
                      <Text style={styles.cardHeaderSmall}>Paper Sizing</Text>
                      <View style={styles.chipRow}>
                        {[
                          { id: 'a4', label: 'A4 Full Page' },
                          { id: 'a5', label: 'A5 Half Page' },
                          { id: 'thermal_80mm', label: '80mm POS Thermal' },
                          { id: 'thermal_58mm', label: '58mm POS Thermal' },
                        ].map((p) => (
                          <Pressable
                            key={p.id}
                            style={[
                              styles.paperSizeChip,
                              config.paperSize === p.id && styles.paperSizeChipActive,
                            ]}
                            onPress={() => setConfig((prev) => ({ ...prev, paperSize: p.id as PaperSize }))}
                          >
                            <Text
                              style={[
                                styles.paperSizeChipText,
                                config.paperSize === p.id && styles.paperSizeChipTextActive,
                              ]}
                            >
                              {p.label}
                            </Text>
                          </Pressable>
                        ))}
                      </View>

                      <View style={[styles.toggleRow, { marginTop: 12 }]}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.toggleText}>Compact Spacing Mode</Text>
                          <Text style={styles.toggleSub}>Reduces bill height for thermal printers</Text>
                        </View>
                        <Switch
                          value={config.compactMode}
                          onValueChange={(v) => setConfig((p) => ({ ...p, compactMode: v }))}
                          trackColor={{ false: colors.line, true: colors.clayLight }}
                          thumbColor={config.compactMode ? colors.clayDeep : '#f4f3f4'}
                        />
                      </View>
                    </View>

                    <View style={styles.formCard}>
                      <Text style={styles.cardHeaderSmall}>Reset Settings</Text>
                      <Pressable
                        style={({ pressed }) => [styles.resetBtn, pressed && { opacity: 0.8 }]}
                        onPress={handleReset}
                      >
                        <Ionicons name="refresh-outline" size={15} color={colors.danger} />
                        <Text style={styles.resetBtnText}>Restore Default Bill Template</Text>
                      </Pressable>
                    </View>
                  </View>
                )}
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
  liveTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  liveTagDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16A34A',
  },
  liveTagText: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    color: '#15803D',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  testPrintBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.paperCard,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.line,
  },
  testPrintBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: colors.ink,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.clayDeep,
    paddingHorizontal: 13,
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
  studioContainer: {
    flex: 1,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  canvasPane: {
    flex: 1,
    height: '100%',
    backgroundColor: '#F1F5F9',
    borderRightWidth: 1,
    borderRightColor: colors.line,
  },
  quickPresetBar: {
    backgroundColor: colors.paperCard,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  quickPresetScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  presetBarLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: colors.inkSoft,
    marginRight: 4,
  },
  quickThemeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: colors.paper,
    borderWidth: 1,
  },
  quickThemeChipActive: {
    backgroundColor: '#FAF5EE',
  },
  quickThemeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  quickThemeText: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.inkSoft,
  },
  canvasScroll: {
    flex: 1,
  },
  canvasContent: {
    padding: 16,
    alignItems: 'center',
    paddingBottom: 60,
  },
  interactivePaper: {
    width: '100%',
    maxWidth: 580,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1.5,
    ...shadow.card,
    elevation: 4,
    overflow: 'hidden',
  },
  billSectionWrap: {
    padding: 14,
    position: 'relative',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  billSectionActive: {
    borderColor: colors.clayDeep,
    backgroundColor: 'rgba(194, 93, 44, 0.03)',
  },
  sectionEditHint: {
    position: 'absolute',
    top: 4,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    zIndex: 10,
  },
  sectionEditHintText: {
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    color: colors.clayDeep,
  },
  billHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  mockLogoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  mockLogoText: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    letterSpacing: 1,
  },
  billStoreName: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    letterSpacing: 0.5,
  },
  billStoreTagline: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.inkSoft,
    marginTop: 1,
  },
  billContactBlock: {
    marginTop: 6,
    gap: 1,
  },
  billContactLine: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.ink,
  },
  gstinHighlight: {
    fontFamily: fonts.bodyBold,
    color: colors.clayDeep,
  },
  billTitleBox: {
    alignItems: 'flex-end',
    minWidth: 130,
  },
  billTitlePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.sm,
    marginBottom: 6,
  },
  billTitleText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: colors.white,
    letterSpacing: 0.8,
  },
  billMetaLine: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.ink,
    marginTop: 1,
  },
  quickTitleStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F8FAFC',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E2E8F0',
  },
  quickStripLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    color: colors.inkSoft,
  },
  quickTitleChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  quickTitleChipActive: {
    backgroundColor: colors.clayLight,
    borderColor: colors.clayDeep,
  },
  quickTitleChipText: {
    fontFamily: fonts.body,
    fontSize: 9.5,
    color: colors.ink,
  },
  quickTitleChipTextActive: {
    fontFamily: fonts.bodyBold,
    color: colors.clayDeep,
  },
  billCustomerStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#FAFAFA',
  },
  billCustomerLabel: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.inkSoft,
  },
  billCustomerName: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: colors.ink,
  },
  billCustomerSub: {
    fontFamily: fonts.body,
    fontSize: 10.5,
    color: colors.inkSoft,
  },
  statusPaidPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  statusPaidText: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    color: '#15803D',
  },
  columnsToolbarWrap: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  columnsToolbarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  columnsToolbarTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 10.5,
    color: colors.ink,
  },
  columnsChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  colToggleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  colToggleChipActive: {
    backgroundColor: colors.clayDeep,
    borderColor: colors.clayDeep,
  },
  colToggleChipText: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.ink,
  },
  colToggleChipTextActive: {
    fontFamily: fonts.bodyBold,
    color: colors.white,
  },
  billTableHead: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 4,
    marginBottom: 4,
  },
  billTh: {
    fontFamily: fonts.bodyBold,
    fontSize: 10.5,
  },
  billTableRow: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    alignItems: 'center',
  },
  billTd: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.ink,
  },
  billSummaryBlock: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  billTotalsCard: {
    width: 210,
    gap: 3,
  },
  billTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  billTotalLabel: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.ink,
  },
  billTotalVal: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: colors.ink,
  },
  balanceDueHighlight: {
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 3,
    marginTop: 2,
  },
  paymentSectionBox: {
    backgroundColor: '#FAFCFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  paymentSectionInner: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 4,
  },
  qrMockCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    minWidth: 110,
  },
  qrPlaceholder: {
    width: 50,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrText: {
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    color: colors.ink,
    marginTop: 2,
  },
  qrVpaText: {
    fontFamily: fonts.body,
    fontSize: 8.5,
    color: colors.clayDeep,
  },
  bankMockCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    minWidth: 140,
  },
  bankMockTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    color: colors.ink,
    marginBottom: 2,
  },
  bankMockText: {
    fontFamily: fonts.body,
    fontSize: 9.5,
    color: colors.inkSoft,
    lineHeight: 14,
  },
  emptyPaymentNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
  },
  emptyPaymentText: {
    fontFamily: fonts.body,
    fontSize: 10.5,
    color: colors.inkSoft,
  },
  termsSectionBox: {
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  termsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 6,
  },
  termsHeading: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    color: colors.ink,
  },
  termsBody: {
    fontFamily: fonts.body,
    fontSize: 9,
    color: colors.inkSoft,
    lineHeight: 13,
  },
  footerNote: {
    fontFamily: fonts.bodyBold,
    fontSize: 9.5,
    color: colors.clayDeep,
    marginTop: 4,
  },
  signatureBox: {
    width: 130,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  signLine: {
    width: '100%',
    height: 1,
    backgroundColor: '#94A3B8',
    marginBottom: 4,
  },
  signTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 9.5,
    color: colors.ink,
    textAlign: 'center',
  },
  signSub: {
    fontFamily: fonts.body,
    fontSize: 8.5,
    color: colors.inkSoft,
    textAlign: 'center',
  },

  /* ════ RIGHT INSPECTOR PANE ════ */
  inspectorPane: {
    flex: 1,
    height: '100%',
    backgroundColor: colors.paper,
  },
  inspectorTabsHeader: {
    backgroundColor: colors.paperCard,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    paddingVertical: 6,
  },
  inspectorTabsScroll: {
    paddingHorizontal: 12,
    gap: 6,
    flexDirection: 'row',
  },
  inspectorTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
  },
  inspectorTabActive: {
    backgroundColor: colors.clayDeep,
    borderColor: colors.clayDeep,
  },
  inspectorTabText: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.ink,
  },
  inspectorTabTextActive: {
    fontFamily: fonts.bodyBold,
    color: colors.white,
  },
  inspectorScroll: {
    flex: 1,
  },
  inspectorContent: {
    padding: 16,
    paddingBottom: 60,
  },
  inspectorHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 3,
  },
  inspectorSectionTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    color: colors.ink,
  },
  inspectorSectionDesc: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.inkSoft,
    marginBottom: 12,
  },
  formCard: {
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
  toggleText: {
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
  sizeChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.sm,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
  },
  sizeChipActive: {
    backgroundColor: colors.clayLight,
    borderColor: colors.clayDeep,
  },
  sizeChipText: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.ink,
  },
  sizeChipTextActive: {
    fontFamily: fonts.bodyBold,
    color: colors.clayDeep,
  },
  quickTagsContainer: {
    marginTop: 10,
  },
  quickTagsHeader: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.inkSoft,
    marginBottom: 4,
  },
  quickTagPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.sm,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
  },
  quickTagPillActive: {
    backgroundColor: colors.clayLight,
    borderColor: colors.clayDeep,
  },
  quickTagPillText: {
    fontFamily: fonts.body,
    fontSize: 10.5,
    color: colors.ink,
  },
  quickTagPillTextActive: {
    fontFamily: fonts.bodyBold,
    color: colors.clayDeep,
  },
  columnToggleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  columnToggleTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: colors.ink,
  },
  columnToggleDesc: {
    fontFamily: fonts.body,
    fontSize: 10.5,
    color: colors.inkSoft,
    marginTop: 1,
  },
  paperSizeChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.sm,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
  },
  paperSizeChipActive: {
    backgroundColor: colors.clayLight,
    borderColor: colors.clayDeep,
  },
  paperSizeChipText: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.ink,
  },
  paperSizeChipTextActive: {
    fontFamily: fonts.bodyBold,
    color: colors.clayDeep,
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: '#FEF2F2',
  },
  resetBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: colors.danger,
  },
});
