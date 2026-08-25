import React, { useCallback, useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  TextInput,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { RootStackParamList } from '../navigation/types';
import { Expense, ExpenseCategory, EXPENSE_CATEGORIES } from '../types/order';
import { getExpenses, deleteExpense } from '../storage/expenseStorage';
import { addDataListener } from '../storage/firebaseSync';
import EmptyState from '../components/EmptyState';
import { colors, fonts, radius, shadow, categoryColor } from '../theme/theme';
import { confirmAction } from '../utils/dialog';
import { formatCurrency, formatDate } from '../utils/format';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function ExpensesScreen() {
  const navigation = useNavigation<Nav>();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [selectedCategory, setSelectedCategory] = useState<ExpenseCategory | 'All'>('All');
  const [searchQuery, setSearchQuery] = useState('');

  const loadExpenses = useCallback(async (forceSync = false) => {
    try {
      const data = await getExpenses(forceSync);
      setExpenses(data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadExpenses(false);
    }, [loadExpenses])
  );

  // Subscribe to live Realtime Database updates
  useEffect(() => {
    const unsub = addDataListener(() => {
      loadExpenses(false);
    });
    return () => unsub();
  }, [loadExpenses]);

  const onRefresh = () => {
    setRefreshing(true);
    loadExpenses(true);
  };

  const handleDelete = (id: string, description: string) => {
    confirmAction({
      title: 'Delete Expense',
      message: `Remove "${description || 'this expense'}"?`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      destructive: true,
      onConfirm: async () => {
        await deleteExpense(id);
        loadExpenses();
      },
    });
  };

  const filteredExpenses = useMemo(() => {
    let result = [...expenses];
    if (selectedCategory !== 'All') {
      result = result.filter((e) => e.category === selectedCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (e) =>
          e.description.toLowerCase().includes(q) ||
          e.category.toLowerCase().includes(q) ||
          e.paymentMethod.toLowerCase().includes(q)
      );
    }
    return result;
  }, [expenses, selectedCategory, searchQuery]);

  const totalOutflow = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

  // Category totals for top breakdown
  const categoryTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    expenses.forEach((e) => {
      totals[e.category] = (totals[e.category] || 0) + e.amount;
    });
    return totals;
  }, [expenses]);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Outflow Ledger</Text>
          <Text style={styles.subtitle}>Track raw materials, rent, shipping & costs</Text>
        </View>
      </View>

      {/* Outflow Hero Summary Card */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryTop}>
          <Text style={styles.summaryLabel}>
            {selectedCategory === 'All' ? 'Total Business Outflow' : `${selectedCategory} Outflow`}
          </Text>
          <Text style={styles.summaryCount}>{filteredExpenses.length} entries</Text>
        </View>
        <Text style={styles.summaryAmount}>{formatCurrency(totalOutflow)}</Text>
      </View>

      {/* Search Input */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={17} color={colors.inkSoft} style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search outflow, notes, vendor…"
          placeholderTextColor={colors.inkSoft}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <Pressable onPress={() => setSearchQuery('')} style={{ padding: 2 }}>
            <Ionicons name="close-circle" size={16} color={colors.inkSoft} />
          </Pressable>
        )}
      </View>

      {/* Category Pills Slider */}
      <View style={styles.pillsWrapper}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={['All', ...EXPENSE_CATEGORIES]}
          keyExtractor={(item) => item}
          contentContainerStyle={styles.pillsList}
          renderItem={({ item }) => {
            const isSelected = selectedCategory === item;
            const catAmt = item !== 'All' ? categoryTotals[item] : null;
            return (
              <Pressable
                style={[
                  styles.pill,
                  isSelected && styles.pillActive,
                  item !== 'All' && isSelected && {
                    backgroundColor: categoryColor[item as ExpenseCategory] || colors.clayDeep,
                    borderColor: categoryColor[item as ExpenseCategory] || colors.clayDeep,
                  },
                ]}
                onPress={() => setSelectedCategory(item as ExpenseCategory | 'All')}
              >
                <Text style={[styles.pillText, isSelected && styles.pillTextActive]}>
                  {item}
                  {catAmt ? ` (${formatCurrency(catAmt)})` : ''}
                </Text>
              </Pressable>
            );
          }}
        />
      </View>

      {/* Expense List */}
      <FlatList
        data={filteredExpenses}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.clayDeep} />
        }
        renderItem={({ item }) => {
          const color = categoryColor[item.category] || colors.clayDeep;
          return (
            <View style={styles.expenseCard}>
              <View style={[styles.categoryIndicator, { backgroundColor: color }]} />
              <View style={styles.expenseBody}>
                <View style={styles.expenseTopRow}>
                  <View style={styles.expenseLeft}>
                    <View style={[styles.catBadge, { backgroundColor: color }]}>
                      <Text style={styles.catBadgeText}>{item.category}</Text>
                    </View>
                    <Text style={styles.expenseDesc} numberOfLines={2}>
                      {item.description || 'Expense entry'}
                    </Text>
                  </View>
                  <Text style={styles.expenseAmount}>-{formatCurrency(item.amount)}</Text>
                </View>

                <View style={styles.expenseBottomRow}>
                  <View style={styles.metaRow}>
                    <Ionicons name="calendar-outline" size={13} color={colors.inkSoft} />
                    <Text style={styles.metaText}>{formatDate(item.date)}</Text>
                    <Text style={styles.metaDivider}>•</Text>
                    <Ionicons name="card-outline" size={13} color={colors.inkSoft} />
                    <Text style={styles.metaText}>{item.paymentMethod || 'Cash'}</Text>
                  </View>

                  <View style={styles.actionIcons}>
                    <Pressable
                      style={styles.iconBtn}
                      onPress={() => navigation.navigate('ExpenseForm', { expenseId: item.id })}
                    >
                      <Ionicons name="pencil" size={16} color={colors.inkSoft} />
                    </Pressable>
                    <Pressable
                      style={styles.iconBtn}
                      onPress={() => handleDelete(item.id, item.description)}
                    >
                      <Ionicons name="trash-outline" size={16} color={colors.danger} />
                    </Pressable>
                  </View>
                </View>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              icon="wallet-outline"
              title={searchQuery || selectedCategory !== 'All' ? 'No expenses match' : 'No expenses yet'}
              message={
                searchQuery || selectedCategory !== 'All'
                  ? 'Try selecting a different category or clearing your search.'
                  : 'Tap the + button to record raw material purchases, rent, courier costs, or other outflow.'
              }
            />
          ) : null
        }
      />

      {/* Floating Add Expense Button */}
      <Pressable
        style={styles.fab}
        onPress={() => navigation.navigate('ExpenseForm', undefined)}
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
    paddingBottom: 6,
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
  summaryCard: {
    backgroundColor: colors.paperCard,
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 8,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    borderLeftWidth: 4,
    borderLeftColor: colors.outflow,
    padding: 14,
    ...shadow.card,
  },
  summaryTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  summaryLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.inkSoft,
  },
  summaryCount: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.inkSoft,
  },
  summaryAmount: {
    fontFamily: fonts.display,
    fontSize: 32,
    color: colors.outflow,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.paperCard,
    marginHorizontal: 20,
    marginTop: 4,
    marginBottom: 8,
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
  searchInput: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.ink,
    padding: 0,
  },
  pillsWrapper: {
    marginBottom: 6,
  },
  pillsList: {
    paddingHorizontal: 20,
    gap: 8,
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.sm,
    backgroundColor: colors.paperCard,
    borderWidth: 1,
    borderColor: colors.line,
  },
  pillActive: {
    backgroundColor: colors.clayDeep,
    borderColor: colors.clayDeep,
  },
  pillText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.ink,
  },
  pillTextActive: {
    color: colors.white,
    fontFamily: fonts.bodyBold,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
    paddingTop: 4,
  },
  expenseCard: {
    flexDirection: 'row',
    backgroundColor: colors.paperCard,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: 10,
    overflow: 'hidden',
    ...shadow.card,
  },
  categoryIndicator: {
    width: 4,
  },
  expenseBody: {
    flex: 1,
    padding: 12,
  },
  expenseTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  expenseLeft: {
    flex: 1,
  },
  catBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.sm,
    marginBottom: 4,
  },
  catBadgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    color: colors.white,
  },
  expenseDesc: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.ink,
  },
  expenseAmount: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    color: colors.outflow,
  },
  expenseBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    borderStyle: 'dashed',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.inkSoft,
  },
  metaDivider: {
    color: colors.line,
    marginHorizontal: 2,
  },
  actionIcons: {
    flexDirection: 'row',
    gap: 12,
  },
  iconBtn: {
    padding: 2,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.duskDeep,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
});
