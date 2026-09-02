import React, { useCallback, useState, useEffect, useMemo } from 'react';
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
  Product,
} from '../types/order';
import { getOrders, setOrderStatus } from '../storage/orderStorage';
import { getExpenses } from '../storage/expenseStorage';
import { getLowStockProducts } from '../storage/productStorage';
import { addDataListener } from '../storage/firebaseSync';
import { colors, fonts, radius, shadow, statusColor } from '../theme/theme';
import { formatCurrency, formatDate } from '../utils/format';
import AppLogo from '../components/AppLogo';
import { useLanguage } from '../i18n/LanguageContext';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// Greeting based on time of day
function getGreeting(t: (path: string, fallback?: string) => string): string {
  const h = new Date().getHours();
  if (h < 12) return t('common.greetingMorning', 'Good Morning');
  if (h < 17) return t('common.greetingAfternoon', 'Good Afternoon');
  return t('common.greetingEvening', 'Good Evening');
}

// Status icon map
const statusIcons: Record<OrderStatus, string> = {
  Placed: 'receipt-outline',
  Packed: 'cube-outline',
  Dispatched: 'paper-plane-outline',
  Delivered: 'checkmark-done-circle-outline',
};

export default function DashboardScreen() {
  const navigation = useNavigation<Nav>();
  const { t, language } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);

  // Pipeline Status Quick-Update Modal State
  const [activePipelineStatus, setActivePipelineStatus] = useState<OrderStatus | null>(null);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [showFinancialDetails, setShowFinancialDetails] = useState(false);

  const loadData = useCallback(async (forceSync = false) => {
    try {
      const [o, e, lowStock] = await Promise.all([
        getOrders(forceSync),
        getExpenses(forceSync),
        getLowStockProducts(),
      ]);
      setOrders(o);
      setExpenses(e);
      setLowStockProducts(lowStock);
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

  // Subscribe to live Firestore changes from other devices
  useEffect(() => {
    const unsub = addDataListener(() => {
      loadData(false);
    });
    return () => unsub();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData(true);
  }, [loadData]);

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

  // Memoized Financial Calculations & Status Breakdown
  const dashboardStats = useMemo(() => {
    let totalSales = 0;
    let totalCollected = 0;
    let pendingCollection = 0;

    const statusCounts: Record<OrderStatus, number> = {
      Placed: 0,
      Packed: 0,
      Dispatched: 0,
      Delivered: 0,
    };

    for (let i = 0; i < orders.length; i++) {
      const o = orders[i];
      const tot = orderTotal(o);
      const bal = orderBalance(o);
      totalSales += tot;
      totalCollected += tot - bal;
      if (bal > 0) {
        pendingCollection += bal;
      }
      if (statusCounts[o.status] !== undefined) {
        statusCounts[o.status]++;
      }
    }

    let totalOutflow = 0;
    for (let i = 0; i < expenses.length; i++) {
      totalOutflow += expenses[i].amount;
    }

    const netProfit = totalSales - totalOutflow;
    const liquidCash = totalCollected - totalOutflow;
    const profitMargin = totalSales > 0 ? ((netProfit / totalSales) * 100).toFixed(1) : '0';
    const collectionRate = totalSales > 0 ? Math.min(100, Math.round((totalCollected / totalSales) * 100)) : 0;
    const avgOrderValue = orders.length > 0 ? Math.round(totalSales / orders.length) : 0;

    return {
      totalSales,
      totalOutflow,
      totalCollected,
      pendingCollection,
      netProfit,
      liquidCash,
      profitMargin,
      collectionRate,
      avgOrderValue,
      statusCounts,
      recentOrders: orders.slice(0, 5),
    };
  }, [orders, expenses]);

  const {
    totalSales,
    totalOutflow,
    totalCollected,
    pendingCollection,
    netProfit,
    liquidCash,
    profitMargin,
    collectionRate,
    avgOrderValue,
    statusCounts,
    recentOrders,
  } = dashboardStats;

  // Orders filtered by the currently active pipeline status
  const pipelineFilteredOrders = activePipelineStatus
    ? orders.filter((o) => o.status === activePipelineStatus)
    : [];

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      {/* ─── Fixed Top Header Bar ─── */}
      <View style={styles.fixedHeaderContainer}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <AppLogo size={40} variant="icon" />
            <View style={styles.headerTextBlock}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={styles.greeting}>{getGreeting(t)}</Text>
                <Ionicons name="sparkles" size={14} color={colors.clayDeep} />
              </View>
              <Text style={styles.headerDate}>
                {new Date().toLocaleDateString(language === 'ta' ? 'ta-IN' : language === 'hi' ? 'hi-IN' : 'en-IN', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable
              style={styles.settingsBtn}
              onPress={() => navigation.navigate('History')}
            >
              <Ionicons name="time-outline" size={22} color={colors.inkSoft} />
            </Pressable>
            <Pressable
              style={styles.settingsBtn}
              onPress={() => navigation.navigate('Settings')}
            >
              <Ionicons name="settings-outline" size={22} color={colors.inkSoft} />
            </Pressable>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.clayDeep} />
        }
      >
        {loading ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator size="large" color={colors.clayDeep} />
          </View>
        ) : (
          <>
            {/* ─── Hero Financial Card ─── */}
            <View style={styles.heroCard}>
              {/* Top Row: Label + Profit Percentage Pill */}
              <View style={styles.heroTopRow}>
                <Text style={styles.heroLabel}>{t('dashboard.netBusinessBalance', 'Net Business Balance')}</Text>
                <View
                  style={[
                    styles.profitPill,
                    {
                      backgroundColor: netProfit >= 0 ? '#E8F5E9' : '#FFEBEE',
                    },
                  ]}
                >
                  <Ionicons
                    name={netProfit >= 0 ? 'trending-up' : 'trending-down'}
                    size={13}
                    color={netProfit >= 0 ? colors.inflow : colors.outflow}
                  />
                  <Text
                    style={[
                      styles.profitPillText,
                      { color: netProfit >= 0 ? colors.inflow : colors.outflow },
                    ]}
                  >
                    {netProfit >= 0 ? `${t('dashboard.profit', 'Profit')} (${profitMargin}%)` : `${t('dashboard.deficit', 'Deficit')} (${profitMargin}%)`}
                  </Text>
                </View>
              </View>

              {/* Main Balance Display */}
              <View style={styles.heroAmountRow}>
                <Text
                  style={[
                    styles.heroAmount,
                    { color: netProfit >= 0 ? colors.inflow : colors.outflow },
                  ]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {formatCurrency(netProfit)}
                </Text>
                <View style={styles.liquidBadge}>
                  <Ionicons name="cash-outline" size={12} color={colors.clayDeep} />
                  <Text style={styles.liquidBadgeText}>
                    {t('dashboard.liquidCashLabel', 'Liquid Cash')}: {formatCurrency(liquidCash)}
                  </Text>
                </View>
              </View>

              {/* Cash Collection Progress Bar */}
              <View style={styles.collectionProgressWrap}>
                <View style={styles.collectionProgressLabelRow}>
                  <Text style={styles.collectionProgressTitle}>{t('dashboard.collectionHealth', 'Collection Health')}</Text>
                  <Text style={styles.collectionProgressPct}>{collectionRate}% {t('dashboard.collectedPct', 'Collected')}</Text>
                </View>
                <View style={styles.collectionProgressBarBg}>
                  <View
                    style={[
                      styles.collectionProgressBarFill,
                      { width: `${Math.min(100, Math.max(0, collectionRate))}%` },
                    ]}
                  />
                </View>
              </View>

              {/* 4 Metric Tiles */}
              <View style={styles.metricsRow}>
                <Pressable
                  style={({ pressed }) => [
                    styles.metricTile,
                    { borderLeftColor: colors.inflow },
                    pressed && { opacity: 0.8 },
                  ]}
                  onPress={() => (navigation as any).navigate('OrdersTab', { initialPaymentFilter: 'All' })}
                >
                  <Ionicons name="arrow-down-circle" size={18} color={colors.inflow} />
                  <Text style={styles.metricTileLabel}>{t('dashboard.totalSales')}</Text>
                  <Text style={[styles.metricTileValue, { color: colors.inflow }]}>
                    {formatCurrency(totalSales)}
                  </Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [
                    styles.metricTile,
                    { borderLeftColor: colors.outflow },
                    pressed && { opacity: 0.8 },
                  ]}
                  onPress={() => (navigation as any).navigate('ExpensesTab')}
                >
                  <Ionicons name="arrow-up-circle" size={18} color={colors.outflow} />
                  <Text style={styles.metricTileLabel}>{t('expenses.totalExpenses')}</Text>
                  <Text style={[styles.metricTileValue, { color: colors.outflow }]}>
                    {formatCurrency(totalOutflow)}
                  </Text>
                </Pressable>
              </View>

              <View style={styles.metricsRow}>
                <Pressable
                  style={({ pressed }) => [
                    styles.metricTile,
                    { borderLeftColor: colors.duskDeep },
                    pressed && { opacity: 0.8 },
                  ]}
                  onPress={() => (navigation as any).navigate('OrdersTab', { initialPaymentFilter: 'Paid' })}
                >
                  <Ionicons name="checkmark-circle" size={18} color={colors.duskDeep} />
                  <Text style={styles.metricTileLabel}>{t('orders.payPaid')}</Text>
                  <Text style={styles.metricTileValue}>
                    {formatCurrency(totalCollected)}
                  </Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [
                    styles.metricTile,
                    { borderLeftColor: colors.pending },
                    pressed && { opacity: 0.8 },
                  ]}
                  onPress={() => (navigation as any).navigate('OrdersTab', { initialPaymentFilter: 'Pending', initialSort: 'due' })}
                >
                  <Ionicons name="time" size={18} color={colors.pending} />
                  <Text style={styles.metricTileLabel}>{t('dashboard.pendingDues')}</Text>
                  <Text style={[styles.metricTileValue, { color: colors.pending }]}>
                    {formatCurrency(pendingCollection)}
                  </Text>
                </Pressable>
              </View>

              {/* Expandable Financial Analysis Panel Toggle */}
              <Pressable
                style={({ pressed }) => [
                  styles.expandFinancialBtn,
                  pressed && { opacity: 0.85 },
                ]}
                onPress={() => setShowFinancialDetails(!showFinancialDetails)}
              >
                <Ionicons
                  name={showFinancialDetails ? 'chevron-up' : 'analytics-outline'}
                  size={15}
                  color={colors.clayDeep}
                />
                <Text style={styles.expandFinancialBtnText}>
                  {showFinancialDetails ? t('common.clear') : `${t('dashboard.cashFlow')} & Analysis`}
                </Text>
              </Pressable>

              {showFinancialDetails && (
                <View style={styles.financialBreakdownPanel}>
                  <View style={styles.breakdownItemRow}>
                    <View style={styles.breakdownLabelGroup}>
                      <Ionicons name="cash" size={15} color={colors.inflow} />
                      <Text style={styles.breakdownLabelText}>{t('dashboard.liquidCash')}</Text>
                    </View>
                    <Text
                      style={[
                        styles.breakdownValText,
                        { color: liquidCash >= 0 ? colors.inflow : colors.outflow },
                      ]}
                    >
                      {formatCurrency(liquidCash)}
                    </Text>
                  </View>

                  <View style={styles.breakdownItemRow}>
                    <View style={styles.breakdownLabelGroup}>
                      <Ionicons name="pie-chart" size={15} color={colors.duskDeep} />
                      <Text style={styles.breakdownLabelText}>{t('dashboard.netProfit')}</Text>
                    </View>
                    <Text style={styles.breakdownValText}>{profitMargin}%</Text>
                  </View>

                  <View style={styles.breakdownItemRow}>
                    <View style={styles.breakdownLabelGroup}>
                      <Ionicons name="shield-checkmark" size={15} color={colors.statusDelivered} />
                      <Text style={styles.breakdownLabelText}>{t('dashboard.collectionRate')}</Text>
                    </View>
                    <Text style={styles.breakdownValText}>{collectionRate}%</Text>
                  </View>
                </View>
              )}
            </View>

            {/* ─── Quick Action Buttons ─── */}
            <View style={styles.actionsRow}>
              <Pressable
                style={({ pressed }) => [
                  styles.actionBtn,
                  styles.actionBtnPrimary,
                  pressed && styles.actionBtnPressed,
                ]}
                onPress={() => navigation.navigate('OrderForm', undefined)}
              >
                <View style={styles.actionBtnIcon}>
                  <Ionicons name="cart" size={20} color={colors.white} />
                </View>
                <Text style={styles.actionBtnText}>{t('dashboard.newOrder')}</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.actionBtn,
                  styles.actionBtnSecondary,
                  pressed && styles.actionBtnPressed,
                ]}
                onPress={() => navigation.navigate('ExpenseForm', undefined)}
              >
                <View style={[styles.actionBtnIcon, { backgroundColor: colors.dusk }]}>
                  <Ionicons name="wallet" size={20} color={colors.white} />
                </View>
                <Text style={[styles.actionBtnText, { color: colors.duskDeep }]}>
                  {t('dashboard.recordExpense')}
                </Text>
              </Pressable>
            </View>

            {/* ─── Low Stock Alert Banner ─── */}
            {lowStockProducts.length > 0 && (
              <Pressable
                style={({ pressed }) => [
                  styles.lowStockBanner,
                  pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] },
                ]}
                onPress={() => navigation.navigate('ProductList')}
              >
                <View style={styles.lowStockBannerLeft}>
                  <View style={styles.lowStockIconWrap}>
                    <Ionicons name="warning-outline" size={20} color="#B45309" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.lowStockBannerTitle}>
                      {lowStockProducts.length} Product{lowStockProducts.length > 1 ? 's' : ''} Low on Stock!
                    </Text>
                    <Text style={styles.lowStockBannerSubtitle} numberOfLines={1}>
                      {lowStockProducts.map((p) => `${p.name} (${p.stockQty ?? 0})`).join(', ')}
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#B45309" />
              </Pressable>
            )}

            {/* ─── Order Pipeline ─── */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>{t('dashboard.pipelineTitle')}</Text>
                <Pressable
                  style={({ pressed }) => [
                    styles.pipelineManageBadge,
                    pressed && { opacity: 0.75 },
                  ]}
                  onPress={() => setActivePipelineStatus('Placed')}
                >
                  <Ionicons name="options-outline" size={13} color={colors.clayDeep} />
                  <Text style={styles.pipelineManageText}>{t('dashboard.pipelineTapToManage')}</Text>
                </Pressable>
              </View>
              <View style={styles.pipelineRow}>
                {ORDER_STATUS_STEPS.map((st, idx) => {
                  const cnt = statusCounts[st] || 0;
                  const color = statusColor[st] || colors.clay;
                  const isLast = idx === ORDER_STATUS_STEPS.length - 1;
                  return (
                    <React.Fragment key={st}>
                      <Pressable
                        style={({ pressed }) => [
                          styles.pipelineItem,
                          pressed && { opacity: 0.7, transform: [{ scale: 0.95 }] },
                        ]}
                        onPress={() => setActivePipelineStatus(st)}
                      >
                        <View style={[styles.pipelineCircle, { backgroundColor: cnt > 0 ? color : colors.line }]}>
                          <Ionicons
                            name={statusIcons[st] as any}
                            size={18}
                            color={cnt > 0 ? colors.white : colors.inkSoft}
                          />
                        </View>
                        <Text style={[styles.pipelineCount, cnt > 0 && { color }]}>{cnt}</Text>
                        <Text style={styles.pipelineName} numberOfLines={1}>
                          {t('status.' + st.toLowerCase()) || st}
                        </Text>
                      </Pressable>
                      {!isLast && (
                        <View style={styles.pipelineConnector}>
                          <View style={styles.pipelineConnectorLine} />
                          <Ionicons name="chevron-forward" size={10} color={colors.line} />
                        </View>
                      )}
                    </React.Fragment>
                  );
                })}
              </View>
            </View>

            {/* ─── Recent Orders ─── */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>{t('dashboard.recentOrders')}</Text>
                <Pressable
                  style={styles.viewAllBtn}
                  onPress={() => navigation.navigate('OrderList')}
                >
                  <Text style={styles.viewAllText}>{t('common.all')} ({orders.length})</Text>
                  <Ionicons name="chevron-forward" size={14} color={colors.duskDeep} />
                </Pressable>
              </View>

              {recentOrders.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="document-text-outline" size={40} color={colors.line} />
                  <Text style={styles.emptyTitle}>{t('dashboard.noOrdersYet')}</Text>
                </View>
              ) : (
                recentOrders.map((o: Order, idx: number) => {
                  const bal = orderBalance(o);
                  const isLast = idx === recentOrders.length - 1;
                  return (
                    <Pressable
                      key={o.id}
                      style={({ pressed }) => [
                        styles.orderRow,
                        !isLast && styles.orderRowBorder,
                        pressed && { backgroundColor: '#F9F5EC' },
                      ]}
                      onPress={() => navigation.navigate('OrderDetail', { orderId: o.id })}
                    >
                      {/* Status indicator dot */}
                      <View
                        style={[
                          styles.orderStatusDot,
                          { backgroundColor: statusColor[o.status] || colors.clay },
                        ]}
                      />
                      <View style={styles.orderInfo}>
                        <View style={styles.orderTopLine}>
                          <Text style={styles.orderNo}>{o.orderNumber}</Text>
                          <Text style={styles.orderAmount}>{formatCurrency(orderTotal(o))}</Text>
                        </View>
                        <View style={styles.orderBottomLine}>
                          <Text style={styles.orderCustomer} numberOfLines={1}>
                            {o.customerName || 'Customer'}
                          </Text>
                          <View style={styles.orderMeta}>
                            <View
                              style={[
                                styles.statusChip,
                                { backgroundColor: statusColor[o.status] || colors.clay },
                              ]}
                            >
                              <Text style={styles.statusChipText}>{t('status.' + o.status.toLowerCase()) || o.status}</Text>
                            </View>
                            {bal > 0 ? (
                              <Text style={styles.dueBadge}>₹{bal.toLocaleString('en-IN')} {t('common.due') || 'due'}</Text>
                            ) : (
                              <View style={styles.paidBadgeInline}>
                                <Ionicons name="checkmark-circle" size={12} color={colors.success} />
                                <Text style={styles.paidBadge}>{t('common.paid') || 'Paid'}</Text>
                              </View>
                            )}
                          </View>
                        </View>
                        <Text style={styles.orderDate}>{formatDate(o.orderDate)}</Text>
                      </View>
                    </Pressable>
                  );
                })
              )}
            </View>

            {/* ─── Quick Tools Grid ─── */}
            <View style={styles.toolsGrid}>
              <Pressable
                style={({ pressed }) => [
                  styles.toolCard,
                  pressed && { opacity: 0.8, transform: [{ scale: 0.97 }] },
                ]}
                onPress={() => navigation.navigate('CustomerList')}
              >
                <View style={[styles.toolIconWrap, { backgroundColor: colors.clayLight }]}>
                  <Ionicons name="people" size={22} color={colors.clayDeep} />
                </View>
                <Text style={styles.toolName}>{t('nav.customers')}</Text>
                <Text style={styles.toolDesc}>Directory & history</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.toolCard,
                  pressed && { opacity: 0.8, transform: [{ scale: 0.97 }] },
                ]}
                onPress={() => navigation.navigate('ProductList')}
              >
                <View style={[styles.toolIconWrap, { backgroundColor: colors.duskLight }]}>
                  <Ionicons name="pricetags" size={22} color={colors.duskDeep} />
                </View>
                <Text style={styles.toolName}>{t('nav.products')}</Text>
                <Text style={styles.toolDesc}>Products & prices</Text>
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
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setActivePipelineStatus(null)}
        >
          <Pressable
            style={styles.modalSheet}
            onPress={(e) => e.stopPropagation?.()}
          >
            {/* Drag Handle */}
            <View style={styles.modalHandle} />

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
                  <Ionicons
                    name={(activePipelineStatus ? statusIcons[activePipelineStatus] : 'cube-outline') as any}
                    size={15}
                    color={colors.white}
                  />
                  <Text style={styles.modalStatusBadgeText}>
                    {activePipelineStatus} stage ({pipelineFilteredOrders.length})
                  </Text>
                </View>
                <Text style={styles.modalSubtitle}>Manage stage status & quick progress orders</Text>
              </View>
              <Pressable
                onPress={() => setActivePipelineStatus(null)}
                style={styles.modalCloseBtn}
                hitSlop={12}
              >
                <Ionicons name="close-circle" size={28} color={colors.inkSoft} />
              </Pressable>
            </View>

            {/* Status Switcher Tabs inside modal */}
            <View style={styles.modalStatusTabsWrap}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.modalStatusTabsContent}
              >
                {ORDER_STATUS_STEPS.map((st) => {
                  const isActive = activePipelineStatus === st;
                  const count = statusCounts[st] || 0;
                  const activeColor = statusColor[st];
                  return (
                    <Pressable
                      key={st}
                      style={[
                        styles.modalStatusTab,
                        isActive && { backgroundColor: activeColor, borderColor: activeColor },
                      ]}
                      onPress={() => setActivePipelineStatus(st)}
                    >
                      <Ionicons
                        name={statusIcons[st] as any}
                        size={15}
                        color={isActive ? colors.white : colors.inkSoft}
                      />
                      <Text
                        style={[
                          styles.modalStatusTabText,
                          isActive && styles.modalStatusTabTextActive,
                        ]}
                      >
                        {st}
                      </Text>
                      <View
                        style={[
                          styles.modalStatusTabCountBadge,
                          isActive
                            ? { backgroundColor: 'rgba(255,255,255,0.25)' }
                            : { backgroundColor: colors.line },
                        ]}
                      >
                        <Text
                          style={[
                            styles.modalStatusTabCountText,
                            isActive && { color: colors.white },
                          ]}
                        >
                          {count}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
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
                  const tot = orderTotal(item);
                  const isUpdating = updatingOrderId === item.id;
                  const currentIdx = ORDER_STATUS_STEPS.indexOf(item.status);
                  const nextStep = currentIdx < ORDER_STATUS_STEPS.length - 1 ? ORDER_STATUS_STEPS[currentIdx + 1] : null;
                  const firstChar = (item.customerName || 'C').charAt(0).toUpperCase();

                  return (
                    <View
                      style={[
                        styles.pipelineOrderCard,
                        { borderLeftColor: statusColor[item.status] || colors.clay },
                      ]}
                    >
                      {/* Top Order Number & Amount Header */}
                      <View style={styles.pipelineCardTopHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <View style={styles.orderNoBadge}>
                            <Ionicons name="receipt" size={13} color={colors.clayDeep} />
                            <Text style={styles.pipelineOrderNo}>{item.orderNumber}</Text>
                          </View>
                          {bal > 0 ? (
                            <View style={styles.dueBadgeWrap}>
                              <Text style={styles.dueBadgeText}>₹{bal.toLocaleString('en-IN')} due</Text>
                            </View>
                          ) : (
                            <View style={styles.paidBadgeWrap}>
                              <Ionicons name="checkmark-circle" size={12} color={colors.statusDelivered} />
                              <Text style={styles.paidBadgeText}>{t('common.paid') || 'Paid'}</Text>
                            </View>
                          )}
                        </View>

                        <Text style={styles.pipelineCardTotalAmount}>{formatCurrency(tot)}</Text>
                      </View>

                      {/* Customer Info & Date Row */}
                      <View style={styles.customerRow}>
                        <View style={styles.customerAvatar}>
                          <Text style={styles.customerAvatarText}>{firstChar}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.pipelineCustomerName}>
                            {item.customerName || 'Customer'}
                          </Text>
                          <Text style={styles.pipelineOrderDate}>
                            {formatDate(item.orderDate)} • {item.items.length} {item.items.length === 1 ? 'Item' : 'Items'}
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

                      {/* Mini Visual Pipeline Progress Bar */}
                      <View style={styles.miniTrackerWrap}>
                        {ORDER_STATUS_STEPS.map((step, idx) => {
                          const reached = idx <= currentIdx;
                          const isCurrent = idx === currentIdx;
                          const stepColor = statusColor[step];
                          return (
                            <React.Fragment key={step}>
                              {idx > 0 && (
                                <View
                                  style={[
                                    styles.miniConnectorLine,
                                    { backgroundColor: reached ? stepColor : colors.line },
                                  ]}
                                />
                              )}
                              <Pressable
                                disabled={isUpdating}
                                style={[
                                  styles.miniStepNode,
                                  {
                                    borderColor: stepColor,
                                    backgroundColor: reached ? stepColor : colors.paperCard,
                                  },
                                  isCurrent && styles.miniStepNodeActive,
                                ]}
                                onPress={() => handleQuickStatusChange(item.id, step)}
                              >
                                <Ionicons
                                  name={statusIcons[step] as any}
                                  size={10}
                                  color={reached ? colors.white : colors.inkSoft}
                                />
                              </Pressable>
                            </React.Fragment>
                          );
                        })}
                      </View>

                      {/* Prominent Next Stage Action Button */}
                      {nextStep && (
                        <Pressable
                          disabled={isUpdating}
                          style={({ pressed }) => [
                            styles.primaryAdvanceBtn,
                            { backgroundColor: statusColor[nextStep] },
                            pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
                          ]}
                          onPress={() => handleQuickStatusChange(item.id, nextStep)}
                        >
                          {isUpdating ? (
                            <ActivityIndicator size="small" color={colors.white} />
                          ) : (
                            <>
                              <Ionicons name="sparkles" size={14} color={colors.white} />
                              <Text style={styles.primaryAdvanceBtnText}>
                                Move to {nextStep} Stage
                              </Text>
                              <Ionicons name="arrow-forward-circle" size={16} color={colors.white} />
                            </>
                          )}
                        </Pressable>
                      )}
                    </View>
                  );
                }}
              />
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  fixedHeaderContainer: {
    backgroundColor: colors.paper,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    paddingHorizontal: 20,
    zIndex: 10,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 40,
    width: '100%',
    maxWidth: 1040,
    alignSelf: 'center',
  },

  // ─── Header ───
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    maxWidth: 1040,
    width: '100%',
    alignSelf: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTextBlock: {
    gap: 1,
  },
  greeting: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.ink,
    paddingRight: 6,
    lineHeight: 32,
  },
  headerDate: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.inkSoft,
  },
  settingsBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.paperCard,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loaderWrap: {
    paddingVertical: 60,
    alignItems: 'center',
  },

  // ─── Hero Financial Card ───
  heroCard: {
    backgroundColor: colors.paperCard,
    borderRadius: radius.lg,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.line,
    ...shadow.card,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  heroAmountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  heroLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.inkSoft,
  },
  heroAmount: {
    fontFamily: fonts.display,
    fontSize: 38,
    lineHeight: 44,
    paddingRight: 10,
  },
  profitPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  profitPillText: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
  },
  liquidBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.paper,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.line,
  },
  liquidBadgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: colors.clayDeep,
  },
  collectionProgressWrap: {
    marginBottom: 14,
    backgroundColor: colors.paper,
    padding: 10,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.line,
  },
  collectionProgressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  collectionProgressTitle: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    color: colors.inkSoft,
  },
  collectionProgressPct: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: colors.duskDeep,
  },
  collectionProgressBarBg: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.line,
    overflow: 'hidden',
  },
  collectionProgressBarFill: {
    height: '100%',
    backgroundColor: colors.duskDeep,
    borderRadius: 3,
  },
  expandFinancialBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 6,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    borderStyle: 'dashed' as any,
  },
  expandFinancialBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: colors.clayDeep,
  },
  financialBreakdownPanel: {
    marginTop: 10,
    paddingTop: 10,
    backgroundColor: colors.paper,
    borderRadius: radius.sm,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.line,
    gap: 10,
  },
  breakdownItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  breakdownLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  breakdownLabelText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.ink,
  },
  breakdownValText: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.ink,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  metricTile: {
    flex: 1,
    backgroundColor: colors.paper,
    borderRadius: radius.sm,
    padding: 12,
    borderLeftWidth: 3,
    gap: 4,
  },
  metricTileLabel: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.inkSoft,
  },
  metricTileValue: {
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    color: colors.ink,
  },

  // ─── Action Buttons ───
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: radius.md,
    gap: 10,
    ...shadow.card,
  },
  actionBtnPrimary: {
    backgroundColor: colors.clayDeep,
  },
  actionBtnSecondary: {
    backgroundColor: colors.paperCard,
    borderWidth: 1.5,
    borderColor: colors.duskDeep,
  },
  actionBtnPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.97 }],
  },
  actionBtnIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    color: colors.white,
  },

  // ─── Section Card ───
  sectionCard: {
    backgroundColor: colors.paperCard,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 16,
    marginBottom: 16,
    ...shadow.card,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.clayDeep,
    paddingRight: 8,
  },
  sectionHint: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    color: colors.clayDeep,
  },

  // ─── Pipeline ───
  pipelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pipelineItem: {
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  pipelineCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  pipelineCount: {
    fontFamily: fonts.bodyBold,
    fontSize: 17,
    color: colors.ink,
  },
  pipelineName: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    color: colors.inkSoft,
    textAlign: 'center',
  },
  pipelineManageBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.clayLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(184, 80, 66, 0.15)',
  },
  pipelineManageText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: colors.clayDeep,
  },
  pipelineConnector: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: -18,
  },
  pipelineConnectorLine: {
    width: 8,
    height: 1.5,
    backgroundColor: colors.line,
  },

  // ─── Recent Orders ───
  viewAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  viewAllText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.duskDeep,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 6,
  },
  emptyTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.ink,
  },
  emptyDesc: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.inkSoft,
    textAlign: 'center',
  },
  orderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    gap: 12,
  },
  orderRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    borderStyle: 'dashed' as any,
  },
  orderStatusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 5,
  },
  orderInfo: {
    flex: 1,
    gap: 3,
  },
  orderTopLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderNo: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.clayDeep,
  },
  orderAmount: {
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    color: colors.ink,
  },
  orderBottomLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderCustomer: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.ink,
    flex: 1,
  },
  orderMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusChip: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  statusChipText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 10,
    color: colors.white,
  },
  dueBadge: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    color: colors.danger,
  },
  paidBadgeInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  paidBadge: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    color: colors.success,
  },
  orderDate: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.inkSoft,
  },

  // ─── Tools Grid ───
  toolsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  toolCard: {
    flex: 1,
    backgroundColor: colors.paperCard,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 16,
    alignItems: 'center',
    gap: 6,
    ...shadow.card,
  },
  toolIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  toolName: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.ink,
  },
  toolDesc: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.inkSoft,
  },

  // ─── Modal Styles ───
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(30, 24, 18, 0.24)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  modalSheet: {
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    backgroundColor: colors.paperCard,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '84%',
    minHeight: '48%',
    paddingBottom: 24,
    borderWidth: 1,
    borderColor: colors.line,
    ...shadow.card,
  },
  modalHandle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.line,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 14,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
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
  modalStatusTabsWrap: {
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    backgroundColor: colors.paper,
    paddingVertical: 8,
  },
  modalStatusTabsContent: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: 'center',
  },
  modalStatusTab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.md,
    backgroundColor: colors.paperCard,
    borderWidth: 1,
    borderColor: colors.line,
  },
  modalStatusTabText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.inkSoft,
  },
  modalStatusTabTextActive: {
    color: colors.white,
    fontFamily: fonts.bodyBold,
  },
  modalStatusTabCountBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalStatusTabCountText: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    color: colors.inkSoft,
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
    borderLeftWidth: 5,
    padding: 14,
    ...shadow.card,
  },
  pipelineCardTopHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  orderNoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.clayLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  pipelineOrderNo: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.clayDeep,
  },
  pipelineCardTotalAmount: {
    fontFamily: fonts.display,
    fontSize: 18,
    color: colors.ink,
  },
  dueBadgeWrap: {
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  dueBadgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: colors.pending,
  },
  paidBadgeWrap: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  paidBadgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: colors.statusDelivered,
  },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  customerAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.duskLight,
    borderWidth: 1,
    borderColor: colors.dusk,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customerAvatarText: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.duskDeep,
  },
  pipelineCustomerName: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.ink,
  },
  pipelineOrderDate: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.inkSoft,
    marginTop: 1,
  },
  viewDetailBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: colors.paperCard,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.sm,
  },
  viewDetailText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    color: colors.clayDeep,
  },
  miniTrackerWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.paperCard,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: 10,
  },
  miniStepNode: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniStepNodeActive: {
    transform: [{ scale: 1.15 }],
  },
  miniConnectorLine: {
    flex: 1,
    height: 2,
    borderRadius: 1,
    marginHorizontal: 2,
  },
  primaryAdvanceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: radius.sm,
    marginTop: 2,
    ...shadow.card,
  },
  primaryAdvanceBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.white,
  },
  lowStockBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: radius.md,
    padding: 14,
    marginBottom: 16,
    ...shadow.card,
  },
  lowStockBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  lowStockIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FDE68A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lowStockBannerTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: '#92400E',
  },
  lowStockBannerSubtitle: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: '#B45309',
    marginTop: 2,
  },
});
