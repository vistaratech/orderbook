import React, { useCallback, useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { RootStackParamList } from '../navigation/types';
import { Order, orderBalance, orderTotal, Expense } from '../types/order';
import { getOrders } from '../storage/orderStorage';
import { getExpenses } from '../storage/expenseStorage';
import { addDataListener } from '../storage/firebaseSync';
import { colors, fonts, radius, shadow, statusColor } from '../theme/theme';
import { formatCurrency, formatDate } from '../utils/format';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function DashboardScreen() {
  const navigation = useNavigation<Nav>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);

  const loadData = useCallback(async (forceSync = false) => {
    try {
      const [o, e] = await Promise.all([getOrders(forceSync), getExpenses(forceSync)]);
      setOrders(o);
      setExpenses(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData(false);
    }, [loadData])
  );

  // Subscribe to live Realtime Database changes from other devices
  useEffect(() => {
    const unsub = addDataListener(() => {
      loadData(false);
    });
    return () => unsub();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData(true);
  };

  // Calculations
  const totalSales = orders.reduce((sum, o) => sum + orderTotal(o), 0);
  const totalOutflow = expenses.reduce((sum, e) => sum + e.amount, 0);
  const totalCollected = orders.reduce((sum, o) => {
    const tot = orderTotal(o);
    const bal = orderBalance(o);
    return sum + (tot - bal);
  }, 0);
  const pendingCollection = orders.reduce((sum, o) => sum + Math.max(0, orderBalance(o)), 0);
  const netProfit = totalSales - totalOutflow;

  // Status breakdown
  const statusCounts: Record<string, number> = {
    Placed: 0,
    Packed: 0,
    Dispatched: 0,
    Delivered: 0,
  };
  orders.forEach((o) => {
    if (statusCounts[o.status] !== undefined) {
      statusCounts[o.status]++;
    }
  });

  const recentOrders = orders.slice(0, 4);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.clayDeep} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Business Pulse</Text>
            <Text style={styles.subtitle}>
              {new Date().toLocaleDateString('en-IN', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </Text>
          </View>
          <Pressable
            style={styles.settingsIconBtn}
            onPress={() => navigation.navigate('Settings')}
          >
            <Ionicons name="cog-outline" size={24} color={colors.inkSoft} />
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator size="large" color={colors.clayDeep} />
          </View>
        ) : (
          <>
            {/* Net Financial Overview Card */}
            <View style={[styles.card, styles.heroCard]}>
              <View style={styles.heroHeader}>
                <Text style={styles.heroTitle}>Net Business Balance</Text>
                <View
                  style={[
                    styles.profitBadge,
                    { backgroundColor: netProfit >= 0 ? colors.successLight : colors.dangerLight },
                  ]}
                >
                  <Text
                    style={[
                      styles.profitBadgeText,
                      { color: netProfit >= 0 ? colors.inflow : colors.outflow },
                    ]}
                  >
                    {netProfit >= 0 ? 'Profitable' : 'Deficit'}
                  </Text>
                </View>
              </View>
              <Text style={[styles.heroAmount, { color: netProfit >= 0 ? colors.inflow : colors.outflow }]}>
                {formatCurrency(netProfit)}
              </Text>
              <Text style={styles.heroSub}>Sales (Inflow) − Expenses (Outflow)</Text>

              <View style={styles.divider} />

              <View style={styles.metricGrid}>
                <View style={styles.metricItem}>
                  <View style={styles.metricLabelRow}>
                    <Ionicons name="arrow-down-circle" size={16} color={colors.inflow} />
                    <Text style={styles.metricLabel}>Total Sales</Text>
                  </View>
                  <Text style={[styles.metricValue, { color: colors.inflow }]}>
                    {formatCurrency(totalSales)}
                  </Text>
                </View>

                <View style={styles.metricItem}>
                  <View style={styles.metricLabelRow}>
                    <Ionicons name="arrow-up-circle" size={16} color={colors.outflow} />
                    <Text style={styles.metricLabel}>Total Outflow</Text>
                  </View>
                  <Text style={[styles.metricValue, { color: colors.outflow }]}>
                    {formatCurrency(totalOutflow)}
                  </Text>
                </View>
              </View>

              <View style={[styles.metricGrid, { marginTop: 12 }]}>
                <View style={styles.metricItem}>
                  <View style={styles.metricLabelRow}>
                    <Ionicons name="checkmark-circle" size={16} color={colors.duskDeep} />
                    <Text style={styles.metricLabel}>Collected</Text>
                  </View>
                  <Text style={styles.metricValue}>{formatCurrency(totalCollected)}</Text>
                </View>

                <View style={styles.metricItem}>
                  <View style={styles.metricLabelRow}>
                    <Ionicons name="time" size={16} color={colors.pending} />
                    <Text style={styles.metricLabel}>Pending Due</Text>
                  </View>
                  <Text style={[styles.metricValue, { color: colors.pending }]}>
                    {formatCurrency(pendingCollection)}
                  </Text>
                </View>
              </View>
            </View>

            {/* Fast Action Buttons */}
            <View style={styles.actionsRow}>
              <Pressable
                style={[styles.actionButton, { backgroundColor: colors.clayDeep }]}
                onPress={() => navigation.navigate('OrderForm', undefined)}
              >
                <Ionicons name="cart" size={20} color={colors.white} />
                <Text style={styles.actionButtonText}>+ New Order</Text>
              </Pressable>

              <Pressable
                style={[styles.actionButton, { backgroundColor: colors.duskDeep }]}
                onPress={() => navigation.navigate('ExpenseForm', undefined)}
              >
                <Ionicons name="wallet" size={20} color={colors.white} />
                <Text style={styles.actionButtonText}>+ Add Outflow</Text>
              </Pressable>
            </View>

            {/* Order Pipeline Status */}
            <View style={styles.card}>
              <Text style={styles.sectionHeading}>Order Pipeline</Text>
              <View style={styles.statusGrid}>
                {Object.entries(statusCounts).map(([st, cnt]) => (
                  <View key={st} style={styles.statusBox}>
                    <View
                      style={[
                        styles.statusDot,
                        { backgroundColor: statusColor[st] || colors.clay },
                      ]}
                    />
                    <Text style={styles.statusNumber}>{cnt}</Text>
                    <Text style={styles.statusName}>{st}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Recent Orders List */}
            <View style={styles.card}>
              <View style={styles.cardHeaderWithLink}>
                <Text style={styles.sectionHeading}>Recent Orders</Text>
                <Pressable onPress={() => navigation.navigate('OrderList')}>
                  <Text style={styles.viewAllText}>View All ({orders.length})</Text>
                </Pressable>
              </View>

              {recentOrders.length === 0 ? (
                <Text style={styles.emptyText}>No orders recorded yet. Tap "+ New Order" to start!</Text>
              ) : (
                recentOrders.map((o) => {
                  const bal = orderBalance(o);
                  return (
                    <Pressable
                      key={o.id}
                      style={styles.recentOrderItem}
                      onPress={() => navigation.navigate('OrderDetail', { orderId: o.id })}
                    >
                      <View style={styles.recentOrderLeft}>
                        <Text style={styles.recentOrderNo}>{o.orderNumber}</Text>
                        <Text style={styles.recentCustomer}>{o.customerName || 'Customer'}</Text>
                        <Text style={styles.recentDate}>{formatDate(o.orderDate)}</Text>
                      </View>
                      <View style={styles.recentOrderRight}>
                        <Text style={styles.recentOrderTotal}>{formatCurrency(orderTotal(o))}</Text>
                        <View
                          style={[
                            styles.miniBadge,
                            { backgroundColor: statusColor[o.status] || colors.clay },
                          ]}
                        >
                          <Text style={styles.miniBadgeText}>{o.status}</Text>
                        </View>
                        {bal > 0 ? (
                          <Text style={styles.pendingDueText}>Due {formatCurrency(bal)}</Text>
                        ) : (
                          <Text style={styles.paidText}>Paid</Text>
                        )}
                      </View>
                    </Pressable>
                  );
                })
              )}
            </View>

            {/* Quick Links to Management Tools */}
            <View style={styles.grid2}>
              <Pressable
                style={[styles.toolCard, { borderColor: colors.line }]}
                onPress={() => navigation.navigate('CustomerList')}
              >
                <Ionicons name="people-outline" size={26} color={colors.clayDeep} />
                <Text style={styles.toolTitle}>Customers</Text>
                <Text style={styles.toolSub}>Directory & history</Text>
              </Pressable>

              <Pressable
                style={[styles.toolCard, { borderColor: colors.line }]}
                onPress={() => navigation.navigate('ProductList')}
              >
                <Ionicons name="pricetags-outline" size={26} color={colors.duskDeep} />
                <Text style={styles.toolTitle}>Catalog</Text>
                <Text style={styles.toolSub}>Products & prices</Text>
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 8,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 36,
    color: colors.ink,
  },
  subtitle: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.inkSoft,
    marginTop: -4,
  },
  settingsIconBtn: {
    padding: 8,
    borderRadius: radius.md,
    backgroundColor: colors.paperCard,
    borderWidth: 1,
    borderColor: colors.line,
  },
  loaderWrap: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  card: {
    backgroundColor: colors.paperCard,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 16,
    marginBottom: 16,
    overflow: 'hidden',
    ...shadow.card,
  },
  heroCard: {
    backgroundColor: '#FFFDF8',
    borderColor: colors.line,
    borderLeftWidth: 4,
    borderLeftColor: colors.clayDeep,
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  heroTitle: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.inkSoft,
  },
  profitBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  profitBadgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
  },
  heroAmount: {
    fontFamily: fonts.display,
    fontSize: 38,
    marginVertical: 4,
  },
  heroSub: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.inkSoft,
    marginBottom: 8,
  },
  divider: {
    height: 0,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    borderStyle: 'dashed',
    marginVertical: 12,
  },
  metricGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  metricItem: {
    flex: 1,
  },
  metricLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  metricLabel: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.inkSoft,
  },
  metricValue: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    color: colors.ink,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: radius.md,
    gap: 8,
    elevation: 2,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  actionButtonText: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.white,
  },
  sectionHeading: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.clayDeep,
    marginBottom: 10,
  },
  cardHeaderWithLink: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  viewAllText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.duskDeep,
  },
  statusGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  statusBox: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    backgroundColor: colors.paper,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.line,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginBottom: 6,
  },
  statusNumber: {
    fontFamily: fonts.bodyBold,
    fontSize: 18,
    color: colors.ink,
  },
  statusName: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.inkSoft,
    marginTop: 2,
  },
  emptyText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.inkSoft,
    textAlign: 'center',
    paddingVertical: 16,
  },
  recentOrderItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  recentOrderLeft: {
    flex: 1,
  },
  recentOrderNo: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.clayDeep,
  },
  recentCustomer: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.ink,
    marginTop: 1,
  },
  recentDate: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.inkSoft,
    marginTop: 1,
  },
  recentOrderRight: {
    alignItems: 'flex-end',
    gap: 3,
  },
  recentOrderTotal: {
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    color: colors.ink,
  },
  miniBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  miniBadgeText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 10,
    color: colors.white,
  },
  pendingDueText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    color: colors.danger,
  },
  paidText: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.success,
  },
  grid2: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  toolCard: {
    flex: 1,
    backgroundColor: colors.paperCard,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: 14,
    alignItems: 'center',
    ...shadow.card,
  },
  toolTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.ink,
    marginTop: 6,
  },
  toolSub: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.inkSoft,
    marginTop: 2,
  },
});
