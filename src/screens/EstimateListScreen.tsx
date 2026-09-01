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
import { Estimate, EstimateStatus, estimateTotal } from '../types/estimate';
import { getEstimates, deleteEstimate } from '../storage/estimateStorage';
import { addDataListener } from '../storage/firebaseSync';
import EmptyState from '../components/EmptyState';
import { colors, fonts, radius, shadow } from '../theme/theme';
import { confirmAction } from '../utils/dialog';
import { formatCurrency, formatDate } from '../utils/format';
import DesktopLayout from '../components/DesktopLayout';
import { useLanguage } from '../i18n/LanguageContext';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const STATUS_COLORS: Record<EstimateStatus, string> = {
  Draft: colors.inkSoft,
  Sent: colors.duskDeep,
  Accepted: colors.success,
  Rejected: colors.danger,
  Expired: colors.pending,
};

interface EstimateCardProps {
  item: Estimate;
  onPress: () => void;
  onDelete: (id: string, name: string) => void;
}

const EstimateCard = React.memo(function EstimateCard({ item, onPress, onDelete }: EstimateCardProps) {
  const total = estimateTotal(item);
  const statusColor = STATUS_COLORS[item.status] || colors.inkSoft;

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] }]}
      onPress={onPress}
    >
      <View style={styles.cardTop}>
        <View style={styles.cardLeft}>
          <View style={[styles.iconCircle, { backgroundColor: colors.clayLight }]}>
            <Ionicons name="document-text" size={20} color={colors.clayDeep} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.customerName} numberOfLines={1}>{item.customerName}</Text>
            <Text style={styles.estimateNum}>{item.estimateNumber} • {formatDate(item.estimateDate)}</Text>
          </View>
        </View>
        <View style={styles.cardRight}>
          <Text style={styles.totalAmount}>{formatCurrency(total)}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + '18' }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>{item.status}</Text>
          </View>
        </View>
      </View>

      {item.validUntil && (
        <View style={styles.validUntilRow}>
          <Ionicons name="calendar-outline" size={12} color={colors.inkSoft} />
          <Text style={styles.validUntil}>Valid until: {formatDate(item.validUntil)}</Text>
        </View>
      )}

      <View style={styles.cardBottom}>
        <View style={styles.itemTag}>
          <Ionicons name="cube-outline" size={13} color={colors.inkSoft} />
          <Text style={styles.itemCount}>{item.items.length} item{item.items.length === 1 ? '' : 's'}</Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.deleteBtn, pressed && { opacity: 0.6 }]}
          onPress={() => onDelete(item.id, item.customerName)}
          hitSlop={8}
        >
          <Ionicons name="trash-outline" size={16} color={colors.danger} />
        </Pressable>
      </View>
    </Pressable>
  );
});

export default function EstimateListScreen() {
  const navigation = useNavigation<Nav>();
  const { t } = useLanguage();
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<EstimateStatus | 'All'>('All');

  const loadEstimates = useCallback(async (forceSync = false) => {
    try {
      const data = await getEstimates(forceSync);
      setEstimates(data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadEstimates(false);
    }, [loadEstimates])
  );

  useEffect(() => {
    const unsub = addDataListener(() => loadEstimates(false));
    return () => unsub();
  }, [loadEstimates]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadEstimates(true);
  }, [loadEstimates]);

  const counts = useMemo(() => {
    let draftCount = 0;
    let sentCount = 0;
    let acceptedCount = 0;
    let rejectedCount = 0;
    let totalValue = 0;
    let acceptedValue = 0;

    for (const e of estimates) {
      const total = estimateTotal(e);
      totalValue += total;
      if (e.status === 'Accepted') {
        acceptedCount++;
        acceptedValue += total;
      } else if (e.status === 'Sent') {
        sentCount++;
      } else if (e.status === 'Draft') {
        draftCount++;
      } else if (e.status === 'Rejected') {
        rejectedCount++;
      }
    }

    return {
      totalCount: estimates.length,
      draftCount,
      sentCount,
      acceptedCount,
      rejectedCount,
      totalValue,
      acceptedValue,
    };
  }, [estimates]);

  const filtered = useMemo(() => {
    let result = estimates;
    if (statusFilter !== 'All') {
      result = result.filter((e) => e.status === statusFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (e) =>
          e.customerName.toLowerCase().includes(q) ||
          e.estimateNumber.toLowerCase().includes(q) ||
          e.items.some((it) => it.name.toLowerCase().includes(q))
      );
    }
    return result;
  }, [estimates, statusFilter, searchQuery]);

  const handleDelete = useCallback(
    (id: string, name: string) => {
      confirmAction({
        title: 'Delete Estimate',
        message: `Remove estimate for ${name}?`,
        confirmText: 'Delete',
        cancelText: 'Cancel',
        destructive: true,
        onConfirm: async () => {
          await deleteEstimate(id);
          loadEstimates(false);
        },
      });
    },
    [loadEstimates]
  );

  const statusFilters: (EstimateStatus | 'All')[] = ['All', 'Draft', 'Sent', 'Accepted', 'Rejected'];

  const content = (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <View style={styles.centerContainer}>
        {/* Header Bar */}
        <View style={styles.header}>
          <View style={styles.headerTitleWrap}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="document-text" size={24} color={colors.clayDeep} />
              <Text style={styles.headerTitle}>{t('estimates.title', 'Estimates & Quotations')}</Text>
            </View>
            <Text style={styles.headerSubtitle}>
              {loading
                ? t('common.loading', 'Loading...')
                : `${filtered.length} of ${estimates.length} quotes`}
            </Text>
          </View>

          <Pressable
            style={({ pressed }) => [styles.newBtn, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}
            onPress={() => navigation.navigate('EstimateForm')}
          >
            <Ionicons name="add" size={18} color={colors.white} />
            <Text style={styles.newBtnText}>New Quote</Text>
          </Pressable>
        </View>

        {/* Quick Summary Metrics Strip */}
        {estimates.length > 0 && (
          <View style={styles.summaryStrip}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.summaryScroll}>
              <View style={styles.summaryBadge}>
                <Text style={styles.summaryLabel}>Total Pipeline:</Text>
                <Text style={styles.summaryVal}>{formatCurrency(counts.totalValue)}</Text>
              </View>
              {counts.acceptedValue > 0 && (
                <View style={[styles.summaryBadge, { backgroundColor: '#E8F5E9' }]}>
                  <Ionicons name="checkmark-done-circle-outline" size={13} color={colors.inflow} />
                  <Text style={[styles.summaryLabel, { color: colors.inflow }]}>Accepted Value:</Text>
                  <Text style={[styles.summaryVal, { color: colors.inflow }]}>{formatCurrency(counts.acceptedValue)}</Text>
                </View>
              )}
              {counts.sentCount > 0 && (
                <View style={[styles.summaryBadge, { backgroundColor: '#FFF3E0' }]}>
                  <Ionicons name="paper-plane-outline" size={13} color={colors.pending} />
                  <Text style={[styles.summaryLabel, { color: colors.pending }]}>Sent / Pending:</Text>
                  <Text style={[styles.summaryVal, { color: colors.pending }]}>{counts.sentCount}</Text>
                </View>
              )}
            </ScrollView>
          </View>
        )}

        {/* Search Bar Toolbar */}
        <View style={styles.searchBarWrap}>
          <Ionicons name="search" size={18} color={colors.inkSoft} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder={t('estimates.searchPlaceholder', 'Search customer, quote #, product...')}
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
                : s === 'Draft'
                ? counts.draftCount
                : s === 'Sent'
                ? counts.sentCount
                : s === 'Accepted'
                ? counts.acceptedCount
                : counts.rejectedCount;

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

        {/* Estimate List */}
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <EstimateCard
              item={item}
              onPress={() => navigation.navigate('EstimateDetail', { estimateId: item.id })}
              onDelete={handleDelete}
            />
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.clayDeep} />}
          ListEmptyComponent={
            !loading ? (
              <EmptyState
                icon="document-text-outline"
                title={t('estimates.emptyTitle', 'No Estimates Yet')}
                subtitle={t('estimates.emptySubtitle', 'Tap + New Quote to create and send your first quotation')}
              />
            ) : null
          }
        />
      </View>
    </SafeAreaView>
  );

  if (Platform.OS === 'web') {
    return <DesktopLayout currentTabName="EstimateList">{content}</DesktopLayout>;
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
  customerName: {
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    color: colors.ink,
  },
  estimateNum: {
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
  validUntilRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    borderStyle: 'dashed' as any,
  },
  validUntil: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.inkSoft,
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
