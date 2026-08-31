import React, { useCallback, useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Linking,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { RootStackParamList } from '../navigation/types';
import { Customer, Order, PaymentEntry, orderBalance, orderTotal } from '../types/order';
import { getCustomer, deleteCustomer } from '../storage/customerStorage';
import { getOrders } from '../storage/orderStorage';
import { getAllPayments } from '../storage/paymentStorage';
import { getBusinessProfile, BusinessProfile } from '../storage/businessProfileStorage';
import { addDataListener } from '../storage/firebaseSync';
import { sendPaymentReminder } from '../utils/reminderGenerator';
import OrderCard from '../components/OrderCard';
import { colors, fonts, radius, shadow } from '../theme/theme';
import { confirmAction } from '../utils/dialog';
import { formatCurrency, formatDate } from '../utils/format';
import DesktopLayout from '../components/DesktopLayout';

type Props = NativeStackScreenProps<RootStackParamList, 'CustomerDetail'>;

interface LedgerEntry {
  id: string;
  date: string;
  type: 'order' | 'payment';
  title: string;
  debit?: number;   // Order total (money owed by customer)
  credit?: number;  // Payment received (money paid by customer)
  orderId?: string;
}

export default function CustomerDetailScreen({ navigation, route }: Props) {
  const { customerId } = route.params;
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [customerOrders, setCustomerOrders] = useState<Order[]>([]);
  const [customerPayments, setCustomerPayments] = useState<PaymentEntry[]>([]);
  const [bizProfile, setBizProfile] = useState<BusinessProfile | null>(null);
  const [viewMode, setViewMode] = useState<'orders' | 'ledger'>('orders');

  const loadCustomerData = useCallback(() => {
    let active = true;
    getBusinessProfile().then((b) => {
      if (active) setBizProfile(b);
    });

    getCustomer(customerId).then((c) => {
      if (!active || !c) return;
      setCustomer(c);
      Promise.all([getOrders(), getAllPayments()]).then(([allOrders, allPayments]) => {
        if (!active) return;
        const filteredOrders = allOrders.filter(
          (o) =>
            (o.customerName &&
              o.customerName.toLowerCase().trim() === c.name.toLowerCase().trim()) ||
            (o.phoneNumber && c.phone && o.phoneNumber === c.phone)
        );
        setCustomerOrders(filteredOrders);

        const orderIds = new Set(filteredOrders.map((o) => o.id));
        const filteredPayments = allPayments.filter((p) => orderIds.has(p.orderId));
        setCustomerPayments(filteredPayments);
      });
    });
    return () => {
      active = false;
    };
  }, [customerId]);

  useFocusEffect(loadCustomerData);

  // Subscribe to live Firestore updates
  useEffect(() => {
    const unsub = addDataListener(() => {
      loadCustomerData();
    });
    return () => unsub();
  }, [loadCustomerData]);

  if (!customer) {
    return (
      <View style={styles.screen}>
        <Text style={styles.loading}>Loading customer…</Text>
      </View>
    );
  }

  const totalSpent = customerOrders.reduce((sum, o) => sum + orderTotal(o), 0);
  const totalPending = customerOrders.reduce(
    (sum, o) => sum + Math.max(0, orderBalance(o)),
    0
  );

  // Build Chronological Ledger Entries
  const ledgerEntries: LedgerEntry[] = [];
  customerOrders.forEach((o) => {
    ledgerEntries.push({
      id: `ord_${o.id}`,
      date: o.orderDate || o.createdAt,
      type: 'order',
      title: `Order ${o.orderNumber}`,
      debit: orderTotal(o),
      orderId: o.id,
    });
    if (o.advance > 0) {
      ledgerEntries.push({
        id: `adv_${o.id}`,
        date: o.orderDate || o.createdAt,
        type: 'payment',
        title: `Advance for ${o.orderNumber}`,
        credit: o.advance,
        orderId: o.id,
      });
    }
  });

  customerPayments.forEach((p) => {
    ledgerEntries.push({
      id: `pay_${p.id}`,
      date: p.date || p.createdAt,
      type: 'payment',
      title: `Payment (${p.method})`,
      credit: p.amount,
      orderId: p.orderId,
    });
  });

  // Sort chronological (oldest to newest for calculating balance, then reverse for display)
  ledgerEntries.sort((a, b) => (a.date > b.date ? 1 : -1));

  let runningBalance = 0;
  const ledgerWithBalance = ledgerEntries.map((entry) => {
    runningBalance += (entry.debit || 0) - (entry.credit || 0);
    return { ...entry, balance: runningBalance };
  }).reverse();

  const handleSendReminder = async () => {
    if (!customer.phone) {
      Alert.alert('Phone Required', 'Please add a phone number for this customer to send a WhatsApp reminder.');
      return;
    }
    if (totalPending <= 0) {
      Alert.alert('No Dues', `${customer.name} has no pending balance.`);
      return;
    }

    const pendingOrderNums = customerOrders
      .filter((o) => orderBalance(o) > 0)
      .map((o) => o.orderNumber);

    const sent = await sendPaymentReminder({
      customerName: customer.name,
      phoneNumber: customer.phone,
      balanceAmount: totalPending,
      businessName: bizProfile?.businessName || 'KadaiBook Store',
      orderNumbers: pendingOrderNums,
    });

    if (sent) {
      Alert.alert('Sent', 'Payment reminder sent to WhatsApp!');
    }
  };

  const handleDelete = () => {
    confirmAction({
      title: 'Delete Customer',
      message: `Remove ${customer.name}?`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      destructive: true,
      onConfirm: async () => {
        await deleteCustomer(customer.id);
        navigation.goBack();
      },
    });
  };

  return (
    <DesktopLayout currentTabName="CustomerList">
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Customer Header Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(customer.name || 'C').charAt(0).toUpperCase()}</Text>
          </View>

          <Text style={styles.customerName}>{customer.name}</Text>
          {customer.phone ? <Text style={styles.customerPhone}>{customer.phone}</Text> : null}
          {customer.email ? <Text style={styles.customerEmail}>{customer.email}</Text> : null}
          {customer.address ? <Text style={styles.customerAddress}>{customer.address}</Text> : null}

          {/* Action Buttons */}
          <View style={styles.actionRow}>
            {customer.phone ? (
              <>
                <Pressable
                  style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.8 }]}
                  onPress={() => Linking.openURL(`tel:${customer.phone}`)}
                >
                  <Ionicons name="call" size={16} color={colors.white} />
                  <Text style={styles.actionBtnText}>Call</Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [styles.actionBtn, { backgroundColor: colors.success }, pressed && { opacity: 0.8 }]}
                  onPress={() => {
                    const clean = customer.phone.replace(/[^0-9]/g, '');
                    Linking.openURL(`whatsapp://send?phone=${clean}`);
                  }}
                >
                  <Ionicons name="logo-whatsapp" size={16} color={colors.white} />
                  <Text style={styles.actionBtnText}>WhatsApp</Text>
                </Pressable>
              </>
            ) : null}

            {totalPending > 0 && customer.phone ? (
              <Pressable
                style={({ pressed }) => [styles.actionBtn, { backgroundColor: '#C97A1E' }, pressed && { opacity: 0.8 }]}
                onPress={handleSendReminder}
              >
                <Ionicons name="notifications-outline" size={16} color={colors.white} />
                <Text style={styles.actionBtnText}>Remind</Text>
              </Pressable>
            ) : null}

            <Pressable
              style={({ pressed }) => [styles.actionBtn, { backgroundColor: colors.clayDeep }, pressed && { opacity: 0.8 }]}
              onPress={() =>
                navigation.navigate('OrderForm', {
                  prefillCustomerName: customer.name,
                  prefillPhone: customer.phone,
                })
              }
            >
              <Ionicons name="add" size={16} color={colors.white} />
              <Text style={styles.actionBtnText}>Order</Text>
            </Pressable>
          </View>
        </View>

        {/* Financial Metrics */}
        <View style={styles.statsCard}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Total Orders</Text>
            <Text style={styles.statVal}>{customerOrders.length}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Lifetime Spend</Text>
            <Text style={styles.statVal}>{formatCurrency(totalSpent)}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Pending Due</Text>
            <Text style={[styles.statVal, { color: totalPending > 0 ? colors.danger : colors.success }]}>
              {formatCurrency(totalPending)}
            </Text>
          </View>
        </View>

        {/* Customer Note */}
        {customer.notes ? (
          <View style={styles.noteCard}>
            <View style={styles.cardHeaderRow}>
              <Ionicons name="document-text-outline" size={18} color={colors.clayDeep} />
              <Text style={styles.sectionTitle}>Customer Notes</Text>
            </View>
            <Text style={styles.noteText}>{customer.notes}</Text>
          </View>
        ) : null}

        {/* View Mode Toggle: Orders vs Ledger */}
        <View style={styles.viewToggleRow}>
          <Pressable
            style={[styles.viewToggleBtn, viewMode === 'orders' && styles.viewToggleBtnActive]}
            onPress={() => setViewMode('orders')}
          >
            <Ionicons name="receipt-outline" size={16} color={viewMode === 'orders' ? colors.white : colors.ink} />
            <Text style={[styles.viewToggleText, viewMode === 'orders' && styles.viewToggleTextActive]}>
              Orders ({customerOrders.length})
            </Text>
          </Pressable>

          <Pressable
            style={[styles.viewToggleBtn, viewMode === 'ledger' && styles.viewToggleBtnActive]}
            onPress={() => setViewMode('ledger')}
          >
            <Ionicons name="book-outline" size={16} color={viewMode === 'ledger' ? colors.white : colors.ink} />
            <Text style={[styles.viewToggleText, viewMode === 'ledger' && styles.viewToggleTextActive]}>
              Khata / Ledger
            </Text>
          </Pressable>
        </View>

        {/* Order History or Ledger Display */}
        {viewMode === 'orders' ? (
          customerOrders.length === 0 ? (
            <Text style={styles.emptyOrders}>No orders recorded for this customer yet.</Text>
          ) : (
            customerOrders.map((o) => (
              <OrderCard
                key={o.id}
                order={o}
                onPress={() => navigation.navigate('OrderDetail', { orderId: o.id })}
              />
            ))
          )
        ) : (
          <View style={styles.ledgerContainer}>
            {ledgerWithBalance.length === 0 ? (
              <Text style={styles.emptyOrders}>No transactions recorded yet.</Text>
            ) : (
              ledgerWithBalance.map((item) => (
                <View key={item.id} style={styles.ledgerRow}>
                  <View style={styles.ledgerLeft}>
                    <View style={[styles.ledgerIconCircle, item.type === 'order' ? { backgroundColor: '#FCEBE9' } : { backgroundColor: '#EAF5EC' }]}>
                      <Ionicons
                        name={item.type === 'order' ? 'arrow-up-outline' : 'arrow-down-outline'}
                        size={16}
                        color={item.type === 'order' ? colors.danger : colors.success}
                      />
                    </View>
                    <View>
                      <Text style={styles.ledgerTitle}>{item.title}</Text>
                      <Text style={styles.ledgerDate}>{formatDate(item.date)}</Text>
                    </View>
                  </View>

                  <View style={styles.ledgerRight}>
                    {item.debit ? (
                      <Text style={styles.debitText}>+{formatCurrency(item.debit)}</Text>
                    ) : (
                      <Text style={styles.creditText}>-{formatCurrency(item.credit || 0)}</Text>
                    )}
                    <Text style={styles.ledgerBalance}>Bal: {formatCurrency(item.balance)}</Text>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* Manage Customer Buttons */}
        <View style={styles.footerRow}>
          <Pressable
            style={({ pressed }) => [styles.editBtn, pressed && { opacity: 0.8 }]}
            onPress={() => navigation.navigate('CustomerForm', { customerId: customer.id })}
          >
            <Ionicons name="pencil" size={16} color={colors.ink} />
            <Text style={styles.editBtnText}>Edit Profile</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.deleteBtn, pressed && { opacity: 0.8 }]}
            onPress={handleDelete}
          >
            <Ionicons name="trash-outline" size={16} color={colors.danger} />
            <Text style={styles.deleteBtnText}>Delete</Text>
          </Pressable>
        </View>
      </ScrollView>
    </DesktopLayout>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  content: {
    padding: 20,
    paddingBottom: 60,
    width: '100%',
    maxWidth: 900,
    alignSelf: 'center',
  },
  loading: {
    fontFamily: fonts.body,
    color: colors.inkSoft,
    textAlign: 'center',
    marginTop: 40,
  },
  profileCard: {
    backgroundColor: colors.paperCard,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 20,
    alignItems: 'center',
    marginBottom: 14,
    ...shadow.card,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.clayDeep,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  avatarText: {
    fontFamily: fonts.display,
    fontSize: 32,
    color: colors.white,
  },
  customerName: {
    fontFamily: fonts.display,
    fontSize: 28,
    color: colors.ink,
  },
  customerPhone: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.inkSoft,
    marginTop: 2,
  },
  customerEmail: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.inkSoft,
    marginTop: 1,
  },
  customerAddress: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.inkSoft,
    textAlign: 'center',
    marginTop: 4,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.duskDeep,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.md,
    ...shadow.card,
  },
  actionBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.white,
  },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: colors.paperCard,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 14,
    marginBottom: 14,
    ...shadow.card,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.inkSoft,
    marginBottom: 2,
  },
  statVal: {
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    color: colors.ink,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: colors.line,
  },
  noteCard: {
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
    marginBottom: 8,
  },
  sectionTitle: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.clayDeep,
  },
  noteText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.ink,
    lineHeight: 19,
  },
  ordersHeaderRow: {
    marginVertical: 8,
  },
  emptyOrders: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.inkSoft,
    textAlign: 'center',
    paddingVertical: 20,
  },
  footerRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  editBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.paperCard,
    borderWidth: 1,
    borderColor: colors.line,
    paddingVertical: 12,
    borderRadius: radius.md,
    ...shadow.card,
  },
  editBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.ink,
  },
  deleteBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.paperCard,
    borderWidth: 1,
    borderColor: colors.danger,
    paddingVertical: 12,
    borderRadius: radius.md,
    ...shadow.card,
  },
  deleteBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.danger,
  },
  viewToggleRow: {
    flexDirection: 'row',
    gap: 10,
    marginVertical: 12,
  },
  viewToggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paperCard,
  },
  viewToggleBtnActive: {
    backgroundColor: colors.clayDeep,
    borderColor: colors.clayDeep,
  },
  viewToggleText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.ink,
  },
  viewToggleTextActive: {
    color: colors.white,
    fontFamily: fonts.bodyBold,
  },
  ledgerContainer: {
    backgroundColor: colors.paperCard,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
    marginBottom: 14,
    ...shadow.card,
  },
  ledgerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  ledgerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  ledgerIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ledgerTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.ink,
  },
  ledgerDate: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.inkSoft,
    marginTop: 1,
  },
  ledgerRight: {
    alignItems: 'flex-end',
  },
  debitText: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.danger,
  },
  creditText: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.success,
  },
  ledgerBalance: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.inkSoft,
    marginTop: 2,
  },
});
