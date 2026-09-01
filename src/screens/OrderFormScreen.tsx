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
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { Order, OrderItem, OrderStatus, PaymentStatus, Customer, Product, CustomColumn } from '../types/order';
import { getOrder, saveOrder, nextOrderNumber } from '../storage/orderStorage';
import { getCustomers, saveCustomer } from '../storage/customerStorage';
import { getProducts, saveProduct } from '../storage/productStorage';
import { generateId } from '../utils/id';
import { formatCurrency, formatDate, todayIso } from '../utils/format';
import { colors, fonts, radius, shadow } from '../theme/theme';
import StatusTracker from '../components/StatusTracker';
import { getBusinessProfile } from '../storage/businessProfileStorage';
import { getBusinessPreset } from '../config/businessTypes';
import { useLanguage } from '../i18n/LanguageContext';
import GlassBackButton from '../components/GlassBackButton';
import { SafeAreaView } from 'react-native-safe-area-context';

type Props = NativeStackScreenProps<RootStackParamList, 'OrderForm'>;

const PAYMENT_METHODS = ['Cash', 'UPI', 'Card', 'Bank Transfer'];
const DISPATCH_METHODS = ['Courier', 'Self Pickup', 'Local Delivery'];
const PAYMENT_STATUSES: PaymentStatus[] = ['Pending', 'Partial', 'Paid'];

function emptyItem(): OrderItem {
  return { id: generateId('itm_'), name: '', qty: 1, price: 0 };
}

function defaultFiveItems(): OrderItem[] {
  return [emptyItem(), emptyItem(), emptyItem(), emptyItem(), emptyItem()];
}

export default function OrderFormScreen({ navigation, route }: Props) {
  const { t } = useLanguage();
  const editingId = route.params?.orderId;
  const prefillName = route.params?.prefillCustomerName;
  const prefillPhone = route.params?.prefillPhone;
  const isEditing = !!editingId;

  const [orderId, setOrderId] = useState<string | undefined>(editingId);
  const [orderNumber, setOrderNumber] = useState('');
  const [orderDate, setOrderDate] = useState(formatDate(todayIso()));
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('Pending');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [customerName, setCustomerName] = useState(prefillName || '');
  const [phoneNumber, setPhoneNumber] = useState(prefillPhone || '');
  const [dispatchMethod, setDispatchMethod] = useState('Courier');
  const [dispatchDate, setDispatchDate] = useState('');
  const [customColumns, setCustomColumns] = useState<CustomColumn[]>([]);
  const [showColumnModal, setShowColumnModal] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');
  const [items, setItems] = useState<OrderItem[]>(defaultFiveItems);
  const [customerNote, setCustomerNote] = useState('');
  const [advance, setAdvance] = useState('');
  const [status, setStatus] = useState<OrderStatus>('Placed');
  const [saving, setSaving] = useState(false);
  const [defaultUnit, setDefaultUnit] = useState('Pcs');

  // Autocomplete data
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);

  useEffect(() => {
    navigation.setOptions({ title: isEditing ? t('orders.editOrderTitle') : t('orders.newOrderTitle') });
  }, [isEditing, navigation, t]);

  useEffect(() => {
    // Load catalog and customer list for suggestions
    getCustomers().then(setAllCustomers);
    getProducts().then(setAllProducts);
    getBusinessProfile().then((profile) => {
      const preset = getBusinessPreset(profile.businessType);
      setDefaultUnit(preset.defaultUnit);
    });

    if (editingId) {
      getOrder(editingId).then((order) => {
        if (!order) return;
        setOrderNumber(order.orderNumber);
        setOrderDate(order.orderDate);
        setPaymentMethod(order.paymentMethod);
        setPaymentStatus(order.paymentStatus);
        setTrackingNumber(order.trackingNumber || '');
        setCustomerName(order.customerName);
        setPhoneNumber(order.phoneNumber);
        setDispatchMethod(order.dispatchMethod || '');
        setDispatchDate(order.dispatchDate || '');
        setCustomColumns(order.customColumns || []);
        setItems(order.items.length ? order.items : defaultFiveItems());
        setCustomerNote(order.customerNote || '');
        setAdvance(order.advance ? String(order.advance) : '');
        setStatus(order.status);
      });
    } else {
      nextOrderNumber().then(setOrderNumber);
    }
  }, [editingId]);

  const total = items.reduce((sum, it) => sum + (it.qty || 0) * (it.price || 0), 0);
  const advanceNum = parseFloat(advance) || 0;
  const balance = total - advanceNum;

  // Auto-set payment status based on advance vs total
  useEffect(() => {
    if (!isEditing) {
      if (total > 0 && advanceNum >= total) {
        setPaymentStatus('Paid');
      } else if (advanceNum > 0 && advanceNum < total) {
        setPaymentStatus('Partial');
      } else if (advanceNum === 0) {
        setPaymentStatus('Pending');
      }
    }
  }, [advanceNum, total, isEditing]);

  const updateItem = (id: string, patch: Partial<OrderItem>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  };

  const addItem = () => setItems((prev) => [...prev, emptyItem()]);

  const removeItem = (id: string) => {
    setItems((prev) => (prev.length > 1 ? prev.filter((it) => it.id !== id) : prev));
  };

  const handleAddColumn = (nameToAdd?: string) => {
    const name = (nameToAdd || newColumnName).trim();
    if (!name) return;
    const exists = customColumns.some((c) => c.name.toLowerCase() === name.toLowerCase());
    if (exists) {
      Alert.alert('Column already exists', `"${name}" column is already added.`);
      return;
    }
    const newCol: CustomColumn = {
      id: generateId('col_'),
      name,
      type: 'text',
    };
    setCustomColumns((prev) => [...prev, newCol]);
    setNewColumnName('');
    setShowColumnModal(false);
  };

  const handleRemoveColumn = (colId: string) => {
    setCustomColumns((prev) => prev.filter((c) => c.id !== colId));
  };

  const updateItemCustomValue = (itemId: string, colId: string, colName: string, value: string) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== itemId) return it;
        const updatedCustom = { ...(it.customValues || {}), [colId]: value };
        const patch: Partial<OrderItem> = { customValues: updatedCustom };
        if (colName.toLowerCase() === 'unit') {
          patch.unit = value;
        }
        if (colName.toLowerCase() === 'discount') {
          patch.discount = parseFloat(value) || 0;
        }
        if (colName.toLowerCase().includes('tax') || colName.toLowerCase().includes('gst')) {
          patch.tax = parseFloat(value) || 0;
        }
        return { ...it, ...patch };
      })
    );
  };

  const handleSelectCustomer = (c: Customer) => {
    setCustomerName(c.name);
    if (c.phone) setPhoneNumber(c.phone);
  };

  const handleSelectProduct = (itemId: string, p: Product) => {
    updateItem(itemId, { name: p.name, price: p.defaultPrice });
  };

  // Filtered customer suggestions
  const customerSuggestions =
    customerName.trim().length > 0 && !allCustomers.some((c) => c.name.toLowerCase() === customerName.toLowerCase())
      ? allCustomers.filter((c) =>
          c.name.toLowerCase().includes(customerName.toLowerCase().trim())
        ).slice(0, 3)
      : [];

  const handleSave = async () => {
    if (!customerName.trim()) {
      Alert.alert(t('common.required'), t('orders.customerName'));
      return;
    }
    const cleanItems = items
      .map((it) => ({ ...it, name: it.name.trim() }))
      .filter((it) => it.name.length > 0);
    if (cleanItems.length === 0) {
      Alert.alert(t('common.required'), t('orders.items'));
      return;
    }

    setSaving(true);

    // Auto-save customer if new or updated
    try {
      const existing = allCustomers.find(
        (c) => c.name.toLowerCase() === customerName.trim().toLowerCase()
      );
      if (!existing) {
        await saveCustomer({
          name: customerName.trim(),
          phone: phoneNumber.trim(),
        });
      } else if (phoneNumber.trim() && !existing.phone) {
        await saveCustomer({
          ...existing,
          phone: phoneNumber.trim(),
        });
      }
    } catch {}

    // Auto-save any new item to catalog
    try {
      for (const it of cleanItems) {
        const hasProd = allProducts.some(
          (p) => p.name.toLowerCase() === it.name.toLowerCase()
        );
        if (!hasProd && it.price > 0) {
          await saveProduct({
            name: it.name,
            defaultPrice: it.price,
            unit: 'pcs',
          });
        }
      }
    } catch {}

    const saved = await saveOrder({
      id: orderId,
      orderNumber,
      orderDate,
      paymentMethod,
      paymentStatus,
      trackingNumber: trackingNumber.trim() || undefined,
      customerName: customerName.trim(),
      phoneNumber: phoneNumber.trim(),
      dispatchMethod: dispatchMethod.trim() || undefined,
      dispatchDate: dispatchDate.trim() || undefined,
      customColumns: customColumns.length > 0 ? customColumns : undefined,
      items: cleanItems,
      customerNote: customerNote.trim() || undefined,
      advance: advanceNum,
      status,
    });

    setSaving(false);
    setOrderId(saved.id);
    navigation.replace('OrderDetail', { orderId: saved.id });
  };

  const getPaymentMethodLabel = (m: string) => {
    switch (m) {
      case 'Cash':
        return t('orders.methodCash');
      case 'UPI':
        return t('orders.methodUpi');
      case 'Card':
        return t('orders.methodCard');
      case 'Bank Transfer':
        return t('orders.methodBankTransfer');
      default:
        return m;
    }
  };

  const getPaymentStatusLabel = (s: string) => {
    switch (s) {
      case 'Paid':
        return t('orders.payPaid');
      case 'Partial':
        return t('orders.payPartial');
      case 'Pending':
        return t('orders.payPending');
      default:
        return s;
    }
  };

  const getDispatchMethodLabel = (d: string) => {
    switch (d) {
      case 'Courier':
        return t('orders.methodCourier');
      case 'Self Pickup':
        return t('orders.methodSelfPickup');
      case 'Local Delivery':
        return t('orders.methodLocalDelivery');
      default:
        return d;
    }
  };

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Top Header Bar Aligned Directly Above Card Container */}
          <View style={styles.topHeaderRow}>
            <GlassBackButton label={t('common.back', 'Back')} />
            <View style={styles.topHeaderTitleWrap}>
              <Text style={styles.topHeaderTitle}>
                {isEditing ? t('orders.editOrderTitle', 'Edit Order') : t('orders.newOrderTitle', 'New Order')}
              </Text>
              {orderNumber ? <Text style={styles.topHeaderSub}>{orderNumber}</Text> : null}
            </View>
          </View>

          <Section title={t('orders.customerInfo')} icon="person-outline">
          <Field label={t('orders.customerName') + ' *'}>
            <TextInput
              style={styles.input}
              value={customerName}
              onChangeText={setCustomerName}
              placeholder={t('orders.customerName')}
              placeholderTextColor={colors.inkSoft}
            />
          </Field>
          {customerSuggestions.length > 0 && (
            <View style={styles.suggestionRow}>
              <Text style={styles.suggestionLabel}>{t('orders.suggested')}</Text>
              {customerSuggestions.map((c) => (
                <Pressable
                  key={c.id}
                  style={styles.suggestionChip}
                  onPress={() => handleSelectCustomer(c)}
                >
                  <Text style={styles.suggestionText}>{c.name}</Text>
                </Pressable>
              ))}
            </View>
          )}
          <Field label={t('orders.customerPhone')}>
            <TextInput
              style={styles.input}
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              placeholder={t('orders.customerPhone')}
              placeholderTextColor={colors.inkSoft}
              keyboardType="phone-pad"
            />
          </Field>
        </Section>

        <Section title={t('orders.paymentDetails')} icon="card-outline">
          <Row>
            <Field label={t('orders.orderNumber')} flex={1}>
              <TextInput
                style={styles.input}
                value={orderNumber}
                onChangeText={setOrderNumber}
                placeholder="#0001"
                placeholderTextColor={colors.inkSoft}
              />
            </Field>
            <Field label={t('orders.orderDate')} flex={1}>
              <TextInput
                style={styles.input}
                value={orderDate}
                onChangeText={setOrderDate}
                placeholder={t('orders.orderDate')}
                placeholderTextColor={colors.inkSoft}
              />
            </Field>
          </Row>
          <Field label={t('orders.paymentMethod')}>
            <ChipRow options={PAYMENT_METHODS} value={paymentMethod} onChange={setPaymentMethod} getLabel={getPaymentMethodLabel} />
          </Field>
          <Field label={t('orders.paymentStatus')}>
            <ChipRow options={PAYMENT_STATUSES} value={paymentStatus} onChange={(v) => setPaymentStatus(v as PaymentStatus)} getLabel={getPaymentStatusLabel} />
          </Field>
          <Field label={t('orders.trackingNumber')}>
            <TextInput
              style={styles.input}
              value={trackingNumber}
              onChangeText={setTrackingNumber}
              placeholder={t('orders.trackingPlaceholder')}
              placeholderTextColor={colors.inkSoft}
            />
          </Field>
        </Section>

        <Section title={t('orders.dispatchDetails')} icon="airplane-outline">
          <Field label={t('orders.dispatchMethod')}>
            <ChipRow options={DISPATCH_METHODS} value={dispatchMethod} onChange={setDispatchMethod} getLabel={getDispatchMethodLabel} />
          </Field>
          <Field label={t('orders.dispatchDate')}>
            <TextInput
              style={styles.input}
              value={dispatchDate}
              onChangeText={setDispatchDate}
              placeholder={t('orders.dispatchDatePlaceholder')}
              placeholderTextColor={colors.inkSoft}
            />
          </Field>
        </Section>

        <Section
          title={t('orders.itemsAndProducts')}
          icon="basket-outline"
          rightAction={
            <Pressable
              style={({ pressed }) => [styles.addColumnHeaderBtn, pressed && { opacity: 0.8 }]}
              onPress={() => setShowColumnModal(true)}
            >
              <Ionicons name="add" size={14} color={colors.clayDeep} />
              <Text style={styles.addColumnHeaderBtnText}>{t('orders.addColumn')}</Text>
            </Pressable>
          }
        >
          <View style={styles.itemHeaderRow}>
            <Text style={[styles.itemHeaderCell, { flex: customColumns.length > 0 ? 2.2 : 3 }]}>
              {t('orders.itemName')}
            </Text>
            <Text style={[styles.itemHeaderCell, { flex: 0.9, textAlign: 'center' }]}>
              {t('orders.quantity')} ({defaultUnit})
            </Text>

            {customColumns.map((col) => (
              <View key={col.id} style={[styles.customColHeader, { flex: 1 }]}>
                <Text style={styles.itemHeaderCell} numberOfLines={1}>
                  {col.name}
                </Text>
                <Pressable
                  onPress={() => handleRemoveColumn(col.id)}
                  hitSlop={6}
                  style={styles.removeColBtn}
                >
                  <Ionicons name="close-circle" size={13} color={colors.inkSoft} />
                </Pressable>
              </View>
            ))}

            <Text style={[styles.itemHeaderCell, { flex: 1.1, textAlign: 'right' }]}>
              {t('orders.unitPrice')}
            </Text>
            <View style={{ width: 28 }} />
          </View>

          {items.map((item) => {
            const prodMatches =
              item.name.trim().length > 0 &&
              allProducts.filter((p) =>
                p.name.toLowerCase().includes(item.name.toLowerCase().trim())
              ).slice(0, 2);

            return (
              <View key={item.id} style={styles.itemContainer}>
                <View style={styles.itemRow}>
                  <TextInput
                    style={[styles.itemInput, { flex: customColumns.length > 0 ? 2.2 : 3 }]}
                    value={item.name}
                    onChangeText={(v) => updateItem(item.id, { name: v })}
                    placeholder={t('orders.productNamePlaceholder')}
                    placeholderTextColor={colors.inkSoft}
                  />
                  <TextInput
                    style={[styles.itemInput, { flex: 0.9, textAlign: 'center' }]}
                    value={item.qty === 0 ? '' : String(item.qty)}
                    onChangeText={(v) => {
                      const clean = v.replace(/^0+(?=\d)/, '');
                      updateItem(item.id, { qty: clean === '' ? 0 : parseInt(clean, 10) || 0 });
                    }}
                    placeholder="1"
                    placeholderTextColor={colors.inkSoft}
                    keyboardType="number-pad"
                    selectTextOnFocus
                  />

                  {customColumns.map((col) => {
                    const val =
                      item.customValues?.[col.id] ||
                      (col.name.toLowerCase() === 'unit' && item.unit ? item.unit : '');
                    return (
                      <TextInput
                        key={col.id}
                        style={[styles.itemInput, { flex: 1, textAlign: 'center' }]}
                        value={val}
                        onChangeText={(v) => updateItemCustomValue(item.id, col.id, col.name, v)}
                        placeholder={col.name}
                        placeholderTextColor={colors.inkSoft}
                      />
                    );
                  })}

                  <TextInput
                    style={[styles.itemInput, { flex: 1.1, textAlign: 'right' }]}
                    value={item.price === 0 ? '' : String(item.price)}
                    onChangeText={(v) => {
                      const clean = v.replace(/^0+(?=\d)/, '');
                      updateItem(item.id, { price: clean === '' ? 0 : parseFloat(clean) || 0 });
                    }}
                    placeholder="0"
                    placeholderTextColor={colors.inkSoft}
                    keyboardType="decimal-pad"
                    selectTextOnFocus
                  />
                  <Pressable onPress={() => removeItem(item.id)} style={styles.removeBtn}>
                    <Ionicons name="close-circle" size={20} color={colors.inkSoft} />
                  </Pressable>
                </View>

                {prodMatches && prodMatches.length > 0 && item.price === 0 && (
                  <View style={styles.prodSuggestionRow}>
                    <Text style={styles.suggestionLabel}>{t('orders.catalogSuggestion')}</Text>
                    {prodMatches.map((p) => (
                      <Pressable
                        key={p.id}
                        style={styles.suggestionChip}
                        onPress={() => handleSelectProduct(item.id, p)}
                      >
                        <Text style={styles.suggestionText}>
                          {p.name} ({formatCurrency(p.defaultPrice)})
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>
            );
          })}

          <View style={styles.itemTableActionsRow}>
            <Pressable style={styles.addItemBtn} onPress={addItem}>
              <Ionicons name="add-circle" size={18} color={colors.clayDeep} />
              <Text style={styles.addItemText}>{t('orders.addAnotherItem')}</Text>
            </Pressable>

            <Pressable
              style={styles.addColSecondaryBtn}
              onPress={() => setShowColumnModal(true)}
            >
              <Ionicons name="grid-outline" size={15} color={colors.clayDeep} />
              <Text style={styles.addColSecondaryText}>+ {t('orders.addColumn')}</Text>
            </Pressable>
          </View>
        </Section>

        <Section title={t('orders.customerNote')} icon="document-text-outline">
          <TextInput
            style={[styles.input, styles.noteInput]}
            value={customerNote}
            onChangeText={setCustomerNote}
            placeholder={t('orders.notePlaceholder')}
            placeholderTextColor={colors.inkSoft}
            multiline
          />
        </Section>

        <Section title={t('orders.paymentSummary')} icon="wallet-outline">
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t('orders.totalBill')}</Text>
            <Text style={styles.summaryValue}>{formatCurrency(total)}</Text>
          </View>
          <Field label={t('orders.advanceReceived')}>
            <TextInput
              style={styles.input}
              value={advance}
              onChangeText={(v) => setAdvance(v.replace(/^0+(?=\d)/, ''))}
              placeholder="0"
              placeholderTextColor={colors.inkSoft}
              keyboardType="decimal-pad"
              selectTextOnFocus
            />
          </Field>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t('orders.balancePending')}</Text>
            <Text style={[styles.summaryValue, balance > 0 && { color: colors.danger }]}>
              {formatCurrency(balance)}
            </Text>
          </View>
        </Section>

        <Section title={t('orders.orderStatus')} icon="git-commit-outline">
          <StatusTracker status={status} onChange={setStatus} />
        </Section>

        <Pressable
          style={({ pressed }) => [styles.saveBtn, saving && { opacity: 0.6 }, pressed && { opacity: 0.85 }]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.saveBtnText}>{saving ? t('orders.savingOrder') : t('orders.saveOrderBtn')}</Text>
        </Pressable>
      </ScrollView>

      {/* ─── Add Column Modal ─── */}
      <Modal
        visible={showColumnModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowColumnModal(false)}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.modalCenterWrap}
          >
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <View style={styles.modalIconWrap}>
                  <Ionicons name="grid-outline" size={20} color={colors.clayDeep} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalTitle}>{t('orders.addColumnTitle')}</Text>
                  <Text style={styles.modalSub}>{t('orders.quickSuggestions')}</Text>
                </View>
                <Pressable
                  onPress={() => setShowColumnModal(false)}
                  style={styles.modalCloseBtn}
                  hitSlop={8}
                >
                  <Ionicons name="close" size={20} color={colors.inkSoft} />
                </Pressable>
              </View>

              {/* Quick Presets Chips */}
              <View style={styles.presetChipsContainer}>
                {[
                  { name: 'Unit', label: 'Unit / அலகு', icon: 'pricetag-outline' },
                  { name: 'Size', label: 'Size / அளவு', icon: 'resize-outline' },
                  { name: 'Color', label: 'Color / நிறம்', icon: 'color-palette-outline' },
                  { name: 'Discount', label: 'Discount (₹)', icon: 'trending-down-outline' },
                  { name: 'GST %', label: 'GST %', icon: 'calculator-outline' },
                  { name: 'HSN', label: 'HSN Code', icon: 'barcode-outline' },
                ].map((preset) => {
                  const alreadyAdded = customColumns.some(
                    (c) => c.name.toLowerCase() === preset.name.toLowerCase()
                  );
                  return (
                    <Pressable
                      key={preset.name}
                      style={[
                        styles.presetChip,
                        alreadyAdded && styles.presetChipAdded,
                      ]}
                      onPress={() => {
                        if (!alreadyAdded) {
                          handleAddColumn(preset.name);
                        }
                      }}
                      disabled={alreadyAdded}
                    >
                      <Ionicons
                        name={preset.icon as any}
                        size={14}
                        color={alreadyAdded ? colors.clayDeep : colors.inkSoft}
                        style={{ marginRight: 4 }}
                      />
                      <Text
                        style={[
                          styles.presetChipText,
                          alreadyAdded && styles.presetChipTextAdded,
                        ]}
                      >
                        {preset.label}
                      </Text>
                      <Ionicons
                        name={alreadyAdded ? 'checkmark-circle' : 'add'}
                        size={14}
                        color={alreadyAdded ? colors.clayDeep : colors.inkSoft}
                        style={{ marginLeft: 4 }}
                      />
                    </Pressable>
                  );
                })}
              </View>

              {/* Divider */}
              <View style={styles.modalDivider}>
                <View style={styles.modalDividerLine} />
                <Text style={styles.modalDividerText}>{t('orders.customColumn')}</Text>
                <View style={styles.modalDividerLine} />
              </View>

              {/* Custom Input */}
              <View style={styles.modalInputGroup}>
                <Text style={styles.modalInputLabel}>{t('orders.columnName')}</Text>
                <View style={styles.modalInputWrap}>
                  <TextInput
                    style={styles.modalTextInput}
                    value={newColumnName}
                    onChangeText={setNewColumnName}
                    placeholder={t('orders.columnNamePlaceholder')}
                    placeholderTextColor={colors.inkSoft}
                    autoFocus
                  />
                </View>
              </View>

              <Pressable
                style={({ pressed }) => [
                  styles.modalSubmitBtn,
                  !newColumnName.trim() && { opacity: 0.5 },
                  pressed && { opacity: 0.85 },
                ]}
                onPress={() => handleAddColumn()}
                disabled={!newColumnName.trim()}
              >
                <Ionicons name="add-circle-outline" size={18} color={colors.white} style={{ marginRight: 6 }} />
                <Text style={styles.modalSubmitBtnText}>{t('orders.addColumn')}</Text>
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Section({
  title,
  icon,
  rightAction,
  children,
}: {
  title: string;
  icon?: string;
  rightAction?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeaderRow}>
        {icon && <Ionicons name={icon as any} size={18} color={colors.clayDeep} />}
        <Text style={styles.sectionTitle}>{title}</Text>
        {rightAction}
      </View>
      {children}
    </View>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

function Field({
  label,
  children,
  flex,
}: {
  label: string;
  children: React.ReactNode;
  flex?: number;
}) {
  return (
    <View style={[styles.field, flex ? { flex } : null]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function ChipRow({
  options,
  value,
  onChange,
  getLabel,
}: {
  options: string[];
  value: string;
  onChange: (opt: string) => void;
  getLabel?: (opt: string) => string;
}) {
  return (
    <View style={styles.chipRow}>
      {options.map((opt) => {
        const active = opt === value;
        const label = getLabel ? getLabel(opt) : opt;
        return (
          <Pressable
            key={opt}
            style={[styles.chip, active && styles.chipActive]}
            onPress={() => onChange(opt)}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.paper },
  content: {
    padding: 20,
    paddingBottom: 60,
    width: '100%',
    maxWidth: 860,
    alignSelf: 'center',
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
    marginBottom: 14,
    ...shadow.card,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.clayDeep,
  },
  row: { flexDirection: 'row', gap: 12 },
  field: { marginBottom: 12 },
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
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: -4,
    marginBottom: 10,
  },
  suggestionLabel: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.inkSoft,
  },
  suggestionChip: {
    backgroundColor: colors.clayLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  suggestionText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    color: colors.clayDeep,
  },
  noteInput: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.paper,
  },
  chipActive: {
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
  itemContainer: {
    marginBottom: 8,
  },
  itemHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 4,
  },
  itemHeaderCell: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    color: colors.inkSoft,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  itemInput: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.ink,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    borderStyle: 'dashed' as any,
    paddingVertical: 6,
    paddingHorizontal: 2,
    minWidth: 0,
  },
  removeBtn: { width: 28, alignItems: 'center', justifyContent: 'center' },
  prodSuggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    marginLeft: 2,
  },
  addItemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 10,
    gap: 6,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.sm,
  },
  addItemText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.clayDeep,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 6,
  },
  summaryLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.ink,
  },
  summaryValue: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    color: colors.ink,
  },
  saveBtn: {
    backgroundColor: colors.clayDeep,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    ...shadow.card,
  },
  saveBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    color: colors.white,
  },

  // ── Custom Columns UI ──
  addColumnHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.clayLight,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.clayDeep,
  },
  addColumnHeaderBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: colors.clayDeep,
  },
  customColHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  removeColBtn: {
    padding: 2,
    marginLeft: 2,
  },
  itemTableActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
  },
  addColSecondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
    borderStyle: 'dashed' as any,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.sm,
  },
  addColSecondaryText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.clayDeep,
  },

  // ── Add Column Modal ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCenterWrap: {
    width: '100%',
    maxWidth: 440,
  },
  modalCard: {
    backgroundColor: colors.paperCard,
    borderRadius: radius.lg,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.line,
    ...shadow.card,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  modalIconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.clayLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.ink,
  },
  modalSub: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.inkSoft,
    marginTop: 1,
  },
  modalCloseBtn: {
    padding: 4,
  },
  presetChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  presetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: radius.sm,
  },
  presetChipAdded: {
    backgroundColor: colors.clayLight,
    borderColor: colors.clayDeep,
    opacity: 0.6,
  },
  presetChipText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.ink,
  },
  presetChipTextAdded: {
    color: colors.clayDeep,
    fontFamily: fonts.bodyBold,
  },
  modalDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
  },
  modalDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.line,
  },
  modalDividerText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    color: colors.inkSoft,
    marginHorizontal: 8,
  },
  modalInputGroup: {
    marginBottom: 16,
  },
  modalInputLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.inkSoft,
    marginBottom: 4,
  },
  modalInputWrap: {
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  modalTextInput: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.ink,
  },
  modalSubmitBtn: {
    backgroundColor: colors.clayDeep,
    borderRadius: radius.sm,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  modalSubmitBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.white,
  },
});
