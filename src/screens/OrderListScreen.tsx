import React, { useCallback, useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  TextInput,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { RootStackParamList } from '../navigation/types';
import { Order, OrderStatus, PaymentStatus, orderBalance, orderTotal } from '../types/order';
import { getOrders, togglePinOrder } from '../storage/orderStorage';
import { addDataListener } from '../storage/firebaseSync';
import OrderCard from '../components/OrderCard';
import EmptyState from '../components/EmptyState';
import { colors, fonts, radius } from '../theme/theme';
import { formatCurrency } from '../utils/format';

type Nav = NativeStackNavigationProp<RootStackParamList>;

type SortOption = 'newest' | 'oldest' | 'highest' | 'due';

export default function OrderListScreen() {
  const navigation = useNavigation<Nav>();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'All'>('All');
  const [paymentFilter, setPaymentFilter] = useState<PaymentStatus | 'All'>('All');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [showFilters, setShowFilters] = useState(false);

  const loadOrders = useCallback(async (forceSync = false) => {
    try {
      const data = await getOrders(forceSync);
      setOrders(data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadOrders(false);
    }, [loadOrders])
  );

  // Subscribe to live Realtime Database changes
  useEffect(() => {
    const unsub = addDataListener(() => {
      loadOrders(false);
    });
    return () => unsub();
  }, [loadOrders]);

  const onRefresh = () => {
    setRefreshing(true);
    loadOrders(true);
  };

  const handleTogglePin = async (orderId: string) => {
    const updated = await togglePinOrder(orderId);
    if (updated) {
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? updated : o))
      );
    }
  };

  const filteredOrders = useMemo(() => {
    let result = [...orders];

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (o) =>
          o.orderNumber.toLowerCase().includes(q) ||
          (o.customerName && o.customerName.toLowerCase().includes(q)) ||
          (o.phoneNumber && o.phoneNumber.includes(q)) ||
          o.items.some((it) => it.name.toLowerCase().includes(q))
      );
    }

    // Status filter
    if (statusFilter !== 'All') {
      result = result.filter((o) => o.status === statusFilter);
    }

    // Payment filter
    if (paymentFilter !== 'All') {
      result = result.filter((o) => o.paymentStatus === paymentFilter);
    }

    // Sort: Pinned orders always stay at the top
    result.sort((a, b) => {
      const pinDiff = Number(b.isPinned || 0) - Number(a.isPinned || 0);
      if (pinDiff !== 0) return pinDiff;

      if (sortBy === 'newest') {
        return a.createdAt < b.createdAt ? 1 : -1;
      }
      if (sortBy === 'oldest') {
        return a.createdAt > b.createdAt ? 1 : -1;
      }
      if (sortBy === 'highest') {
        return orderTotal(b) - orderTotal(a);
      }
      if (sortBy === 'due') {
        return orderBalance(b) - orderBalance(a);
      }
      return 0;
    });

    return result;
  }, [orders, searchQuery, statusFilter, paymentFilter, sortBy]);

  const totalFilteredValue = filteredOrders.reduce((sum, o) => sum + orderTotal(o), 0);
  const totalFilteredDue = filteredOrders.reduce(
    (sum, o) => sum + Math.max(0, orderBalance(o)),
    0
  );

  const pinnedCount = orders.filter((o) => o.isPinned).length;

  const hasActiveFilters =
    statusFilter !== 'All' || paymentFilter !== 'All' || sortBy !== 'newest';

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Order Book</Text>
          <Text style={styles.subtitle}>
            {loading
              ? 'Loading…'
              : `${filteredOrders.length} of ${orders.length} order${
                  orders.length === 1 ? '' : 's'
                }${pinnedCount > 0 ? ` • 📌 ${pinnedCount} pinned` : ''}`}
          </Text>
        </View>
      </View>

      {/* Modern Unified Search & Filter Toolbar */}
      <View style={styles.searchToolbar}>
        <View style={styles.searchInputWrap}>
          <Ionicons name="search" size={17} color={colors.inkSoft} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search orders, clients, items…"
            placeholderTextColor={colors.inkSoft}
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')} style={styles.clearBtn}>
              <Ionicons name="close-circle" size={16} color={colors.inkSoft} />
            </Pressable>
          )}
        </View>

        <Pressable
          style={[styles.filterIconButton, hasActiveFilters && styles.filterIconButtonActive]}
          onPress={() => setShowFilters(!showFilters)}
        >
          <Ionicons
            name={showFilters ? 'chevron-up' : 'filter-outline'}
            size={19}
            color={hasActiveFilters ? colors.white : colors.ink}
          />
          {hasActiveFilters && <View style={styles.activeFilterDot} />}
        </Pressable>
      </View>

      {/* Expandable Filters Section */}
      {showFilters && (
        <View style={styles.filterSection}>
          <Text style={styles.filterGroupTitle}>Status</Text>
          <View style={styles.chipRow}>
            {(['All', 'Placed', 'Packed', 'Dispatched', 'Delivered'] as const).map((st) => (
              <Pressable
                key={st}
                style={[styles.chip, statusFilter === st && styles.chipActive]}
                onPress={() => setStatusFilter(st)}
              >
                <Text style={[styles.chipText, statusFilter === st && styles.chipTextActive]}>
                  {st}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.filterGroupTitle, { marginTop: 10 }]}>Payment</Text>
          <View style={styles.chipRow}>
            {(['All', 'Pending', 'Partial', 'Paid'] as const).map((ps) => (
              <Pressable
                key={ps}
                style={[styles.chip, paymentFilter === ps && styles.chipActive]}
                onPress={() => setPaymentFilter(ps)}
              >
                <Text style={[styles.chipText, paymentFilter === ps && styles.chipTextActive]}>
                  {ps}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.filterGroupTitle, { marginTop: 10 }]}>Sort By</Text>
          <View style={styles.chipRow}>
            {[
              { id: 'newest', label: 'Newest First' },
              { id: 'oldest', label: 'Oldest' },
              { id: 'highest', label: 'Highest Value' },
              { id: 'due', label: 'Pending Due' },
            ].map((s) => (
              <Pressable
                key={s.id}
                style={[styles.chip, sortBy === s.id && styles.chipActive]}
                onPress={() => setSortBy(s.id as SortOption)}
              >
                <Text style={[styles.chipText, sortBy === s.id && styles.chipTextActive]}>
                  {s.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {hasActiveFilters && (
            <Pressable
              style={styles.resetBtn}
              onPress={() => {
                setStatusFilter('All');
                setPaymentFilter('All');
                setSortBy('newest');
              }}
            >
              <Ionicons name="refresh" size={14} color={colors.clayDeep} />
              <Text style={styles.resetText}>Reset Filters</Text>
            </Pressable>
          )}
        </View>
      )}

      {/* Summary strip when results are filtered */}
      {filteredOrders.length > 0 && (
        <View style={styles.summaryStrip}>
          <Text style={styles.summaryStripText}>
            Total: <Text style={styles.boldText}>{formatCurrency(totalFilteredValue)}</Text>
          </Text>
          {totalFilteredDue > 0 && (
            <Text style={[styles.summaryStripText, { color: colors.danger }]}>
              Due: <Text style={styles.boldText}>{formatCurrency(totalFilteredDue)}</Text>
            </Text>
          )}
        </View>
      )}

      {/* Orders List */}
      <FlatList
        data={filteredOrders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.clayDeep} />
        }
        renderItem={({ item }) => (
          <OrderCard
            order={item}
            onPress={() => navigation.navigate('OrderDetail', { orderId: item.id })}
            onTogglePin={handleTogglePin}
          />
        )}
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              title={searchQuery || hasActiveFilters ? 'No matches found' : 'No orders yet'}
              message={
                searchQuery || hasActiveFilters
                  ? 'Try changing your search or clearing filters.'
                  : 'Tap the + button below to write your first order.'
              }
            />
          ) : null
        }
      />

      {/* Floating Action Button */}
      <Pressable
        style={styles.fab}
        onPress={() => navigation.navigate('OrderForm', undefined)}
      >
        <Ionicons name="add" size={30} color={colors.white} />
      </Pressable>
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
    paddingTop: 12,
    paddingBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 36,
    color: colors.ink,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.inkSoft,
    marginTop: -4,
  },
  searchToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 20,
    marginTop: 4,
    marginBottom: 8,
  },
  searchInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.paperCard,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 12,
    paddingVertical: 9,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.ink,
    padding: 0,
  },
  clearBtn: {
    padding: 2,
    marginLeft: 4,
  },
  filterIconButton: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.paperCard,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  filterIconButtonActive: {
    backgroundColor: colors.clayDeep,
    borderColor: colors.clayDeep,
  },
  activeFilterDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.white,
  },
  filterSection: {
    backgroundColor: colors.paperCard,
    marginHorizontal: 20,
    marginBottom: 8,
    padding: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
  },
  filterGroupTitle: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    color: colors.inkSoft,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.sm,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
  },
  chipActive: {
    backgroundColor: colors.clay,
    borderColor: colors.clayDeep,
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
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  resetText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.clayDeep,
  },
  summaryStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: 20,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  summaryStripText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.inkSoft,
  },
  boldText: {
    fontFamily: fonts.bodyBold,
    color: colors.ink,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
    paddingTop: 4,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.clayDeep,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
});
