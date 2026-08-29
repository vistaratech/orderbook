import React, { useCallback, useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Linking,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { RootStackParamList } from '../navigation/types';
import { Customer, Order, orderBalance, orderTotal } from '../types/order';
import { getCustomer, deleteCustomer } from '../storage/customerStorage';
import { getOrders } from '../storage/orderStorage';
import { addDataListener } from '../storage/firebaseSync';
import OrderCard from '../components/OrderCard';
import { colors, fonts, radius, shadow } from '../theme/theme';
import { confirmAction } from '../utils/dialog';
import { formatCurrency } from '../utils/format';
import DesktopLayout from '../components/DesktopLayout';

type Props = NativeStackScreenProps<RootStackParamList, 'CustomerDetail'>;

export default function CustomerDetailScreen({ navigation, route }: Props) {
  const { customerId } = route.params;
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [customerOrders, setCustomerOrders] = useState<Order[]>([]);

  const loadCustomerData = useCallback(() => {
    let active = true;
    getCustomer(customerId).then((c) => {
      if (!active || !c) return;
      setCustomer(c);
      getOrders().then((all) => {
        if (!active) return;
        const filtered = all.filter(
          (o) =>
            (o.customerName &&
              o.customerName.toLowerCase().trim() === c.name.toLowerCase().trim()) ||
            (o.phoneNumber && c.phone && o.phoneNumber === c.phone)
        );
        setCustomerOrders(filtered);
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

        {/* Order History */}
        <View style={styles.ordersHeaderRow}>
          <Text style={styles.sectionTitle}>Order History ({customerOrders.length})</Text>
        </View>

        {customerOrders.length === 0 ? (
          <Text style={styles.emptyOrders}>No orders recorded for this customer yet.</Text>
        ) : (
          customerOrders.map((o) => (
            <OrderCard
              key={o.id}
              order={o}
              onPress={() => navigation.navigate('OrderDetail', { orderId: o.id })}
            />
          ))
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
});
