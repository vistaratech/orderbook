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
      loadProducts(false);
    }, [loadProducts])
  );

  // Subscribe to live Realtime Database changes
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
    <View style={styles.screen}>
      {/* Search Bar */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={17} color={colors.inkSoft} style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search products in catalog…"
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

      <View style={styles.subHeader}>
        <Text style={styles.subHeaderText}>
          {filteredProducts.length} product{filteredProducts.length === 1 ? '' : 's'} in catalog
        </Text>
      </View>

      {/* Product List */}
      <FlatList
        data={filteredProducts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.clayDeep} />
        }
        renderItem={({ item }) => (
          <View style={styles.productCard}>
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
                  style={styles.iconBtn}
                  onPress={() => navigation.navigate('ProductForm', { productId: item.id })}
                >
                  <Ionicons name="pencil" size={16} color={colors.inkSoft} />
                </Pressable>
                <Pressable
                  style={styles.iconBtn}
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
        style={styles.fab}
        onPress={() => navigation.navigate('ProductForm', undefined)}
      >
        <Ionicons name="add" size={30} color={colors.white} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.paperCard,
    marginHorizontal: 16,
    marginTop: 12,
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
  subHeader: {
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  subHeaderText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.inkSoft,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 90,
  },
  productCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.paperCard,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 14,
    marginBottom: 10,
    ...shadow.card,
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
    marginTop: 4,
  },
  unitBadgeText: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.inkSoft,
  },
  productRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  productPrice: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    color: colors.clayDeep,
  },
  actions: {
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
