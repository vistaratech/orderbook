import React, { useCallback, useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  TextInput,
  RefreshControl,
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
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}
      onPress={onPress}
    >
      <View style={styles.cardTop}>
        <View style={styles.cardLeft}>
          <View style={[styles.iconCircle, { backgroundColor: colors.duskLight }]}>
            <Ionicons name="cart-outline" size={20} color={colors.duskDeep} />
          </View>
          <View>
            <Text style={styles.supplierName}>{item.supplierName}</Text>
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
          <Text style={styles.balanceLabel}>Balance Due:</Text>
          <Text style={styles.balanceAmount}>{formatCurrency(balance)}</Text>
        </View>
      )}

      <View style={styles.cardBottom}>
        <Text style={styles.itemCount}>{item.items.length} item(s)</Text>
        <Pressable
          style={({ pressed }) => [styles.deleteBtn, pressed && { opacity: 0.6 }]}
          onPress={() => onDelete(item.id, item.supplierName)}
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
          p.purchaseNumber.toLowerCase().includes(q)
      );
    }
    return result;
  }, [purchases, statusFilter, searchQuery]);

  const handleDelete = useCallback(
    (id: string, name: string) => {
      confirmAction({
        title: 'Delete Purchase',
        message: `Remove purchase from ${name}?`,
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
    <View style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.safeTop}>
        <View style={styles.header}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="cart" size={24} color={colors.clayDeep} />
            <Text style={styles.headerTitle}>{t('purchases.title', 'Purchases')}</Text>
          </View>
          <Pressable
            style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.85 }]}
            onPress={() => navigation.navigate('PurchaseForm')}
          >
            <Ionicons name="add" size={22} color={colors.white} />
            <Text style={styles.addBtnText}>{t('purchases.addBtn', 'New Purchase')}</Text>
          </Pressable>
        </View>

        <View style={styles.searchRow}>
          <Ionicons name="search-outline" size={18} color={colors.inkSoft} />
          <TextInput
            style={styles.searchInput}
            placeholder={t('purchases.searchPlaceholder', 'Search suppliers...')}
            placeholderTextColor={colors.inkSoft}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <View style={styles.filterRow}>
          {statusFilters.map((s) => (
            <Pressable
              key={s}
              style={[styles.filterChip, statusFilter === s && styles.filterChipActive]}
              onPress={() => setStatusFilter(s)}
            >
              <Text style={[styles.filterChipText, statusFilter === s && styles.filterChipTextActive]}>
                {s}
              </Text>
            </Pressable>
          ))}
        </View>
      </SafeAreaView>

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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.clayDeep} />}
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              icon="cart-outline"
              title={t('purchases.emptyTitle', 'No Purchases Yet')}
              subtitle={t('purchases.emptySubtitle', 'Tap + to record your first purchase')}
            />
          ) : null
        }
      />
    </View>
  );

  if (Platform.OS === 'web') {
    return <DesktopLayout>{content}</DesktopLayout>;
  }
  return content;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  safeTop: { backgroundColor: colors.paper },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.select({ web: 16, default: 8 }),
    paddingBottom: 8,
  },
  headerTitle: { fontFamily: fonts.display, fontSize: 28, color: colors.clayDeep },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.duskDeep,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.sm,
    ...shadow.card,
  },
  addBtnText: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.white },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 8,
    backgroundColor: colors.paperCard,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 12,
    paddingVertical: Platform.select({ ios: 10, default: 6 }),
    gap: 8,
  },
  searchInput: { flex: 1, fontFamily: fonts.body, fontSize: 14, color: colors.ink },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  filterChip: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: colors.paper,
  },
  filterChipActive: { backgroundColor: colors.duskDeep, borderColor: colors.duskDeep },
  filterChipText: { fontFamily: fonts.body, fontSize: 12, color: colors.ink },
  filterChipTextActive: { color: colors.white, fontFamily: fonts.bodyBold },
  listContent: { padding: 20, paddingTop: 4, paddingBottom: 100, width: '100%', maxWidth: 720, alignSelf: 'center' as any },
  card: {
    backgroundColor: colors.paperCard,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 14,
    marginBottom: 10,
    ...shadow.card,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  iconCircle: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  supplierName: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
  purchaseNum: { fontFamily: fonts.body, fontSize: 12, color: colors.inkSoft, marginTop: 2 },
  cardRight: { alignItems: 'flex-end' },
  totalAmount: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.ink },
  statusBadge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, marginTop: 4 },
  statusText: { fontFamily: fonts.bodyMedium, fontSize: 11 },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    borderStyle: 'dashed' as any,
  },
  balanceLabel: { fontFamily: fonts.body, fontSize: 13, color: colors.inkSoft },
  balanceAmount: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.danger },
  cardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  itemCount: { fontFamily: fonts.body, fontSize: 12, color: colors.inkSoft },
  deleteBtn: { padding: 4 },
});
