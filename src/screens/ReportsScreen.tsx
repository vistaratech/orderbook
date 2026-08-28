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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { Order, Expense, orderTotal, orderBalance } from '../types/order';
import { getOrders } from '../storage/orderStorage';
import { getExpenses } from '../storage/expenseStorage';
import { addDataListener } from '../storage/firebaseSync';
import { colors, fonts, radius, shadow, categoryColor } from '../theme/theme';
import { formatCurrency } from '../utils/format';

type Period = 'this_month' | 'last_30_days' | 'this_week' | 'all_time';

export default function ReportsScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState<Period>('this_month');
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
      loadData(true);
    }, [loadData])
  );

  useEffect(() => {
    loadData(true);
  }, [loadData]);

  // Subscribe to live Firestore updates
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

  // Totals
  const totalInflow = filteredOrders.reduce((sum, o) => sum + orderTotal(o), 0);
  const totalOutflow = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  const totalCollected = filteredOrders.reduce(
    (sum, o) => sum + (orderTotal(o) - orderBalance(o)),
    0
  );
  const totalPending = filteredOrders.reduce(
    (sum, o) => sum + Math.max(0, orderBalance(o)),
    0
  );
  const netProfit = totalInflow - totalOutflow;
  const liquidCash = totalCollected - totalOutflow;
  const profitMargin = totalInflow > 0 ? ((netProfit / totalInflow) * 100).toFixed(1) : '0';
  const collectionRate = totalInflow > 0 ? Math.min(100, Math.round((totalCollected / totalInflow) * 100)) : 0;

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
    const msg = `📊 Business Financial Report (${period.replace('_', ' ').toUpperCase()})
• Total Sales: ${formatCurrency(totalInflow)} (${filteredOrders.length} orders)
• Outflow Expenses: ${formatCurrency(totalOutflow)} (${filteredExpenses.length} entries)
• Net Balance: ${formatCurrency(netProfit)} (Margin: ${profitMargin}%)
• Cash Collected: ${formatCurrency(totalCollected)} (${collectionRate}% Collection Rate)
• Liquid Cash Available: ${formatCurrency(liquidCash)}
• Outstanding Dues: ${formatCurrency(totalPending)}
Generated from Order Book App`;
    await Share.share({ message: msg });
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.clayDeep} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Reports</Text>
            <Text style={styles.subtitle}>Inflow vs Outflow Business Performance</Text>
          </View>
          <Pressable
            style={({ pressed }) => [styles.shareBtn, pressed && { opacity: 0.8 }]}
            onPress={handleShareSummary}
          >
            <Ionicons name="share-outline" size={18} color={colors.clayDeep} />
            <Text style={styles.shareBtnText}>Share</Text>
          </Pressable>
        </View>

        {/* Period Selector Tabs */}
        <View style={styles.periodTabs}>
          {[
            { id: 'this_week', label: '7 Days' },
            { id: 'this_month', label: 'This Month' },
            { id: 'last_30_days', label: '30 Days' },
            { id: 'all_time', label: 'All Time' },
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

        {loading ? (
          <ActivityIndicator size="large" color={colors.clayDeep} style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* P&L Statement Card */}
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <Ionicons name="pie-chart-outline" size={18} color={colors.clayDeep} />
                <Text style={styles.cardTitle}>Profit & Loss Statement</Text>
              </View>

              <View style={styles.pnlRow}>
                <View style={styles.pnlLabelRow}>
                  <Ionicons name="arrow-down-circle" size={18} color={colors.inflow} />
                  <Text style={styles.pnlLabel} numberOfLines={1}>Sales Revenue</Text>
                </View>
                <Text style={[styles.pnlValue, { color: colors.inflow }]}>
                  +{formatCurrency(totalInflow)}
                </Text>
              </View>

              <View style={styles.pnlRow}>
                <View style={styles.pnlLabelRow}>
                  <Ionicons name="arrow-up-circle" size={18} color={colors.outflow} />
                  <Text style={styles.pnlLabel} numberOfLines={1}>Total Expenses</Text>
                </View>
                <Text style={[styles.pnlValue, { color: colors.outflow }]}>
                  -{formatCurrency(totalOutflow)}
                </Text>
              </View>

              <View style={styles.divider} />

              <View style={styles.pnlRow}>
                <View>
                  <Text style={styles.netProfitLabel}>Net Business Profit</Text>
                  <Text style={styles.marginText}>Margin: {profitMargin}%</Text>
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
                  <Text style={styles.subStatLabel}>Cash Collected</Text>
                  <Text style={styles.subStatValue}>{formatCurrency(totalCollected)}</Text>
                </Pressable>
                <View style={styles.subStatDivider} />
                <Pressable
                  style={styles.subStatItem}
                  onPress={() => (navigation as any).navigate('OrdersTab', { initialPaymentFilter: 'Pending' })}
                >
                  <Text style={styles.subStatLabel}>Pending Collections</Text>
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
                  <Text style={styles.cardTitle}>Expense Breakdown</Text>
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
                  <Text style={styles.cardTitle}>Top Customers</Text>
                </View>
                {topCustomers.map((c, idx) => (
                  <View key={c.name} style={styles.rankRow}>
                    <View style={styles.rankBadge}>
                      <Text style={styles.rankBadgeText}>#{idx + 1}</Text>
                    </View>
                    <View style={styles.rankInfo}>
                      <Text style={styles.rankName}>{c.name}</Text>
                      <Text style={styles.rankMeta}>
                        {c.count} order{c.count === 1 ? '' : 's'}
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
                  <Text style={styles.cardTitle}>Best Selling Catalog Products</Text>
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
                      <Text style={styles.rankMeta}>{it.qty} units sold</Text>
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
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 40,
    width: '100%',
    maxWidth: 1040,
    alignSelf: 'center',
  },
  header: {
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 32,
    color: colors.ink,
    lineHeight: 36,
    paddingRight: 10,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.inkSoft,
    marginTop: 1,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.paperCard,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 12,
    paddingVertical: 7,
    ...shadow.card,
  },
  shareBtnText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.clayDeep,
  },
  periodTabs: {
    flexDirection: 'row',
    backgroundColor: colors.paperCard,
    borderRadius: 20,
    padding: 3,
    marginBottom: 14,
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
