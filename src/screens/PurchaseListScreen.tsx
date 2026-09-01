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
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { RootStackParamList } from '../navigation/types';
import { Purchase, PurchaseStatus, purchaseTotal, purchaseBalance } from '../types/purchase';
import { getPurchases, deletePurchase } from '../storage/purchaseStorage';
import { addDataListener } from '../storage/firebaseSync';
import EmptyState from '../components/EmptyState';
import { colors, fonts, radius, shadow } from '../theme/theme';
import { confirmAction } from '../utils/dialog';
import { formatCurrency, formatDate } from '../utils/format';
import DesktopLayout from '../components/DesktopLayout';
import { useLanguage } from '../i18n/LanguageContext';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const STATUS_COLORS: Record<PurchaseStatus, string> = {
  Paid: colors.success,
  Partial: colors.pending,
  Pending: colors.danger,
};

interface PurchaseCardProps {
  item: Purchase;
  onPress: () => void;
  onDelete: (id: string, name: string) => void;
}

const PurchaseCard = React.memo(function PurchaseCard({ item, onPress, onDelete }: PurchaseCardProps) {
  const total = purchaseTotal(item);
  const balance = purchaseBalance(item);
  const statusColor = STATUS_COLORS[item.paymentStatus] || colors.inkSoft;

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] }]}
      onPress={onPress}
    >
      <View style={styles.cardTop}>
        <View style={styles.cardLeft}>
          <View style={[styles.iconCircle, { backgroundColor: colors.duskLight }]}>
            <Ionicons name="cart" size={20} color={colors.duskDeep} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.supplierName} numberOfLines={1}>{item.supplierName}</Text>
            <Text style={styles.purchaseNum}>{item.purchaseNumber} • {formatDate(item.purchaseDate)}</Text>
          </View>
        </View>
        <View style={styles.cardRight}>
          <Text style={styles.totalAmount}>{formatCurrency(total)}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + '18' }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>{item.paymentStatus}</Text>
          </View>
        </View>
      </View>

      {balance > 0 && (
        <View style={styles.balanceRow}>
          <Text style={styles.balanceLabel}>Balance Due to Supplier:</Text>
          <Text style={styles.balanceAmount}>{formatCurrency(balance)}</Text>
        </View>
      )}

      <View style={styles.cardBottom}>
        <View style={styles.itemTag}>
          <Ionicons name="cube-outline" size={13} color={colors.inkSoft} />
          <Text style={styles.itemCount}>{item.items.length} item{item.items.length === 1 ? '' : 's'}</Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.deleteBtn, pressed && { opacity: 0.6 }]}
          onPress={() => onDelete(item.id, item.supplierName)}
          hitSlop={8}
        >
          <Ionicons name="trash-outline" size={16} color={colors.danger} />
        </Pressable>
      </View>
    </Pressable>
  );
});

export default function PurchaseListScreen() {
  const navigation = useNavigation<Nav>();
  const { t } = useLanguage();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<PurchaseStatus | 'All'>('All');

  const loadPurchases = useCallback(async (forceSync = false) => {
    try {
      const data = await getPurchases(forceSync);
      setPurchases(data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadPurchases(false);
    }, [loadPurchases])
  );

  useEffect(() => {
    const unsub = addDataListener(() => {
      loadPurchases(false);
    });
    return () => unsub();
  }, [loadPurchases]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadPurchases(true);
  }, [loadPurchases]);

  const counts = useMemo(() => {
    let pendingCount = 0;
    let partialCount = 0;
    let paidCount = 0;
    let totalSpend = 0;
    let totalDue = 0;

    for (const p of purchases) {
      const total = purchaseTotal(p);
      const balance = purchaseBalance(p);
      totalSpend += total;
      totalDue += Math.max(0, balance);

      if (p.paymentStatus === 'Paid') paidCount++;
      else if (p.paymentStatus === 'Partial') partialCount++;
      else pendingCount++;
    }

    return {
      totalCount: purchases.length,
      pendingCount,
      partialCount,
      paidCount,
      totalSpend,
      totalDue,
    };
  }, [purchases]);

  const filtered = useMemo(() => {
    let result = purchases;
    if (statusFilter !== 'All') {
      result = result.filter((p) => p.paymentStatus === statusFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (p) =>
          p.supplierName.toLowerCase().includes(q) ||
          p.purchaseNumber.toLowerCase().includes(q) ||
          p.items.some((it) => it.name.toLowerCase().includes(q))
      );
    }
    return result;
  }, [purchases, statusFilter, searchQuery]);

  const handleDelete = useCallback(
    (id: string, name: string) => {
      confirmAction({
        title: 'Delete Purchase',
        message: `Remove purchase record from ${name}?`,
        confirmText: 'Delete',
        cancelText: 'Cancel',
        destructive: true,
        onConfirm: async () => {
          await deletePurchase(id);
          loadPurchases(false);
        },
      });
    },
    [loadPurchases]
  );

  const statusFilters: (PurchaseStatus | 'All')[] = ['All', 'Pending', 'Partial', 'Paid'];

  const content = (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <View style={styles.centerContainer}>
        {/* Header Bar */}
        <View style={styles.header}>
          <View style={styles.headerTitleWrap}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="cart" size={24} color={colors.clayDeep} />
              <Text style={styles.headerTitle}>{t('purchases.title', 'Purchases')}</Text>
            </View>
            <Text style={styles.headerSubtitle}>
              {loading
                ? t('common.loading', 'Loading...')
                : `${filtered.length} of ${purchases.length} records`}
            </Text>
          </View>

          <Pressable
            style={({ pressed }) => [styles.newBtn, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}
            onPress={() => navigation.navigate('PurchaseForm')}
          >
            <Ionicons name="add" size={18} color={colors.white} />
            <Text style={styles.newBtnText}>New Purchase</Text>
          </Pressable>
        </View>

        {/* Quick Summary Metrics Strip */}
        {purchases.length > 0 && (
          <View style={styles.summaryStrip}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.summaryScroll}>
              <View style={styles.summaryBadge}>
                <Text style={styles.summaryLabel}>Total Spend:</Text>
                <Text style={styles.summaryVal}>{formatCurrency(counts.totalSpend)}</Text>
              </View>
              {counts.totalDue > 0 && (
                <View style={[styles.summaryBadge, { backgroundColor: '#FFEBEE' }]}>
                  <Ionicons name="time-outline" size={13} color={colors.danger} />
                  <Text style={[styles.summaryLabel, { color: colors.danger }]}>Supplier Due:</Text>
                  <Text style={[styles.summaryVal, { color: colors.danger }]}>{formatCurrency(counts.totalDue)}</Text>
                </View>
              )}
              <View style={[styles.summaryBadge, { backgroundColor: '#E8F5E9' }]}>
                <Ionicons name="checkmark-circle-outline" size={13} color={colors.inflow} />
                <Text style={[styles.summaryLabel, { color: colors.inflow }]}>Paid in Full:</Text>
                <Text style={[styles.summaryVal, { color: colors.inflow }]}>{counts.paidCount}</Text>
              </View>
            </ScrollView>
          </View>
        )}

        {/* Search Bar Toolbar */}
        <View style={styles.searchBarWrap}>
          <Ionicons name="search" size={18} color={colors.inkSoft} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder={t('purchases.searchPlaceholder', 'Search supplier, bill #, product...')}
            placeholderTextColor={colors.inkSoft}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={colors.inkSoft} />
            </Pressable>
          )}
        </View>

        {/* Filter Chips Bar */}
        <View style={styles.filterChipRow}>
          {statusFilters.map((s) => {
            const isSelected = statusFilter === s;
            const count =
              s === 'All'
                ? counts.totalCount
                : s === 'Pending'
                ? counts.pendingCount
                : s === 'Partial'
                ? counts.partialCount
                : counts.paidCount;

            return (
              <Pressable
                key={s}
                style={[styles.filterChip, isSelected && styles.filterChipActive]}
                onPress={() => setStatusFilter(s)}
              >
                {isSelected && <Ionicons name="checkmark-circle" size={13} color={colors.white} style={{ marginRight: 4 }} />}
                <Text style={[styles.filterChipText, isSelected && styles.filterChipTextActive]}>
                  {s} ({count})
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Purchase List */}
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <PurchaseCard
              item={item}
              onPress={() => navigation.navigate('PurchaseForm', { purchaseId: item.id })}
              onDelete={handleDelete}
            />
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.clayDeep} />}
          ListEmptyComponent={
            !loading ? (
              <EmptyState
                icon="cart-outline"
                title={t('purchases.emptyTitle', 'No Purchases Yet')}
                subtitle={t('purchases.emptySubtitle', 'Tap + New Purchase to record your first supplier bill')}
              />
            ) : null
          }
        />
      </View>
    </SafeAreaView>
  );

  if (Platform.OS === 'web') {
    return <DesktopLayout currentTabName="PurchaseList">{content}</DesktopLayout>;
  }
  return content;
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
    paddingHorizontal: Platform.select({ web: 24, default: 16 }),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Platform.select({ web: 18, default: 12 }),
    paddingBottom: 10,
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitle: {
    fontFamily: fonts.display,
    fontSize: 26,
    color: colors.clayDeep,
    lineHeight: 30,
  },
  headerSubtitle: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.inkSoft,
    marginTop: 2,
  },
  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.clayDeep,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: radius.md,
    ...shadow.card,
  },
  newBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.white,
    letterSpacing: 0.2,
  },
  summaryStrip: {
    marginBottom: 10,
  },
  summaryScroll: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  summaryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.paperCard,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.line,
  },
  summaryLabel: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.inkSoft,
  },
  summaryVal: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: colors.ink,
  },
  searchBarWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.paperCard,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 14,
    paddingVertical: Platform.select({ ios: 10, default: 8 }),
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.ink,
    padding: 0,
  },
  filterChipRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: colors.paperCard,
  },
  filterChipActive: {
    backgroundColor: colors.clayDeep,
    borderColor: colors.clayDeep,
  },
  filterChipText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.ink,
  },
  filterChipTextActive: {
    color: colors.white,
    fontFamily: fonts.bodyBold,
  },
  listContent: {
    paddingBottom: 100,
  },
  card: {
    backgroundColor: colors.paperCard,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 16,
    marginBottom: 10,
    ...shadow.card,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: 10,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  supplierName: {
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    color: colors.ink,
  },
  purchaseNum: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.inkSoft,
    marginTop: 2,
  },
  cardRight: {
    alignItems: 'flex-end',
  },
  totalAmount: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    color: colors.ink,
  },
  statusBadge: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 4,
  },
  statusText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    borderStyle: 'dashed' as any,
  },
  balanceLabel: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.inkSoft,
  },
  balanceAmount: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.danger,
  },
  cardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  itemTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.paper,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.line,
  },
  itemCount: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.inkSoft,
  },
  deleteBtn: {
    padding: 6,
  },
});
