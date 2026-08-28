import React, { useCallback, useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  TextInput,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { RootStackParamList } from '../navigation/types';
import { Order, OrderStatus, PaymentStatus, orderBalance, orderTotal } from '../types/order';
import { getOrders } from '../storage/orderStorage';
import { addDataListener } from '../storage/firebaseSync';
import OrderCard from '../components/OrderCard';
import EmptyState from '../components/EmptyState';
import { colors, fonts, radius, shadow } from '../theme/theme';
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
  const route = useRoute<any>();
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    if (route.params?.initialPaymentFilter) {
      setPaymentFilter(route.params.initialPaymentFilter);
    }
    if (route.params?.initialSort) {
      setSortBy(route.params.initialSort);
    }
  }, [route.params]);

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
      loadOrders(true);
    }, [loadOrders])
  );

  // Subscribe to live Firestore changes
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
      if (paymentFilter === 'Pending') {
        // Pending Dues: Includes 'Pending', 'Partial', or any order with uncollected balance > 0
        result = result.filter(
          (o) => o.paymentStatus === 'Pending' || o.paymentStatus === 'Partial' || orderBalance(o) > 0
        );
      } else {
        result = result.filter((o) => o.paymentStatus === paymentFilter);
      }
    }

    // Sort
    result.sort((a, b) => {
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

  const hasActiveFilters =
    statusFilter !== 'All' || paymentFilter !== 'All' || sortBy !== 'newest';

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Orders</Text>
          <Text style={styles.subtitle}>
            {loading
              ? 'Loading…'
              : `${filteredOrders.length} of ${orders.length} order${
                  orders.length === 1 ? '' : 's'
                }`}
          </Text>
        </View>
      </View>

      {/* Modern Search & Filter Toolbar */}
      <View style={styles.searchToolbar}>
        <View style={styles.searchInputWrap}>
          <Ionicons name="search" size={18} color={colors.inkSoft} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search orders, customers, items…"
            placeholderTextColor={colors.inkSoft}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')} style={styles.clearBtn}>
              <Ionicons name="close-circle" size={18} color={colors.inkSoft} />
            </Pressable>
          )}
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.filterIconButton,
            hasActiveFilters && styles.filterIconButtonActive,
            pressed && { opacity: 0.8 },
          ]}
          onPress={() => setShowFilters(!showFilters)}
        >
          <Ionicons
            name={showFilters ? 'chevron-up' : 'options-outline'}
            size={20}
            color={hasActiveFilters ? colors.white : colors.ink}
          />
          {hasActiveFilters && <View style={styles.activeFilterDot} />}
        </Pressable>
      </View>

      {/* Quick Filter Horizontal Scrollbar */}
      <View style={styles.quickFilterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickFilterScroll}>
          <Pressable
            style={[styles.quickChip, paymentFilter === 'All' && statusFilter === 'All' && styles.quickChipActive]}
            onPress={() => {
              setPaymentFilter('All');
              setStatusFilter('All');
            }}
          >
            <Text style={[styles.quickChipText, paymentFilter === 'All' && statusFilter === 'All' && styles.quickChipTextActive]}>
              All Orders ({orders.length})
            </Text>
          </Pressable>

          <Pressable
            style={[styles.quickChip, paymentFilter === 'Pending' && styles.quickChipActive, { borderColor: colors.pending }]}
            onPress={() => {
              setPaymentFilter('Pending');
              setStatusFilter('All');
              setSortBy('due');
            }}
          >
            <Ionicons name="time" size={13} color={paymentFilter === 'Pending' ? colors.white : colors.pending} />
            <Text style={[styles.quickChipText, paymentFilter === 'Pending' && styles.quickChipTextActive, { color: paymentFilter === 'Pending' ? colors.white : colors.pending }]}>
              Pending Dues ({orders.filter((o) => o.paymentStatus !== 'Paid' && orderBalance(o) > 0).length})
            </Text>
          </Pressable>

          <Pressable
            style={[styles.quickChip, paymentFilter === 'Paid' && styles.quickChipActive, { borderColor: colors.inflow }]}
            onPress={() => {
              setPaymentFilter('Paid');
              setStatusFilter('All');
            }}
          >
            <Ionicons name="checkmark-circle" size={13} color={paymentFilter === 'Paid' ? colors.white : colors.inflow} />
            <Text style={[styles.quickChipText, paymentFilter === 'Paid' && styles.quickChipTextActive, { color: paymentFilter === 'Paid' ? colors.white : colors.inflow }]}>
              Paid ({orders.filter((o) => o.paymentStatus === 'Paid').length})
            </Text>
          </Pressable>

          <Pressable
            style={[styles.quickChip, statusFilter === 'Delivered' && styles.quickChipActive]}
            onPress={() => {
              setStatusFilter('Delivered');
              setPaymentFilter('All');
            }}
          >
            <Text style={[styles.quickChipText, statusFilter === 'Delivered' && styles.quickChipTextActive]}>
              Delivered ({orders.filter((o) => o.status === 'Delivered').length})
            </Text>
          </Pressable>
        </ScrollView>
      </View>

      {/* Expandable Filters Section Drawer */}
      {showFilters && (
        <View style={styles.filterSection}>
          {/* Status Stage Section */}
          <View style={styles.filterGroupHeader}>
            <Ionicons name="cube-outline" size={16} color={colors.clayDeep} />
            <Text style={styles.filterGroupTitle}>Status Stage</Text>
          </View>
          <View style={styles.chipRow}>
            {(['All', 'Placed', 'Packed', 'Dispatched', 'Delivered'] as const).map((st) => {
              const isSelected = statusFilter === st;
              return (
                <Pressable
                  key={st}
                  style={[styles.chip, isSelected && styles.chipActive]}
                  onPress={() => setStatusFilter(st)}
                >
                  {isSelected && (
                    <Ionicons name="checkmark-circle" size={13} color={colors.white} />
                  )}
                  <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                    {st}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Payment Status Section */}
          <View style={[styles.filterGroupHeader, { marginTop: 12 }]}>
            <Ionicons name="card-outline" size={16} color={colors.duskDeep} />
            <Text style={styles.filterGroupTitle}>Payment Status</Text>
          </View>
          <View style={styles.chipRow}>
            {(['All', 'Pending', 'Partial', 'Paid'] as const).map((ps) => {
              const isSelected = paymentFilter === ps;
              return (
                <Pressable
                  key={ps}
                  style={[styles.chip, isSelected && styles.chipActive]}
                  onPress={() => setPaymentFilter(ps)}
                >
                  {isSelected && (
                    <Ionicons name="checkmark-circle" size={13} color={colors.white} />
                  )}
                  <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                    {ps}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Sort By Section */}
          <View style={[styles.filterGroupHeader, { marginTop: 12 }]}>
            <Ionicons name="swap-vertical-outline" size={16} color={colors.statusPlaced} />
            <Text style={styles.filterGroupTitle}>Sort By</Text>
          </View>
          <View style={styles.chipRow}>
            {[
              { id: 'newest', label: 'Newest First' },
              { id: 'oldest', label: 'Oldest' },
              { id: 'highest', label: 'Highest Value' },
              { id: 'due', label: 'Pending Due' },
            ].map((s) => {
              const isSelected = sortBy === s.id;
              return (
                <Pressable
                  key={s.id}
                  style={[styles.chip, isSelected && styles.chipActive]}
                  onPress={() => setSortBy(s.id as SortOption)}
                >
                  {isSelected && (
                    <Ionicons name="checkmark-circle" size={13} color={colors.white} />
                  )}
                  <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                    {s.label}
                  </Text>
                </Pressable>
              );
            })}
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
              <Text style={styles.resetText}>Reset All Filters</Text>
            </Pressable>
          )}
        </View>
      )}

      {/* Summary strip when results are present */}
      {filteredOrders.length > 0 && (
        <View style={styles.summaryStrip}>
          <View style={styles.summaryBadge}>
            <Ionicons name="wallet-outline" size={14} color={colors.inkSoft} />
            <Text style={styles.summaryStripText}>
              Total: <Text style={styles.boldText}>{formatCurrency(totalFilteredValue)}</Text>
            </Text>
          </View>
          {totalFilteredDue > 0 && (
            <View style={[styles.summaryBadge, { backgroundColor: '#FFEBEE' }]}>
              <Ionicons name="time-outline" size={14} color={colors.danger} />
              <Text style={[styles.summaryStripText, { color: colors.danger }]}>
                Due: <Text style={[styles.boldText, { color: colors.danger }]}>{formatCurrency(totalFilteredDue)}</Text>
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Orders List */}
      <FlatList
        data={filteredOrders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.clayDeep} />
        }
        renderItem={({ item }) => (
          <OrderCard
            order={item}
            onPress={() => navigation.navigate('OrderDetail', { orderId: item.id })}
          />
        )}
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              title={searchQuery || hasActiveFilters ? 'No matching orders' : 'No orders recorded yet'}
              message={
                searchQuery || hasActiveFilters
                  ? 'Try adjusting your search terms or clearing active filters.'
                  : 'Tap the "+ New" button to create your first order.'
              }
            />
          ) : null
        }
      />

      {/* Floating Action Button */}
      <Pressable
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
        onPress={() => navigation.navigate('OrderForm', undefined)}
      >
        <Ionicons name="cart" size={24} color={colors.white} />
        <Text style={styles.fabText}>+ Order</Text>
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
    paddingTop: 14,
    paddingBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 32,
    color: colors.ink,
    lineHeight: 36,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.inkSoft,
    marginTop: 1,
  },
  newOrderHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.clayDeep,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.md,
    ...shadow.card,
  },
  newOrderHeaderBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.white,
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
    paddingVertical: 10,
    ...shadow.card,
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
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.paperCard,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.card,
  },
  filterIconButtonActive: {
    backgroundColor: colors.clayDeep,
    borderColor: colors.clayDeep,
  },
  activeFilterDot: {
    position: 'absolute',
    top: 9,
    right: 9,
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
    ...shadow.card,
  },
  filterGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  filterGroupTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: colors.ink,
    letterSpacing: 0.3,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
  },
  chipActive: {
    backgroundColor: colors.clayDeep,
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
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    borderStyle: 'dashed' as any,
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
    marginBottom: 6,
    gap: 10,
  },
  summaryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.paperCard,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.line,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 28,
    backgroundColor: colors.clayDeep,
    elevation: 6,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  fabPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.96 }],
  },
  fabText: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.white,
  },

  // Quick Filter Bar
  quickFilterBar: {
    marginBottom: 8,
  },
  quickFilterScroll: {
    paddingHorizontal: 20,
    gap: 8,
  },
  quickChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: colors.paperCard,
    borderWidth: 1,
    borderColor: colors.line,
  },
  quickChipActive: {
    backgroundColor: colors.clayDeep,
    borderColor: colors.clayDeep,
  },
  quickChipText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.inkSoft,
  },
  quickChipTextActive: {
    color: colors.white,
    fontFamily: fonts.bodyBold,
  },
});

