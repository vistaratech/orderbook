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
import { Product } from '../types/order';
import { getProducts, deleteProduct } from '../storage/productStorage';
import { addDataListener } from '../storage/firebaseSync';
import EmptyState from '../components/EmptyState';
import { colors, fonts, radius, shadow } from '../theme/theme';
import { confirmAction } from '../utils/dialog';
import { formatCurrency } from '../utils/format';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function ProductListScreen() {
  const navigation = useNavigation<Nav>();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const loadProducts = useCallback(async (forceSync = false) => {
    try {
      const data = await getProducts(forceSync);
      setProducts(data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadProducts(true);
    }, [loadProducts])
  );

  // Subscribe to live Firestore updates
  useEffect(() => {
    const unsub = addDataListener(() => {
      loadProducts(false);
    });
    return () => unsub();
  }, [loadProducts]);

  const onRefresh = () => {
    setRefreshing(true);
    loadProducts(true);
  };

  const handleDelete = (id: string, name: string) => {
    confirmAction({
      title: 'Delete Product',
      message: `Remove "${name}" from catalog?`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      destructive: true,
      onConfirm: async () => {
        await deleteProduct(id);
        loadProducts();
      },
    });
  };

  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return products;
    const q = searchQuery.toLowerCase().trim();
    return products.filter((p) => p.name.toLowerCase().includes(q));
  }, [products, searchQuery]);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Catalog</Text>
          <Text style={styles.subtitle}>
            {filteredProducts.length} product{filteredProducts.length === 1 ? '' : 's'} in store catalog
          </Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.newProductHeaderBtn, pressed && { opacity: 0.8 }]}
          onPress={() => navigation.navigate('ProductForm', undefined)}
        >
          <Ionicons name="add" size={20} color={colors.white} />
          <Text style={styles.newProductHeaderBtnText}>Add</Text>
        </Pressable>
      </View>

      {/* Search Bar */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color={colors.inkSoft} style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search products in catalog…"
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

      {/* Product List */}
      <FlatList
        data={filteredProducts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.clayDeep} />
        }
        renderItem={({ item }) => (
          <View style={styles.productCard}>
            <View style={styles.productIconWrap}>
              <Ionicons name="cube-outline" size={22} color={colors.duskDeep} />
            </View>

            <View style={styles.productLeft}>
              <Text style={styles.productName}>{item.name}</Text>
              <View style={styles.unitBadge}>
                <Text style={styles.unitBadgeText}>per {item.unit || 'pcs'}</Text>
              </View>
            </View>

            <View style={styles.productRight}>
              <Text style={styles.productPrice}>{formatCurrency(item.defaultPrice)}</Text>
              <View style={styles.actions}>
                <Pressable
                  style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.6 }]}
                  onPress={() => navigation.navigate('ProductForm', { productId: item.id })}
                >
                  <Ionicons name="pencil" size={16} color={colors.inkSoft} />
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.6 }]}
                  onPress={() => handleDelete(item.id, item.name)}
                >
                  <Ionicons name="trash-outline" size={16} color={colors.danger} />
                </Pressable>
              </View>
            </View>
          </View>
        )}
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              icon="pricetags-outline"
              title={searchQuery ? 'No products match' : 'Catalog is empty'}
              message={
                searchQuery
                  ? 'Try searching with a different product name.'
                  : 'Add your regular products here to quickly autocomplete names and prices when writing orders.'
              }
            />
          ) : null
        }
      />

      {/* Floating Add Product Button */}
      <Pressable
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
        onPress={() => navigation.navigate('ProductForm', undefined)}
      >
        <Ionicons name="add" size={22} color={colors.white} />
        <Text style={styles.fabText}>+ Item</Text>
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
    paddingRight: 10,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.inkSoft,
    marginTop: 1,
  },
  newProductHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.duskDeep,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.md,
    ...shadow.card,
  },
  newProductHeaderBtnText: {
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
  productCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.paperCard,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 14,
    marginBottom: 10,
    gap: 12,
    ...shadow.card,
  },
  productIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.duskLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  productLeft: {
    flex: 1,
  },
  productName: {
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    color: colors.ink,
  },
  unitBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 3,
  },
  unitBadgeText: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.inkSoft,
  },
  productRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  productPrice: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    color: colors.duskDeep,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  iconBtn: {
    padding: 4,
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
    backgroundColor: colors.duskDeep,
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
