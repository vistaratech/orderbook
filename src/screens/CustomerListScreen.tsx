import React, { useCallback, useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  TextInput,
  RefreshControl,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { RootStackParamList } from '../navigation/types';
import { Customer, Order, orderTotal, orderBalance } from '../types/order';
import { getCustomers } from '../storage/customerStorage';
import { getOrders } from '../storage/orderStorage';
import { addDataListener } from '../storage/firebaseSync';
import EmptyState from '../components/EmptyState';
import { colors, fonts, radius, shadow } from '../theme/theme';
import { formatCurrency } from '../utils/format';
import DesktopLayout from '../components/DesktopLayout';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function CustomerListScreen() {
  const navigation = useNavigation<Nav>();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const loadData = useCallback(async (forceSync = false) => {
    try {
      const [c, o] = await Promise.all([getCustomers(forceSync), getOrders(forceSync)]);
      setCustomers(c);
      setOrders(o);
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

  // Build customer stats map
  const customerStats = useMemo(() => {
    const stats: Record<string, { orderCount: number; totalSpend: number; pendingDue: number }> =
      {};
    orders.forEach((o) => {
      const key = (o.customerName || '').toLowerCase().trim();
      if (!key) return;
      if (!stats[key]) {
        stats[key] = { orderCount: 0, totalSpend: 0, pendingDue: 0 };
      }
      stats[key].orderCount += 1;
      stats[key].totalSpend += orderTotal(o);
      stats[key].pendingDue += Math.max(0, orderBalance(o));
    });
    return stats;
  }, [orders]);

  const filteredCustomers = useMemo(() => {
    if (!searchQuery.trim()) return customers;
    const q = searchQuery.toLowerCase().trim();
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.phone && c.phone.includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q))
    );
  }, [customers, searchQuery]);

  const handleCall = (phone?: string) => {
    if (phone) Linking.openURL(`tel:${phone}`);
  };

  const handleWhatsApp = (phone?: string) => {
    if (phone) {
      const clean = phone.replace(/[^0-9]/g, '');
      Linking.openURL(`whatsapp://send?phone=${clean}`);
    }
  };

  return (
    <DesktopLayout currentTabName="CustomerList">
      <SafeAreaView style={styles.screen} edges={['top']}>
        <View style={styles.centerContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Customers</Text>
              <Text style={styles.subtitle}>
                {loading
                  ? 'Loading…'
                  : `${filteredCustomers.length} contact${filteredCustomers.length === 1 ? '' : 's'}`}
              </Text>
            </View>
          </View>

          {/* Search Bar */}
          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color={colors.inkSoft} style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search customers by name or phone…"
              placeholderTextColor={colors.inkSoft}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery('')} style={{ padding: 2 }}>
                <Ionicons name="close-circle" size={18} color={colors.inkSoft} />
              </Pressable>
            )}
          </View>

          {/* Customer List */}
          <FlatList
            data={filteredCustomers}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.clayDeep} />
            }
            renderItem={({ item }) => {
              const stats = customerStats[item.name.toLowerCase().trim()] || {
                orderCount: 0,
                totalSpend: 0,
                pendingDue: 0,
              };
              return (
                <Pressable
                  style={({ pressed }) => [
                    styles.customerCard,
                    pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
                  ]}
                  onPress={() =>
                    navigation.navigate('CustomerDetail', { customerId: item.id })
                  }
                >
                  <View style={styles.cardHeader}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>
                        {item.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.nameBlock}>
                      <Text style={styles.customerName}>{item.name}</Text>
                      {item.phone ? (
                        <Text style={styles.phoneText}>📞 {item.phone}</Text>
                      ) : null}
                      {item.address ? (
                        <Text style={styles.addressText} numberOfLines={1}>
                          📍 {item.address}
                        </Text>
                      ) : null}
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.inkSoft} />
                  </View>

                  {/* Micro Stats Row */}
                  <View style={styles.statsRow}>
                    <View style={styles.statItem}>
                      <Text style={styles.statLabel}>Orders</Text>
                      <Text style={styles.statValue}>{stats.orderCount}</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                      <Text style={styles.statLabel}>Total Spend</Text>
                      <Text style={[styles.statValue, { color: colors.inflow }]}>
                        {formatCurrency(stats.totalSpend)}
                      </Text>
                    </View>
                    {stats.pendingDue > 0 && (
                      <>
                        <View style={styles.statDivider} />
                        <View style={styles.statItem}>
                          <Text style={styles.statLabel}>Pending Due</Text>
                          <Text style={[styles.statValue, { color: colors.danger }]}>
                            {formatCurrency(stats.pendingDue)}
                          </Text>
                        </View>
                      </>
                    )}
                  </View>

                  {/* Quick Action Pills */}
                  <View style={styles.actionPillsRow}>
                    {item.phone ? (
                      <>
                        <Pressable
                          style={({ pressed }) => [styles.actionPill, pressed && { opacity: 0.7 }]}
                          onPress={() => handleCall(item.phone)}
                        >
                          <Ionicons name="call" size={14} color={colors.clayDeep} />
                          <Text style={styles.actionPillText}>Call</Text>
                        </Pressable>

                        <Pressable
                          style={({ pressed }) => [styles.actionPill, pressed && { opacity: 0.7 }]}
                          onPress={() => handleWhatsApp(item.phone)}
                        >
                          <Ionicons name="logo-whatsapp" size={14} color={colors.success} />
                          <Text style={[styles.actionPillText, { color: colors.success }]}>
                            WhatsApp
                          </Text>
                        </Pressable>
                      </>
                    ) : null}

                    <Pressable
                      style={({ pressed }) => [styles.actionPill, styles.newOrderPill, pressed && { opacity: 0.7 }]}
                      onPress={() =>
                        navigation.navigate('OrderForm', {
                          prefillCustomerName: item.name,
                          prefillPhone: item.phone,
                        })
                      }
                    >
                      <Ionicons name="add" size={14} color={colors.duskDeep} />
                      <Text style={[styles.actionPillText, { color: colors.duskDeep }]}>
                        New Order
                      </Text>
                    </Pressable>
                  </View>
                </Pressable>
              );
            }}
            ListEmptyComponent={
              !loading ? (
                <EmptyState
                  icon="people-outline"
                  title={searchQuery ? 'No customers found' : 'No customers yet'}
                  message={
                    searchQuery
                      ? 'Try searching with a different name or phone number.'
                      : 'Customers are automatically saved when you create orders, or you can add them directly.'
                  }
                />
              ) : null
            }
          />

          {/* Floating Add Customer Button */}
          <Pressable
            style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
            onPress={() => navigation.navigate('CustomerForm', undefined)}
          >
            <Ionicons name="person-add" size={20} color={colors.white} />
            <Text style={styles.fabText}>+ Customer</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </DesktopLayout>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  centerContainer: {
    flex: 1,
    width: '100%',
    maxWidth: 1040,
    alignSelf: 'center',
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
    paddingRight: 10,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.inkSoft,
    marginTop: 1,
  },
  newCustomerHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.clayDeep,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.md,
    ...shadow.card,
  },
  newCustomerHeaderBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.white,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.paperCard,
    marginHorizontal: 20,
    marginTop: 4,
    marginBottom: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 12,
    paddingVertical: 10,
    ...shadow.card,
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.ink,
    padding: 0,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  customerCard: {
    backgroundColor: colors.paperCard,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 14,
    marginBottom: 12,
    ...shadow.card,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.clayDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.white,
  },
  nameBlock: {
    flex: 1,
  },
  customerName: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    color: colors.ink,
  },
  phoneText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.inkSoft,
    marginTop: 2,
  },
  addressText: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.inkSoft,
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.paper,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 10,
    borderWidth: 1,
    borderColor: colors.line,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: 20,
    backgroundColor: colors.line,
    marginHorizontal: 4,
  },
  statLabel: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.inkSoft,
  },
  statValue: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.ink,
    marginTop: 1,
  },
  actionPillsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    borderStyle: 'dashed' as any,
  },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.sm,
  },
  actionPillText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    color: colors.clayDeep,
  },
  newOrderPill: {
    marginLeft: 'auto',
    backgroundColor: colors.duskLight,
    borderColor: colors.duskDeep,
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
});
