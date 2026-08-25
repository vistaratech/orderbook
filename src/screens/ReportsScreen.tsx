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
      loadData(false);
    }, [loadData])
  );

  // Subscribe to live Realtime Database changes
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
  const profitMargin = totalInflow > 0 ? ((netProfit / totalInflow) * 100).toFixed(1) : '0';

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
    const msg = `📊 Business Summary (${period.replace('_', ' ').toUpperCase()})
• Sales Inflow: ${formatCurrency(totalInflow)} (${filteredOrders.length} orders)
• Outflow (Expenses): ${formatCurrency(totalOutflow)} (${filteredExpenses.length} entries)
• Net Profit: ${formatCurrency(netProfit)} (Margin: ${profitMargin}%)
• Collected: ${formatCurrency(totalCollected)}
• Pending Due: ${formatCurrency(totalPending)}
Generated from Order Book App`;
    await Share.share({ message: msg });
  };

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
            <Text style={styles.title}>P&L & Analytics</Text>
            <Text style={styles.subtitle}>Inflow vs Outflow Business Performance</Text>
          </View>
          <Pressable style={styles.shareBtn} onPress={handleShareSummary}>
            <Ionicons name="share-outline" size={20} color={colors.clayDeep} />
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
            <View style={[styles.card, styles.pnlCard]}>
              <Text style={styles.pnlHeader}>Profit & Loss Statement</Text>

              <View style={styles.pnlRow}>
                <View style={styles.pnlLabelRow}>
                  <Ionicons name="trending-up" size={16} color={colors.inflow} />
                  <Text style={styles.pnlLabel}>Total Revenue (Inflow)</Text>
                </View>
                <Text style={[styles.pnlValue, { color: colors.inflow }]}>
                  +{formatCurrency(totalInflow)}
                </Text>
              </View>

              <View style={styles.pnlRow}>
                <View style={styles.pnlLabelRow}>
                  <Ionicons name="trending-down" size={16} color={colors.outflow} />
                  <Text style={styles.pnlLabel}>Total Expenses (Outflow)</Text>
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

              <View style={styles.divider} />

              <View style={styles.subStatsRow}>
                <View style={styles.subStatItem}>
                  <Text style={styles.subStatLabel}>Cash Collected</Text>
                  <Text style={styles.subStatValue}>{formatCurrency(totalCollected)}</Text>
                </View>
                <View style={styles.subStatDivider} />
                <View style={styles.subStatItem}>
                  <Text style={styles.subStatLabel}>Pending Balance</Text>
                  <Text style={[styles.subStatValue, { color: colors.pending }]}>
                    {formatCurrency(totalPending)}
                  </Text>
                </View>
              </View>
            </View>

            {/* Outflow by Category Breakdown */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Outflow by Expense Category</Text>
              {expenseByCategory.length === 0 ? (
                <Text style={styles.emptyText}>No expenses recorded for this period.</Text>
              ) : (
                expenseByCategory.map((item) => {
                  const barColor = categoryColor[item.category] || colors.clayDeep;
                  return (
                    <View key={item.category} style={styles.categoryBarItem}>
                      <View style={styles.categoryBarHeader}>
                        <Text style={styles.catName}>{item.category}</Text>
                        <Text style={styles.catAmt}>
                          {formatCurrency(item.amount)}{' '}
                          <Text style={styles.catPct}>({item.pct.toFixed(0)}%)</Text>
                        </Text>
                      </View>
                      <View style={styles.progressBarTrack}>
                        <View
                          style={[
                            styles.progressBarFill,
                            { width: `${Math.max(4, Math.min(100, item.pct))}%`, backgroundColor: barColor },
                          ]}
                        />
                      </View>
                    </View>
                  );
                })
              )}
            </View>

            {/* Top Customers */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Top Customers</Text>
              {topCustomers.length === 0 ? (
                <Text style={styles.emptyText}>No customer orders for this period.</Text>
              ) : (
                topCustomers.map((cust, idx) => (
                  <View key={cust.name} style={styles.rankItem}>
                    <View style={styles.rankBadge}>
                      <Text style={styles.rankBadgeText}>#{idx + 1}</Text>
                    </View>
                    <View style={styles.rankItemInfo}>
                      <Text style={styles.rankItemName}>{cust.name}</Text>
                      <Text style={styles.rankItemSub}>{cust.count} order{cust.count === 1 ? '' : 's'}</Text>
                    </View>
                    <Text style={styles.rankItemTotal}>{formatCurrency(cust.total)}</Text>
                  </View>
                ))
              )}
            </View>

            {/* Best Selling Items */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Best Selling Items</Text>
              {topItems.length === 0 ? (
                <Text style={styles.emptyText}>No items sold in this period.</Text>
              ) : (
                topItems.map((it, idx) => (
                  <View key={it.name} style={styles.rankItem}>
                    <View style={[styles.rankBadge, { backgroundColor: colors.duskLight }]}>
                      <Text style={[styles.rankBadgeText, { color: colors.duskDeep }]}>#{idx + 1}</Text>
                    </View>
                    <View style={styles.rankItemInfo}>
                      <Text style={styles.rankItemName}>{it.name}</Text>
                      <Text style={styles.rankItemSub}>{it.qty} units sold</Text>
                    </View>
                    <Text style={styles.rankItemTotal}>{formatCurrency(it.revenue)}</Text>
                  </View>
                ))
              )}
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
    paddingBottom: 50,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 34,
    color: colors.ink,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.inkSoft,
    marginTop: -4,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.sm,
    backgroundColor: colors.paperCard,
    borderWidth: 1,
    borderColor: colors.line,
  },
  shareBtnText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.clayDeep,
  },
  periodTabs: {
    flexDirection: 'row',
    backgroundColor: colors.paperCard,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 3,
    marginBottom: 14,
  },
  periodTab: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: radius.sm - 2,
  },
  periodTabActive: {
    backgroundColor: colors.clayDeep,
  },
  periodTabText: {
    fontFamily: fonts.body,
    fontSize: 12,
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
    overflow: 'hidden',
    ...shadow.card,
  },
  pnlCard: {
    borderLeftWidth: 4,
    borderLeftColor: colors.duskDeep,
  },
  pnlHeader: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.clayDeep,
    marginBottom: 12,
  },
  pnlRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  pnlLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pnlLabel: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.ink,
  },
  pnlValue: {
    fontFamily: fonts.bodyBold,
    fontSize: 15,
  },
  divider: {
    height: 0,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    borderStyle: 'dashed',
    marginVertical: 10,
  },
  netProfitLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    color: colors.ink,
  },
  marginText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.inkSoft,
    marginTop: 2,
  },
  netProfitValue: {
    fontFamily: fonts.display,
    fontSize: 28,
  },
  subStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  subStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  subStatDivider: {
    width: 1,
    backgroundColor: colors.line,
  },
  subStatLabel: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.inkSoft,
  },
  subStatValue: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.ink,
    marginTop: 2,
  },
  cardTitle: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.clayDeep,
    marginBottom: 12,
  },
  emptyText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.inkSoft,
    textAlign: 'center',
    paddingVertical: 12,
  },
  categoryBarItem: {
    marginBottom: 10,
  },
  categoryBarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  catName: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.ink,
  },
  catAmt: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.ink,
  },
  catPct: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.inkSoft,
  },
  progressBarTrack: {
    height: 8,
    backgroundColor: colors.paper,
    borderRadius: 4,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.line,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  rankItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    borderStyle: 'dashed',
    gap: 10,
  },
  rankBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.clayLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankBadgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: colors.clayDeep,
  },
  rankItemInfo: {
    flex: 1,
  },
  rankItemName: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.ink,
  },
  rankItemSub: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.inkSoft,
  },
  rankItemTotal: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.ink,
  },
});
