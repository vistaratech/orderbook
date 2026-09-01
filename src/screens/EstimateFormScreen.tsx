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
import { Estimate, EstimateStatus } from '../types/estimate';
import { OrderItem } from '../types/order';
import { getEstimate, saveEstimate, nextEstimateNumber } from '../storage/estimateStorage';
import { getCustomers } from '../storage/customerStorage';
import { getProducts } from '../storage/productStorage';
import { Customer, Product } from '../types/order';
import { generateId } from '../utils/id';
import { formatCurrency, formatDate, todayIso } from '../utils/format';
import { colors, fonts, radius, shadow } from '../theme/theme';
import { useLanguage } from '../i18n/LanguageContext';
import GlassBackButton from '../components/GlassBackButton';
import { SafeAreaView } from 'react-native-safe-area-context';

type Props = NativeStackScreenProps<RootStackParamList, 'EstimateForm'>;

const ESTIMATE_STATUSES: EstimateStatus[] = ['Draft', 'Sent', 'Accepted', 'Rejected'];

function emptyItem(): OrderItem {
  return { id: generateId('eitm_'), name: '', qty: 1, price: 0 };
}

export default function EstimateFormScreen({ navigation, route }: Props) {
  const { t } = useLanguage();
  const editingId = route.params?.estimateId;
  const isEditing = !!editingId;

  const [estimateNumber, setEstimateNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [customerNote, setCustomerNote] = useState('');
  const [status, setStatus] = useState<EstimateStatus>('Draft');
  const [items, setItems] = useState<OrderItem[]>([emptyItem(), emptyItem(), emptyItem()]);
  const [saving, setSaving] = useState(false);

  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);

  useEffect(() => {
    navigation.setOptions({
      title: isEditing ? t('estimates.editTitle', 'Edit Estimate') : t('estimates.newTitle', 'New Estimate'),
    });
  }, [isEditing, navigation, t]);

  useEffect(() => {
    getCustomers().then(setAllCustomers);
    getProducts().then(setAllProducts);

    if (editingId) {
      getEstimate(editingId).then((e) => {
        if (!e) return;
        setEstimateNumber(e.estimateNumber);
        setCustomerName(e.customerName);
        setPhoneNumber(e.phoneNumber);
        setValidUntil(e.validUntil || '');
        setCustomerNote(e.customerNote || '');
        setStatus(e.status);
        setItems(e.items.length > 0 ? e.items : [emptyItem()]);
      });
    } else {
      nextEstimateNumber().then(setEstimateNumber);
    }
  }, [editingId]);

  const total = items.reduce((sum, item) => {
    if (!item.name?.trim()) return sum;
    return sum + (item.qty || 0) * (item.price || 0);
  }, 0);

  const updateItem = (index: number, field: keyof OrderItem, value: any) => {
    setItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };

      // Auto-fill price from product catalog
      if (field === 'name' && value) {
        const match = allProducts.find(
          (p) => p.name.toLowerCase() === value.toLowerCase().trim()
        );
        if (match) {
          updated[index].price = match.defaultPrice;
          updated[index].unit = match.unit;
        }
      }
      return updated;
    });
  };

  const addItemRow = () => setItems((prev) => [...prev, emptyItem()]);

  const removeItem = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!customerName.trim()) {
      Alert.alert('Required', 'Please enter customer name.');
      return;
    }
    const validItems = items.filter((item) => item.name.trim());
    if (validItems.length === 0) {
      Alert.alert('Required', 'Please add at least one item.');
      return;
    }

    setSaving(true);
    try {
      await saveEstimate({
        id: editingId,
        estimateNumber,
        estimateDate: todayIso(),
        validUntil: validUntil || undefined,
        customerName: customerName.trim(),
        phoneNumber: phoneNumber.trim(),
        items: validItems,
        customerNote: customerNote.trim() || undefined,
        status,
      });
      navigation.goBack();
    } catch (err) {
      Alert.alert('Error', 'Failed to save estimate.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {/* Top Header Row Aligned Directly Above Card Container */}
          <View style={styles.topHeaderRow}>
            <GlassBackButton label={t('common.back', 'Back')} />
            <View style={styles.topHeaderTitleWrap}>
              <Text style={styles.topHeaderTitle}>
                {isEditing ? t('estimates.editTitle', 'Edit Estimate') : t('estimates.newTitle', 'New Estimate')}
              </Text>
              {estimateNumber ? <Text style={styles.topHeaderSub}>{estimateNumber}</Text> : null}
            </View>
          </View>

          {/* Customer Details */}
          <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Ionicons name="person-outline" size={18} color={colors.clayDeep} />
            <Text style={styles.sectionTitle}>{t('estimates.customerDetails', 'Customer Details')}</Text>
          </View>

          <View style={styles.row}>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>Estimate #</Text>
              <TextInput style={[styles.input, styles.readOnlyInput]} value={estimateNumber} editable={false} />
            </View>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>Status</Text>
              <View style={styles.chipRow}>
                {ESTIMATE_STATUSES.map((s) => (
                  <Pressable key={s} style={[styles.miniChip, status === s && styles.miniChipActive]} onPress={() => setStatus(s)}>
                    <Text style={[styles.miniChipText, status === s && styles.miniChipTextActive]}>{s}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Customer Name *</Text>
            <TextInput
              style={styles.input}
              value={customerName}
              onChangeText={(v) => {
                setCustomerName(v);
                const match = allCustomers.find((c) => c.name.toLowerCase() === v.toLowerCase().trim());
                if (match && match.phone) setPhoneNumber(match.phone);
              }}
              placeholder="Customer name"
              placeholderTextColor={colors.inkSoft}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Phone</Text>
            <TextInput
              style={styles.input}
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              placeholder="Phone number"
              placeholderTextColor={colors.inkSoft}
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Valid Until</Text>
            <TextInput
              style={styles.input}
              value={validUntil}
              onChangeText={setValidUntil}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.inkSoft}
            />
          </View>
        </View>

        {/* Items */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Ionicons name="list-outline" size={18} color={colors.clayDeep} />
            <Text style={styles.sectionTitle}>{t('estimates.items', 'Items')}</Text>
          </View>

          {items.map((item, index) => (
            <View key={item.id} style={styles.itemRow}>
              <View style={styles.itemHeader}>
                <Text style={styles.itemNum}>#{index + 1}</Text>
                {items.length > 1 && (
                  <Pressable onPress={() => removeItem(index)}>
                    <Ionicons name="close-circle" size={20} color={colors.danger} />
                  </Pressable>
                )}
              </View>
              <TextInput
                style={styles.input}
                value={item.name}
                onChangeText={(v) => updateItem(index, 'name', v)}
                placeholder="Item name"
                placeholderTextColor={colors.inkSoft}
              />
              <View style={styles.qtyPriceRow}>
                <View style={[styles.field, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>Qty</Text>
                  <TextInput
                    style={styles.input}
                    value={String(item.qty)}
                    onChangeText={(v) => updateItem(index, 'qty', parseInt(v) || 0)}
                    keyboardType="numeric"
                  />
                </View>
                <View style={[styles.field, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>Price (₹)</Text>
                  <TextInput
                    style={styles.input}
                    value={item.price ? String(item.price) : ''}
                    onChangeText={(v) => updateItem(index, 'price', parseFloat(v) || 0)}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={[styles.field, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>Amount</Text>
                  <Text style={styles.itemAmount}>{formatCurrency(item.qty * item.price)}</Text>
                </View>
              </View>
            </View>
          ))}

          <Pressable style={({ pressed }) => [styles.addItemBtn, pressed && { opacity: 0.7 }]} onPress={addItemRow}>
            <Ionicons name="add-circle-outline" size={18} color={colors.clayDeep} />
            <Text style={styles.addItemText}>Add Item</Text>
          </Pressable>

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{formatCurrency(total)}</Text>
          </View>
        </View>

        {/* Notes */}
        <View style={styles.section}>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Notes</Text>
            <TextInput
              style={[styles.input, { minHeight: 50 }]}
              value={customerNote}
              onChangeText={setCustomerNote}
              placeholder="Terms, conditions, notes..."
              placeholderTextColor={colors.inkSoft}
              multiline
            />
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [styles.saveBtn, saving && { opacity: 0.6 }, pressed && { opacity: 0.85 }]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.saveBtnText}>
            {saving ? 'Saving...' : isEditing ? 'Update Estimate' : 'Save Estimate'}
          </Text>
        </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.paper },
  content: { padding: 20, paddingBottom: 60, width: '100%', maxWidth: 720, alignSelf: 'center' as any },
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
  topHeaderSub: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.inkSoft,
    marginTop: 1,
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
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  sectionTitle: { fontFamily: fonts.display, fontSize: 22, color: colors.clayDeep },
  row: { flexDirection: 'row', gap: 12 },
  field: { marginBottom: 14 },
  fieldLabel: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.inkSoft, marginBottom: 4 },
  input: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.ink,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    borderStyle: 'dashed' as any,
    paddingVertical: 6,
  },
  readOnlyInput: { color: colors.inkSoft, backgroundColor: colors.paper },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  miniChip: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: colors.paper,
  },
  miniChipActive: { backgroundColor: colors.clayDeep, borderColor: colors.clayDeep },
  miniChipText: { fontFamily: fonts.body, fontSize: 11, color: colors.ink },
  miniChipTextActive: { color: colors.white, fontFamily: fonts.bodyBold },
  itemRow: {
    backgroundColor: colors.paper,
    borderRadius: radius.sm,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.line,
  },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  itemNum: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.inkSoft },
  qtyPriceRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  itemAmount: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.clayDeep, paddingVertical: 6 },
  addItemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  addItemText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.clayDeep },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 2,
    borderTopColor: colors.clayDeep,
    marginTop: 8,
  },
  totalLabel: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.ink },
  totalValue: { fontFamily: fonts.bodyBold, fontSize: 18, color: colors.clayDeep },
  saveBtn: {
    backgroundColor: colors.clayDeep,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
    ...shadow.card,
  },
  saveBtnText: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.white },
});
