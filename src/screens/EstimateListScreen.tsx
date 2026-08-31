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
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}
      onPress={onPress}
    >
      <View style={styles.cardTop}>
        <View style={styles.cardLeft}>
          <View style={[styles.iconCircle, { backgroundColor: colors.clayLight }]}>
            <Ionicons name="document-text-outline" size={20} color={colors.clayDeep} />
          </View>
          <View>
            <Text style={styles.customerName}>{item.customerName}</Text>
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
        <Text style={styles.validUntil}>Valid until: {formatDate(item.validUntil)}</Text>
      )}

      <View style={styles.cardBottom}>
        <Text style={styles.itemCount}>{item.items.length} item(s)</Text>
        <Pressable
          style={({ pressed }) => [styles.deleteBtn, pressed && { opacity: 0.6 }]}
          onPress={() => onDelete(item.id, item.customerName)}
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
          e.estimateNumber.toLowerCase().includes(q)
      );
    }
    return result;
  }, [estimates, statusFilter, searchQuery]);

  const handleDelete = useCallback(
    (id: string, name: string) => {
      confirmAction({
        title: 'Delete Estimate',
        message: `Remove estimate for ${name}?`,
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
    <View style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.safeTop}>
        <View style={styles.header}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="document-text" size={24} color={colors.clayDeep} />
            <Text style={styles.headerTitle}>{t('estimates.title', 'Estimates')}</Text>
          </View>
          <Pressable
            style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.85 }]}
            onPress={() => navigation.navigate('EstimateForm')}
          >
            <Ionicons name="add" size={22} color={colors.white} />
            <Text style={styles.addBtnText}>{t('estimates.addBtn', 'New Quote')}</Text>
          </Pressable>
        </View>

        <View style={styles.searchRow}>
          <Ionicons name="search-outline" size={18} color={colors.inkSoft} />
          <TextInput
            style={styles.searchInput}
            placeholder={t('estimates.searchPlaceholder', 'Search estimates...')}
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
          <EstimateCard
            item={item}
            onPress={() => navigation.navigate('EstimateDetail', { estimateId: item.id })}
            onDelete={handleDelete}
          />
        )}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.clayDeep} />}
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              icon="document-text-outline"
              title={t('estimates.emptyTitle', 'No Estimates Yet')}
              subtitle={t('estimates.emptySubtitle', 'Tap + to create your first quotation')}
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
    backgroundColor: colors.clayDeep,
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
    flexWrap: 'wrap',
  },
  filterChip: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: colors.paper,
  },
  filterChipActive: { backgroundColor: colors.clayDeep, borderColor: colors.clayDeep },
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
  customerName: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
  estimateNum: { fontFamily: fonts.body, fontSize: 12, color: colors.inkSoft, marginTop: 2 },
  cardRight: { alignItems: 'flex-end' },
  totalAmount: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.ink },
  statusBadge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, marginTop: 4 },
  statusText: { fontFamily: fonts.bodyMedium, fontSize: 11 },
  validUntil: { fontFamily: fonts.body, fontSize: 12, color: colors.pending, marginTop: 6 },
  cardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  itemCount: { fontFamily: fonts.body, fontSize: 12, color: colors.inkSoft },
  deleteBtn: { padding: 4 },
});
