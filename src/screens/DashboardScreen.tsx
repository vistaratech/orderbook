import React, { useCallback, useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Modal,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { RootStackParamList } from '../navigation/types';
import {
  Order,
  OrderStatus,
  ORDER_STATUS_STEPS,
  orderBalance,
  orderTotal,
  Expense,
} from '../types/order';
import { getOrders, setOrderStatus } from '../storage/orderStorage';
import { getExpenses } from '../storage/expenseStorage';
import { addDataListener } from '../storage/firebaseSync';
import { colors, fonts, radius, shadow, statusColor } from '../theme/theme';
import { formatCurrency, formatDate } from '../utils/format';
import AppLogo from '../components/AppLogo';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function DashboardScreen() {
  const navigation = useNavigation<Nav>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);

  // Pipeline Status Quick-Update Modal State
  const [activePipelineStatus, setActivePipelineStatus] = useState<OrderStatus | null>(null);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

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

  // Status update handler for Pipeline
  const handleQuickStatusChange = async (orderId: string, newStatus: OrderStatus) => {
    setUpdatingOrderId(orderId);
    try {
      await setOrderStatus(orderId, newStatus);
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
      );
    } finally {
      setUpdatingOrderId(null);
    }
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
  const statusCounts: Record<OrderStatus, number> = {
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

  // Orders filtered by the currently active pipeline status
  const pipelineFilteredOrders = activePipelineStatus
    ? orders.filter((o) => o.status === activePipelineStatus)
    : [];

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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <AppLogo size={36} variant="icon" />
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

            {/* Interactive Order Pipeline Status */}
            <View style={styles.card}>
              <View style={styles.pipelineHeaderRow}>
                <Text style={styles.sectionHeading}>Order Pipeline</Text>
                <Text style={styles.pipelineHint}>Tap to update status ⚡</Text>
              </View>
              <View style={styles.statusGrid}>
                {ORDER_STATUS_STEPS.map((st) => {
                  const cnt = statusCounts[st] || 0;
                  const color = statusColor[st] || colors.clay;
                  return (
                    <Pressable
                      key={st}
                      style={({ pressed }) => [
                        styles.statusBox,
                        pressed && styles.statusBoxPressed,
                        cnt > 0 && { borderColor: color, backgroundColor: '#FFFDF9' },
                      ]}
                      onPress={() => setActivePipelineStatus(st)}
                    >
                      <View style={[styles.statusDot, { backgroundColor: color }]} />
                      <Text style={[styles.statusNumber, cnt > 0 && { color }]}>
                        {cnt}
                      </Text>
                      <Text style={styles.statusName}>{st}</Text>
                    </Pressable>
                  );
                })}
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

      {/* ─── Pipeline Quick Status Update Modal ─── */}
      <Modal
        visible={!!activePipelineStatus}
        animationType="slide"
        transparent
        onRequestClose={() => setActivePipelineStatus(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderTitleRow}>
                <View
                  style={[
                    styles.modalStatusBadge,
                    activePipelineStatus
                      ? { backgroundColor: statusColor[activePipelineStatus] }
                      : null,
                  ]}
                >
                  <Text style={styles.modalStatusBadgeText}>
                    {activePipelineStatus} ({pipelineFilteredOrders.length})
                  </Text>
                </View>
                <Text style={styles.modalSubtitle}>Tap any status below to update</Text>
              </View>
              <Pressable
                onPress={() => setActivePipelineStatus(null)}
                style={styles.modalCloseBtn}
                hitSlop={12}
              >
                <Ionicons name="close-circle" size={26} color={colors.inkSoft} />
              </Pressable>
            </View>

            {/* Status Switcher Tabs inside modal */}
            <View style={styles.modalStatusTabs}>
              {ORDER_STATUS_STEPS.map((st) => {
                const isActive = activePipelineStatus === st;
                const count = statusCounts[st] || 0;
                return (
                  <Pressable
                    key={st}
                    style={[
                      styles.modalStatusTab,
                      isActive && { backgroundColor: statusColor[st], borderColor: statusColor[st] },
                    ]}
                    onPress={() => setActivePipelineStatus(st)}
                  >
                    <Text
                      style={[
                        styles.modalStatusTabText,
                        isActive && styles.modalStatusTabTextActive,
                      ]}
                    >
                      {st} ({count})
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Orders List for Active Status */}
            {pipelineFilteredOrders.length === 0 ? (
              <View style={styles.modalEmptyState}>
                <Ionicons
                  name="checkmark-done-circle-outline"
                  size={48}
                  color={colors.statusDelivered}
                />
                <Text style={styles.modalEmptyTitle}>No {activePipelineStatus} Orders</Text>
                <Text style={styles.modalEmptyDesc}>
                  All orders in this stage have been moved to the next step.
                </Text>
              </View>
            ) : (
              <FlatList
                data={pipelineFilteredOrders}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.modalListContent}
                renderItem={({ item }) => {
                  const bal = orderBalance(item);
                  const isUpdating = updatingOrderId === item.id;
                  return (
                    <View style={styles.pipelineOrderCard}>
                      {/* Top Order Info */}
                      <View style={styles.pipelineCardTop}>
                        <View>
                          <Text style={styles.pipelineOrderNo}>{item.orderNumber}</Text>
                          <Text style={styles.pipelineCustomerName}>
                            {item.customerName || 'Customer'}
                          </Text>
                          <Text style={styles.pipelineOrderDate}>
                            {formatDate(item.orderDate)} • {formatCurrency(orderTotal(item))}
                            {bal > 0 ? ` (Due ${formatCurrency(bal)})` : ' (Paid)'}
                          </Text>
                        </View>
                        <Pressable
                          style={styles.viewDetailBtn}
                          onPress={() => {
                            setActivePipelineStatus(null);
                            navigation.navigate('OrderDetail', { orderId: item.id });
                          }}
                        >
                          <Text style={styles.viewDetailText}>Details</Text>
                          <Ionicons name="chevron-forward" size={14} color={colors.clayDeep} />
                        </Pressable>
                      </View>

                      {/* Quick Status Selector Pills */}
                      <View style={styles.statusUpdateRow}>
                        <Text style={styles.updateStatusLabel}>Move to:</Text>
                        <View style={styles.statusPillsWrap}>
                          {ORDER_STATUS_STEPS.map((step) => {
                            const isCurrent = item.status === step;
                            const stepColor = statusColor[step];
                            return (
                              <Pressable
                                key={step}
                                disabled={isUpdating}
                                style={[
                                  styles.statusPillBtn,
                                  isCurrent && {
                                    backgroundColor: stepColor,
                                    borderColor: stepColor,
                                  },
                                ]}
                                onPress={() => handleQuickStatusChange(item.id, step)}
                              >
                                {isUpdating && isCurrent ? (
                                  <ActivityIndicator size="small" color={colors.white} />
                                ) : (
                                  <Text
                                    style={[
                                      styles.statusPillText,
                                      isCurrent && styles.statusPillTextActive,
                                    ]}
                                  >
                                    {step}
                                  </Text>
                                )}
                              </Pressable>
                            );
                          })}
                        </View>
                      </View>
                    </View>
                  );
                }}
              />
            )}
          </View>
        </View>
      </Modal>
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
  pipelineHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionHeading: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.clayDeep,
  },
  pipelineHint: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    color: colors.clayDeep,
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
    paddingVertical: 12,
    backgroundColor: colors.paper,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.line,
  },
  statusBoxPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.97 }],
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

  // ─── Modal Styles ───
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.paperCard,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    maxHeight: '82%',
    minHeight: '45%',
    paddingTop: 16,
    paddingBottom: 24,
    borderWidth: 1,
    borderColor: colors.line,
    ...shadow.card,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  modalHeaderTitleRow: {
    flex: 1,
  },
  modalStatusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.sm,
    marginBottom: 4,
  },
  modalStatusBadgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.white,
  },
  modalSubtitle: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.inkSoft,
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalStatusTabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  modalStatusTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: radius.sm,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
  },
  modalStatusTabText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    color: colors.inkSoft,
  },
  modalStatusTabTextActive: {
    color: colors.white,
    fontFamily: fonts.bodyBold,
  },
  modalListContent: {
    padding: 16,
    gap: 12,
  },
  modalEmptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  modalEmptyTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    color: colors.ink,
    marginTop: 10,
  },
  modalEmptyDesc: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.inkSoft,
    textAlign: 'center',
    marginTop: 4,
  },
  pipelineOrderCard: {
    backgroundColor: colors.paper,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 12,
  },
  pipelineCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  pipelineOrderNo: {
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    color: colors.clayDeep,
  },
  pipelineCustomerName: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.ink,
    marginTop: 1,
  },
  pipelineOrderDate: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.inkSoft,
    marginTop: 2,
  },
  viewDetailBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: colors.paperCard,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  viewDetailText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    color: colors.clayDeep,
  },
  statusUpdateRow: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: 8,
  },
  updateStatusLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    color: colors.inkSoft,
    marginBottom: 6,
  },
  statusPillsWrap: {
    flexDirection: 'row',
    gap: 6,
  },
  statusPillBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    borderRadius: radius.sm,
    backgroundColor: colors.paperCard,
    borderWidth: 1,
    borderColor: colors.line,
  },
  statusPillText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    color: colors.ink,
  },
  statusPillTextActive: {
    color: colors.white,
    fontFamily: fonts.bodyBold,
  },
});
