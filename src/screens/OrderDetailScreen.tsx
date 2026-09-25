import React, { useCallback, useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Alert,
  Linking,
  Share,
  TextInput,
  Modal,
  Platform,
  StatusBar,
  Image,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { RootStackParamList } from '../navigation/types';
import { Order, PaymentEntry, orderTotal, orderBalance } from '../types/order';
import {
  getOrder,
  deleteOrder,
  setOrderStatus,
  saveOrder,
} from '../storage/orderStorage';
import { getPaymentsForOrder, addPayment } from '../storage/paymentStorage';
import { getAuthState, UserAccount } from '../storage/authStorage';
import { getBusinessProfile, BusinessProfile } from '../storage/businessProfileStorage';
import { addDataListener } from '../storage/firebaseSync';
import { colors, fonts, radius, shadow, statusColor } from '../theme/theme';
import { checkProStatus } from '../storage/subscriptionStorage';
import { assertSubscriptionLimit } from '../utils/subscriptionGuard';
import { confirmAction } from '../utils/dialog';
import { formatCurrency, formatDate, formatDateTime, todayIso } from '../utils/format';
import {
  sendWhatsAppInvoice,
  sharePdfInvoiceToWhatsApp,
  printPdfInvoice,
  generatePrintableInvoiceHtml,
} from '../utils/invoiceGenerator';
import {
  InvoiceTemplateConfig,
  InvoiceTemplateId,
  PaperSize,
  INVOICE_THEME_PRESETS,
  DEFAULT_INVOICE_TEMPLATE_CONFIG,
} from '../types/invoiceTemplate';
import { getInvoiceTemplateConfig } from '../storage/invoiceTemplateStorage';
import StatusTracker from '../components/StatusTracker';
import { AppLogoIcon } from '../components/AppLogo';
import GlassBackButton from '../components/GlassBackButton';
import { sendPaymentReminder } from '../utils/reminderGenerator';
import { useLanguage } from '../i18n/LanguageContext';

type Props = NativeStackScreenProps<RootStackParamList, 'OrderDetail'>;

export default function OrderDetailScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 640;

  const { orderId } = route.params;
  const { t } = useLanguage();
  const [order, setOrder] = useState<Order | null>(null);
  const [payments, setPayments] = useState<PaymentEntry[]>([]);

  const [userProfile, setUserProfile] = useState<UserAccount | null>(null);
  const [bizProfile, setBizProfile] = useState<BusinessProfile | null>(null);

  // Payment Recording Modal
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('UPI');
  const [payNote, setPayNote] = useState('');
  const [isSavingPayment, setIsSavingPayment] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<InvoiceTemplateId>('modern_slate');
  const [selectedPaperSize, setSelectedPaperSize] = useState<PaperSize>('a4');
  const [isCompactMode, setIsCompactMode] = useState(false);
  const [templateConfig, setTemplateConfig] = useState<InvoiceTemplateConfig>(DEFAULT_INVOICE_TEMPLATE_CONFIG);

  useEffect(() => {
    getAuthState().then((state) => {
      if (state.user) setUserProfile(state.user);
    });
    getBusinessProfile().then((b) => {
      if (b) setBizProfile(b);
    });
    getInvoiceTemplateConfig().then((cfg) => {
      setTemplateConfig(cfg);
      if (cfg.templateId) setSelectedTemplate(cfg.templateId);
      if (cfg.paperSize) setSelectedPaperSize(cfg.paperSize);
      if (cfg.compactMode !== undefined) setIsCompactMode(cfg.compactMode);
    });
  }, []);

  const loadData = useCallback(() => {
    let active = true;
    getOrder(orderId).then((o) => {
      if (active && o) setOrder(o);
    });
    getPaymentsForOrder(orderId).then((p) => {
      if (active) setPayments(p);
    });
    getBusinessProfile().then((b) => {
      if (active && b) setBizProfile(b);
    });
    getInvoiceTemplateConfig().then((cfg) => {
      if (active && cfg) {
        setTemplateConfig(cfg);
        if (cfg.templateId) setSelectedTemplate(cfg.templateId);
        if (cfg.paperSize) setSelectedPaperSize(cfg.paperSize);
        if (cfg.compactMode !== undefined) setIsCompactMode(cfg.compactMode);
      }
    });
    return () => {
      active = false;
    };
  }, [orderId]);

  const openPdfModal = useCallback(async () => {
    try {
      const [cfg, bp] = await Promise.all([
        getInvoiceTemplateConfig(),
        getBusinessProfile(),
      ]);
      if (cfg) {
        setTemplateConfig(cfg);
        if (cfg.templateId) setSelectedTemplate(cfg.templateId);
        if (cfg.paperSize) setSelectedPaperSize(cfg.paperSize);
        if (cfg.compactMode !== undefined) setIsCompactMode(cfg.compactMode);
      }
      if (bp) setBizProfile(bp);
    } catch (e) {
      console.error('Error refreshing template config for modal:', e);
    }
    setShowPdfModal(true);
  }, []);

  useFocusEffect(loadData);

  useEffect(() => {
    const unsub = addDataListener(() => {
      loadData();
    });
    return () => unsub();
  }, [loadData]);

  const activeBusinessProfile: BusinessProfile = useMemo(() => ({
    businessName: bizProfile?.businessName || userProfile?.businessName || 'KadaiBook Store',
    phone: bizProfile?.phone || userProfile?.phone || '',
    email: bizProfile?.email || userProfile?.email || '',
    address: bizProfile?.address || '',
    gstin: bizProfile?.gstin || '',
    tagline: bizProfile?.tagline || '',
    logoUri: bizProfile?.logoUri || '',
    bankDetails: bizProfile?.bankDetails || '',
    upiId: bizProfile?.upiId || '',
  }), [bizProfile, userProfile]);

  const selectedPreset = INVOICE_THEME_PRESETS[selectedTemplate] || INVOICE_THEME_PRESETS['modern_slate'];

  const activeConfig: InvoiceTemplateConfig = useMemo(() => ({
    ...templateConfig,
    templateId: selectedTemplate,
    primaryColor: selectedPreset.primaryColor,
    accentColor: selectedPreset.accentColor,
    headerBgColor: selectedPreset.headerBgColor,
    headerTextColor: selectedPreset.headerTextColor,
    cardBorderColor: selectedPreset.cardBorderColor,
    fontFamily: selectedPreset.fontFamily,
    paperSize: selectedPaperSize,
    compactMode: isCompactMode,
  }), [templateConfig, selectedTemplate, selectedPreset, selectedPaperSize, isCompactMode]);

  const invoiceHtml = useMemo(() => {
    if (!order) return '';
    return generatePrintableInvoiceHtml(order, activeBusinessProfile, activeConfig);
  }, [order, activeBusinessProfile, activeConfig]);

  if (!order) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <View style={styles.topHeaderContainer}>
          <View style={styles.topHeaderInner}>
            <GlassBackButton label={t('common.back', 'Back')} />
          </View>
        </View>
        <View style={{ alignItems: 'center', justifyContent: 'center', marginTop: 60 }}>
          <ActivityIndicator size="large" color={colors.clayDeep} />
          <Text style={styles.loading}>{t('common.loading', 'Loading order details…')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const total = orderTotal(order);
  const balance = orderBalance(order);

  const handleDelete = () => {
    confirmAction({
      title: 'Delete order',
      message: `Remove ${order.orderNumber} from the book? This cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      destructive: true,
      onConfirm: async () => {
        await deleteOrder(order.id);
        navigation.goBack();
      },
    });
  };

  const checkOrderModificationAllowed = async (actionName: string): Promise<boolean> => {
    return assertSubscriptionLimit({
      type: 'order',
      actionName,
      navigation,
    });
  };

  const handleStatusChange = async (status: Order['status']) => {
    const allowed = await checkOrderModificationAllowed('update fulfillment status');
    if (!allowed) return;
    setOrder({ ...order, status });
    await setOrderStatus(order.id, status);
  };

  const handleOpenPaymentModal = async () => {
    const allowed = await checkOrderModificationAllowed('record payments and track balances');
    if (!allowed) return;
    setPayAmount(balance > 0 ? String(balance) : '');
    setShowPaymentModal(true);
  };

  const handleEditOrder = async () => {
    const allowed = await checkOrderModificationAllowed('edit this order');
    if (!allowed) return;
    navigation.navigate('OrderForm', { orderId: order.id });
  };

  const handleRecordPayment = async () => {
    if (!order || isSavingPayment) return;
    const allowed = await checkOrderModificationAllowed('record payments');
    if (!allowed) {
      setShowPaymentModal(false);
      return;
    }

    const amt = parseFloat(payAmount);
    if (!amt || amt <= 0) {
      Alert.alert('Amount required', 'Enter a valid payment amount.');
      return;
    }

    setIsSavingPayment(true);
    try {
      const nowIso = todayIso();
      await addPayment({
        orderId: order.id,
        amount: amt,
        date: nowIso,
        method: payMethod,
        note: payNote.trim() || undefined,
      });

      const newAdvance = (order.advance || 0) + amt;
      const newStatus = newAdvance >= total ? 'Paid' : 'Partial';

      const updated = await saveOrder({
        ...order,
        advance: newAdvance,
        paymentStatus: newStatus,
      });

      setOrder(updated);
      setPayAmount('');
      setPayNote('');
      setShowPaymentModal(false);
      loadData();
    } catch (err) {
      console.error('Error saving payment:', err);
    } finally {
      setIsSavingPayment(false);
    }
  };

  const callCustomer = () => {
    if (order.phoneNumber) Linking.openURL(`tel:${order.phoneNumber}`);
  };

  const checkTemplatePro = async () => {
    if (activeConfig.templateId !== 'modern_slate') {
      const isPro = await checkProStatus();
      if (!isPro) {
        Alert.alert(
          'Activate Pro to Use',
          'Your previously saved invoice template is a Pro feature. Please activate Pro to generate this invoice or customize it to use the default free template.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Activate Pro', onPress: () => (navigation as any).navigate('PaywallScreen') },
          ]
        );
        return false;
      }
    }
    return true;
  };

  const whatsappCustomer = async () => {
    if (order) {
      const isProTemplateAllowed = await checkTemplatePro();
      if (!isProTemplateAllowed) return;
      await sendWhatsAppInvoice(order, activeBusinessProfile, activeConfig);
    }
  };

  const sharePdfCustomer = async () => {
    if (order) {
      const isProTemplateAllowed = await checkTemplatePro();
      if (!isProTemplateAllowed) return;
      await sharePdfInvoiceToWhatsApp(order, activeBusinessProfile, activeConfig);
    }
  };

  const handleSendReminder = async () => {
    if (!order.phoneNumber) {
      Alert.alert('Phone Required', 'No phone number on this order.');
      return;
    }
    if (balance <= 0) {
      Alert.alert('Paid in Full', 'This order has no balance due.');
      return;
    }
    const sent = await sendPaymentReminder({
      customerName: order.customerName,
      phoneNumber: order.phoneNumber,
      balanceAmount: balance,
      businessName: bizProfile?.businessName || 'KadaiBook Store',
      orderNumbers: [order.orderNumber],
    });
    if (sent) {
      Alert.alert('Sent', 'Payment reminder sent to customer via WhatsApp!');
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      {/* ─── Modern Top Header Bar ─── */}
      <View style={styles.topHeaderContainer}>
        <View style={styles.topHeaderInner}>
          <GlassBackButton label={t('common.back', 'Back')} />
          <View style={styles.topHeaderTitleWrap}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Text style={styles.topHeaderTitle}>{order.orderNumber}</Text>
              <View style={[styles.statusChip, { backgroundColor: statusColor[order.status] || colors.clay }]}>
                <Text style={styles.statusChipText}>{order.status}</Text>
              </View>
            </View>
            <Text style={styles.topHeaderSub} numberOfLines={1}>
              {formatDate(order.orderDate)} • {order.customerName}
            </Text>
          </View>

          {/* Quick Header Action Buttons */}
          <View style={styles.topHeaderActions}>
            <Pressable
              style={styles.headerIconBtn}
              onPress={handleEditOrder}
              hitSlop={6}
              accessibilityLabel="Edit Order"
            >
              <Ionicons name="pencil" size={17} color={colors.ink} />
            </Pressable>
            <Pressable
              style={[styles.headerIconBtn, styles.headerDeleteIconBtn]}
              onPress={handleDelete}
              hitSlop={6}
              accessibilityLabel="Delete Order"
            >
              <Ionicons name="trash-outline" size={17} color={colors.danger} />
            </Pressable>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 110 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── HERO CARD: Financials & Status Progress ─── */}
        <View style={styles.heroCard}>
          <View style={styles.heroFinancialsRow}>
            <View style={styles.heroFinancialItem}>
              <Text style={styles.heroFinancialLabel}>{t('orders.totalAmount', 'Total Bill')}</Text>
              <Text style={styles.heroFinancialTotalVal}>{formatCurrency(total)}</Text>
            </View>

            <View style={styles.heroFinancialDivider} />

            <View style={styles.heroFinancialItem}>
              <Text style={styles.heroFinancialLabel}>{t('orders.advancePaid', 'Advance Paid')}</Text>
              <Text style={[styles.heroFinancialVal, { color: colors.inflow }]}>
                {formatCurrency(order.advance)}
              </Text>
            </View>

            <View style={styles.heroFinancialDivider} />

            <View style={styles.heroFinancialItem}>
              <Text style={styles.heroFinancialLabel}>{t('orders.balanceDue', 'Balance Due')}</Text>
              <Text
                style={[
                  styles.heroFinancialVal,
                  { color: balance > 0 ? colors.danger : colors.success },
                ]}
              >
                {balance > 0 ? formatCurrency(balance) : 'Paid ✓'}
              </Text>
            </View>
          </View>

          {/* Fulfillment Status Tracker inside Hero */}
          <View style={styles.heroStatusTrackerWrap}>
            <Text style={styles.heroTrackerLabel}>Fulfillment Progress:</Text>
            <StatusTracker status={order.status} onChange={handleStatusChange} />
          </View>
        </View>

        {/* ─── QUICK ACTION RIBBON (1-Tap Super Actions) ─── */}
        <View style={styles.quickActionRibbon}>
          <Pressable
            style={({ pressed }) => [styles.quickActionBtn, styles.quickActionWhatsApp, pressed && { opacity: 0.85 }]}
            onPress={whatsappCustomer}
          >
            <Ionicons name="logo-whatsapp" size={18} color={colors.white} />
            <Text style={styles.quickActionBtnTextWhite}>WhatsApp Bill</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.quickActionBtn, styles.quickActionPdf, pressed && { opacity: 0.85 }]}
            onPress={sharePdfCustomer}
          >
            <Ionicons name="document-text-outline" size={18} color={colors.white} />
            <Text style={styles.quickActionBtnTextWhite}>Share PDF</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.quickActionBtn, styles.quickActionPreview, pressed && { opacity: 0.85 }]}
            onPress={openPdfModal}
          >
            <Ionicons name="eye-outline" size={18} color={colors.clayDeep} />
            <Text style={styles.quickActionBtnTextClay}>Preview</Text>
          </Pressable>
        </View>

        {/* ─── CARD 1: Customer Details & Contact ─── */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardHeaderIcon, { backgroundColor: '#E0F2FE' }]}>
              <Ionicons name="person" size={18} color="#0284C7" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{t('orders.customerInfo', 'Customer Details')}</Text>
              <Text style={styles.cardSubtitle}>Buyer identity and quick contact</Text>
            </View>
          </View>

          <View style={styles.customerProfileRow}>
            <View style={styles.customerAvatar}>
              <Text style={styles.customerAvatarText}>
                {(order.customerName || 'C').charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.customerNameText}>{order.customerName}</Text>
              {order.phoneNumber ? (
                <Text style={styles.customerPhoneText}>{order.phoneNumber}</Text>
              ) : (
                <Text style={styles.customerNoPhoneText}>No phone recorded</Text>
              )}
            </View>

            {/* Quick Action Contact Buttons */}
            {order.phoneNumber ? (
              <View style={styles.contactActionButtons}>
                <Pressable
                  style={styles.contactCallBtn}
                  onPress={callCustomer}
                  hitSlop={6}
                >
                  <Ionicons name="call" size={15} color="#0284C7" />
                  <Text style={styles.contactCallBtnText}>Call</Text>
                </Pressable>

                {balance > 0 && (
                  <Pressable
                    style={styles.contactRemindBtn}
                    onPress={handleSendReminder}
                    hitSlop={6}
                  >
                    <Ionicons name="notifications-outline" size={15} color="#D97706" />
                    <Text style={styles.contactRemindBtnText}>Remind</Text>
                  </Pressable>
                )}
              </View>
            ) : null}
          </View>
        </View>

        {/* ─── CARD 2: Dispatch & Payment Metadata (Full 2x2 Grid) ─── */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardHeaderIcon, { backgroundColor: '#F3E8FF' }]}>
              <Ionicons name="cube" size={18} color="#9333EA" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Dispatch & Payment Mode</Text>
              <Text style={styles.cardSubtitle}>Fulfillment method and payment terms</Text>
            </View>
          </View>

          <View style={styles.metaGrid}>
            <View style={styles.metaBox}>
              <Text style={styles.metaLabel}>Payment Mode</Text>
              <View style={styles.metaValueRow}>
                <Ionicons name="card-outline" size={16} color={colors.inkSoft} />
                <Text style={styles.metaValueText}>{order.paymentMethod || 'Cash'}</Text>
              </View>
            </View>

            <View style={styles.metaBox}>
              <Text style={styles.metaLabel}>Payment Status</Text>
              <View style={styles.metaValueRow}>
                <View
                  style={[
                    styles.paymentStatusDot,
                    {
                      backgroundColor:
                        order.paymentStatus === 'Paid'
                          ? colors.success
                          : order.paymentStatus === 'Partial'
                          ? colors.pending
                          : colors.danger,
                    },
                  ]}
                />
                <Text style={styles.metaValueText}>{order.paymentStatus || 'Pending'}</Text>
              </View>
            </View>

            <View style={styles.metaBox}>
              <Text style={styles.metaLabel}>Dispatch Method</Text>
              <View style={styles.metaValueRow}>
                <Ionicons name="paper-plane-outline" size={16} color={colors.inkSoft} />
                <Text style={styles.metaValueText}>{order.dispatchMethod || 'Courier'}</Text>
              </View>
            </View>

            {order.trackingNumber ? (
              <View style={styles.metaBox}>
                <Text style={styles.metaLabel}>Tracking Number</Text>
                <View style={styles.metaValueRow}>
                  <Ionicons name="barcode-outline" size={16} color={colors.inkSoft} />
                  <Text style={[styles.metaValueText, { fontFamily: fonts.bodyBold }]}>
                    {order.trackingNumber}
                  </Text>
                </View>
              </View>
            ) : order.dispatchDate ? (
              <View style={styles.metaBox}>
                <Text style={styles.metaLabel}>Dispatch Date</Text>
                <View style={styles.metaValueRow}>
                  <Ionicons name="calendar-outline" size={16} color={colors.inkSoft} />
                  <Text style={styles.metaValueText}>{order.dispatchDate}</Text>
                </View>
              </View>
            ) : (
              <View style={styles.metaBox}>
                <Text style={styles.metaLabel}>Order Date</Text>
                <View style={styles.metaValueRow}>
                  <Ionicons name="calendar-outline" size={16} color={colors.inkSoft} />
                  <Text style={styles.metaValueText}>{formatDate(order.orderDate)}</Text>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* ─── CARD 3: Ordered Items (Modern Cards) ─── */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardHeaderIcon, { backgroundColor: '#FEF3C7' }]}>
              <Ionicons name="basket" size={18} color="#D97706" />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.cardTitle}>{t('orders.items', 'Order Items')}</Text>
                <View style={styles.itemCountBadge}>
                  <Text style={styles.itemCountBadgeText}>{order.items.length}</Text>
                </View>
              </View>
              <Text style={styles.cardSubtitle}>Itemized breakdown and rates</Text>
            </View>
          </View>

          {/* Items List */}
          <View style={styles.itemsListContainer}>
            {order.items.map((item, idx) => (
              <View key={item.id || idx} style={styles.itemCardRow}>
                <View style={styles.itemCardIndex}>
                  <Text style={styles.itemCardIndexText}>#{idx + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemCardName}>{item.name}</Text>
                  <View style={styles.itemCardMetaRow}>
                    <Text style={styles.itemCardQtyRate}>
                      {item.qty} {item.unit || 'Pcs'} × {formatCurrency(item.price)}
                    </Text>
                    {/* Custom column tags */}
                    {order.customColumns?.map((col) => {
                      const val = item.customValues?.[col.id];
                      if (!val) return null;
                      return (
                        <View key={col.id} style={styles.customAttrTag}>
                          <Text style={styles.customAttrText}>
                            {col.name}: {val}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
                <Text style={styles.itemCardTotalVal}>
                  {formatCurrency(item.qty * item.price)}
                </Text>
              </View>
            ))}
          </View>

          {/* Item Totals Summary Box */}
          <View style={styles.itemsSummaryBox}>
            <View style={styles.summaryLine}>
              <Text style={styles.summaryLineLabel}>{t('orders.totalAmount', 'Subtotal')}</Text>
              <Text style={styles.summaryLineVal}>{formatCurrency(total)}</Text>
            </View>
            <View style={styles.summaryLine}>
              <Text style={styles.summaryLineLabel}>{t('orders.advancePaid', 'Advance Received')}</Text>
              <Text style={[styles.summaryLineVal, { color: colors.inflow }]}>
                {formatCurrency(order.advance)}
              </Text>
            </View>
            <View style={[styles.summaryLine, styles.summaryTotalLine]}>
              <Text style={styles.summaryTotalLabel}>{t('orders.balanceDue', 'Balance Due')}</Text>
              <Text
                style={[
                  styles.summaryTotalAmount,
                  { color: balance > 0 ? colors.danger : colors.success },
                ]}
              >
                {formatCurrency(balance)}
              </Text>
            </View>
          </View>
        </View>

        {/* ─── CARD 4: Payment History Log (if any collections recorded) ─── */}
        {payments.length > 0 && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={[styles.cardHeaderIcon, { backgroundColor: '#DCFCE7' }]}>
                <Ionicons name="receipt" size={18} color="#16A34A" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Payment Collection Log</Text>
                <Text style={styles.cardSubtitle}>Audit trail of installments received</Text>
              </View>
            </View>

            <View style={styles.paymentLogsList}>
              {payments.map((p) => (
                <View key={p.id} style={styles.paymentLogCard}>
                  <View style={styles.payLogLeft}>
                    <Text style={styles.payLogAmount}>+{formatCurrency(p.amount)}</Text>
                    <Text style={styles.payLogDate}>
                      {formatDateTime(p.createdAt || p.date)} • {p.method}
                    </Text>
                  </View>
                  {p.note ? <Text style={styles.payLogNote}>{p.note}</Text> : null}
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ─── CARD 5: Attached Photos ─── */}
        {order.photos && order.photos.length > 0 && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={[styles.cardHeaderIcon, { backgroundColor: '#FEF3C7' }]}>
                <Ionicons name="images" size={18} color="#D97706" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Attached Photos ({order.photos.length})</Text>
                <Text style={styles.cardSubtitle}>Reference photos, bills or design sketches</Text>
              </View>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
              {order.photos.map((uri, idx) => (
                <Image
                  key={idx}
                  source={{ uri }}
                  style={styles.photoThumb}
                />
              ))}
            </ScrollView>
          </View>
        )}

        {/* ─── CARD 6: Customer Notes ─── */}
        {order.customerNote ? (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={[styles.cardHeaderIcon, { backgroundColor: '#F3F4F6' }]}>
                <Ionicons name="document-text" size={18} color={colors.inkSoft} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{t('orders.customerNote', 'Customer Note')}</Text>
                <Text style={styles.cardSubtitle}>Special customizations or remarks</Text>
              </View>
            </View>
            <View style={styles.noteBox}>
              <Text style={styles.noteText}>{order.customerNote}</Text>
            </View>
          </View>
        ) : null}
      </ScrollView>

      {/* ─── STICKY BOTTOM BAR (Action Center) ─── */}
      <View style={[styles.stickyBottomBar, { paddingBottom: Math.max(12, insets.bottom + 6) }]}>
        <View style={styles.stickyBottomContent}>
          <View style={styles.stickyBottomInfo}>
            <Text style={styles.stickyBottomLabel}>
              {balance > 0 ? t('orders.balanceDue', 'Balance Due') : 'Payment Status'}
            </Text>
            <Text
              style={[
                styles.stickyBottomAmount,
                { color: balance > 0 ? colors.danger : colors.success },
              ]}
            >
              {balance > 0 ? formatCurrency(balance) : 'Paid in Full ✓'}
            </Text>
          </View>

          <View style={styles.stickyBottomActions}>
            {balance > 0 ? (
              <Pressable
                style={({ pressed }) => [styles.recordPayBtn, pressed && { opacity: 0.85 }]}
                onPress={handleOpenPaymentModal}
              >
                <Ionicons name="cash-outline" size={17} color={colors.white} />
                <Text style={styles.recordPayBtnText}>+ Collect ₹</Text>
              </Pressable>
            ) : null}

            <Pressable
              style={({ pressed }) => [styles.sharePdfBtn, pressed && { opacity: 0.85 }]}
              onPress={sharePdfCustomer}
            >
              <Ionicons name="share-outline" size={17} color={colors.white} />
              <Text style={styles.sharePdfBtnText}>Share Bill</Text>
            </Pressable>
          </View>
        </View>
      </View>

      {/* ─── MODAL 1: Payment Collection ─── */}
      <Modal
        visible={showPaymentModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPaymentModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowPaymentModal(false)}
        >
          <Pressable
            style={styles.modalCard}
            onPress={(e) => e.stopPropagation?.()}
          >
            <View style={styles.modalHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={[styles.cardHeaderIcon, { backgroundColor: '#DCFCE7' }]}>
                  <Ionicons name="cash" size={18} color="#16A34A" />
                </View>
                <Text style={styles.modalTitle}>Record Payment</Text>
              </View>
              <Pressable
                onPress={() => setShowPaymentModal(false)}
                hitSlop={8}
                style={styles.modalCloseIconBtn}
              >
                <Ionicons name="close" size={20} color={colors.inkSoft} />
              </Pressable>
            </View>

            <Text style={styles.modalSub}>
              Remaining balance due: <Text style={{ fontFamily: fonts.bodyBold, color: colors.danger }}>{formatCurrency(balance)}</Text>
            </Text>

            <View style={styles.modalField}>
              <Text style={styles.modalFieldLabel}>Amount Received (₹)</Text>
              <TextInput
                style={styles.modalInput}
                value={payAmount}
                onChangeText={setPayAmount}
                keyboardType="decimal-pad"
                placeholder={String(balance)}
                placeholderTextColor={colors.inkSoft}
                autoFocus
              />
            </View>

            <View style={styles.modalField}>
              <Text style={styles.modalFieldLabel}>Payment Mode</Text>
              <View style={styles.chipRow}>
                {['UPI', 'Cash', 'Card', 'Bank Transfer'].map((m) => (
                  <Pressable
                    key={m}
                    style={[styles.chip, payMethod === m && styles.chipActive]}
                    onPress={() => setPayMethod(m)}
                  >
                    <Text style={[styles.chipText, payMethod === m && styles.chipTextActive]}>
                      {m}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.modalField}>
              <Text style={styles.modalFieldLabel}>Note (Optional)</Text>
              <TextInput
                style={styles.modalInput}
                value={payNote}
                onChangeText={setPayNote}
                placeholder="e.g. GPay ref #1234, cash in counter"
                placeholderTextColor={colors.inkSoft}
              />
            </View>

            <View style={styles.modalBtnRow}>
              <Pressable
                style={styles.modalCancelBtn}
                disabled={isSavingPayment}
                onPress={() => setShowPaymentModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalSaveBtn, isSavingPayment && { opacity: 0.6 }]}
                disabled={isSavingPayment}
                onPress={handleRecordPayment}
              >
                {isSavingPayment ? (
                  <ActivityIndicator color={colors.white} size="small" />
                ) : (
                  <Text style={styles.modalSaveText}>Save Collection</Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ─── MODAL 2: Revamped Modern Invoice Preview & Sharing Hub ─── */}
      <Modal
        visible={showPdfModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowPdfModal(false)}
      >
        <SafeAreaView style={styles.pdfModalContainer} edges={['top', 'bottom', 'left', 'right']}>
          {/* ─── Top Glass Modal Header ─── */}
          <View
            style={[
              styles.pdfModalHeader,
              {
                paddingTop:
                  Platform.OS === 'ios'
                    ? Math.max(insets.top, 47) + 6
                    : (StatusBar.currentHeight || 16) + 8,
              },
            ]}
          >
            <View style={styles.pdfModalHeaderInner}>
              <Pressable
                style={styles.pdfModalCloseBtn}
                onPress={() => setShowPdfModal(false)}
                hitSlop={8}
              >
                <Ionicons name="close" size={22} color={colors.ink} />
              </Pressable>

              <View style={styles.pdfModalTitleCenter}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.pdfModalTitle}>Invoice Preview</Text>
                  <View
                    style={[
                      styles.pdfModalStatusBadge,
                      { backgroundColor: balance <= 0 ? '#DCFCE7' : '#FEF3C7' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.pdfModalStatusText,
                        { color: balance <= 0 ? '#15803D' : '#B45309' },
                      ]}
                    >
                      {balance <= 0 ? 'PAID' : `DUE ${formatCurrency(balance)}`}
                    </Text>
                  </View>
                </View>
                <Text style={styles.pdfModalSubtitle} numberOfLines={1}>
                  {order.orderNumber} • {order.customerName || 'Walk-in'}
                </Text>
              </View>

              <Pressable
                style={styles.pdfModalCustomizePill}
                onPress={() => {
                  setShowPdfModal(false);
                  navigation.navigate('InvoiceTemplateCustomizer');
                }}
              >
                <Ionicons name="options-outline" size={14} color={colors.clayDeep} />
                <Text style={styles.pdfModalCustomizeText}>Studio</Text>
              </Pressable>
            </View>
          </View>

          {/* ─── Interactive Template & Paper Switcher Ribbon ─── */}
          <View style={styles.pdfRibbonSection}>
            <View style={styles.pdfRibbonInner}>
              {/* Template Presets Horizontal Scroller */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.pdfTemplateChipsRow}
              >
                {Object.values(INVOICE_THEME_PRESETS).map((tmpl) => {
                  const isSelected = selectedTemplate === tmpl.id;
                  return (
                    <Pressable
                      key={tmpl.id}
                      style={[
                        styles.pdfThemeChip,
                        isSelected && styles.pdfThemeChipActive,
                        isSelected && {
                          borderColor: tmpl.primaryColor,
                          backgroundColor: tmpl.primaryColor + '14',
                        },
                      ]}
                      onPress={() => {
                        setSelectedTemplate(tmpl.id as InvoiceTemplateId);
                        if (tmpl.id === 'thermal_pos' && !selectedPaperSize.startsWith('thermal')) {
                          setSelectedPaperSize('thermal_80mm');
                        }
                      }}
                    >
                      <View
                        style={[
                          styles.pdfThemeDot,
                          { backgroundColor: tmpl.primaryColor },
                          isSelected && { borderColor: '#FFFFFF', borderWidth: 1.5 },
                        ]}
                      />
                      <Text
                        style={[
                          styles.pdfThemeChipText,
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
              <View style={styles.pdfPaperPillsRow}>
                <View style={styles.pdfPaperGroup}>
                  <Text style={styles.pdfPaperLabel}>Format:</Text>
                  {[
                    { id: 'a4', label: '📄 A4' },
                    { id: 'a5', label: '📑 A5' },
                    { id: 'thermal_80mm', label: '🧾 80mm POS' },
                    { id: 'thermal_58mm', label: '58mm' },
                  ].map((p) => {
                    const isSelected = selectedPaperSize === p.id;
                    return (
                      <Pressable
                        key={p.id}
                        style={[
                          styles.pdfPaperPill,
                          isSelected && styles.pdfPaperPillActive,
                        ]}
                        onPress={() => setSelectedPaperSize(p.id as PaperSize)}
                      >
                        <Text
                          style={[
                            styles.pdfPaperPillText,
                            isSelected && styles.pdfPaperPillTextActive,
                          ]}
                        >
                          {p.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Pressable
                  style={[
                    styles.pdfCompactPill,
                    isCompactMode && styles.pdfCompactPillActive,
                  ]}
                  onPress={() => setIsCompactMode((prev) => !prev)}
                >
                  <Ionicons
                    name={isCompactMode ? 'contract' : 'expand'}
                    size={12}
                    color={isCompactMode ? colors.white : colors.inkSoft}
                  />
                  <Text
                    style={[
                      styles.pdfCompactPillText,
                      isCompactMode && styles.pdfCompactPillTextActive,
                    ]}
                  >
                    {isCompactMode ? 'Compact: ON' : 'Compact'}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>

          {/* ─── Main Preview Stage Canvas ─── */}
          {Platform.OS === 'web' ? (
            <View style={[styles.pdfStageContainer, !isDesktop && { padding: 0 }]}>
              <View
                style={[
                  styles.pdfPaperWrapperWeb,
                  !isDesktop && { borderRadius: 0, borderWidth: 0, boxShadow: 'none' },
                  selectedPaperSize.startsWith('thermal') || selectedTemplate === 'thermal_pos'
                    ? { maxWidth: selectedPaperSize === 'thermal_58mm' ? 240 : 320 }
                    : selectedPaperSize === 'a5'
                    ? { maxWidth: 580 }
                    : { maxWidth: 740 },
                ]}
              >
                <iframe
                  key={`${selectedTemplate}-${selectedPaperSize}-${isCompactMode}-${JSON.stringify(activeBusinessProfile)}`}
                  title="Live Invoice Preview"
                  srcDoc={invoiceHtml}
                  style={{
                    width: '100%',
                    height: '100%',
                    minHeight: isDesktop ? '640px' : '520px',
                    border: 'none',
                    backgroundColor: '#FFFFFF',
                    borderRadius: isDesktop ? '8px' : '0px',
                    display: 'block',
                  }}
                />
              </View>
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={[styles.pdfNativeScroll, { paddingBottom: 120 }]}
              showsVerticalScrollIndicator={false}
            >
              {/* Native Document or Thermal Receipt rendering */}
              {selectedPaperSize.startsWith('thermal') || selectedTemplate === 'thermal_pos' ? (
                /* Thermal Slip Native Preview */
                <View style={styles.thermalNativeCard}>
                  <View style={styles.thermalHeader}>
                    <Text style={styles.thermalTitle}>{activeBusinessProfile.businessName?.toUpperCase()}</Text>
                    {activeBusinessProfile.tagline ? (
                      <Text style={styles.thermalSub}>{activeBusinessProfile.tagline}</Text>
                    ) : null}
                    {activeBusinessProfile.address ? (
                      <Text style={styles.thermalSub}>{activeBusinessProfile.address}</Text>
                    ) : null}
                    {activeBusinessProfile.phone ? (
                      <Text style={styles.thermalSub}>Ph: {activeBusinessProfile.phone}</Text>
                    ) : null}
                    {activeBusinessProfile.gstin ? (
                      <Text style={styles.thermalSub}>GSTIN: {activeBusinessProfile.gstin}</Text>
                    ) : null}
                  </View>

                  <View style={styles.thermalDashedDivider} />

                  <View style={styles.thermalMetaRow}>
                    <Text style={styles.thermalMono}>Bill #: {order.orderNumber}</Text>
                    <Text style={styles.thermalMono}>{formatDate(order.orderDate)}</Text>
                  </View>
                  <Text style={styles.thermalMono}>Customer: {order.customerName || 'Walk-in'}</Text>
                  {order.phoneNumber ? <Text style={styles.thermalMono}>Phone: {order.phoneNumber}</Text> : null}

                  <View style={styles.thermalDashedDivider} />

                  {/* Thermal Items */}
                  {order.items.map((it, idx) => (
                    <View key={it.id || idx} style={styles.thermalItemBlock}>
                      <View style={styles.thermalItemRow}>
                        <Text style={styles.thermalItemName}>{idx + 1}. {it.name || 'Item'}</Text>
                        <Text style={styles.thermalItemPrice}>{formatCurrency(it.qty * it.price - (it.discount || 0))}</Text>
                      </View>
                      <Text style={styles.thermalItemDetail}>
                        {it.qty} {it.unit || 'pcs'} x {formatCurrency(it.price)} {it.taxRate ? `(GST ${it.taxRate}%)` : ''}
                      </Text>
                    </View>
                  ))}

                  <View style={styles.thermalSolidDivider} />

                  <View style={styles.thermalTotalRow}>
                    <Text style={styles.thermalTotalLabel}>Grand Total:</Text>
                    <Text style={styles.thermalTotalVal}>{formatCurrency(total)}</Text>
                  </View>
                  <View style={styles.thermalTotalRow}>
                    <Text style={styles.thermalSub}>Advance Paid:</Text>
                    <Text style={styles.thermalSub}>{formatCurrency(order.advance)}</Text>
                  </View>
                  <View style={styles.thermalTotalRow}>
                    <Text style={styles.thermalMonoBold}>Balance Due:</Text>
                    <Text style={styles.thermalMonoBold}>{balance > 0 ? formatCurrency(balance) : 'PAID IN FULL'}</Text>
                  </View>

                  <View style={styles.thermalDashedDivider} />
                  <Text style={styles.thermalFooterText}>Thank you for your business!</Text>
                </View>
              ) : (
                /* Full Sheet Native Preview */
                <View
                  style={[
                    styles.pdfPaperCard,
                    {
                      borderColor: selectedPreset.cardBorderColor || colors.line,
                      maxWidth: selectedPaperSize === 'a5' ? 480 : 640,
                    },
                  ]}
                >
                  {/* Brand Header */}
                  <View
                    style={[
                      styles.pdfHeaderRow,
                      {
                        backgroundColor: selectedPreset.headerBgColor,
                        borderBottomColor: selectedPreset.primaryColor,
                      },
                    ]}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, flex: 1 }}>
                      {activeBusinessProfile.logoUri ? (
                        <Image
                          source={{ uri: activeBusinessProfile.logoUri }}
                          style={styles.pdfHeaderLogo}
                          resizeMode="contain"
                        />
                      ) : (
                        <AppLogoIcon size={44} />
                      )}
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.pdfBrandTitle,
                            { color: selectedPreset.headerTextColor || colors.clayDeep },
                          ]}
                        >
                          {activeBusinessProfile.businessName?.toUpperCase()}
                        </Text>
                        <Text
                          style={[
                            styles.pdfBrandSubtitle,
                            {
                              color: selectedPreset.headerTextColor
                                ? selectedPreset.headerTextColor + 'CC'
                                : colors.inkSoft,
                            },
                          ]}
                        >
                          {activeBusinessProfile.tagline || 'Official Business Invoice & Receipt'}
                        </Text>
                        {activeBusinessProfile.address ? (
                          <Text style={styles.pdfAddressText}>{activeBusinessProfile.address}</Text>
                        ) : null}
                        <View style={styles.pdfContactsRow}>
                          {activeBusinessProfile.phone ? (
                            <Text style={styles.pdfContactText}>Ph: {activeBusinessProfile.phone}</Text>
                          ) : null}
                          {activeBusinessProfile.gstin ? (
                            <Text style={[styles.pdfContactText, { fontFamily: fonts.bodyBold, color: selectedPreset.primaryColor }]}>
                              GSTIN: {activeBusinessProfile.gstin}
                            </Text>
                          ) : null}
                        </View>
                      </View>
                    </View>

                    <View style={{ alignItems: 'flex-end' }}>
                      <View
                        style={[
                          styles.pdfTitleBadge,
                          { backgroundColor: selectedPreset.primaryColor },
                        ]}
                      >
                        <Text style={styles.pdfTitleBadgeText}>
                          {(activeConfig.invoiceTitle || 'TAX INVOICE').toUpperCase()}
                        </Text>
                      </View>
                      <Text style={styles.pdfMetaLine}>Bill #: {order.orderNumber}</Text>
                      <Text style={styles.pdfMetaLine}>Date: {formatDate(order.orderDate)}</Text>
                    </View>
                  </View>

                  {/* Buyer Strip */}
                  <View style={styles.pdfBuyerStrip}>
                    <View>
                      <Text style={styles.pdfBuyerLabel}>BUYER / BILLED TO:</Text>
                      <Text style={styles.pdfBuyerName}>{order.customerName || 'Walk-in Customer'}</Text>
                      {order.phoneNumber ? (
                        <Text style={styles.pdfBuyerPhone}>Phone: {order.phoneNumber}</Text>
                      ) : null}
                    </View>
                    <View
                      style={[
                        styles.pdfStatusPill,
                        { backgroundColor: balance <= 0 ? '#DCFCE7' : '#FEF3C7' },
                      ]}
                    >
                      <Text
                        style={[
                          styles.pdfStatusPillText,
                          { color: balance <= 0 ? '#15803D' : '#B45309' },
                        ]}
                      >
                        {balance <= 0 ? 'PAID IN FULL' : 'PARTIALLY PAID'}
                      </Text>
                    </View>
                  </View>

                  {/* Itemized Table */}
                  <View style={styles.pdfTableWrap}>
                    <View
                      style={[
                        styles.pdfTableHeader,
                        { backgroundColor: selectedPreset.primaryColor },
                      ]}
                    >
                      <Text style={[styles.pdfTh, { width: 28, textAlign: 'center' }]}>#</Text>
                      <Text style={[styles.pdfTh, { flex: 2.5 }]}>Item</Text>
                      <Text style={[styles.pdfTh, { width: 44, textAlign: 'center' }]}>Qty</Text>
                      <Text style={[styles.pdfTh, { width: 68, textAlign: 'right' }]}>Rate</Text>
                      <Text style={[styles.pdfTh, { width: 75, textAlign: 'right' }]}>Total</Text>
                    </View>

                    {order.items.map((item, idx) => (
                      <View
                        key={item.id || idx}
                        style={[
                          styles.pdfTableRow,
                          idx % 2 === 1 && { backgroundColor: '#F8FAFC' },
                        ]}
                      >
                        <Text style={[styles.pdfTd, { width: 28, textAlign: 'center', color: colors.inkSoft }]}>
                          {idx + 1}
                        </Text>
                        <View style={{ flex: 2.5 }}>
                          <Text style={[styles.pdfTd, { fontFamily: fonts.bodyBold }]}>
                            {item.name || 'Item'}
                          </Text>
                          {item.hsnCode || item.unit ? (
                            <Text style={styles.pdfSubDetail}>
                              {item.hsnCode ? `HSN: ${item.hsnCode}` : ''}{item.hsnCode && item.unit ? ' • ' : ''}{item.unit ? `Unit: ${item.unit}` : ''}
                            </Text>
                          ) : null}
                        </View>
                        <Text style={[styles.pdfTd, { width: 44, textAlign: 'center' }]}>{item.qty}</Text>
                        <Text style={[styles.pdfTd, { width: 68, textAlign: 'right' }]}>
                          {formatCurrency(item.price)}
                        </Text>
                        <Text style={[styles.pdfTd, { width: 75, textAlign: 'right', fontFamily: fonts.bodyBold }]}>
                          {formatCurrency(item.qty * item.price - (item.discount || 0))}
                        </Text>
                      </View>
                    ))}
                  </View>

                  {/* Totals & Notes Section */}
                  <View style={styles.pdfTotalsSection}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.pdfSectionSmallTitle}>Amount in Words:</Text>
                      <Text style={styles.pdfWordsVal}>Rupees {Math.round(total)} Only</Text>
                      {order.customerNote ? (
                        <View style={{ marginTop: 8 }}>
                          <Text style={styles.pdfSectionSmallTitle}>Note:</Text>
                          <Text style={styles.pdfNoteVal}>{order.customerNote}</Text>
                        </View>
                      ) : null}
                    </View>

                    <View style={styles.pdfTotalsCard}>
                      <View style={styles.pdfCalcRow}>
                        <Text style={styles.pdfCalcLabel}>Subtotal:</Text>
                        <Text style={styles.pdfCalcVal}>{formatCurrency(total)}</Text>
                      </View>
                      <View style={styles.pdfCalcRow}>
                        <Text style={styles.pdfCalcLabel}>Advance Paid:</Text>
                        <Text style={[styles.pdfCalcVal, { color: colors.inflow }]}>
                          {formatCurrency(order.advance)}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.pdfCalcRow,
                          styles.pdfCalcBalanceRow,
                          {
                            backgroundColor: balance <= 0 ? '#F0FDF4' : '#FEF2F2',
                            borderColor: balance <= 0 ? '#BBF7D0' : '#FECACA',
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.pdfCalcBalanceLabel,
                            { color: balance <= 0 ? '#15803D' : '#DC2626' },
                          ]}
                        >
                          Balance Due:
                        </Text>
                        <Text
                          style={[
                            styles.pdfCalcBalanceVal,
                            { color: balance <= 0 ? '#15803D' : '#DC2626' },
                          ]}
                        >
                          {balance <= 0 ? '₹0 (PAID)' : formatCurrency(balance)}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Footer Terms & Signatory */}
                  <View style={styles.pdfFooterStrip}>
                    <Text style={styles.pdfFooterBrand}>Generated with KadaiBook</Text>
                    <Text style={styles.pdfFooterThankyou}>Thank you for your business!</Text>
                  </View>
                </View>
              )}
            </ScrollView>
          )}

          {/* ─── Sticky Bottom Action Bar ─── */}
          <View style={[styles.pdfStickyBottomBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            <View style={styles.pdfStickyBottomInner}>
              <Pressable
                style={({ pressed }) => [styles.pdfActionBtn, styles.pdfActionWhatsApp, pressed && { opacity: 0.85 }]}
                onPress={whatsappCustomer}
              >
                <Ionicons name="logo-whatsapp" size={18} color={colors.white} />
                <Text style={styles.pdfActionBtnTextWhite}>WhatsApp Bill</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [styles.pdfActionBtn, styles.pdfActionPdf, pressed && { opacity: 0.85 }]}
                onPress={sharePdfCustomer}
              >
                <Ionicons name="document-text-outline" size={18} color={colors.white} />
                <Text style={styles.pdfActionBtnTextWhite}>Share PDF</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [styles.pdfActionBtn, styles.pdfActionPrint, pressed && { opacity: 0.85 }]}
                onPress={async () => {
                  if (order) {
                    const isProAllowed = await checkTemplatePro();
                    if (!isProAllowed) return;
                    printPdfInvoice(order, activeBusinessProfile, activeConfig);
                  }
                }}
              >
                <Ionicons name="print-outline" size={18} color={colors.ink} />
                <Text style={styles.pdfActionBtnTextInk}>Print</Text>
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  topHeaderContainer: {
    backgroundColor: colors.paperCard,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    paddingHorizontal: 16,
    paddingTop: Platform.select({ web: 10, default: 8 }),
    paddingBottom: 10,
    zIndex: 10,
  },
  topHeaderInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    maxWidth: 860,
    alignSelf: 'center',
    width: '100%',
  },
  topHeaderTitleWrap: {
    flex: 1,
    minWidth: 0,
  },
  topHeaderTitle: {
    fontFamily: fonts.display,
    fontSize: 19,
    color: colors.ink,
    lineHeight: 23,
  },
  topHeaderSub: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.inkSoft,
    marginTop: 2,
  },
  topHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerIconBtn: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerDeleteIconBtn: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FECACA',
  },
  statusChip: {
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  statusChipText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: colors.white,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 14,
    width: '100%',
    maxWidth: 860,
    alignSelf: 'center',
  },
  loading: { fontFamily: fonts.body, color: colors.inkSoft, marginTop: 40, textAlign: 'center' },

  // ── Hero Financial & Status Card ──
  heroCard: {
    backgroundColor: colors.paperCard,
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.line,
    ...shadow.card,
  },
  heroFinancialsRow: {
    flexDirection: 'row',
    backgroundColor: colors.paper,
    borderRadius: radius.md,
    padding: 12,
    alignItems: 'center',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.line,
  },
  heroFinancialItem: { flex: 1, alignItems: 'center' },
  heroFinancialLabel: { fontFamily: fonts.body, fontSize: 11, color: colors.inkSoft, marginBottom: 2 },
  heroFinancialTotalVal: { fontFamily: fonts.display, fontSize: 18, color: colors.ink },
  heroFinancialVal: { fontFamily: fonts.bodyBold, fontSize: 15 },
  heroFinancialDivider: { width: 1, height: 28, backgroundColor: colors.line },
  heroStatusTrackerWrap: {
    paddingTop: 4,
  },
  heroTrackerLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.inkSoft,
    marginBottom: 8,
  },

  // ── Quick Action Ribbon ──
  quickActionRibbon: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  quickActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: radius.md,
    minHeight: 46,
    ...shadow.card,
  },
  quickActionWhatsApp: {
    backgroundColor: '#16A34A',
  },
  quickActionPdf: {
    backgroundColor: colors.clayDeep,
  },
  quickActionPreview: {
    backgroundColor: colors.paperCard,
    borderWidth: 1,
    borderColor: colors.clayDeep,
  },
  quickActionBtnTextWhite: {
    fontFamily: fonts.bodyBold,
    fontSize: 12.5,
    color: colors.white,
  },
  quickActionBtnTextClay: {
    fontFamily: fonts.bodyBold,
    fontSize: 12.5,
    color: colors.clayDeep,
  },

  // ── Card Standard Structure ──
  card: {
    backgroundColor: colors.paperCard,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 16,
    marginBottom: 14,
    ...shadow.card,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  cardHeaderIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontFamily: fonts.display,
    fontSize: 16,
    color: colors.ink,
  },
  cardSubtitle: {
    fontFamily: fonts.body,
    fontSize: 11.5,
    color: colors.inkSoft,
    marginTop: 1,
  },

  // ── Customer Details ──
  customerProfileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.paper,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
  },
  customerAvatar: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.duskLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customerAvatarText: {
    fontFamily: fonts.display,
    fontSize: 17,
    color: colors.duskDeep,
  },
  customerNameText: {
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    color: colors.ink,
  },
  customerPhoneText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.inkSoft,
    marginTop: 1,
  },
  customerNoPhoneText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.inkSoft,
    fontStyle: 'italic',
  },
  contactActionButtons: {
    flexDirection: 'row',
    gap: 6,
  },
  contactCallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E0F2FE',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  contactCallBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: '#0284C7',
  },
  contactRemindBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  contactRemindBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: '#D97706',
  },

  // ── Dispatch & Payment 2x2 Grid (Balanced Full-Width) ──
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metaBox: {
    flex: 1,
    minWidth: '47%',
    backgroundColor: colors.paper,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
  },
  metaLabel: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.inkSoft,
    marginBottom: 4,
  },
  metaValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaValueText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.ink,
  },
  paymentStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  // ── Items List ──
  itemCountBadge: {
    backgroundColor: colors.clayLight,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radius.pill,
  },
  itemCountBadgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: colors.clayDeep,
  },
  itemsListContainer: {
    gap: 8,
    marginBottom: 12,
  },
  itemCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.paper,
    padding: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
  },
  itemCardIndex: {
    width: 26,
    height: 26,
    borderRadius: radius.sm,
    backgroundColor: colors.paperCard,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemCardIndexText: {
    fontFamily: fonts.bodyBold,
    fontSize: 10.5,
    color: colors.inkSoft,
  },
  itemCardName: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.ink,
  },
  itemCardMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  itemCardQtyRate: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.inkSoft,
  },
  customAttrTag: {
    backgroundColor: colors.clayLight,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radius.sm,
  },
  customAttrText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 10,
    color: colors.clayDeep,
  },
  itemCardTotalVal: {
    fontFamily: fonts.display,
    fontSize: 15,
    color: colors.ink,
  },

  // Items Summary Box
  itemsSummaryBox: {
    backgroundColor: colors.paper,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 12,
  },
  summaryLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  summaryLineLabel: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.inkSoft,
  },
  summaryLineVal: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.ink,
  },
  summaryTotalLine: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
    marginTop: 6,
    paddingTop: 8,
  },
  summaryTotalLabel: {
    fontFamily: fonts.display,
    fontSize: 14,
    color: colors.ink,
  },
  summaryTotalAmount: {
    fontFamily: fonts.display,
    fontSize: 17,
  },

  // ── Payment History ──
  paymentLogsList: {
    gap: 8,
  },
  paymentLogCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.paper,
    padding: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
  },
  payLogLeft: { flex: 1 },
  payLogAmount: { fontFamily: fonts.display, fontSize: 14, color: colors.inflow },
  payLogDate: { fontFamily: fonts.body, fontSize: 11, color: colors.inkSoft, marginTop: 2 },
  payLogNote: { fontFamily: fonts.body, fontSize: 12, color: colors.ink, fontStyle: 'italic' },

  // Photos & Notes
  photoThumb: {
    width: 100,
    height: 100,
    borderRadius: radius.md,
    backgroundColor: colors.line,
  },
  noteBox: {
    backgroundColor: colors.paper,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
  },
  noteText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.ink,
    lineHeight: 18,
  },

  // ── Sticky Bottom Action Bar ──
  stickyBottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.paperCard,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingHorizontal: 16,
    paddingTop: 10,
    ...shadow.card,
  },
  stickyBottomContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    maxWidth: 860,
    alignSelf: 'center',
    width: '100%',
    gap: 12,
  },
  stickyBottomInfo: {
    flex: 1,
    minWidth: 100,
  },
  stickyBottomLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    color: colors.inkSoft,
  },
  stickyBottomAmount: {
    fontFamily: fonts.display,
    fontSize: 18,
    lineHeight: 22,
  },
  stickyBottomActions: {
    flexDirection: 'row',
    gap: 8,
  },
  recordPayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#16A34A',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: radius.md,
    ...shadow.card,
  },
  recordPayBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 13.5,
    color: colors.white,
  },
  sharePdfBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.clayDeep,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: radius.md,
    ...shadow.card,
  },
  sharePdfBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 13.5,
    color: colors.white,
  },

  // ── Payment Modal ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: colors.paperCard,
    borderRadius: radius.lg,
    padding: 20,
    width: '100%',
    maxWidth: 420,
    borderWidth: 1,
    borderColor: colors.line,
    ...shadow.card,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: { fontFamily: fonts.display, fontSize: 18, color: colors.ink },
  modalCloseIconBtn: { padding: 4 },
  modalSub: { fontFamily: fonts.body, fontSize: 13, color: colors.inkSoft, marginBottom: 16 },
  modalField: { marginBottom: 14 },
  modalFieldLabel: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.inkSoft, marginBottom: 4 },
  modalInput: {
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.ink,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.paper,
  },
  chipActive: { backgroundColor: colors.clayDeep, borderColor: colors.clayDeep },
  chipText: { fontFamily: fonts.body, fontSize: 12, color: colors.ink },
  chipTextActive: { color: colors.white, fontFamily: fonts.bodyBold },
  modalBtnRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  modalCancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
    paddingVertical: 11,
    alignItems: 'center',
  },
  modalCancelText: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.inkSoft },
  modalSaveBtn: {
    flex: 1,
    backgroundColor: colors.clayDeep,
    borderRadius: radius.sm,
    paddingVertical: 11,
    alignItems: 'center',
  },
  modalSaveText: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.white },

  // ── Revamped PDF & Invoice Preview Modal ──
  pdfModalContainer: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
  pdfModalHeader: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: colors.paperCard,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    zIndex: 10,
  },
  pdfModalHeaderInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    maxWidth: 860,
    width: '100%',
    alignSelf: 'center',
  },
  pdfModalCloseBtn: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pdfModalTitleCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  pdfModalTitle: {
    fontFamily: fonts.display,
    fontSize: 16,
    color: colors.ink,
  },
  pdfModalSubtitle: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.inkSoft,
    marginTop: 1,
  },
  pdfModalStatusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radius.pill,
  },
  pdfModalStatusText: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
  },
  pdfModalCustomizePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.clayLight,
    borderWidth: 1,
    borderColor: colors.clayDeep + '30',
  },
  pdfModalCustomizeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11.5,
    color: colors.clayDeep,
  },

  // Ribbon Toolbar
  pdfRibbonSection: {
    backgroundColor: colors.paperCard,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    paddingVertical: 8,
  },
  pdfRibbonInner: {
    maxWidth: 860,
    width: '100%',
    alignSelf: 'center',
  },
  pdfTemplateChipsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  pdfThemeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paper,
  },
  pdfThemeChipActive: {
    borderWidth: 1.5,
  },
  pdfThemeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  pdfThemeChipText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.ink,
  },
  pdfPaperPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 4,
    gap: 8,
    flexWrap: 'wrap',
  },
  pdfPaperGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  pdfPaperLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    color: colors.inkSoft,
  },
  pdfPaperPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.sm,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
  },
  pdfPaperPillActive: {
    backgroundColor: colors.clayDeep,
    borderColor: colors.clayDeep,
  },
  pdfPaperPillText: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.ink,
  },
  pdfPaperPillTextActive: {
    fontFamily: fonts.bodyBold,
    color: colors.white,
  },
  pdfCompactPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.sm,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
  },
  pdfCompactPillActive: {
    backgroundColor: colors.clayDeep,
    borderColor: colors.clayDeep,
  },
  pdfCompactPillText: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.inkSoft,
  },
  pdfCompactPillTextActive: {
    fontFamily: fonts.bodyBold,
    color: colors.white,
  },

  // Main Preview Canvas
  pdfStageContainer: {
    flex: 1,
    backgroundColor: '#E2E8F0',
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pdfPaperWrapperWeb: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.white,
    borderRadius: 8,
    overflow: 'hidden',
    ...shadow.card,
  },
  pdfNativeScroll: {
    padding: 16,
    alignItems: 'center',
  },

  // Thermal Native Receipt
  thermalNativeCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#CCCCCC',
    ...shadow.card,
  },
  thermalHeader: {
    alignItems: 'center',
    gap: 2,
  },
  thermalTitle: {
    fontFamily: fonts.display,
    fontSize: 15,
    color: '#000000',
    textAlign: 'center',
  },
  thermalSub: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: '#333333',
    textAlign: 'center',
  },
  thermalDashedDivider: {
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#000000',
    marginVertical: 8,
  },
  thermalSolidDivider: {
    borderTopWidth: 1,
    borderColor: '#000000',
    marginVertical: 8,
  },
  thermalMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  thermalMono: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: '#000000',
  },
  thermalMonoBold: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: '#000000',
  },
  thermalItemBlock: {
    marginBottom: 6,
  },
  thermalItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  thermalItemName: {
    fontFamily: fonts.bodyBold,
    fontSize: 11.5,
    color: '#000000',
    flex: 1,
  },
  thermalItemPrice: {
    fontFamily: fonts.bodyBold,
    fontSize: 11.5,
    color: '#000000',
  },
  thermalItemDetail: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: '#555555',
    paddingLeft: 10,
    marginTop: 1,
  },
  thermalTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  thermalTotalLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: '#000000',
  },
  thermalTotalVal: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: '#000000',
  },
  thermalFooterText: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: '#555555',
    textAlign: 'center',
  },

  // Document Native Paper Card
  pdfPaperCard: {
    width: '100%',
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    overflow: 'hidden',
    ...shadow.card,
  },
  pdfHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 16,
    borderBottomWidth: 2,
    gap: 12,
  },
  pdfHeaderLogo: {
    width: 46,
    height: 46,
    borderRadius: radius.sm,
  },
  pdfBrandTitle: {
    fontFamily: fonts.display,
    fontSize: 16,
    letterSpacing: 0.3,
  },
  pdfBrandSubtitle: {
    fontFamily: fonts.body,
    fontSize: 11,
    marginTop: 1,
  },
  pdfAddressText: {
    fontFamily: fonts.body,
    fontSize: 10.5,
    color: colors.inkSoft,
    marginTop: 2,
  },
  pdfContactsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 3,
  },
  pdfContactText: {
    fontFamily: fonts.body,
    fontSize: 10.5,
    color: colors.inkSoft,
  },
  pdfTitleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginBottom: 4,
  },
  pdfTitleBadgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    color: colors.white,
    textTransform: 'uppercase',
  },
  pdfMetaLine: {
    fontFamily: fonts.body,
    fontSize: 10.5,
    color: colors.ink,
    textAlign: 'right',
  },
  pdfBuyerStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  pdfBuyerLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 9.5,
    color: colors.inkSoft,
    textTransform: 'uppercase',
  },
  pdfBuyerName: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.ink,
    marginTop: 1,
  },
  pdfBuyerPhone: {
    fontFamily: fonts.body,
    fontSize: 10.5,
    color: colors.inkSoft,
  },
  pdfStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  pdfStatusPillText: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
  },
  pdfTableWrap: {
    padding: 12,
  },
  pdfTableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  pdfTh: {
    fontFamily: fonts.bodyBold,
    fontSize: 10.5,
    color: colors.white,
    textTransform: 'uppercase',
  },
  pdfTableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  pdfTd: {
    fontFamily: fonts.body,
    fontSize: 11.5,
    color: colors.ink,
  },
  pdfSubDetail: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.inkSoft,
    marginTop: 1,
  },
  pdfTotalsSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: '#FAFAFA',
    gap: 16,
  },
  pdfSectionSmallTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 9.5,
    color: colors.inkSoft,
    textTransform: 'uppercase',
  },
  pdfWordsVal: {
    fontFamily: fonts.body,
    fontSize: 10.5,
    fontStyle: 'italic',
    color: colors.ink,
    marginTop: 2,
  },
  pdfNoteVal: {
    fontFamily: fonts.body,
    fontSize: 10.5,
    color: colors.ink,
    marginTop: 2,
  },
  pdfTotalsCard: {
    width: 200,
  },
  pdfCalcRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  pdfCalcLabel: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.inkSoft,
  },
  pdfCalcVal: {
    fontFamily: fonts.bodyBold,
    fontSize: 11.5,
    color: colors.ink,
  },
  pdfCalcBalanceRow: {
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 4,
    marginTop: 4,
  },
  pdfCalcBalanceLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
  },
  pdfCalcBalanceVal: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
  },
  pdfFooterStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
    backgroundColor: '#FFFFFF',
  },
  pdfFooterBrand: {
    fontFamily: fonts.body,
    fontSize: 9.5,
    color: colors.inkSoft,
  },
  pdfFooterThankyou: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    color: colors.ink,
  },

  // Floating Action Bottom Bar
  pdfStickyBottomBar: {
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: colors.paperCard,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    ...shadow.card,
  },
  pdfStickyBottomInner: {
    flexDirection: 'row',
    gap: 10,
    maxWidth: 860,
    width: '100%',
    alignSelf: 'center',
  },
  pdfActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: radius.md,
    ...shadow.card,
  },
  pdfActionWhatsApp: {
    backgroundColor: '#16A34A',
  },
  pdfActionPdf: {
    backgroundColor: colors.clayDeep,
  },
  pdfActionPrint: {
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
  },
  pdfActionBtnTextWhite: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.white,
  },
  pdfActionBtnTextInk: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.ink,
  },
});
