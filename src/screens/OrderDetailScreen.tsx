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
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { RootStackParamList } from '../navigation/types';
import { Order, PaymentEntry, orderTotal, orderBalance } from '../types/order';
import { getOrder, deleteOrder, setOrderStatus, saveOrder } from '../storage/orderStorage';
import { getPaymentsForOrder, addPayment } from '../storage/paymentStorage';
import { addDataListener } from '../storage/firebaseSync';
import { colors, fonts, radius, shadow, statusColor } from '../theme/theme';
import { confirmAction } from '../utils/dialog';
import { formatCurrency, formatDate, todayIso } from '../utils/format';
import StatusTracker from '../components/StatusTracker';

type Props = NativeStackScreenProps<RootStackParamList, 'OrderDetail'>;

export default function OrderDetailScreen({ navigation, route }: Props) {
  const { orderId } = route.params;
  const [order, setOrder] = useState<Order | null>(null);
  const [payments, setPayments] = useState<PaymentEntry[]>([]);

  // Payment Recording Modal
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('UPI');
  const [payNote, setPayNote] = useState('');

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

  // Subscribe to live Realtime Database updates
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

    const msg = `🧾 *Order Receipt — ${order.orderNumber}*
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

  const whatsappCustomer = () => {
    if (order.phoneNumber) {
      const clean = order.phoneNumber.replace(/[^0-9]/g, '');
      Linking.openURL(`whatsapp://send?phone=${clean}`);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Top Header Row */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.orderNumber}>{order.orderNumber}</Text>
          <Text style={styles.date}>Ordered {formatDate(order.orderDate)}</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: statusColor[order.status] }]}>
          <Text style={styles.badgeText}>{order.status}</Text>
        </View>
      </View>

      {/* Share / Action Bar */}
      <View style={styles.quickBar}>
        <Pressable style={styles.quickBtn} onPress={shareInvoice}>
          <Ionicons name="share-social-outline" size={16} color={colors.clayDeep} />
          <Text style={styles.quickBtnText}>Share Bill</Text>
        </Pressable>

        {order.phoneNumber ? (
          <>
            <Pressable style={styles.quickBtn} onPress={callCustomer}>
              <Ionicons name="call-outline" size={16} color={colors.duskDeep} />
              <Text style={[styles.quickBtnText, { color: colors.duskDeep }]}>Call</Text>
            </Pressable>

            <Pressable style={styles.quickBtn} onPress={whatsappCustomer}>
              <Ionicons name="logo-whatsapp" size={16} color={colors.success} />
              <Text style={[styles.quickBtnText, { color: colors.success }]}>WhatsApp</Text>
            </Pressable>
          </>
        ) : null}
      </View>

      {/* Status Tracker */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Fulfillment Status</Text>
        <StatusTracker status={order.status} onChange={handleStatusChange} />
      </View>

      {/* Customer Info */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Customer</Text>
        <DetailRow label="Name" value={order.customerName} />
        <DetailRow label="Phone" value={order.phoneNumber || '—'} />
        {order.trackingNumber ? <DetailRow label="Tracking #" value={order.trackingNumber} /> : null}
      </View>

      {/* Payment & Dispatch Info */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Payment & Dispatch</Text>
        <DetailRow label="Payment Method" value={order.paymentMethod} />
        <DetailRow label="Payment Status" value={order.paymentStatus} />
        {order.dispatchMethod ? <DetailRow label="Dispatch Method" value={order.dispatchMethod} /> : null}
        {order.dispatchDate ? <DetailRow label="Dispatch Date" value={order.dispatchDate} /> : null}
      </View>

      {/* Order Items Table */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Ordered Items</Text>
        <View style={styles.itemHeaderRow}>
          <Text style={[styles.itemHeaderCell, { flex: 3 }]}>Item</Text>
          <Text style={[styles.itemHeaderCell, { flex: 1, textAlign: 'center' }]}>Qty</Text>
          <Text style={[styles.itemHeaderCell, { flex: 1.4, textAlign: 'right' }]}>Total</Text>
        </View>
        {order.items.map((item) => (
          <View key={item.id} style={styles.itemRow}>
            <Text style={[styles.itemCell, { flex: 3 }]}>{item.name}</Text>
            <Text style={[styles.itemCell, { flex: 1, textAlign: 'center' }]}>{item.qty}</Text>
            <Text style={[styles.itemCell, { flex: 1.4, textAlign: 'right' }]}>
              {formatCurrency(item.qty * item.price)}
            </Text>
          </View>
        ))}

        <View style={styles.divider} />
        <DetailRow label="Total Amount" value={formatCurrency(total)} bold />
        <DetailRow label="Advance Received" value={formatCurrency(order.advance)} />
        <DetailRow
          label="Balance Due"
          value={formatCurrency(balance)}
          bold
          valueColor={balance > 0 ? colors.danger : colors.statusDelivered}
        />

        {balance > 0 && (
          <Pressable style={styles.recordPayBtn} onPress={() => setShowPaymentModal(true)}>
            <Ionicons name="cash-outline" size={16} color={colors.white} />
            <Text style={styles.recordPayBtnText}>+ Record Payment Received</Text>
          </Pressable>
        )}
      </View>

      {/* Payment History Log */}
      {payments.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Payment Collection Log</Text>
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
          <Text style={styles.cardTitle}>Customer Note</Text>
          <Text style={styles.note}>{order.customerNote}</Text>
        </View>
      ) : null}

      {/* Edit / Delete Footer Buttons */}
      <View style={styles.actionsRow}>
        <Pressable
          style={[styles.actionBtn, styles.editBtn]}
          onPress={() => navigation.navigate('OrderForm', { orderId: order.id })}
        >
          <Ionicons name="pencil" size={16} color={colors.white} />
          <Text style={styles.actionBtnText}>Edit Order</Text>
        </Pressable>
        <Pressable style={[styles.actionBtn, styles.deleteBtn]} onPress={handleDelete}>
          <Ionicons name="trash-outline" size={16} color={colors.danger} />
          <Text style={[styles.actionBtnText, { color: colors.danger }]}>Delete</Text>
        </Pressable>
      </View>

      {/* In-Place Payment Collection Modal */}
      <Modal visible={showPaymentModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Record Collection</Text>
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
          </View>
        </View>
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
  content: { padding: 16, paddingBottom: 60 },
  loading: { fontFamily: fonts.body, color: colors.inkSoft, marginTop: 40, textAlign: 'center' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  orderNumber: { fontFamily: fonts.display, fontSize: 34, color: colors.clayDeep },
  date: { fontFamily: fonts.body, fontSize: 13, color: colors.inkSoft, marginTop: -4 },
  badge: { borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.white },
  quickBar: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 10,
  },
  quickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.paperCard,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 12,
    paddingVertical: 7,
    ...shadow.card,
  },
  quickBtnText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.clayDeep,
  },
  card: {
    backgroundColor: colors.paperCard,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 16,
    marginBottom: 14,
    overflow: 'hidden',
    ...shadow.card,
  },
  cardTitle: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink, marginBottom: 10 },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
  },
  detailLabel: { fontFamily: fonts.body, fontSize: 13, color: colors.inkSoft },
  detailValue: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.ink },
  itemHeaderRow: { flexDirection: 'row', marginBottom: 6 },
  itemHeaderCell: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.inkSoft },
  itemRow: { flexDirection: 'row', paddingVertical: 4 },
  itemCell: { fontFamily: fonts.body, fontSize: 13, color: colors.ink },
  divider: { height: 0, borderTopWidth: 1, borderTopColor: colors.line, borderStyle: 'dashed', marginVertical: 8 },
  recordPayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.inflow,
    borderRadius: radius.sm,
    paddingVertical: 10,
    marginTop: 10,
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
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    borderStyle: 'dashed',
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
  },
  editBtn: { backgroundColor: colors.clayDeep },
  deleteBtn: { backgroundColor: colors.paperCard, borderWidth: 1, borderColor: colors.danger },
  actionBtnText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.white },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: colors.paperCard,
    borderRadius: radius.md,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.line,
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
    marginBottom: 12,
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
    borderStyle: 'dashed',
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
    paddingHorizontal: 10,
    paddingVertical: 5,
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
