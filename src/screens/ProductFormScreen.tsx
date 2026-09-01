import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { ProductUnit, PRODUCT_UNITS, GST_RATES, GSTRate } from '../types/order';
import { getProduct, saveProduct } from '../storage/productStorage';
import { colors, fonts, radius, shadow } from '../theme/theme';
import { getBusinessProfile } from '../storage/businessProfileStorage';
import { getBusinessPreset } from '../config/businessTypes';
import { useLanguage } from '../i18n/LanguageContext';
import GlassBackButton from '../components/GlassBackButton';
import { SafeAreaView } from 'react-native-safe-area-context';

type Props = NativeStackScreenProps<RootStackParamList, 'ProductForm'>;

export default function ProductFormScreen({ navigation, route }: Props) {
  const { t } = useLanguage();
  const productId = route.params?.productId;
  const isEditing = !!productId;

  const [name, setName] = useState('');
  const [defaultPrice, setDefaultPrice] = useState('');
  const [unit, setUnit] = useState<ProductUnit>('pcs');
  const [stockQty, setStockQty] = useState('');
  const [lowStockThreshold, setLowStockThreshold] = useState('');
  const [hsnCode, setHsnCode] = useState('');
  const [taxRate, setTaxRate] = useState<GSTRate>(0);
  const [barcode, setBarcode] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    navigation.setOptions({
      title: isEditing ? t('products.editProduct') : t('products.addProductBtn'),
    });
  }, [isEditing, navigation, t]);

  useEffect(() => {
    getBusinessProfile().then((profile) => {
      const preset = getBusinessPreset(profile.businessType);
      if (!productId && preset.defaultUnit) {
        const matchedUnit = preset.defaultUnit.toLowerCase() as ProductUnit;
        if (PRODUCT_UNITS.includes(matchedUnit)) {
          setUnit(matchedUnit);
        }
      }
    });

    if (productId) {
      getProduct(productId).then((p) => {
        if (!p) return;
        setName(p.name);
        setDefaultPrice(String(p.defaultPrice));
        setUnit(p.unit || 'pcs');
        setStockQty(p.stockQty !== undefined ? String(p.stockQty) : '');
        setLowStockThreshold(p.lowStockThreshold !== undefined ? String(p.lowStockThreshold) : '');
        setHsnCode(p.hsnCode || '');
        setTaxRate(p.taxRate || 0);
        setBarcode(p.barcode || '');
      });
    }
  }, [productId]);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Name required', 'Please enter product name.');
      return;
    }
    const price = parseFloat(defaultPrice);
    if (isNaN(price) || price < 0) {
      Alert.alert('Price required', 'Please enter a valid price.');
      return;
    }

    setSaving(true);
    await saveProduct({
      id: productId,
      name: name.trim(),
      defaultPrice: price,
      unit,
      stockQty: stockQty ? parseInt(stockQty, 10) : undefined,
      lowStockThreshold: lowStockThreshold ? parseInt(lowStockThreshold, 10) : undefined,
      hsnCode: hsnCode.trim() || undefined,
      taxRate: taxRate || undefined,
      barcode: barcode.trim() || undefined,
    });
    setSaving(false);
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {/* Top Header Bar Aligned Directly Above Card Container */}
          <View style={styles.topHeaderRow}>
            <GlassBackButton label={t('common.back', 'Back')} />
            <View style={styles.topHeaderTitleWrap}>
              <Text style={styles.topHeaderTitle}>
                {isEditing ? t('products.editProduct', 'Edit Product') : t('products.addProductBtn', 'Add Product')}
              </Text>
            </View>
          </View>

          <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Ionicons name="pricetag-outline" size={18} color={colors.duskDeep} />
            <Text style={styles.sectionTitle}>{t('products.productDetailsTitle')}</Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{t('products.productName')} *</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Silk Scarf, Cotton T-Shirt"
              placeholderTextColor={colors.inkSoft}
              autoFocus={!isEditing}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{t('products.price')} (₹) *</Text>
            <TextInput
              style={styles.input}
              value={defaultPrice}
              onChangeText={(v) => setDefaultPrice(v.replace(/^0+(?=\d)/, ''))}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={colors.inkSoft}
              selectTextOnFocus
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{t('products.unit')}</Text>
            <View style={styles.chipRow}>
              {PRODUCT_UNITS.map((u) => {
                const active = u === unit;
                return (
                  <Pressable
                    key={u}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setUnit(u)}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{u}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>

        {/* Stock Management Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Ionicons name="cube-outline" size={18} color={colors.inflow} />
            <Text style={styles.sectionTitle}>{t('products.stockTitle', 'Stock / Inventory')}</Text>
          </View>

          <View style={styles.row}>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>{t('products.stockQty', 'Current Stock')}</Text>
              <TextInput
                style={styles.input}
                value={stockQty}
                onChangeText={setStockQty}
                keyboardType="numeric"
                placeholder="e.g. 100"
                placeholderTextColor={colors.inkSoft}
              />
            </View>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>{t('products.lowStockAlert', 'Low Stock Alert')}</Text>
              <TextInput
                style={styles.input}
                value={lowStockThreshold}
                onChangeText={setLowStockThreshold}
                keyboardType="numeric"
                placeholder="e.g. 10"
                placeholderTextColor={colors.inkSoft}
              />
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{t('products.barcode', 'Barcode / SKU')}</Text>
            <TextInput
              style={styles.input}
              value={barcode}
              onChangeText={setBarcode}
              placeholder="Scan or enter barcode"
              placeholderTextColor={colors.inkSoft}
            />
          </View>
        </View>

        {/* GST Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Ionicons name="receipt-outline" size={18} color={colors.clayDeep} />
            <Text style={styles.sectionTitle}>{t('products.gstTitle', 'GST Details')}</Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{t('products.hsnCode', 'HSN / SAC Code')}</Text>
            <TextInput
              style={styles.input}
              value={hsnCode}
              onChangeText={setHsnCode}
              placeholder="e.g. 6106"
              placeholderTextColor={colors.inkSoft}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{t('products.taxRate', 'Default GST Rate')}</Text>
            <View style={styles.chipRow}>
              {GST_RATES.map((rate) => {
                const active = rate === taxRate;
                return (
                  <Pressable
                    key={rate}
                    style={[styles.chip, active && styles.chipActiveGst]}
                    onPress={() => setTaxRate(rate)}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{rate}%</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [styles.saveBtn, saving && { opacity: 0.6 }, pressed && { opacity: 0.85 }]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.saveBtnText}>
            {saving ? t('common.loading') : isEditing ? t('common.update') : t('products.saveProductBtn')}
          </Text>
        </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  content: {
    padding: 20,
    paddingBottom: 60,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center' as any,
  },
  topHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
    paddingTop: Platform.select({ web: 6, default: 4 }),
  },
  topHeaderTitleWrap: {
    flex: 1,
  },
  topHeaderTitle: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.ink,
    lineHeight: 26,
  },
  section: {
    backgroundColor: colors.paperCard,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 16,
    marginBottom: 16,
    ...shadow.card,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  sectionTitle: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.clayDeep,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  field: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.inkSoft,
    marginBottom: 4,
  },
  input: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.ink,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    borderStyle: 'dashed' as any,
    paddingVertical: 6,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: colors.paper,
  },
  chipActive: {
    backgroundColor: colors.duskDeep,
    borderColor: colors.duskDeep,
  },
  chipActiveGst: {
    backgroundColor: colors.clayDeep,
    borderColor: colors.clayDeep,
  },
  chipText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.ink,
  },
  chipTextActive: {
    color: colors.white,
    fontFamily: fonts.bodyBold,
  },
  saveBtn: {
    backgroundColor: colors.duskDeep,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
    ...shadow.card,
  },
  saveBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    color: colors.white,
  },
});

