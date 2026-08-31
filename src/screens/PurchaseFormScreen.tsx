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
import { Purchase, PurchaseItem, PurchaseStatus } from '../types/purchase';
import { getPurchase, savePurchase, nextPurchaseNumber } from '../storage/purchaseStorage';
import { adjustStockByName } from '../storage/productStorage';
import { generateId } from '../utils/id';
import { formatCurrency, todayIso } from '../utils/format';
import { colors, fonts, radius, shadow } from '../theme/theme';
import { useLanguage } from '../i18n/LanguageContext';

type Props = NativeStackScreenProps<RootStackParamList, 'PurchaseForm'>;

const PAYMENT_METHODS = ['Cash', 'UPI', 'Card', 'Bank Transfer'];
const PAYMENT_STATUSES: PurchaseStatus[] = ['Pending', 'Partial', 'Paid'];

function emptyItem(): PurchaseItem {
  return { id: generateId('pitm_'), name: '', qty: 1, price: 0 };
}

export default function PurchaseFormScreen({ navigation, route }: Props) {
  const { t } = useLanguage();
  const editingId = route.params?.purchaseId;
  const isEditing = !!editingId;

  const [purchaseNumber, setPurchaseNumber] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [supplierPhone, setSupplierPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [paymentStatus, setPaymentStatus] = useState<PurchaseStatus>('Pending');
  const [amountPaid, setAmountPaid] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<PurchaseItem[]>([emptyItem(), emptyItem(), emptyItem()]);
  const [saving, setSaving] = useState(false);
  const [isNewPurchase, setIsNewPurchase] = useState(true);

  useEffect(() => {
    navigation.setOptions({
      title: isEditing ? t('purchases.editTitle', 'Edit Purchase') : t('purchases.newTitle', 'New Purchase'),
    });
  }, [isEditing, navigation, t]);

  useEffect(() => {
    if (editingId) {
      setIsNewPurchase(false);
      getPurchase(editingId).then((p) => {
        if (!p) return;
        setPurchaseNumber(p.purchaseNumber);
        setSupplierName(p.supplierName);
        setSupplierPhone(p.supplierPhone || '');
        setPaymentMethod(p.paymentMethod);
        setPaymentStatus(p.paymentStatus);
        setAmountPaid(String(p.amountPaid));
        setNotes(p.notes || '');
        setItems(p.items.length > 0 ? p.items : [emptyItem()]);
      });
    } else {
      nextPurchaseNumber().then(setPurchaseNumber);
    }
  }, [editingId]);

  const total = items.reduce((sum, item) => {
    const name = item.name?.trim();
    if (!name) return sum;
    return sum + (item.qty || 0) * (item.price || 0);
  }, 0);

  const updateItem = (index: number, field: keyof PurchaseItem, value: any) => {
    setItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const addItemRow = () => {
    setItems((prev) => [...prev, emptyItem()]);
  };

  const removeItem = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!supplierName.trim()) {
      Alert.alert('Required', 'Please enter supplier name.');
      return;
    }

    const validItems = items.filter((item) => item.name.trim());
    if (validItems.length === 0) {
      Alert.alert('Required', 'Please add at least one item.');
      return;
    }

    setSaving(true);
    try {
      const purchase = await savePurchase({
        id: editingId,
        purchaseNumber,
        purchaseDate: todayIso(),
        supplierName: supplierName.trim(),
        supplierPhone: supplierPhone.trim() || undefined,
        items: validItems,
        paymentStatus,
        paymentMethod,
        amountPaid: parseFloat(amountPaid) || 0,
        notes: notes.trim() || undefined,
      });

      // Auto-increase stock for purchased items (only for new purchases)
      if (isNewPurchase) {
        for (const item of validItems) {
          if (item.name.trim()) {
            await adjustStockByName(item.name.trim(), item.qty);
          }
        }
      }

      navigation.goBack();
    } catch (err) {
      Alert.alert('Error', 'Failed to save purchase.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {/* Supplier Details */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Ionicons name="business-outline" size={18} color={colors.duskDeep} />
            <Text style={styles.sectionTitle}>{t('purchases.supplierDetails', 'Supplier Details')}</Text>
          </View>

          <View style={styles.row}>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>{t('purchases.purchaseNo', 'Purchase #')}</Text>
              <TextInput style={[styles.input, styles.readOnlyInput]} value={purchaseNumber} editable={false} />
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{t('purchases.supplierName', 'Supplier Name')} *</Text>
            <TextInput
              style={styles.input}
              value={supplierName}
              onChangeText={setSupplierName}
              placeholder="e.g. ABC Textiles"
              placeholderTextColor={colors.inkSoft}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{t('purchases.supplierPhone', 'Phone')}</Text>
            <TextInput
              style={styles.input}
              value={supplierPhone}
              onChangeText={setSupplierPhone}
              placeholder="Phone number"
              placeholderTextColor={colors.inkSoft}
              keyboardType="phone-pad"
            />
          </View>
        </View>

        {/* Items */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Ionicons name="list-outline" size={18} color={colors.duskDeep} />
            <Text style={styles.sectionTitle}>{t('purchases.items', 'Items')}</Text>
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
            <Ionicons name="add-circle-outline" size={18} color={colors.duskDeep} />
            <Text style={styles.addItemText}>{t('purchases.addItem', 'Add Item')}</Text>
          </Pressable>

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>{t('purchases.total', 'Total')}</Text>
            <Text style={styles.totalValue}>{formatCurrency(total)}</Text>
          </View>
        </View>

        {/* Payment */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Ionicons name="card-outline" size={18} color={colors.duskDeep} />
            <Text style={styles.sectionTitle}>{t('purchases.payment', 'Payment')}</Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{t('purchases.paymentStatus', 'Payment Status')}</Text>
            <View style={styles.chipRow}>
              {PAYMENT_STATUSES.map((s) => (
                <Pressable
                  key={s}
                  style={[styles.chip, paymentStatus === s && styles.chipActive]}
                  onPress={() => setPaymentStatus(s)}
                >
                  <Text style={[styles.chipText, paymentStatus === s && styles.chipTextActive]}>{s}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{t('purchases.paymentMethod', 'Payment Method')}</Text>
            <View style={styles.chipRow}>
              {PAYMENT_METHODS.map((m) => (
                <Pressable
                  key={m}
                  style={[styles.chip, paymentMethod === m && styles.chipActive]}
                  onPress={() => setPaymentMethod(m)}
                >
                  <Text style={[styles.chipText, paymentMethod === m && styles.chipTextActive]}>{m}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{t('purchases.amountPaid', 'Amount Paid')} (₹)</Text>
            <TextInput
              style={styles.input}
              value={amountPaid}
              onChangeText={(v) => setAmountPaid(v.replace(/^0+(?=\d)/, ''))}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={colors.inkSoft}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{t('purchases.notes', 'Notes')}</Text>
            <TextInput
              style={[styles.input, { minHeight: 50 }]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Any notes..."
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
            {saving ? t('common.loading', 'Saving...') : isEditing ? t('common.update', 'Update') : t('purchases.saveBtn', 'Save Purchase')}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.paper },
  content: { padding: 20, paddingBottom: 60, width: '100%', maxWidth: 720, alignSelf: 'center' as any },
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
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: colors.paper,
  },
  chipActive: { backgroundColor: colors.duskDeep, borderColor: colors.duskDeep },
  chipText: { fontFamily: fonts.body, fontSize: 13, color: colors.ink },
  chipTextActive: { color: colors.white, fontFamily: fonts.bodyBold },
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
  itemAmount: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.duskDeep, paddingVertical: 6 },
  addItemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  addItemText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.duskDeep },
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
    backgroundColor: colors.duskDeep,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
    ...shadow.card,
  },
  saveBtnText: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.white },
});
