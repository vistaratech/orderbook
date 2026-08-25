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
import { Order, OrderItem, OrderStatus, PaymentStatus, Customer, Product } from '../types/order';
import { getOrder, saveOrder, nextOrderNumber } from '../storage/orderStorage';
import { getCustomers, saveCustomer } from '../storage/customerStorage';
import { getProducts, saveProduct } from '../storage/productStorage';
import { generateId } from '../utils/id';
import { formatCurrency, formatDate, todayIso } from '../utils/format';
import { colors, fonts, radius } from '../theme/theme';
import StatusTracker from '../components/StatusTracker';

type Props = NativeStackScreenProps<RootStackParamList, 'OrderForm'>;

const PAYMENT_METHODS = ['Cash', 'UPI', 'Card', 'Bank Transfer'];
const DISPATCH_METHODS = ['Courier', 'Self Pickup', 'Local Delivery'];
const PAYMENT_STATUSES: PaymentStatus[] = ['Pending', 'Partial', 'Paid'];

function emptyItem(): OrderItem {
  return { id: generateId('itm_'), name: '', qty: 1, price: 0 };
}

export default function OrderFormScreen({ navigation, route }: Props) {
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
  const [items, setItems] = useState<OrderItem[]>([emptyItem()]);
  const [customerNote, setCustomerNote] = useState('');
  const [advance, setAdvance] = useState('0');
  const [status, setStatus] = useState<OrderStatus>('Placed');
  const [saving, setSaving] = useState(false);

  // Autocomplete data
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);

  useEffect(() => {
    navigation.setOptions({ title: isEditing ? 'Edit Order' : 'New Order' });
  }, [isEditing, navigation]);

  useEffect(() => {
    // Load catalog and customer list for suggestions
    getCustomers().then(setAllCustomers);
    getProducts().then(setAllProducts);

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
        setItems(order.items.length ? order.items : [emptyItem()]);
        setCustomerNote(order.customerNote || '');
        setAdvance(String(order.advance ?? 0));
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
      Alert.alert('Name required', "Enter the customer's name before saving.");
      return;
    }
    const cleanItems = items
      .map((it) => ({ ...it, name: it.name.trim() }))
      .filter((it) => it.name.length > 0);
    if (cleanItems.length === 0) {
      Alert.alert('Add an item', 'Add at least one item to the order.');
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
      items: cleanItems,
      customerNote: customerNote.trim() || undefined,
      advance: advanceNum,
      status,
    });

    setSaving(false);
    setOrderId(saved.id);
    navigation.replace('OrderDetail', { orderId: saved.id });
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Section title="Order">
          <Row>
            <Field label="Order #" flex={1}>
              <TextInput style={styles.input} value={orderNumber} onChangeText={setOrderNumber} />
            </Field>
            <Field label="Order Date" flex={1}>
              <TextInput style={styles.input} value={orderDate} onChangeText={setOrderDate} />
            </Field>
          </Row>
          <Field label="Tracking #">
            <TextInput
              style={styles.input}
              value={trackingNumber}
              onChangeText={setTrackingNumber}
              placeholder="Courier tracking number"
              placeholderTextColor={colors.inkSoft}
            />
          </Field>
        </Section>

        <Section title="Customer">
          <Field label="Name">
            <TextInput
              style={styles.input}
              value={customerName}
              onChangeText={setCustomerName}
              placeholder="Customer name"
              placeholderTextColor={colors.inkSoft}
            />
          </Field>

          {/* Customer Suggestions */}
          {customerSuggestions.length > 0 && (
            <View style={styles.suggestionRow}>
              <Text style={styles.suggestionLabel}>Suggested:</Text>
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

          <Field label="Phone No.">
            <TextInput
              style={styles.input}
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              keyboardType="phone-pad"
              placeholder="10-digit mobile number"
              placeholderTextColor={colors.inkSoft}
            />
          </Field>
        </Section>

        <Section title="Payment">
          <Field label="Payment Method">
            <ChipRow options={PAYMENT_METHODS} value={paymentMethod} onChange={setPaymentMethod} />
          </Field>
          <Field label="Payment Status">
            <ChipRow
              options={PAYMENT_STATUSES}
              value={paymentStatus}
              onChange={(v) => setPaymentStatus(v as PaymentStatus)}
            />
          </Field>
        </Section>

        <Section title="Dispatch">
          <Field label="Dispatch Method">
            <ChipRow options={DISPATCH_METHODS} value={dispatchMethod} onChange={setDispatchMethod} />
          </Field>
          <Field label="Dispatch Date">
            <TextInput
              style={styles.input}
              value={dispatchDate}
              onChangeText={setDispatchDate}
              placeholder="Optional date / notes"
              placeholderTextColor={colors.inkSoft}
            />
          </Field>
        </Section>

        <Section title="Items & Products">
          <View style={styles.itemHeaderRow}>
            <Text style={[styles.itemHeaderCell, { flex: 3 }]}>Item Name</Text>
            <Text style={[styles.itemHeaderCell, { flex: 1, textAlign: 'center' }]}>Qty</Text>
            <Text style={[styles.itemHeaderCell, { flex: 1.2, textAlign: 'right' }]}>Price</Text>
            <View style={{ width: 28 }} />
          </View>

          {items.map((item) => {
            // Product suggestions for this row
            const prodMatches =
              item.name.trim().length > 0 &&
              allProducts.filter((p) =>
                p.name.toLowerCase().includes(item.name.toLowerCase().trim())
              ).slice(0, 2);

            return (
              <View key={item.id} style={styles.itemContainer}>
                <View style={styles.itemRow}>
                  <TextInput
                    style={[styles.itemInput, { flex: 3 }]}
                    value={item.name}
                    onChangeText={(v) => updateItem(item.id, { name: v })}
                    placeholder="Product name"
                    placeholderTextColor={colors.inkSoft}
                  />
                  <TextInput
                    style={[styles.itemInput, { flex: 1, textAlign: 'center' }]}
                    value={String(item.qty)}
                    onChangeText={(v) => updateItem(item.id, { qty: parseInt(v, 10) || 0 })}
                    keyboardType="number-pad"
                  />
                  <TextInput
                    style={[styles.itemInput, { flex: 1.2, textAlign: 'right' }]}
                    value={String(item.price)}
                    onChangeText={(v) => updateItem(item.id, { price: parseFloat(v) || 0 })}
                    keyboardType="decimal-pad"
                  />
                  <Pressable onPress={() => removeItem(item.id)} style={styles.removeBtn}>
                    <Ionicons name="close-circle" size={20} color={colors.inkSoft} />
                  </Pressable>
                </View>

                {prodMatches && prodMatches.length > 0 && item.price === 0 && (
                  <View style={styles.prodSuggestionRow}>
                    <Text style={styles.suggestionLabel}>Catalog:</Text>
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

          <Pressable style={styles.addItemBtn} onPress={addItem}>
            <Ionicons name="add" size={16} color={colors.clayDeep} />
            <Text style={styles.addItemText}>Add Item</Text>
          </Pressable>
        </Section>

        <Section title="Customer Note">
          <TextInput
            style={[styles.input, styles.noteInput]}
            value={customerNote}
            onChangeText={setCustomerNote}
            placeholder="Special customizations, packaging notes…"
            placeholderTextColor={colors.inkSoft}
            multiline
          />
        </Section>

        <Section title="Payment Summary">
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Bill</Text>
            <Text style={styles.summaryValue}>{formatCurrency(total)}</Text>
          </View>
          <Field label="Advance Received">
            <TextInput
              style={styles.input}
              value={advance}
              onChangeText={setAdvance}
              keyboardType="decimal-pad"
            />
          </Field>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Balance Pending</Text>
            <Text style={[styles.summaryValue, balance > 0 && { color: colors.danger }]}>
              {formatCurrency(balance)}
            </Text>
          </View>
        </Section>

        <Section title="Status">
          <StatusTracker status={status} onChange={setStatus} />
        </Section>

        <Pressable style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
          <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save Order'}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
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
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={styles.chipRow}>
      {options.map((opt) => {
        const active = opt === value;
        return (
          <Pressable
            key={opt}
            style={[styles.chip, active && styles.chipActive]}
            onPress={() => onChange(opt)}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.paper },
  content: { padding: 16, paddingBottom: 60 },
  section: {
    backgroundColor: colors.paperCard,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 16,
    marginBottom: 14,
    overflow: 'hidden',
  },
  sectionTitle: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.clayDeep,
    marginBottom: 10,
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
    borderStyle: 'dashed',
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
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipActive: {
    backgroundColor: colors.clay,
    borderColor: colors.clayDeep,
  },
  chipText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.ink,
  },
  chipTextActive: {
    color: colors.white,
    fontFamily: fonts.bodyMedium,
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
    gap: 4,
  },
  itemInput: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.ink,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    borderStyle: 'dashed',
    paddingVertical: 4,
    paddingHorizontal: 2,
    minWidth: 0,
  },
  removeBtn: { width: 24, alignItems: 'center', justifyContent: 'center' },
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
    marginTop: 6,
    gap: 4,
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
    marginBottom: 8,
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
    marginTop: 4,
  },
  saveBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    color: colors.white,
  },
});
