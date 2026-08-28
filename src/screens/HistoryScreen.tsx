import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  TextInput,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { RootStackParamList } from '../navigation/types';
import { getOrders } from '../storage/orderStorage';
import { getExpenses } from '../storage/expenseStorage';
import { getAllPayments } from '../storage/paymentStorage';
import { addDataListener, pullAllCloudDataToLocal } from '../storage/firebaseSync';
import { colors, fonts, radius, shadow } from '../theme/theme';
import { formatCurrency, formatDate } from '../utils/format';
import GlassBackButton from '../components/GlassBackButton';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export type HistoryFilterType = 'All' | 'Orders' | 'Payments' | 'Outflows';
export type DateRangeFilter = 'all' | 'today' | 'week' | 'month';
export type HistorySortOption = 'newest' | 'oldest' | 'highest';

export interface ActivityEvent {
  id: string;
  type: 'order' | 'payment' | 'expense';
  title: string;
  subtitle: string;
  amount?: number;
  amountType?: 'inflow' | 'outflow' | 'neutral';
  date: string;
  icon: string;
  iconColor: string;
  badgeBg: string;
  orderId?: string;
  expenseId?: string;
}

export default function HistoryScreen() {
  const navigation = useNavigation<Nav>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [filterType, setFilterType] = useState<HistoryFilterType>('All');
  const [dateRange, setDateRange] = useState<DateRangeFilter>('all');
  const [sortBy, setSortBy] = useState<HistorySortOption>('newest');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const loadHistoryData = useCallback(async (forceSync = false) => {
    try {
      if (forceSync) {
        await pullAllCloudDataToLocal();
      }

      const [orders, expenses, payments] = await Promise.all([
        getOrders(forceSync),
        getExpenses(forceSync),
        getAllPayments(forceSync),
      ]);

      const timeline: ActivityEvent[] = [];

      // 1. Convert Orders
      orders.forEach((ord) => {
        const total = ord.items.reduce((s, i) => s + i.qty * i.price, 0);
        timeline.push({
          id: `ord_${ord.id}`,
          type: 'order',
          title: `Order ${ord.orderNumber} (${ord.status})`,
          subtitle: `${ord.customerName || 'Customer'} • ${ord.items.length} item${ord.items.length === 1 ? '' : 's'}`,
          amount: total,
          amountType: 'neutral',
          date: ord.createdAt || ord.orderDate,
          icon: 'receipt-outline',
          iconColor: colors.clayDeep,
          badgeBg: colors.clayLight,
          orderId: ord.id,
        });
      });

      // 2. Convert Payments
      payments.forEach((pay) => {
        const parentOrder = orders.find((o) => o.id === pay.orderId);
        const orderNum = parentOrder ? parentOrder.orderNumber : '';
        const custName = parentOrder ? parentOrder.customerName : 'Customer';

        timeline.push({
          id: `pay_${pay.id}`,
          type: 'payment',
          title: `Payment Received (${pay.method})`,
          subtitle: `${custName} ${orderNum ? `• ${orderNum}` : ''}`,
          amount: pay.amount,
          amountType: 'inflow',
          date: pay.createdAt || pay.date,
          icon: 'cash-outline',
          iconColor: colors.inflow,
          badgeBg: '#E8F5E9',
          orderId: pay.orderId,
        });
      });

      // 3. Convert Expenses / Outflows
      expenses.forEach((exp) => {
        timeline.push({
          id: `exp_${exp.id}`,
          type: 'expense',
          title: `Outflow (${exp.category})`,
          subtitle: exp.description || exp.paymentMethod || 'Store Outflow',
          amount: exp.amount,
          amountType: 'outflow',
          date: exp.createdAt || exp.date,
          icon: 'wallet-outline',
          iconColor: colors.outflow,
          badgeBg: '#FFEBEE',
          expenseId: exp.id,
        });
      });

      // Sort timeline
      setEvents(timeline);
    } catch (err) {
      console.warn('Error loading history timeline:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadHistoryData(true);
    }, [loadHistoryData])
  );

  useEffect(() => {
    const unsub = addDataListener(() => {
      loadHistoryData(false);
    });
    return () => unsub();
  }, [loadHistoryData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadHistoryData(true);
  };

  const filteredEvents = useMemo(() => {
    let list = [...events];

    // Activity Category Filter
    if (filterType === 'Orders') {
      list = list.filter((e) => e.type === 'order');
    } else if (filterType === 'Payments') {
      list = list.filter((e) => e.type === 'payment');
    } else if (filterType === 'Outflows') {
      list = list.filter((e) => e.type === 'expense');
    }

    // Date Range Filter
    if (dateRange !== 'all') {
      const now = new Date();
      list = list.filter((e) => {
        if (!e.date) return false;
        const itemDate = new Date(e.date);
        const diffDays = (now.getTime() - itemDate.getTime()) / (1000 * 3600 * 24);
        if (dateRange === 'today') return diffDays <= 1;
        if (dateRange === 'week') return diffDays <= 7;
        if (dateRange === 'month') return diffDays <= 30;
        return true;
      });
    }

    // Search Query Filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          e.subtitle.toLowerCase().includes(q) ||
          (e.amount && String(e.amount).includes(q))
      );
    }

    // Sorting
    list.sort((a, b) => {
      if (sortBy === 'newest') {
        const timeA = new Date(a.date).getTime() || 0;
        const timeB = new Date(b.date).getTime() || 0;
        return timeB - timeA;
      }
      if (sortBy === 'oldest') {
        const timeA = new Date(a.date).getTime() || 0;
        const timeB = new Date(b.date).getTime() || 0;
        return timeA - timeB;
      }
      if (sortBy === 'highest') {
        return (b.amount || 0) - (a.amount || 0);
      }
      return 0;
    });

    return list;
  }, [events, filterType, dateRange, sortBy, searchQuery]);

  const totalInflow = useMemo(
    () => events.filter((e) => e.type === 'payment').reduce((s, e) => s + (e.amount || 0), 0),
    [events]
  );

  const totalOutflow = useMemo(
    () => events.filter((e) => e.type === 'expense').reduce((s, e) => s + (e.amount || 0), 0),
    [events]
  );

  const hasActiveFilters =
    filterType !== 'All' || dateRange !== 'all' || sortBy !== 'newest' || searchQuery.length > 0;

  const handleItemPress = (item: ActivityEvent) => {
    if (item.orderId) {
      navigation.navigate('OrderDetail', { orderId: item.orderId });
    } else if (item.expenseId) {
      navigation.navigate('ExpenseForm', { expenseId: item.expenseId });
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <GlassBackButton label="Back" />
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Store Activity & History</Text>
            <Text style={styles.subtitle}>
              {loading ? 'Loading timeline…' : `${events.length} total activity log${events.length === 1 ? '' : 's'}`}
            </Text>
          </View>
        </View>
      </View>

      {/* Summary Cards Row */}
      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, { borderLeftColor: colors.inflow }]}>
          <Text style={styles.summaryLabel}>Total Payments</Text>
          <Text style={[styles.summaryValue, { color: colors.inflow }]}>
            {formatCurrency(totalInflow)}
          </Text>
        </View>

        <View style={[styles.summaryCard, { borderLeftColor: colors.outflow }]}>
          <Text style={styles.summaryLabel}>Total Outflows</Text>
          <Text style={[styles.summaryValue, { color: colors.outflow }]}>
            {formatCurrency(totalOutflow)}
          </Text>
        </View>
      </View>

      {/* Search & Filter Toolbar */}
      <View style={styles.searchToolbar}>
        <View style={styles.searchInputWrap}>
          <Ionicons name="search" size={18} color={colors.inkSoft} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by order #, customer, amount…"
            placeholderTextColor={colors.inkSoft}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={colors.inkSoft} />
            </Pressable>
          )}
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.filterBtn,
            hasActiveFilters && styles.filterBtnActive,
            pressed && { opacity: 0.8 },
          ]}
          onPress={() => setShowFilters(!showFilters)}
        >
          <Ionicons
            name={showFilters ? 'chevron-up' : 'options-outline'}
            size={18}
            color={hasActiveFilters ? colors.white : colors.ink}
          />
          {hasActiveFilters && <View style={styles.activeDot} />}
        </Pressable>
      </View>

      {/* Expandable Filter Options Drawer */}
      {showFilters && (
        <View style={styles.filterDrawer}>
          {/* Date Range Section */}
          <View style={styles.filterHeaderRow}>
            <Ionicons name="calendar-outline" size={15} color={colors.clayDeep} />
            <Text style={styles.filterSectionTitle}>Time Period</Text>
          </View>
          <View style={styles.chipGroupRow}>
            {[
              { id: 'all', label: 'All Time' },
              { id: 'today', label: 'Today (24h)' },
              { id: 'week', label: 'This Week (7 days)' },
              { id: 'month', label: 'This Month (30 days)' },
            ].map((d) => {
              const selected = dateRange === d.id;
              return (
                <Pressable
                  key={d.id}
                  style={[styles.drawerChip, selected && styles.drawerChipActive]}
                  onPress={() => setDateRange(d.id as DateRangeFilter)}
                >
                  <Text style={[styles.drawerChipText, selected && styles.drawerChipTextActive]}>
                    {d.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Sort By Section */}
          <View style={[styles.filterHeaderRow, { marginTop: 10 }]}>
            <Ionicons name="swap-vertical-outline" size={15} color={colors.duskDeep} />
            <Text style={styles.filterSectionTitle}>Sort By</Text>
          </View>
          <View style={styles.chipGroupRow}>
            {[
              { id: 'newest', label: 'Newest First' },
              { id: 'oldest', label: 'Oldest First' },
              { id: 'highest', label: 'Highest Amount' },
            ].map((s) => {
              const selected = sortBy === s.id;
              return (
                <Pressable
                  key={s.id}
                  style={[styles.drawerChip, selected && styles.drawerChipActive]}
                  onPress={() => setSortBy(s.id as HistorySortOption)}
                >
                  <Text style={[styles.drawerChipText, selected && styles.drawerChipTextActive]}>
                    {s.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {hasActiveFilters && (
            <Pressable
              style={styles.resetFilterBtn}
              onPress={() => {
                setFilterType('All');
                setDateRange('all');
                setSortBy('newest');
                setSearchQuery('');
              }}
            >
              <Ionicons name="refresh" size={14} color={colors.clayDeep} />
              <Text style={styles.resetFilterText}>Reset All Filters</Text>
            </Pressable>
          )}
        </View>
      )}

      {/* Activity Category Filter Chips */}
      <View style={styles.filterChipsRow}>
        {(['All', 'Orders', 'Payments', 'Outflows'] as HistoryFilterType[]).map((type) => {
          const active = filterType === type;
          return (
            <Pressable
              key={type}
              style={[styles.filterChip, active && styles.filterChipActive]}
              onPress={() => setFilterType(type)}
            >
              <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                {type}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Activity Timeline List */}
      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color={colors.clayDeep} />
        </View>
      ) : (
        <FlatList
          data={filteredEvents}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.clayDeep]} />
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons name="time-outline" size={48} color={colors.inkSoft} />
              <Text style={styles.emptyTitle}>No Activity Logs Found</Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery
                  ? 'No activity matches your search.'
                  : 'Activities like new orders, payments, and outflows will show up here automatically.'}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [styles.eventCard, pressed && { opacity: 0.85 }]}
              onPress={() => handleItemPress(item)}
            >
              <View style={[styles.iconBox, { backgroundColor: item.badgeBg }]}>
                <Ionicons name={item.icon as any} size={20} color={item.iconColor} />
              </View>

              <View style={styles.eventInfo}>
                <Text style={styles.eventTitle}>{item.title}</Text>
                <Text style={styles.eventSubtitle}>{item.subtitle}</Text>
                <Text style={styles.eventDate}>{formatDate(item.date)}</Text>
              </View>

              {item.amount !== undefined && item.amount > 0 && (
                <Text
                  style={[
                    styles.eventAmount,
                    item.amountType === 'inflow' && { color: colors.inflow },
                    item.amountType === 'outflow' && { color: colors.outflow },
                  ]}
                >
                  {item.amountType === 'inflow' ? '+' : item.amountType === 'outflow' ? '-' : ''}
                  {formatCurrency(item.amount)}
                </Text>
              )}
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    padding: 6,
    marginRight: 4,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 24,
    color: colors.ink,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.inkSoft,
  },

  summaryRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.paperCard,
    borderRadius: radius.md,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.line,
    borderLeftWidth: 4,
    ...shadow.card,
  },
  summaryLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    color: colors.inkSoft,
  },
  summaryValue: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    marginTop: 4,
  },

  searchToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    gap: 10,
    marginBottom: 10,
  },
  searchInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.paperCard,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.line,
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.ink,
  },
  filterBtn: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.paperCard,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  filterBtnActive: {
    backgroundColor: colors.clayDeep,
    borderColor: colors.clayDeep,
  },
  activeDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.statusPlaced,
  },

  // Filter Drawer
  filterDrawer: {
    backgroundColor: colors.paperCard,
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    ...shadow.card,
  },
  filterHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  filterSectionTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: colors.ink,
  },
  chipGroupRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  drawerChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
  },
  drawerChipActive: {
    backgroundColor: colors.clayDeep,
    borderColor: colors.clayDeep,
  },
  drawerChipText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.ink,
  },
  drawerChipTextActive: {
    color: colors.white,
    fontFamily: fonts.bodyBold,
  },
  resetFilterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    borderStyle: 'dashed' as any,
  },
  resetFilterText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.clayDeep,
  },

  filterChipsRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 12,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: colors.paperCard,
    borderWidth: 1,
    borderColor: colors.line,
  },
  filterChipActive: {
    backgroundColor: colors.clayDeep,
    borderColor: colors.clayDeep,
  },
  filterChipText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.inkSoft,
  },
  filterChipTextActive: {
    color: colors.white,
    fontFamily: fonts.bodyBold,
  },

  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 10,
  },
  loaderWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 30,
  },
  emptyTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    color: colors.ink,
    marginTop: 12,
  },
  emptySubtitle: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.inkSoft,
    textAlign: 'center',
    marginTop: 4,
  },

  eventCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.paperCard,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    gap: 12,
    ...shadow.card,
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventInfo: {
    flex: 1,
  },
  eventTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.ink,
  },
  eventSubtitle: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.inkSoft,
    marginTop: 2,
  },
  eventDate: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.inkSoft,
    marginTop: 2,
  },
  eventAmount: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.ink,
  },
});
