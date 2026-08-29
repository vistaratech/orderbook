import React, { useCallback, useState, useEffect } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
import { confirmAction } from '../utils/dialog';
import { formatCurrency, formatDate, todayIso } from '../utils/format';
import {
  sendWhatsAppInvoice,
  sharePdfInvoiceToWhatsApp,
  printPdfInvoice,
  generatePrintableInvoiceHtml,
} from '../utils/invoiceGenerator';
import StatusTracker from '../components/StatusTracker';
import { useLanguage } from '../i18n/LanguageContext';

type Props = NativeStackScreenProps<RootStackParamList, 'OrderDetail'>;

export default function OrderDetailScreen({ navigation, route }: Props) {
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

  // Fetch logged in business profile & full branding
  useEffect(() => {
    getAuthState().then((state) => {
      if (state.user) setUserProfile(state.user);
    });
    getBusinessProfile().then((b) => {
      if (b) setBizProfile(b);
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
    return () => {
      active = false;
    };
  }, [orderId]);

  useFocusEffect(loadData);

  // Subscribe to live Firestore updates
  useEffect(() => {
    const unsub = addDataListener(() => {
      loadData();
    });
    return () => unsub();
  }, [loadData]);

  if (!order) {
    return (
      <View style={styles.screen}>
        <Text style={styles.loading}>Loading order details…</Text>
      </View>
    );
  }

  const total = orderTotal(order);
  const balance = orderBalance(order);

  const handleDelete = () => {
    confirmAction({
      title: 'Delete order',
      message: `Remove ${order.orderNumber} from the book?`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      destructive: true,
      onConfirm: async () => {
        await deleteOrder(order.id);
        navigation.goBack();
      },
    });
  };

  const handleStatusChange = async (status: Order['status']) => {
    setOrder({ ...order, status });
    await setOrderStatus(order.id, status);
  };

  const handleRecordPayment = async () => {
    const amt = parseFloat(payAmount);
    if (!amt || amt <= 0) {
      Alert.alert('Amount required', 'Enter a valid payment amount.');
      return;
    }

    // Save payment entry
    await addPayment({
      orderId: order.id,
      amount: amt,
      date: formatDate(todayIso()),
      method: payMethod,
      note: payNote.trim() || undefined,
    });

    // Update order advance & payment status
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
  };

  const shareInvoice = async () => {
    const itemsList = order.items
      .map((it) => `• ${it.name} (${it.qty} × ₹${it.price}) = ${formatCurrency(it.qty * it.price)}`)
      .join('\n');

    const msg = `*ORDER RECEIPT — ${order.orderNumber}*
Date: ${formatDate(order.orderDate)}
Customer: ${order.customerName}
${order.phoneNumber ? `Phone: ${order.phoneNumber}\n` : ''}
*Items:*
${itemsList}

*Total:* ${formatCurrency(total)}
*Advance Paid:* ${formatCurrency(order.advance)}
*Balance Due:* ${formatCurrency(balance)}
*Status:* ${order.status}
${order.trackingNumber ? `*Tracking #:* ${order.trackingNumber}\n` : ''}
Thank you for your business!`;

    await Share.share({ message: msg });
  };

  const callCustomer = () => {
    if (order.phoneNumber) Linking.openURL(`tel:${order.phoneNumber}`);
  };

  const activeBusinessProfile: BusinessProfile = {
    businessName: bizProfile?.businessName || userProfile?.businessName || 'KadaiBook Store',
    phone: bizProfile?.phone || userProfile?.phone || '',
    email: bizProfile?.email || userProfile?.email || '',
    address: bizProfile?.address || '',
    gstin: bizProfile?.gstin || '',
    tagline: bizProfile?.tagline || '',
    logoUri: bizProfile?.logoUri || '',
    bankDetails: bizProfile?.bankDetails || '',
  };

  const whatsappCustomer = async () => {
    if (order) {
      await sendWhatsAppInvoice(order, activeBusinessProfile);
    }
  };

  const sharePdfCustomer = async () => {
    if (order) {
      await sharePdfInvoiceToWhatsApp(order, activeBusinessProfile);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* Hero Header Card */}
      <View style={styles.heroHeaderCard}>
        <View style={styles.heroTopRow}>
          <View>
            <Text style={styles.orderNumber}>{order.orderNumber}</Text>
            <Text style={styles.heroDate}>Created on {formatDate(order.orderDate)}</Text>
          </View>

          <View style={[styles.statusChip, { backgroundColor: statusColor[order.status] || colors.clay }]}>
            <Text style={styles.statusChipText}>{order.status}</Text>
          </View>
        </View>

        {/* Financial Highlights inside Hero */}
        <View style={styles.heroStatsRow}>
          <View style={styles.heroStatItem}>
            <Text style={styles.heroStatLabel}>Total Amount</Text>
            <Text style={styles.heroStatValue}>{formatCurrency(total)}</Text>
          </View>

          <View style={styles.heroStatDivider} />

          <View style={styles.heroStatItem}>
            <Text style={styles.heroStatLabel}>Advance Paid</Text>
            <Text style={[styles.heroStatValue, { color: colors.inflow }]}>
              {formatCurrency(order.advance)}
            </Text>
          </View>

          <View style={styles.heroStatDivider} />

          <View style={styles.heroStatItem}>
            <Text style={styles.heroStatLabel}>Balance Due</Text>
            <Text
              style={[
                styles.heroStatValue,
                { color: balance > 0 ? colors.danger : colors.success },
              ]}
            >
              {formatCurrency(balance)}
            </Text>
          </View>
        </View>
      </View>

      {/* ─── Premium Invoice & Receipt Action Card ─── */}
      <View style={styles.invoiceActionCard}>
        <View style={styles.invoiceActionCardHeader}>
          <Ionicons name="receipt-outline" size={18} color={colors.clayDeep} />
          <Text style={styles.invoiceActionCardTitle}>{t('orders.orderDetailsTitle')}</Text>
        </View>

        {/* Primary WhatsApp PDF Document Sharing Card */}
        <Pressable
          style={({ pressed }) => [
            styles.waBannerCard,
            pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] },
          ]}
          onPress={sharePdfCustomer}
        >
          <View style={styles.waBannerLeft}>
            <View style={styles.waIconCircle}>
              <Ionicons name="document-attach" size={22} color={colors.white} />
            </View>
            <View style={styles.waBannerTextBlock}>
              <Text style={styles.waBannerTitle}>{t('orders.downloadPdf')}</Text>
              <Text style={styles.waBannerSubtitle}>
                {order.phoneNumber
                  ? `${order.customerName || 'Customer'} (${order.phoneNumber})`
                  : t('orders.shareInvoice')}
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.white} />
        </Pressable>

        {/* Sub Action Buttons Row */}
        <View style={styles.invoiceSubActionsRow}>
          <Pressable
            style={({ pressed }) => [
              styles.pdfActionBtn,
              pressed && { opacity: 0.85 },
            ]}
            onPress={() => setShowPdfModal(true)}
          >
            <Ionicons name="eye-outline" size={16} color={colors.clayDeep} />
            <Text style={styles.pdfActionBtnText}>{t('common.details')}</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.shareActionBtn,
              pressed && { opacity: 0.85 },
            ]}
            onPress={whatsappCustomer}
          >
            <Ionicons name="logo-whatsapp" size={16} color={colors.success} />
            <Text style={[styles.shareActionBtnText, { color: colors.success, fontFamily: fonts.bodyBold }]}>
              {t('orders.shareInvoice')}
            </Text>
          </Pressable>

          {order.phoneNumber ? (
            <Pressable
              style={({ pressed }) => [
                styles.callActionBtn,
                pressed && { opacity: 0.85 },
              ]}
              onPress={callCustomer}
            >
              <Ionicons name="call-outline" size={16} color={colors.duskDeep} />
              <Text style={styles.callActionBtnText}>{t('customers.call')}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* Fulfillment Status Tracker */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Ionicons name="git-commit-outline" size={18} color={colors.clayDeep} />
          <Text style={styles.cardTitle}>{t('orders.orderStatus')}</Text>
        </View>
        <StatusTracker status={order.status} onChange={handleStatusChange} />
      </View>

      {/* Customer Info */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Ionicons name="person-outline" size={18} color={colors.clayDeep} />
          <Text style={styles.cardTitle}>{t('orders.customerInfo')}</Text>
        </View>
        <DetailRow label={t('customers.name')} value={order.customerName} bold />
        <DetailRow label={t('customers.phone')} value={order.phoneNumber || '—'} />
        {order.trackingNumber ? <DetailRow label={t('orders.trackingNumber')} value={order.trackingNumber} /> : null}
      </View>

      {/* Payment & Dispatch Info */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Ionicons name="card-outline" size={18} color={colors.duskDeep} />
          <Text style={styles.cardTitle}>{t('orders.paymentDetails')}</Text>
        </View>
        <DetailRow label={t('orders.paymentMethod')} value={order.paymentMethod} />
        <DetailRow label={t('orders.paymentStatus')} value={order.paymentStatus} />
        {order.dispatchMethod ? <DetailRow label={t('orders.dispatchMethod')} value={order.dispatchMethod} /> : null}
        {order.dispatchDate ? <DetailRow label={t('orders.dispatchDate')} value={order.dispatchDate} /> : null}
      </View>

      {/* Order Items Table */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Ionicons name="basket-outline" size={18} color={colors.clayDeep} />
          <Text style={styles.cardTitle}>{t('orders.items')} ({order.items.length})</Text>
        </View>

        <View style={styles.itemHeaderRow}>
          <Text style={[styles.itemHeaderCell, { flex: order.customColumns?.length ? 2.2 : 3 }]}>{t('orders.itemName')}</Text>
          <Text style={[styles.itemHeaderCell, { flex: 0.9, textAlign: 'center' }]}>{t('orders.quantity')}</Text>
          {order.customColumns?.map((col) => (
            <Text key={col.id} style={[styles.itemHeaderCell, { flex: 1, textAlign: 'center' }]} numberOfLines={1}>
              {col.name}
            </Text>
          ))}
          <Text style={[styles.itemHeaderCell, { flex: 1.2, textAlign: 'right' }]}>{t('common.total')}</Text>
        </View>
        {order.items.map((item) => (
          <View key={item.id} style={styles.itemRow}>
            <Text style={[styles.itemCell, { flex: order.customColumns?.length ? 2.2 : 3 }]}>{item.name}</Text>
            <Text style={[styles.itemCell, { flex: 0.9, textAlign: 'center' }]}>
              {item.qty}{item.unit ? ` ${item.unit}` : ''}
            </Text>
            {order.customColumns?.map((col) => {
              const val =
                item.customValues?.[col.id] ||
                (col.name.toLowerCase() === 'unit' ? item.unit || '-' : '-');
              return (
                <Text key={col.id} style={[styles.itemCell, { flex: 1, textAlign: 'center', color: colors.inkSoft }]}>
                  {val || '-'}
                </Text>
              );
            })}
            <Text style={[styles.itemCell, { flex: 1.2, textAlign: 'right', fontFamily: fonts.bodyBold }]}>
              {formatCurrency(item.qty * item.price)}
            </Text>
          </View>
        ))}

        <View style={styles.divider} />
        <DetailRow label={t('orders.totalAmount')} value={formatCurrency(total)} bold />
        <DetailRow label={t('orders.advancePaid')} value={formatCurrency(order.advance)} />
        <DetailRow
          label={t('orders.balanceDue')}
          value={formatCurrency(balance)}
          bold
          valueColor={balance > 0 ? colors.danger : colors.success}
        />

        {balance > 0 && (
          <Pressable
            style={({ pressed }) => [styles.recordPayBtn, pressed && { opacity: 0.85 }]}
            onPress={() => setShowPaymentModal(true)}
          >
            <Ionicons name="cash-outline" size={18} color={colors.white} />
            <Text style={styles.recordPayBtnText}>+ {t('orders.markPaid')}</Text>
          </Pressable>
        )}
      </View>

      {/* Payment History Log */}
      {payments.length > 0 && (
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Ionicons name="receipt-outline" size={18} color={colors.inflow} />
            <Text style={styles.cardTitle}>{t('orders.orderTimeline')}</Text>
          </View>
          {payments.map((p) => (
            <View key={p.id} style={styles.paymentLogRow}>
              <View>
                <Text style={styles.payLogAmount}>+{formatCurrency(p.amount)}</Text>
                <Text style={styles.payLogDate}>{p.date} • {p.method}</Text>
              </View>
              {p.note ? <Text style={styles.payLogNote}>{p.note}</Text> : null}
            </View>
          ))}
        </View>
      )}

      {/* Customer Note */}
      {order.customerNote ? (
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Ionicons name="document-text-outline" size={18} color={colors.inkSoft} />
            <Text style={styles.cardTitle}>{t('orders.customerNote')}</Text>
          </View>
          <Text style={styles.note}>{order.customerNote}</Text>
        </View>
      ) : null}

      {/* Edit / Delete Footer Buttons */}
      <View style={styles.actionsRow}>
        <Pressable
          style={({ pressed }) => [styles.actionBtn, styles.editBtn, pressed && { opacity: 0.85 }]}
          onPress={() => navigation.navigate('OrderForm', { orderId: order.id })}
        >
          <Ionicons name="pencil" size={16} color={colors.white} />
          <Text style={styles.actionBtnText}>{t('common.edit')}</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.actionBtn, styles.deleteBtn, pressed && { opacity: 0.85 }]}
          onPress={handleDelete}
        >
          <Ionicons name="trash-outline" size={16} color={colors.danger} />
          <Text style={[styles.actionBtnText, { color: colors.danger }]}>{t('common.delete')}</Text>
        </Pressable>
      </View>

      {/* In-Place Payment Collection Modal */}
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
              <Text style={styles.modalTitle}>Record Collection</Text>
              <Pressable
                onPress={() => setShowPaymentModal(false)}
                hitSlop={8}
                style={styles.modalCloseIconBtn}
              >
                <Ionicons name="close" size={20} color={colors.inkSoft} />
              </Pressable>
            </View>
            <Text style={styles.modalSub}>
              Remaining balance due: {formatCurrency(balance)}
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
                placeholder="e.g. GPay ref #1234"
                placeholderTextColor={colors.inkSoft}
              />
            </View>

            <View style={styles.modalBtnRow}>
              <Pressable
                style={styles.modalCancelBtn}
                onPress={() => setShowPaymentModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.modalSaveBtn} onPress={handleRecordPayment}>
                <Text style={styles.modalSaveText}>Save Collection</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ─── PDF Invoice Printable Preview Modal ─── */}
      <Modal
        visible={showPdfModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowPdfModal(false)}
      >
        <SafeAreaView style={styles.pdfModalContainer} edges={['top', 'bottom']}>
          {/* PDF Modal Top Bar */}
          <View style={styles.pdfModalHeader}>
            <Pressable
              style={styles.pdfModalCloseBtn}
              onPress={() => setShowPdfModal(false)}
            >
              <Ionicons name="close" size={24} color={colors.ink} />
            </Pressable>
            <Text style={styles.pdfModalTitle}>PDF Invoice Preview</Text>

            <Pressable
              style={styles.pdfModalPrintBtn}
              onPress={() => {
                if (order) printPdfInvoice(order, activeBusinessProfile);
              }}
            >
              <Ionicons name="print-outline" size={18} color={colors.white} />
              <Text style={styles.pdfModalPrintBtnText}>Print PDF</Text>
            </Pressable>
          </View>

          {/* Printable Invoice Page Preview */}
          <ScrollView contentContainerStyle={styles.pdfPageContent} showsVerticalScrollIndicator={false}>
            <View style={styles.pdfPaperCard}>
              <View style={styles.pdfHeaderRow}>
                <View>
                  <Text style={styles.pdfBrandTitle}>
                    {activeBusinessProfile.businessName?.toUpperCase()}
                  </Text>
                  <Text style={styles.pdfBrandSubtitle}>
                    {activeBusinessProfile.tagline || 'Official Business Invoice & Receipt'}
                  </Text>
                  {activeBusinessProfile.address ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                      <Ionicons name="location-outline" size={11} color={colors.inkSoft} />
                      <Text style={{ fontFamily: fonts.body, fontSize: 11, color: colors.inkSoft }}>
                        {activeBusinessProfile.address}
                      </Text>
                    </View>
                  ) : null}
                  {activeBusinessProfile.gstin ? (
                    <Text style={{ fontFamily: fonts.bodyBold, fontSize: 11, color: colors.clayDeep, marginTop: 2 }}>
                      GSTIN: {activeBusinessProfile.gstin}
                    </Text>
                  ) : null}
                </View>
                <View
                  style={[
                    styles.pdfStatusBadge,
                    { backgroundColor: balance <= 0 ? '#E8F5E9' : '#FFF3E0', flexDirection: 'row', alignItems: 'center', gap: 4 },
                  ]}
                >
                  {balance <= 0 && (
                    <Ionicons name="checkmark-circle" size={12} color="#2E7D32" />
                  )}
                  <Text
                    style={[
                      styles.pdfStatusBadgeText,
                      { color: balance <= 0 ? '#2E7D32' : '#E65100' },
                    ]}
                  >
                    {balance <= 0 ? 'PAID' : 'BALANCE DUE'}
                  </Text>
                </View>
              </View>

              <View style={styles.pdfGridRow}>
                <View style={styles.pdfGridBox}>
                  <Text style={styles.pdfGridLabel}>CUSTOMER DETAILS</Text>
                  <Text style={styles.pdfGridValue}>{order.customerName || 'Walk-in Customer'}</Text>
                  <Text style={styles.pdfGridSubValue}>{order.phoneNumber || 'No phone recorded'}</Text>
                </View>

                <View style={[styles.pdfGridBox, { alignItems: 'flex-end' }]}>
                  <Text style={styles.pdfGridLabel}>INVOICE METADATA</Text>
                  <Text style={styles.pdfGridValue}>Order #{order.orderNumber}</Text>
                  <Text style={styles.pdfGridSubValue}>{formatDate(order.orderDate)}</Text>
                </View>
              </View>

              {/* Itemized Table */}
              <View style={styles.pdfTableWrap}>
                <View style={styles.pdfTableHeader}>
                  <Text style={[styles.pdfTh, { flex: 0.5 }]}>#</Text>
                  <Text style={[styles.pdfTh, { flex: 2.5 }]}>Item Description</Text>
                  <Text style={[styles.pdfTh, { flex: 1, textAlign: 'center' }]}>Qty</Text>
                  <Text style={[styles.pdfTh, { flex: 1.5, textAlign: 'right' }]}>Rate</Text>
                  <Text style={[styles.pdfTh, { flex: 1.5, textAlign: 'right' }]}>Amount</Text>
                </View>

                {order.items.map((item, idx) => (
                  <View key={item.id || idx} style={styles.pdfTableRow}>
                    <Text style={[styles.pdfTd, { flex: 0.5, color: colors.inkSoft }]}>{idx + 1}</Text>
                    <Text style={[styles.pdfTd, { flex: 2.5, fontFamily: fonts.bodyBold }]}>
                      {item.name || 'Item'}
                    </Text>
                    <Text style={[styles.pdfTd, { flex: 1, textAlign: 'center' }]}>{item.qty}</Text>
                    <Text style={[styles.pdfTd, { flex: 1.5, textAlign: 'right' }]}>
                      {formatCurrency(item.price)}
                    </Text>
                    <Text style={[styles.pdfTd, { flex: 1.5, textAlign: 'right', fontFamily: fonts.bodyBold }]}>
                      {formatCurrency(item.qty * item.price)}
                    </Text>
                  </View>
                ))}
              </View>

              {/* Total Summary */}
              <View style={styles.pdfSummaryBox}>
                <View style={styles.pdfSummaryRow}>
                  <Text style={styles.pdfSummaryLabel}>Subtotal</Text>
                  <Text style={styles.pdfSummaryVal}>{formatCurrency(total)}</Text>
                </View>

                <View style={styles.pdfSummaryRow}>
                  <Text style={styles.pdfSummaryLabel}>Advance Paid</Text>
                  <Text style={[styles.pdfSummaryVal, { color: colors.inflow }]}>
                    {formatCurrency(order.advance)}
                  </Text>
                </View>

                <View style={[styles.pdfSummaryRow, styles.pdfSummaryTotalRow]}>
                  <Text style={styles.pdfSummaryTotalLabel}>Balance Due</Text>
                  <Text style={styles.pdfSummaryTotalVal}>{formatCurrency(balance)}</Text>
                </View>
              </View>

              <View style={styles.pdfFooter}>
                <Text style={styles.pdfFooterText}>Thank you for your business!</Text>
                <Text style={styles.pdfFooterSubText}>Generated via KadaiBook • kadaibook.in</Text>
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </ScrollView>
  );
}

function DetailRow({
  label,
  value,
  bold,
  valueColor,
}: {
  label: string;
  value: string;
  bold?: boolean;
  valueColor?: string;
}) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text
        style={[
          styles.detailValue,
          bold && { fontFamily: fonts.bodyBold },
          valueColor ? { color: valueColor } : null,
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: {
    padding: 20,
    paddingBottom: 60,
    width: '100%',
    maxWidth: 900,
    alignSelf: 'center',
  },
  loading: { fontFamily: fonts.body, color: colors.inkSoft, marginTop: 40, textAlign: 'center' },

  // Hero Card
  heroHeaderCard: {
    backgroundColor: colors.paperCard,
    borderRadius: radius.lg,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.line,
    ...shadow.card,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  orderNumber: { fontFamily: fonts.display, fontSize: 32, color: colors.clayDeep, lineHeight: 36 },
  heroDate: { fontFamily: fonts.body, fontSize: 12, color: colors.inkSoft, marginTop: 2 },
  pinnedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.clayLight,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  pinnedBadgeText: { fontFamily: fonts.bodyBold, fontSize: 9, color: colors.clayDeep },
  statusChip: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 5 },
  statusChipText: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.white },

  heroStatsRow: {
    flexDirection: 'row',
    backgroundColor: colors.paper,
    borderRadius: radius.md,
    padding: 12,
    alignItems: 'center',
  },
  heroStatItem: { flex: 1, alignItems: 'center' },
  heroStatLabel: { fontFamily: fonts.body, fontSize: 11, color: colors.inkSoft, marginBottom: 2 },
  heroStatValue: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
  heroStatDivider: { width: 1, height: 24, backgroundColor: colors.line },

  // Invoice & WhatsApp Action Card
  invoiceActionCard: {
    backgroundColor: colors.paperCard,
    borderRadius: radius.md,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.line,
    ...shadow.card,
  },
  invoiceActionCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  invoiceActionCardTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.ink,
  },
  waBannerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#25D366',
    borderRadius: radius.md,
    padding: 14,
    marginBottom: 10,
    ...shadow.card,
  },
  waBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  waIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  waBannerTextBlock: {
    flex: 1,
  },
  waBannerTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.white,
  },
  waBannerSubtitle: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 2,
  },
  invoiceSubActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  pdfActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.paper,
    borderRadius: radius.sm,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: colors.clayDeep,
  },
  pdfActionBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: colors.clayDeep,
  },
  shareActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.paper,
    borderRadius: radius.sm,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: colors.line,
  },
  shareActionBtnText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.inkSoft,
  },
  callActionBtn: {
    flex: 0.7,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: colors.paper,
    borderRadius: radius.sm,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: colors.line,
  },
  callActionBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: colors.duskDeep,
  },

  // PDF Printable Preview Modal Styles
  pdfModalContainer: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  pdfModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 16) + 6 : 14,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    backgroundColor: colors.paperCard,
  },
  pdfModalCloseBtn: {
    padding: 4,
  },
  pdfModalTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    color: colors.ink,
  },
  pdfModalPrintBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.clayDeep,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.sm,
  },
  pdfModalPrintBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: colors.white,
  },
  pdfPageContent: {
    padding: 16,
    alignItems: 'center',
  },
  pdfPaperCard: {
    width: '100%',
    maxWidth: 640,
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.line,
    ...shadow.card,
  },
  pdfHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 2,
    borderBottomColor: colors.clayDeep,
    paddingBottom: 16,
    marginBottom: 20,
  },
  pdfBrandTitle: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.clayDeep,
  },
  pdfBrandSubtitle: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.inkSoft,
    marginTop: 2,
  },
  pdfStatusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
  },
  pdfStatusBadgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
  },
  pdfGridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  pdfGridBox: {
    flex: 1,
  },
  pdfGridLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    color: colors.inkSoft,
    marginBottom: 4,
  },
  pdfGridValue: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.ink,
  },
  pdfGridSubValue: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.inkSoft,
  },
  pdfTableWrap: {
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  pdfTableHeader: {
    flexDirection: 'row',
    backgroundColor: colors.paper,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  pdfTh: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: colors.inkSoft,
  },
  pdfTableRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  pdfTd: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.ink,
  },
  pdfSummaryBox: {
    alignSelf: 'flex-end',
    width: 240,
    backgroundColor: colors.paper,
    padding: 12,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: 20,
  },
  pdfSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  pdfSummaryLabel: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.inkSoft,
  },
  pdfSummaryVal: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: colors.ink,
  },
  pdfSummaryTotalRow: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: 6,
    marginTop: 4,
    marginBottom: 0,
  },
  pdfSummaryTotalLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.clayDeep,
  },
  pdfSummaryTotalVal: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.clayDeep,
  },
  pdfFooter: {
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  pdfFooterText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.inkSoft,
  },
  pdfFooterSubText: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.inkSoft,
    marginTop: 2,
  },

  card: {
    backgroundColor: colors.paperCard,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 16,
    marginBottom: 14,
    ...shadow.card,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  cardTitle: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    borderStyle: 'dashed' as any,
  },
  detailLabel: { fontFamily: fonts.body, fontSize: 13, color: colors.inkSoft },
  detailValue: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.ink },
  itemHeaderRow: { flexDirection: 'row', marginBottom: 8 },
  itemHeaderCell: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.inkSoft },
  itemRow: { flexDirection: 'row', paddingVertical: 6 },
  itemCell: { fontFamily: fonts.body, fontSize: 13, color: colors.ink },
  divider: { height: 0, borderTopWidth: 1, borderTopColor: colors.line, borderStyle: 'dashed' as any, marginVertical: 10 },
  recordPayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.inflow,
    borderRadius: radius.sm,
    paddingVertical: 12,
    marginTop: 12,
  },
  recordPayBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.white,
  },
  paymentLogRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    borderStyle: 'dashed' as any,
  },
  payLogAmount: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.inflow,
  },
  payLogDate: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.inkSoft,
    marginTop: 1,
  },
  payLogNote: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.inkSoft,
  },
  note: { fontFamily: fonts.body, fontSize: 13, color: colors.ink, lineHeight: 19 },
  actionsRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: radius.md,
    paddingVertical: 14,
    ...shadow.card,
  },
  editBtn: { backgroundColor: colors.clayDeep },
  deleteBtn: { backgroundColor: colors.paperCard, borderWidth: 1, borderColor: colors.danger },
  actionBtnText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.white },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: colors.paperCard,
    borderRadius: radius.lg,
    padding: 22,
    borderWidth: 1,
    borderColor: colors.line,
    alignSelf: 'center',
    ...shadow.card,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  modalCloseIconBtn: {
    padding: 4,
    borderRadius: 16,
    backgroundColor: colors.paper,
  },
  modalTitle: {
    fontFamily: fonts.display,
    fontSize: 24,
    color: colors.clayDeep,
  },
  modalSub: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.inkSoft,
    marginTop: 2,
    marginBottom: 14,
  },
  modalField: {
    marginBottom: 14,
  },
  modalFieldLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.inkSoft,
    marginBottom: 4,
  },
  modalInput: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.ink,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    borderStyle: 'dashed' as any,
    paddingVertical: 6,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.paper,
  },
  chipActive: {
    backgroundColor: colors.inflow,
    borderColor: colors.inflow,
  },
  chipText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.ink,
  },
  chipTextActive: {
    color: colors.white,
    fontFamily: fonts.bodyBold,
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
  },
  modalCancelText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.inkSoft,
  },
  modalSaveBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radius.sm,
    backgroundColor: colors.inflow,
    alignItems: 'center',
  },
  modalSaveText: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.white,
  },
});
