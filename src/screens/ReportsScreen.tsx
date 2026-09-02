import React, { useCallback, useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Share,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import useCollapsibleHeader from '../hooks/useCollapsibleHeader';
import { Ionicons } from '@expo/vector-icons';

import { Order, Expense, orderTotal, orderBalance } from '../types/order';
import { Purchase, purchaseTotal } from '../types/purchase';
import { getOrders } from '../storage/orderStorage';
import { getExpenses } from '../storage/expenseStorage';
import { getPurchases } from '../storage/purchaseStorage';
import { addDataListener } from '../storage/firebaseSync';
import { colors, fonts, radius, shadow, categoryColor } from '../theme/theme';
import { formatCurrency } from '../utils/format';
import { useLanguage } from '../i18n/LanguageContext';

type Period = 'this_month' | 'last_30_days' | 'this_week' | 'all_time';

export default function ReportsScreen() {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState<Period>('this_month');
  const [orders, setOrders] = useState<Order[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);

  const {
    onScroll,
    scrollEventThrottle,
    headerAnimatedStyle,
    onHeaderLayout,
    headerHeight,
  } = useCollapsibleHeader({ initialHeight: 110 });

  const loadData = useCallback(async (forceSync = false) => {
    try {
      const [o, e, p] = await Promise.all([
        getOrders(forceSync),
        getExpenses(forceSync),
        getPurchases(forceSync),
      ]);
      setOrders(o);
      setExpenses(e);
      setPurchases(p);
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

  // Subscribe to live Firestore updates
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

  // Date filtering
  const now = new Date();
  const filterDate = useMemo(() => {
    const d = new Date();
    if (period === 'this_week') {
      d.setDate(d.getDate() - 7);
      return d.toISOString();
    }
    if (period === 'this_month') {
      return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    }
    if (period === 'last_30_days') {
      d.setDate(d.getDate() - 30);
      return d.toISOString();
    }
    return '';
  }, [period]);

  const filteredOrders = useMemo(() => {
    if (!filterDate) return orders;
    return orders.filter((o) => (o.createdAt || o.orderDate) >= filterDate);
  }, [orders, filterDate]);

  const filteredExpenses = useMemo(() => {
    if (!filterDate) return expenses;
    return expenses.filter((e) => (e.createdAt || e.date) >= filterDate);
  }, [expenses, filterDate]);

  const filteredPurchases = useMemo(() => {
    if (!filterDate) return purchases;
    return purchases.filter((p) => (p.createdAt || p.purchaseDate) >= filterDate);
  }, [purchases, filterDate]);

  // Memoized Totals
  const reportTotals = useMemo(() => {
    let totalInflow = 0;
    let totalCollected = 0;
    let totalPending = 0;

    for (let i = 0; i < filteredOrders.length; i++) {
      const o = filteredOrders[i];
      const tot = orderTotal(o);
      const bal = orderBalance(o);
      totalInflow += tot;
      totalCollected += tot - bal;
      if (bal > 0) {
        totalPending += bal;
      }
    }

    let totalPurchases = 0;
    for (let i = 0; i < filteredPurchases.length; i++) {
      totalPurchases += purchaseTotal(filteredPurchases[i]);
    }

    let totalOutflow = 0;
    for (let i = 0; i < filteredExpenses.length; i++) {
      totalOutflow += filteredExpenses[i].amount;
    }

    const grossProfit = totalInflow - totalPurchases;
    const netProfit = grossProfit - totalOutflow;
    const liquidCash = totalCollected - totalOutflow - totalPurchases;
    const profitMargin = totalInflow > 0 ? ((netProfit / totalInflow) * 100).toFixed(1) : '0';
    const collectionRate = totalInflow > 0 ? Math.min(100, Math.round((totalCollected / totalInflow) * 100)) : 0;

    return {
      totalInflow,
      totalPurchases,
      grossProfit,
      totalOutflow,
      totalCollected,
      totalPending,
      netProfit,
      liquidCash,
      profitMargin,
      collectionRate,
    };
  }, [filteredOrders, filteredExpenses, filteredPurchases]);

  const {
    totalInflow,
    totalPurchases,
    grossProfit,
    totalOutflow,
    totalCollected,
    totalPending,
    netProfit,
    liquidCash,
    profitMargin,
    collectionRate,
  } = reportTotals;

  // Expense breakdown by category
  const expenseByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    filteredExpenses.forEach((e) => {
      map[e.category] = (map[e.category] || 0) + e.amount;
    });
    return Object.entries(map)
      .map(([cat, amt]) => ({
        category: cat,
        amount: amt,
        pct: totalOutflow > 0 ? (amt / totalOutflow) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [filteredExpenses, totalOutflow]);

  // Top Customers
  const topCustomers = useMemo(() => {
    const map: Record<string, { total: number; count: number; phone: string }> = {};
    filteredOrders.forEach((o) => {
      const name = o.customerName || 'Walk-in Customer';
      if (!map[name]) {
        map[name] = { total: 0, count: 0, phone: o.phoneNumber };
      }
      map[name].total += orderTotal(o);
      map[name].count += 1;
    });
    return Object.entries(map)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [filteredOrders]);

  // Best Selling Items
  const topItems = useMemo(() => {
    const map: Record<string, { qty: number; revenue: number }> = {};
    filteredOrders.forEach((o) => {
      o.items.forEach((it) => {
        const key = it.name.trim() || 'Item';
        if (!map[key]) {
          map[key] = { qty: 0, revenue: 0 };
        }
        map[key].qty += it.qty || 0;
        map[key].revenue += (it.qty || 0) * (it.price || 0);
      });
    });
    return Object.entries(map)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [filteredOrders]);

  const handleShareSummary = async () => {
    const msg = `*BUSINESS FINANCIAL REPORT (${period.replace('_', ' ').toUpperCase()})*
• Total Sales: ${formatCurrency(totalInflow)} (${filteredOrders.length} orders)
• Outflow Expenses: ${formatCurrency(totalOutflow)} (${filteredExpenses.length} entries)
• Net Balance: ${formatCurrency(netProfit)} (Margin: ${profitMargin}%)
• Cash Collected: ${formatCurrency(totalCollected)} (${collectionRate}% Collection Rate)
• Liquid Cash Available: ${formatCurrency(liquidCash)}
• Outstanding Dues: ${formatCurrency(totalPending)}
Generated from KadaiBook • kadaibook.in`;
    await Share.share({ message: msg });
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      {/* ─── Collapsible Header & Period Selector ─── */}
      <Animated.View
        style={[styles.fixedHeaderContainer, headerAnimatedStyle]}
        onLayout={onHeaderLayout}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.title}>{t('reports.title')}</Text>
            <Text style={styles.subtitle}>{t('reports.subtitle')}</Text>
          </View>
          <Pressable
            style={({ pressed }) => [styles.shareBtn, pressed && { opacity: 0.8 }]}
            onPress={handleShareSummary}
          >
            <Ionicons name="share-outline" size={16} color={colors.clayDeep} />
            <Text style={styles.shareBtnText}>{t('common.share')}</Text>
          </Pressable>
        </View>

        {/* Period Selector Tabs */}
        <View style={styles.periodTabs}>
          {[
            { id: 'this_week', label: t('reports.thisWeek') },
            { id: 'this_month', label: t('reports.thisMonth') },
            { id: 'last_30_days', label: t('reports.lastMonth') },
            { id: 'all_time', label: t('reports.allTime') },
          ].map((p) => (
            <Pressable
              key={p.id}
              style={[styles.periodTab, period === p.id && styles.periodTabActive]}
              onPress={() => setPeriod(p.id as Period)}
            >
              <Text style={[styles.periodTabText, period === p.id && styles.periodTabTextActive]}>
                {p.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </Animated.View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: headerHeight + 12 }]}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={scrollEventThrottle}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.clayDeep} />
        }
      >
        {loading ? (
          <ActivityIndicator size="large" color={colors.clayDeep} style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* P&L Statement Card */}
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <Ionicons name="pie-chart-outline" size={18} color={colors.clayDeep} />
                <Text style={styles.cardTitle}>{t('reports.profitLoss')}</Text>
              </View>

              <View style={styles.pnlRow}>
                <View style={styles.pnlLabelRow}>
                  <Ionicons name="arrow-down-circle" size={18} color={colors.inflow} />
                  <Text style={styles.pnlLabel} numberOfLines={1}>{t('reports.totalRevenue')}</Text>
                </View>
                <Text style={[styles.pnlValue, { color: colors.inflow }]}>
                  +{formatCurrency(totalInflow)}
                </Text>
              </View>

              {totalPurchases > 0 ? (
                <>
                  <View style={styles.pnlRow}>
                    <View style={styles.pnlLabelRow}>
                      <Ionicons name="cart-outline" size={18} color="#C97A1E" />
                      <Text style={styles.pnlLabel} numberOfLines={1}>Stock Purchases (COGS)</Text>
                    </View>
                    <Text style={[styles.pnlValue, { color: '#C97A1E' }]}>
                      -{formatCurrency(totalPurchases)}
                    </Text>
                  </View>

                  <View style={styles.pnlRow}>
                    <View style={styles.pnlLabelRow}>
                      <Ionicons name="trending-up-outline" size={18} color={colors.clayDeep} />
                      <Text style={[styles.pnlLabel, { fontFamily: fonts.bodyBold }]} numberOfLines={1}>Gross Profit</Text>
                    </View>
                    <Text style={[styles.pnlValue, { color: grossProfit >= 0 ? colors.inflow : colors.outflow, fontFamily: fonts.bodyBold }]}>
                      {formatCurrency(grossProfit)}
                    </Text>
                  </View>
                </>
              ) : null}

              <View style={styles.pnlRow}>
                <View style={styles.pnlLabelRow}>
                  <Ionicons name="arrow-up-circle" size={18} color={colors.outflow} />
                  <Text style={styles.pnlLabel} numberOfLines={1}>{t('reports.totalOutflow')}</Text>
                </View>
                <Text style={[styles.pnlValue, { color: colors.outflow }]}>
                  -{formatCurrency(totalOutflow)}
                </Text>
              </View>

              <View style={styles.divider} />

              <View style={styles.pnlRow}>
                <View>
                  <Text style={styles.netProfitLabel}>{t('dashboard.netProfit')}</Text>
                  <Text style={styles.marginText}>{t('reports.netMargin')}: {profitMargin}%</Text>
                </View>
                <Text
                  style={[
                    styles.netProfitValue,
                    { color: netProfit >= 0 ? colors.inflow : colors.outflow },
                  ]}
                >
                  {formatCurrency(netProfit)}
                </Text>
              </View>

              {/* Inflow Sub-breakdown */}
              <View style={styles.subStatsBox}>
                <Pressable
                  style={styles.subStatItem}
                  onPress={() => (navigation as any).navigate('OrdersTab', { initialPaymentFilter: 'Paid' })}
                >
                  <Text style={styles.subStatLabel}>{t('dashboard.collected')}</Text>
                  <Text style={styles.subStatValue}>{formatCurrency(totalCollected)}</Text>
                </Pressable>
                <View style={styles.subStatDivider} />
                <Pressable
                  style={styles.subStatItem}
                  onPress={() => (navigation as any).navigate('OrdersTab', { initialPaymentFilter: 'Pending' })}
                >
                  <Text style={styles.subStatLabel}>{t('dashboard.pendingDues')}</Text>
                  <Text style={[styles.subStatValue, { color: colors.pending }]}>
                    {formatCurrency(totalPending)}
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Expense Breakdown Category Bars */}
            {expenseByCategory.length > 0 && (
              <View style={styles.card}>
                <View style={styles.cardHeaderRow}>
                  <Ionicons name="wallet-outline" size={18} color={colors.outflow} />
                  <Text style={styles.cardTitle}>{t('reports.expenseBreakdown')}</Text>
                </View>
                {expenseByCategory.map((item) => {
                  const barColor = categoryColor[item.category as any] || colors.clayDeep;
                  return (
                    <View key={item.category} style={styles.categoryBarRow}>
                      <View style={styles.categoryBarHeader}>
                        <View style={styles.catLabelWrap}>
                          <View style={[styles.catColorDot, { backgroundColor: barColor }]} />
                          <Text style={styles.catName}>{item.category}</Text>
                        </View>
                        <Text style={styles.catAmount}>{formatCurrency(item.amount)} ({item.pct.toFixed(0)}%)</Text>
                      </View>
                      <View style={styles.barTrack}>
                        <View
                          style={[
                            styles.barFill,
                            { width: `${Math.min(100, item.pct)}%`, backgroundColor: barColor },
                          ]}
                        />
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Top Customers */}
            {topCustomers.length > 0 && (
              <View style={styles.card}>
                <View style={styles.cardHeaderRow}>
                  <Ionicons name="people-outline" size={18} color={colors.clayDeep} />
                  <Text style={styles.cardTitle}>{t('reports.topCustomers')}</Text>
                </View>
                {topCustomers.map((c, idx) => (
                  <View key={c.name} style={styles.rankRow}>
                    <View style={styles.rankBadge}>
                      <Text style={styles.rankBadgeText}>#{idx + 1}</Text>
                    </View>
                    <View style={styles.rankInfo}>
                      <Text style={styles.rankName}>{c.name}</Text>
                      <Text style={styles.rankMeta}>
                        {c.count} {c.count === 1 ? t('reports.orderCount') : t('reports.ordersCount')}
                      </Text>
                    </View>
                    <Text style={styles.rankAmount}>{formatCurrency(c.total)}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Best Selling Items */}
            {topItems.length > 0 && (
              <View style={styles.card}>
                <View style={styles.cardHeaderRow}>
                  <Ionicons name="ribbon-outline" size={18} color={colors.duskDeep} />
                  <Text style={styles.cardTitle}>{t('reports.topProducts')}</Text>
                </View>
                {topItems.map((it, idx) => (
                  <View key={it.name} style={styles.rankRow}>
                    <View style={[styles.rankBadge, { backgroundColor: colors.duskLight }]}>
                      <Text style={[styles.rankBadgeText, { color: colors.duskDeep }]}>
                        #{idx + 1}
                      </Text>
                    </View>
                    <View style={styles.rankInfo}>
                      <Text style={styles.rankName}>{it.name}</Text>
                      <Text style={styles.rankMeta}>{it.qty} {t('reports.unitsSold')}</Text>
                    </View>
                    <Text style={styles.rankAmount}>{formatCurrency(it.revenue)}</Text>
                  </View>
                ))}
              </View>
            )}
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
  fixedHeaderContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.paper,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 12,
    zIndex: 20,
    width: '100%',
    maxWidth: 1040,
    alignSelf: 'center',
    ...shadow.card,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
    width: '100%',
    maxWidth: 1040,
    alignSelf: 'center',
  },
  header: {
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitleWrap: {
    flex: 1,
    paddingRight: 10,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 26,
    color: colors.ink,
    lineHeight: 32,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.inkSoft,
    marginTop: 2,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.paperCard,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 12,
    paddingVertical: 8,
    ...shadow.card,
  },
  shareBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: colors.clayDeep,
  },
  periodTabs: {
    flexDirection: 'row',
    backgroundColor: colors.paperCard,
    borderRadius: 20,
    padding: 3,
    marginTop: 4,
    marginBottom: 0,
    borderWidth: 1,
    borderColor: colors.line,
  },
  periodTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 7,
    borderRadius: 18,
  },
  periodTabActive: {
    backgroundColor: colors.clayDeep,
  },
  periodTabText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    color: colors.inkSoft,
  },
  periodTabTextActive: {
    color: colors.white,
    fontFamily: fonts.bodyBold,
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
    marginBottom: 14,
  },
  cardTitle: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.clayDeep,
    paddingRight: 8,
  },
  pnlRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  pnlLabelRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginRight: 8,
  },
  pnlLabel: {
    flex: 1,
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.ink,
  },
  pnlValue: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
  },
  divider: {
    height: 0,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    borderStyle: 'dashed' as any,
    marginVertical: 10,
  },
  netProfitLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    color: colors.ink,
  },
  marginText: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.inkSoft,
  },
  netProfitValue: {
    fontFamily: fonts.display,
    fontSize: 28,
    paddingRight: 8,
  },
  subStatsBox: {
    flexDirection: 'row',
    backgroundColor: colors.paper,
    borderRadius: radius.sm,
    padding: 12,
    marginTop: 12,
  },
  subStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  subStatLabel: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.inkSoft,
    marginBottom: 2,
  },
  subStatValue: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.ink,
  },
  subStatDivider: {
    width: 1,
    height: 24,
    backgroundColor: colors.line,
  },
  categoryBarRow: {
    marginBottom: 12,
  },
  categoryBarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  catLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  catColorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  catName: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.ink,
  },
  catAmount: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.inkSoft,
  },
  barTrack: {
    height: 6,
    backgroundColor: colors.paper,
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    borderStyle: 'dashed' as any,
    gap: 12,
  },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.clayLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankBadgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: colors.clayDeep,
  },
  rankInfo: {
    flex: 1,
  },
  rankName: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.ink,
  },
  rankMeta: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.inkSoft,
  },
  rankAmount: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.ink,
  },
});
