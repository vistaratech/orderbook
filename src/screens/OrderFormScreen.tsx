import React, { useEffect, useState, useMemo } from 'react';
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
  FlatList,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import {
  Order,
  OrderItem,
  OrderStatus,
  PaymentStatus,
  Customer,
  Product,
  ProductUnit,
  CustomColumn,
} from '../types/order';
import { getOrder, saveOrder, nextOrderNumber, getOrders } from '../storage/orderStorage';
import { getCustomers, saveCustomer } from '../storage/customerStorage';
import { getProducts, saveProduct } from '../storage/productStorage';
import { getEstimate } from '../storage/estimateStorage';
import { generateId } from '../utils/id';
import { formatCurrency, formatDate, todayIso } from '../utils/format';
import { colors, fonts, radius, shadow } from '../theme/theme';
import StatusTracker from '../components/StatusTracker';
import { getBusinessProfile } from '../storage/businessProfileStorage';
import { checkProStatus, checkBasicStatus } from '../storage/subscriptionStorage';
import { getBusinessPreset } from '../config/businessTypes';
import { useLanguage } from '../i18n/LanguageContext';
import { assertSubscriptionLimit } from '../utils/subscriptionGuard';
import GlassBackButton from '../components/GlassBackButton';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = NativeStackScreenProps<RootStackParamList, 'OrderForm'>;

const PAYMENT_METHODS = [
  { id: 'Cash', labelKey: 'orders.methodCash', defaultLabel: 'Cash', icon: 'cash-outline' },
  { id: 'UPI', labelKey: 'orders.methodUpi', defaultLabel: 'UPI / GPay', icon: 'flash-outline' },
  { id: 'Card', labelKey: 'orders.methodCard', defaultLabel: 'Card', icon: 'card-outline' },
  { id: 'Bank Transfer', labelKey: 'orders.methodBankTransfer', defaultLabel: 'Bank Transfer', icon: 'business-outline' },
];

const DISPATCH_METHODS = [
  { id: 'Courier', labelKey: 'orders.methodCourier', defaultLabel: 'Courier', icon: 'cube-outline' },
  { id: 'Self Pickup', labelKey: 'orders.methodSelfPickup', defaultLabel: 'Self Pickup', icon: 'bag-handle-outline' },
  { id: 'Local Delivery', labelKey: 'orders.methodLocalDelivery', defaultLabel: 'Local Delivery', icon: 'bicycle-outline' },
];

const PAYMENT_STATUSES: PaymentStatus[] = ['Pending', 'Partial', 'Paid'];

function emptyItem(defaultUnit = 'Pcs'): OrderItem {
  return { id: generateId('itm_'), name: '', qty: 1, price: 0, unit: defaultUnit };
}

export default function OrderFormScreen({ navigation, route }: Props) {
  const { t } = useLanguage();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isDesktop = width >= 640;

  const editingId = route.params?.orderId;
  const prefillName = route.params?.prefillCustomerName;
  const prefillPhone = route.params?.prefillPhone;
  const fromEstimateId = route.params?.fromEstimateId;
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
  const [items, setItems] = useState<OrderItem[]>([emptyItem()]);
  const [customerNote, setCustomerNote] = useState('');
  const [advance, setAdvance] = useState('');
  const [status, setStatus] = useState<OrderStatus>('Placed');
  const [saving, setSaving] = useState(false);
  const [defaultUnit, setDefaultUnit] = useState('Pcs');
  const [upgradeNudge, setUpgradeNudge] = useState<string | null>(null);

  // Modals & Pickers
  const [showCatalogModal, setShowCatalogModal] = useState(false);
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [activeItemSuggestIndex, setActiveItemSuggestIndex] = useState<string | null>(null);

  // Autocomplete data
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);

  useEffect(() => {
    navigation.setOptions({
      title: isEditing ? t('orders.editOrderTitle', 'Edit Order') : t('orders.newOrderTitle', 'Create Order'),
    });
  }, [isEditing, navigation, t]);

  useEffect(() => {
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
        setDispatchMethod(order.dispatchMethod || 'Courier');
        setDispatchDate(order.dispatchDate || '');
        setCustomColumns(order.customColumns || []);
        setItems(order.items.length ? order.items : [emptyItem()]);
        setCustomerNote(order.customerNote || '');
        setAdvance(order.advance ? String(order.advance) : '');
        setStatus(order.status);
      });
    } else if (fromEstimateId) {
      nextOrderNumber().then(setOrderNumber);
      getEstimate(fromEstimateId).then((est) => {
        if (est) {
          if (est.customerName) setCustomerName(est.customerName);
          if (est.phoneNumber) setPhoneNumber(est.phoneNumber);
          if (est.customerNote) setCustomerNote(est.customerNote);
          if (est.items && est.items.length > 0) {
            setItems(est.items.map((it) => ({ ...it, id: generateId('itm_') })));
          }
        }
      });
    } else {
      nextOrderNumber().then(setOrderNumber);

      // Check limits
      (async () => {
        const isPro = await checkProStatus();
        if (isPro) return;

        const isBasic = await checkBasicStatus();
        const orders = await getOrders();
        const limit = isBasic ? 150 : 30;

        if (orders.length >= limit) {
          assertSubscriptionLimit({
            type: 'order',
            actionName: 'create new orders',
            navigation,
          });
        } else if (orders.length >= (isBasic ? 120 : 25)) {
          setUpgradeNudge(
            `⚠️ Only ${Math.max(0, limit - orders.length)} free orders left (${orders.length}/${limit} used)! Upgrade to Pro.`
          );
        }
      })();
    }
  }, [editingId, fromEstimateId]);

  // Calculations
  const total = useMemo(() => {
    return items.reduce((sum, it) => sum + (it.qty || 0) * (it.price || 0), 0);
  }, [items]);

  const advanceNum = parseFloat(advance) || 0;
  const balance = Math.max(0, total - advanceNum);
  const totalItemCount = useMemo(() => {
    return items.filter((it) => it.name.trim().length > 0).reduce((sum, it) => sum + (it.qty || 1), 0);
  }, [items]);

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

  const addItem = () => {
    setItems((prev) => [...prev, emptyItem(defaultUnit)]);
  };

  const duplicateItem = (item: OrderItem) => {
    const newItem: OrderItem = {
      ...item,
      id: generateId('itm_'),
      name: item.name ? `${item.name}` : '',
    };
    setItems((prev) => [...prev, newItem]);
  };

  const removeItem = (id: string) => {
    setItems((prev) => (prev.length > 1 ? prev.filter((it) => it.id !== id) : [emptyItem(defaultUnit)]));
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
    setShowCustomerPicker(false);
  };

  const handleSelectProduct = (itemId: string, p: Product) => {
    updateItem(itemId, {
      name: p.name,
      price: p.defaultPrice || 0,
      unit: p.unit || defaultUnit,
    });
    setActiveItemSuggestIndex(null);
  };

  const handleAddCatalogProductDirectly = (p: Product) => {
    setItems((prev) => {
      const last = prev[prev.length - 1];
      if (prev.length === 1 && !last.name.trim() && last.price === 0) {
        return [
          {
            ...last,
            name: p.name,
            price: p.defaultPrice || 0,
            unit: p.unit || defaultUnit,
            qty: 1,
          },
        ];
      }
      return [
        ...prev,
        {
          id: generateId('itm_'),
          name: p.name,
          price: p.defaultPrice || 0,
          unit: p.unit || defaultUnit,
          qty: 1,
        },
      ];
    });
    setShowCatalogModal(false);
  };

  // Recent customers (top 5)
  const recentCustomers = useMemo(() => {
    return allCustomers.slice(0, 5);
  }, [allCustomers]);

  // Filtered customer list for picker modal
  const filteredCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    if (!q) return allCustomers;
    return allCustomers.filter(
      (c) => c.name.toLowerCase().includes(q) || (c.phone && c.phone.includes(q))
    );
  }, [allCustomers, customerSearch]);

  // Filtered catalog products for picker modal
  const filteredProducts = useMemo(() => {
    const q = catalogSearch.trim().toLowerCase();
    if (!q) return allProducts;
    return allProducts.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.hsnCode && p.hsnCode.toLowerCase().includes(q)) ||
        (p.barcode && p.barcode.toLowerCase().includes(q))
    );
  }, [allProducts, catalogSearch]);

  // Quick dispatch date preset helpers
  const setQuickDate = (daysFromNow: number) => {
    const d = new Date();
    d.setDate(d.getDate() + daysFromNow);
    setDispatchDate(formatDate(d.toISOString()));
  };

  // Quick advance percentage presets
  const handleQuickAdvance = (percentage: number) => {
    if (percentage === 0) {
      setAdvance('0');
    } else if (percentage === 1) {
      setAdvance(String(total));
    } else {
      setAdvance(String(Math.round(total * percentage)));
    }
  };

  const handleSave = async () => {
    if (!customerName.trim()) {
      Alert.alert(t('common.required', 'Required'), t('orders.customerName', 'Please enter customer name'));
      return;
    }
    const cleanItems = items
      .map((it) => ({ ...it, name: it.name.trim() }))
      .filter((it) => it.name.length > 0);
    if (cleanItems.length === 0) {
      Alert.alert(t('common.required', 'Required'), t('orders.items', 'Please add at least one item with a name'));
      return;
    }

    setSaving(true);

    // Verify limit before saving a new order
    if (!isEditing) {
      const allowed = await assertSubscriptionLimit({
        type: 'order',
        actionName: 'save this new order',
        navigation,
      });
      if (!allowed) {
        setSaving(false);
        return;
      }
    }

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
          const rawUnit = (it.unit || defaultUnit || 'pcs').toLowerCase();
          const validUnit: ProductUnit = [
            'pcs',
            'kg',
            'meter',
            'liter',
            'box',
            'set',
            'grams',
            'hours',
            'pairs',
            'bags',
            'sqft',
          ].includes(rawUnit)
            ? (rawUnit as ProductUnit)
            : 'pcs';

          await saveProduct({
            name: it.name,
            defaultPrice: it.price,
            unit: validUnit,
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
      estimateId: fromEstimateId,
    });

    setSaving(false);
    setOrderId(saved.id);
    navigation.replace('OrderDetail', { orderId: saved.id });
  };

  return (
    <SafeAreaView style={styles.flex} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* ─── Top Header Bar ─── */}
        <View style={styles.topHeaderContainer}>
          <View style={styles.topHeaderLeft}>
            <GlassBackButton label={t('common.back', 'Back')} />
            <View style={styles.topHeaderTitleWrap}>
              <Text style={styles.topHeaderTitle}>
                {isEditing ? t('orders.editOrderTitle', 'Edit Order') : t('orders.newOrderTitle', 'Create New Order')}
              </Text>
              <View style={styles.topHeaderMetaRow}>
                <View style={styles.orderNumberBadge}>
                  <Text style={styles.orderNumberText}>{orderNumber || '#....'}</Text>
                </View>
                <Text style={styles.orderDateText}>{orderDate}</Text>
              </View>
            </View>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Upgrade Nudge Banner ── */}
          {upgradeNudge && (
            <Pressable
              style={styles.upgradeBanner}
              onPress={() => (navigation as any).navigate('PaywallScreen')}
            >
              <Ionicons name="sparkles" size={18} color="#CA8A04" />
              <Text style={styles.upgradeBannerText}>{upgradeNudge}</Text>
              <View style={styles.upgradeBadge}>
                <Text style={styles.upgradeBadgeText}>Upgrade</Text>
              </View>
            </Pressable>
          )}

          {/* ─── CARD 1: Customer Information ─── */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={[styles.cardHeaderIcon, { backgroundColor: '#E0F2FE' }]}>
                <Ionicons name="person" size={18} color="#0284C7" />
              </View>
              <View style={{ flex: 1, minWidth: 120 }}>
                <Text style={styles.cardTitle}>{t('orders.customerInfo', 'Customer Information')}</Text>
                <Text style={styles.cardSubtitle}>Select existing customer or enter new buyer details</Text>
              </View>
              {allCustomers.length > 0 && (
                <Pressable
                  style={styles.browseCustomerBtn}
                  onPress={() => {
                    setCustomerSearch('');
                    setShowCustomerPicker(true);
                  }}
                >
                  <Ionicons name="people-outline" size={14} color={colors.clayDeep} />
                  <Text style={styles.browseCustomerBtnText}>Browse</Text>
                </Pressable>
              )}
            </View>

            {/* Recent Customers Quick Chips */}
            {recentCustomers.length > 0 && (
              <View style={styles.recentCustSection}>
                <Text style={styles.recentCustLabel}>Quick Fill:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recentCustRow}>
                  {recentCustomers.map((c) => (
                    <Pressable
                      key={c.id}
                      style={[
                        styles.recentCustChip,
                        customerName === c.name && styles.recentCustChipActive,
                      ]}
                      onPress={() => handleSelectCustomer(c)}
                    >
                      <Ionicons
                        name="person-circle-outline"
                        size={15}
                        color={customerName === c.name ? colors.clayDeep : colors.inkSoft}
                      />
                      <Text
                        style={[
                          styles.recentCustChipText,
                          customerName === c.name && styles.recentCustChipTextActive,
                        ]}
                        numberOfLines={1}
                      >
                        {c.name}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Customer Inputs - Responsive (column on mobile, row on desktop) */}
            <View style={[styles.formResponsiveRow, { flexDirection: isDesktop ? 'row' : 'column' }]}>
              <View style={[styles.inputGroup, isDesktop ? { flex: 1.2 } : { width: '100%' }]}>
                <Text style={styles.inputLabel}>
                  {t('orders.customerName', 'Customer Name')} <Text style={styles.requiredStar}>*</Text>
                </Text>
                <View style={styles.textInputBox}>
                  <Ionicons name="person-outline" size={17} color={colors.inkSoft} style={{ marginRight: 8 }} />
                  <TextInput
                    style={styles.textInput}
                    value={customerName}
                    onChangeText={setCustomerName}
                    placeholder="e.g. Ramesh Kumar / Store Name"
                    placeholderTextColor={colors.inkSoft}
                  />
                  {customerName.length > 0 && (
                    <Pressable onPress={() => setCustomerName('')} hitSlop={6}>
                      <Ionicons name="close-circle" size={16} color={colors.inkSoft} />
                    </Pressable>
                  )}
                </View>
              </View>

              <View style={[styles.inputGroup, isDesktop ? { flex: 1 } : { width: '100%' }]}>
                <Text style={styles.inputLabel}>{t('orders.customerPhone', 'Phone Number')}</Text>
                <View style={styles.textInputBox}>
                  <Ionicons name="call-outline" size={17} color={colors.inkSoft} style={{ marginRight: 8 }} />
                  <TextInput
                    style={styles.textInput}
                    value={phoneNumber}
                    onChangeText={setPhoneNumber}
                    placeholder="10-digit mobile"
                    placeholderTextColor={colors.inkSoft}
                    keyboardType="phone-pad"
                  />
                </View>
              </View>
            </View>
          </View>

          {/* ─── CARD 2: Order Items (Revamped Item UI) ─── */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={[styles.cardHeaderIcon, { backgroundColor: '#FEF3C7' }]}>
                <Ionicons name="cart" size={18} color="#D97706" />
              </View>
              <View style={{ flex: 1, minWidth: 110 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.cardTitle}>{t('orders.itemsAndProducts', 'Items & Products')}</Text>
                  <View style={styles.itemCountBadge}>
                    <Text style={styles.itemCountBadgeText}>{items.length}</Text>
                  </View>
                </View>
                <Text style={styles.cardSubtitle}>Add products, adjust quantity & rates</Text>
              </View>

              {/* Action buttons in header */}
              <View style={styles.cardHeaderActions}>
                {allProducts.length > 0 && (
                  <Pressable
                    style={styles.catalogQuickBtn}
                    onPress={() => {
                      setCatalogSearch('');
                      setShowCatalogModal(true);
                    }}
                  >
                    <Ionicons name="grid" size={13} color="#D97706" />
                    <Text style={styles.catalogQuickBtnText}>Catalog</Text>
                  </Pressable>
                )}
                <Pressable
                  style={styles.addColumnBtn}
                  onPress={() => setShowColumnModal(true)}
                >
                  <Ionicons name="add" size={14} color={colors.clayDeep} />
                  <Text style={styles.addColumnBtnText}>Column</Text>
                </Pressable>
              </View>
            </View>

            {/* Custom columns active pill tags */}
            {customColumns.length > 0 && (
              <View style={styles.activeColumnsRow}>
                <Text style={styles.activeColLabel}>Extra Fields:</Text>
                {customColumns.map((col) => (
                  <View key={col.id} style={styles.activeColTag}>
                    <Text style={styles.activeColTagText}>{col.name}</Text>
                    <Pressable onPress={() => handleRemoveColumn(col.id)} hitSlop={6}>
                      <Ionicons name="close" size={12} color={colors.clayDeep} />
                    </Pressable>
                  </View>
                ))}
              </View>
            )}

            {/* Items List (Cards) */}
            <View style={styles.itemsListWrap}>
              {items.map((item, index) => {
                const itemSubtotal = (item.qty || 0) * (item.price || 0);
                const isSuggesting = activeItemSuggestIndex === item.id;
                const prodMatches =
                  item.name.trim().length > 0 && isSuggesting
                    ? allProducts
                        .filter((p) => p.name.toLowerCase().includes(item.name.toLowerCase().trim()))
                        .slice(0, 3)
                    : [];

                return (
                  <View key={item.id} style={styles.itemCard}>
                    {/* Item Card Top: Index, Name, Actions */}
                    <View style={styles.itemCardTopRow}>
                      <View style={styles.itemIndexPill}>
                        <Text style={styles.itemIndexText}>#{index + 1}</Text>
                      </View>

                      <View style={{ flex: 1, minWidth: 100 }}>
                        <TextInput
                          style={styles.itemNameInput}
                          value={item.name}
                          onChangeText={(v) => {
                            updateItem(item.id, { name: v });
                            setActiveItemSuggestIndex(item.id);
                          }}
                          onFocus={() => setActiveItemSuggestIndex(item.id)}
                          placeholder={t('orders.productNamePlaceholder', 'Product name')}
                          placeholderTextColor={colors.inkSoft}
                        />
                      </View>

                      <View style={styles.itemCardActions}>
                        <Pressable
                          style={styles.itemActionBtn}
                          onPress={() => duplicateItem(item)}
                          hitSlop={8}
                          accessibilityLabel="Duplicate item"
                        >
                          <Ionicons name="copy-outline" size={17} color={colors.inkSoft} />
                        </Pressable>
                        <Pressable
                          style={[styles.itemActionBtn, items.length <= 1 && { opacity: 0.4 }]}
                          onPress={() => removeItem(item.id)}
                          hitSlop={8}
                          disabled={items.length <= 1 && !item.name && item.price === 0}
                          accessibilityLabel="Delete item"
                        >
                          <Ionicons name="trash-outline" size={17} color={colors.danger} />
                        </Pressable>
                      </View>
                    </View>

                    {/* Catalog suggestions dropdown when typing */}
                    {prodMatches.length > 0 && (
                      <View style={styles.prodSuggestBox}>
                        <Text style={styles.prodSuggestHeading}>Matching Catalog Items:</Text>
                        <View style={styles.prodSuggestList}>
                          {prodMatches.map((p) => (
                            <Pressable
                              key={p.id}
                              style={styles.prodSuggestItem}
                              onPress={() => handleSelectProduct(item.id, p)}
                            >
                              <Ionicons name="pricetag" size={12} color="#D97706" />
                              <Text style={styles.prodSuggestName}>{p.name}</Text>
                              <Text style={styles.prodSuggestPrice}>{formatCurrency(p.defaultPrice)}</Text>
                            </Pressable>
                          ))}
                        </View>
                      </View>
                    )}

                    {/* Item Card Bottom Row: Qty Stepper, Unit Price, Subtotal */}
                    <View style={styles.itemCardBottomRow}>
                      {/* Quantity Stepper */}
                      <View style={styles.itemQtyControlWrap}>
                        <Text style={styles.itemFieldMicroLabel}>
                          {t('orders.quantity', 'Qty')} ({item.unit || defaultUnit})
                        </Text>
                        <View style={styles.qtyStepperBox}>
                          <Pressable
                            style={styles.stepperBtn}
                            onPress={() => {
                              const next = Math.max(1, (item.qty || 1) - 1);
                              updateItem(item.id, { qty: next });
                            }}
                          >
                            <Ionicons name="remove" size={14} color={colors.ink} />
                          </Pressable>
                          <TextInput
                            style={styles.qtyTextInput}
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
                          <Pressable
                            style={[styles.stepperBtn, styles.stepperBtnAdd]}
                            onPress={() => {
                              const next = (item.qty || 0) + 1;
                              updateItem(item.id, { qty: next });
                            }}
                          >
                            <Ionicons name="add" size={14} color={colors.clayDeep} />
                          </Pressable>
                        </View>
                      </View>

                      {/* Unit Price */}
                      <View style={styles.itemPriceInputWrap}>
                        <Text style={styles.itemFieldMicroLabel}>{t('orders.unitPrice', 'Price (₹)')}</Text>
                        <View style={styles.priceInputBox}>
                          <Text style={styles.currencySymbol}>₹</Text>
                          <TextInput
                            style={styles.priceTextInput}
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
                        </View>
                      </View>

                      {/* Item Total Subtotal */}
                      <View style={styles.itemSubtotalWrap}>
                        <Text style={styles.itemFieldMicroLabel}>Total</Text>
                        <Text style={styles.itemSubtotalText}>{formatCurrency(itemSubtotal)}</Text>
                      </View>
                    </View>

                    {/* Custom columns values row (if any added) */}
                    {customColumns.length > 0 && (
                      <View style={styles.customValuesWrap}>
                        {customColumns.map((col) => {
                          const val =
                            item.customValues?.[col.id] ||
                            (col.name.toLowerCase() === 'unit' && item.unit ? item.unit : '');
                          return (
                            <View key={col.id} style={styles.customFieldItem}>
                              <Text style={styles.customFieldItemLabel}>{col.name}</Text>
                              <TextInput
                                style={styles.customFieldInput}
                                value={val}
                                onChangeText={(v) => updateItemCustomValue(item.id, col.id, col.name, v)}
                                placeholder={col.name}
                                placeholderTextColor={colors.inkSoft}
                              />
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>

            {/* Item Action Buttons - Responsive 50/50 or Stacked */}
            <View style={[styles.itemActionButtonsRow, { flexDirection: width < 420 ? 'column' : 'row' }]}>
              <Pressable
                style={({ pressed }) => [styles.addCustomItemBtn, pressed && { opacity: 0.85 }]}
                onPress={addItem}
              >
                <Ionicons name="add-circle" size={19} color={colors.clayDeep} />
                <Text style={styles.addCustomItemBtnText}>{t('orders.addAnotherItem', '+ Add Another Item')}</Text>
              </Pressable>

              {allProducts.length > 0 && (
                <Pressable
                  style={({ pressed }) => [styles.addCatalogItemBtn, pressed && { opacity: 0.85 }]}
                  onPress={() => {
                    setCatalogSearch('');
                    setShowCatalogModal(true);
                  }}
                >
                  <Ionicons name="bag-add-outline" size={18} color="#2563EB" />
                  <Text style={styles.addCatalogItemBtnText}>+ From Catalog</Text>
                </Pressable>
              )}
            </View>
          </View>

          {/* ─── CARD 3: Dispatch & Fulfillment Details ─── */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={[styles.cardHeaderIcon, { backgroundColor: '#F3E8FF' }]}>
                <Ionicons name="paper-plane" size={18} color="#9333EA" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{t('orders.dispatchDetails', 'Dispatch Details')}</Text>
                <Text style={styles.cardSubtitle}>Fulfillment method and shipment tracking</Text>
              </View>
            </View>

            {/* Dispatch Method Pills */}
            <View style={styles.fieldWrap}>
              <Text style={styles.inputLabel}>{t('orders.dispatchMethod', 'Dispatch Method')}</Text>
              <View style={styles.methodChipsRow}>
                {DISPATCH_METHODS.map((m) => {
                  const active = dispatchMethod === m.id;
                  const label = t(m.labelKey, m.defaultLabel);
                  return (
                    <Pressable
                      key={m.id}
                      style={[styles.methodChip, active && styles.methodChipActive]}
                      onPress={() => setDispatchMethod(m.id)}
                    >
                      <Ionicons
                        name={m.icon as any}
                        size={16}
                        color={active ? colors.white : colors.inkSoft}
                      />
                      <Text style={[styles.methodChipText, active && styles.methodChipTextActive]}>
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Dispatch Date & Tracking - Responsive (column on mobile, row on desktop) */}
            <View style={[styles.formResponsiveRow, { flexDirection: isDesktop ? 'row' : 'column' }]}>
              <View style={[styles.inputGroup, isDesktop ? { flex: 1 } : { width: '100%' }]}>
                <Text style={styles.inputLabel}>{t('orders.dispatchDate', 'Dispatch Date')}</Text>
                <View style={styles.textInputBox}>
                  <Ionicons name="calendar-outline" size={17} color={colors.inkSoft} style={{ marginRight: 8 }} />
                  <TextInput
                    style={styles.textInput}
                    value={dispatchDate}
                    onChangeText={setDispatchDate}
                    placeholder="DD Mon YYYY / Notes"
                    placeholderTextColor={colors.inkSoft}
                  />
                </View>
                {/* Quick Date Presets */}
                <View style={styles.quickDateRow}>
                  <Pressable style={styles.quickDateBtn} onPress={() => setQuickDate(0)}>
                    <Text style={styles.quickDateText}>Today</Text>
                  </Pressable>
                  <Pressable style={styles.quickDateBtn} onPress={() => setQuickDate(1)}>
                    <Text style={styles.quickDateText}>Tomorrow</Text>
                  </Pressable>
                  <Pressable style={styles.quickDateBtn} onPress={() => setQuickDate(3)}>
                    <Text style={styles.quickDateText}>+3 Days</Text>
                  </Pressable>
                </View>
              </View>

              <View style={[styles.inputGroup, isDesktop ? { flex: 1 } : { width: '100%' }]}>
                <Text style={styles.inputLabel}>{t('orders.trackingNumber', 'Tracking #')}</Text>
                <View style={styles.textInputBox}>
                  <Ionicons name="barcode-outline" size={17} color={colors.inkSoft} style={{ marginRight: 8 }} />
                  <TextInput
                    style={styles.textInput}
                    value={trackingNumber}
                    onChangeText={setTrackingNumber}
                    placeholder="AWB / Docket number"
                    placeholderTextColor={colors.inkSoft}
                  />
                </View>
              </View>
            </View>
          </View>

          {/* ─── CARD 4: Payment & Financials ─── */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={[styles.cardHeaderIcon, { backgroundColor: '#DCFCE7' }]}>
                <Ionicons name="wallet" size={18} color="#16A34A" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{t('orders.paymentDetails', 'Payment Details')}</Text>
                <Text style={styles.cardSubtitle}>Payment mode, advance received & balance</Text>
              </View>
            </View>

            {/* Payment Method Pills */}
            <View style={styles.fieldWrap}>
              <Text style={styles.inputLabel}>{t('orders.paymentMethod', 'Payment Method')}</Text>
              <View style={styles.methodChipsRow}>
                {PAYMENT_METHODS.map((m) => {
                  const active = paymentMethod === m.id;
                  const label = t(m.labelKey, m.defaultLabel);
                  return (
                    <Pressable
                      key={m.id}
                      style={[styles.methodChip, active && styles.methodChipActive]}
                      onPress={() => setPaymentMethod(m.id)}
                    >
                      <Ionicons
                        name={m.icon as any}
                        size={16}
                        color={active ? colors.white : colors.inkSoft}
                      />
                      <Text style={[styles.methodChipText, active && styles.methodChipTextActive]}>
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Financial Ledger Calculation Summary */}
            <View style={styles.financialSummaryCard}>
              <View style={styles.financialRow}>
                <Text style={styles.financialLabel}>{t('orders.totalBill', 'Total Bill')}</Text>
                <Text style={styles.financialTotalVal}>{formatCurrency(total)}</Text>
              </View>

              {/* Advance Input with Quick % Presets */}
              <View style={styles.advanceInputSection}>
                <View style={styles.advanceLabelRow}>
                  <Text style={styles.inputLabel}>{t('orders.advanceReceived', 'Advance Received (₹)')}</Text>
                  <View style={styles.quickAdvanceRow}>
                    <Pressable style={styles.quickAdvancePill} onPress={() => handleQuickAdvance(0)}>
                      <Text style={styles.quickAdvancePillText}>₹0</Text>
                    </Pressable>
                    <Pressable style={styles.quickAdvancePill} onPress={() => handleQuickAdvance(0.5)}>
                      <Text style={styles.quickAdvancePillText}>50%</Text>
                    </Pressable>
                    <Pressable style={styles.quickAdvancePill} onPress={() => handleQuickAdvance(1)}>
                      <Text style={styles.quickAdvancePillText}>Full</Text>
                    </Pressable>
                  </View>
                </View>

                <View style={styles.textInputBox}>
                  <Text style={styles.currencySymbol}>₹</Text>
                  <TextInput
                    style={styles.textInput}
                    value={advance}
                    onChangeText={(v) => setAdvance(v.replace(/^0+(?=\d)/, ''))}
                    placeholder="0"
                    placeholderTextColor={colors.inkSoft}
                    keyboardType="decimal-pad"
                    selectTextOnFocus
                  />
                </View>
              </View>

              {/* Balance Due Row */}
              <View style={[styles.financialRow, styles.balanceRow]}>
                <View>
                  <Text style={styles.balanceLabel}>{t('orders.balancePending', 'Balance Pending')}</Text>
                  <Text style={styles.balanceSub}>
                    {balance === 0 ? 'Fully paid ✓' : 'Pending from customer'}
                  </Text>
                </View>
                <View style={[styles.balanceBadge, balance === 0 ? styles.balanceBadgePaid : styles.balanceBadgeDue]}>
                  <Text style={[styles.balanceBadgeText, balance === 0 ? styles.balanceTextPaid : styles.balanceTextDue]}>
                    {formatCurrency(balance)}
                  </Text>
                </View>
              </View>
            </View>

            {/* Payment Status Selector */}
            <View style={styles.paymentStatusRow}>
              <Text style={styles.inputLabel}>{t('orders.paymentStatus', 'Payment Status')}:</Text>
              <View style={styles.statusChipsRow}>
                {PAYMENT_STATUSES.map((st) => {
                  const active = paymentStatus === st;
                  const isPaid = st === 'Paid';
                  const isPartial = st === 'Partial';
                  return (
                    <Pressable
                      key={st}
                      style={[
                        styles.paymentStatusChip,
                        active && (isPaid ? styles.statusPaidActive : isPartial ? styles.statusPartialActive : styles.statusPendingActive),
                      ]}
                      onPress={() => setPaymentStatus(st)}
                    >
                      <Ionicons
                        name={isPaid ? 'checkmark-circle' : isPartial ? 'hourglass-outline' : 'alert-circle-outline'}
                        size={14}
                        color={
                          active
                            ? colors.white
                            : isPaid
                            ? colors.success
                            : isPartial
                            ? colors.pending
                            : colors.danger
                        }
                      />
                      <Text
                        style={[
                          styles.paymentStatusChipText,
                          active && styles.paymentStatusChipTextActive,
                        ]}
                      >
                        {st}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>

          {/* ─── CARD 5: Status & Remarks ─── */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={[styles.cardHeaderIcon, { backgroundColor: '#FEE2E2' }]}>
                <Ionicons name="options" size={18} color="#DC2626" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{t('orders.orderStatus', 'Order Status')}</Text>
                <Text style={styles.cardSubtitle}>Current fulfillment phase</Text>
              </View>
            </View>

            <StatusTracker status={status} onChange={setStatus} />

            <View style={[styles.inputGroup, { marginTop: 16 }]}>
              <Text style={styles.inputLabel}>{t('orders.customerNote', 'Customer Note')}</Text>
              <View style={[styles.textInputBox, styles.noteInputBox]}>
                <TextInput
                  style={[styles.textInput, styles.noteTextInput]}
                  value={customerNote}
                  onChangeText={setCustomerNote}
                  placeholder={t('orders.notePlaceholder', 'Special customizations, packaging notes…')}
                  placeholderTextColor={colors.inkSoft}
                  multiline
                  numberOfLines={3}
                />
              </View>
            </View>
          </View>

          {/* Space for bottom sticky bar */}
          <View style={{ height: 90 }} />
        </ScrollView>

        {/* ─── FLOATING / STICKY BOTTOM ACTION BAR ─── */}
        <View style={[styles.stickyBottomBar, { paddingBottom: Math.max(12, insets.bottom + 6) }]}>
          <View style={styles.stickyBottomContent}>
            <View style={styles.stickyTotalInfo}>
              <Text style={styles.stickyTotalLabel}>
                {t('common.total', 'Total')}: <Text style={styles.stickyTotalCount}>({totalItemCount} items)</Text>
              </Text>
              <Text style={styles.stickyTotalAmount}>{formatCurrency(total)}</Text>
              {balance > 0 && (
                <Text style={styles.stickyBalancePending}>
                  {t('orders.balancePending', 'Balance Pending')}: {formatCurrency(balance)}
                </Text>
              )}
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.saveOrderButton,
                saving && { opacity: 0.6 },
                pressed && { transform: [{ scale: 0.98 }] },
              ]}
              onPress={handleSave}
              disabled={saving}
            >
              <Ionicons
                name={saving ? 'hourglass-outline' : 'checkmark-circle'}
                size={18}
                color={colors.white}
              />
              <Text style={styles.saveOrderButtonText}>
                {saving
                  ? t('orders.savingOrder', 'Saving Order…')
                  : isEditing
                  ? t('orders.updateOrderBtn', 'Update Order')
                  : t('orders.saveOrderBtn', 'Save Order')}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* ─── MODAL 1: Product Catalog Quick Picker ─── */}
        <Modal
          visible={showCatalogModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowCatalogModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalSheetContainer}>
              <View style={styles.modalSheetHeader}>
                <View style={styles.modalSheetTitleWrap}>
                  <Ionicons name="grid" size={20} color="#D97706" />
                  <Text style={styles.modalSheetTitle}>Select Product from Catalog</Text>
                </View>
                <Pressable
                  onPress={() => setShowCatalogModal(false)}
                  style={styles.modalCloseBtn}
                  hitSlop={8}
                >
                  <Ionicons name="close" size={22} color={colors.inkSoft} />
                </Pressable>
              </View>

              {/* Search Bar */}
              <View style={styles.modalSearchBox}>
                <Ionicons name="search" size={18} color={colors.inkSoft} style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.modalSearchInput}
                  value={catalogSearch}
                  onChangeText={setCatalogSearch}
                  placeholder="Search products by name or barcode…"
                  placeholderTextColor={colors.inkSoft}
                  autoFocus
                />
                {catalogSearch.length > 0 && (
                  <Pressable onPress={() => setCatalogSearch('')} hitSlop={6}>
                    <Ionicons name="close-circle" size={16} color={colors.inkSoft} />
                  </Pressable>
                )}
              </View>

              {/* Product List */}
              <FlatList
                data={filteredProducts}
                keyExtractor={(p) => p.id}
                contentContainerStyle={{ paddingVertical: 8 }}
                ListEmptyComponent={
                  <View style={styles.emptyListState}>
                    <Ionicons name="cube-outline" size={36} color={colors.inkSoft} />
                    <Text style={styles.emptyListText}>No catalog products found</Text>
                  </View>
                }
                renderItem={({ item: p }) => (
                  <Pressable
                    style={styles.catalogListItem}
                    onPress={() => handleAddCatalogProductDirectly(p)}
                  >
                    <View style={styles.catalogItemIcon}>
                      <Ionicons name="pricetag-outline" size={18} color={colors.clayDeep} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.catalogItemName}>{p.name}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                        {p.unit ? <Text style={styles.catalogItemUnit}>{p.unit}</Text> : null}
                        {p.stockQty !== undefined && (
                          <Text style={styles.catalogItemStock}>Stock: {p.stockQty}</Text>
                        )}
                      </View>
                    </View>
                    <View style={styles.catalogItemPriceWrap}>
                      <Text style={styles.catalogItemPrice}>{formatCurrency(p.defaultPrice)}</Text>
                      <View style={styles.catalogItemAddBtn}>
                        <Ionicons name="add" size={16} color={colors.white} />
                      </View>
                    </View>
                  </Pressable>
                )}
              />
            </View>
          </View>
        </Modal>

        {/* ─── MODAL 2: Customer Quick Picker ─── */}
        <Modal
          visible={showCustomerPicker}
          transparent
          animationType="slide"
          onRequestClose={() => setShowCustomerPicker(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalSheetContainer}>
              <View style={styles.modalSheetHeader}>
                <View style={styles.modalSheetTitleWrap}>
                  <Ionicons name="people" size={20} color="#0284C7" />
                  <Text style={styles.modalSheetTitle}>Select Existing Customer</Text>
                </View>
                <Pressable
                  onPress={() => setShowCustomerPicker(false)}
                  style={styles.modalCloseBtn}
                  hitSlop={8}
                >
                  <Ionicons name="close" size={22} color={colors.inkSoft} />
                </Pressable>
              </View>

              {/* Search Bar */}
              <View style={styles.modalSearchBox}>
                <Ionicons name="search" size={18} color={colors.inkSoft} style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.modalSearchInput}
                  value={customerSearch}
                  onChangeText={setCustomerSearch}
                  placeholder="Search by customer name or phone…"
                  placeholderTextColor={colors.inkSoft}
                  autoFocus
                />
                {customerSearch.length > 0 && (
                  <Pressable onPress={() => setCustomerSearch('')} hitSlop={6}>
                    <Ionicons name="close-circle" size={16} color={colors.inkSoft} />
                  </Pressable>
                )}
              </View>

              {/* Customer List */}
              <FlatList
                data={filteredCustomers}
                keyExtractor={(c) => c.id}
                contentContainerStyle={{ paddingVertical: 8 }}
                ListEmptyComponent={
                  <View style={styles.emptyListState}>
                    <Ionicons name="person-outline" size={36} color={colors.inkSoft} />
                    <Text style={styles.emptyListText}>No customers found</Text>
                  </View>
                }
                renderItem={({ item: c }) => (
                  <Pressable
                    style={styles.customerListItem}
                    onPress={() => handleSelectCustomer(c)}
                  >
                    <View style={styles.customerAvatar}>
                      <Text style={styles.customerAvatarText}>{c.name.charAt(0).toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.customerItemName}>{c.name}</Text>
                      {c.phone ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                          <Ionicons name="call-outline" size={12} color={colors.inkSoft} />
                          <Text style={styles.customerItemPhone}>{c.phone}</Text>
                        </View>
                      ) : null}
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.inkSoft} />
                  </Pressable>
                )}
              />
            </View>
          </View>
        </Modal>

        {/* ─── MODAL 3: Add Custom Column ─── */}
        <Modal
          visible={showColumnModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowColumnModal(false)}
        >
          <View style={styles.modalOverlayCenter}>
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
                    <Text style={styles.modalTitle}>{t('orders.addColumnTitle', 'Add Table Column')}</Text>
                    <Text style={styles.modalSub}>{t('orders.quickSuggestions', 'Quick attributes for items')}</Text>
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
                  <Text style={styles.modalDividerText}>{t('orders.customColumn', 'Custom Attribute')}</Text>
                  <View style={styles.modalDividerLine} />
                </View>

                {/* Custom Input */}
                <View style={styles.modalInputGroup}>
                  <Text style={styles.modalInputLabel}>{t('orders.columnName', 'Attribute Name')}</Text>
                  <View style={styles.modalInputWrap}>
                    <TextInput
                      style={styles.modalTextInput}
                      value={newColumnName}
                      onChangeText={setNewColumnName}
                      placeholder={t('orders.columnNamePlaceholder', 'e.g. Fabric, Weight, Warranty')}
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
                  <Text style={styles.modalSubmitBtnText}>{t('orders.addColumn', 'Add Column')}</Text>
                </Pressable>
              </View>
            </KeyboardAvoidingView>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.paper },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    width: '100%',
    maxWidth: 820,
    alignSelf: 'center',
  },

  // ── Top Header ──
  topHeaderContainer: {
    paddingHorizontal: 16,
    paddingTop: Platform.select({ web: 10, default: 8 }),
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    backgroundColor: colors.paperCard,
  },
  topHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    maxWidth: 820,
    alignSelf: 'center',
    width: '100%',
  },
  topHeaderTitleWrap: {
    flex: 1,
  },
  topHeaderTitle: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.ink,
    lineHeight: 24,
  },
  topHeaderMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  orderNumberBadge: {
    backgroundColor: colors.clayLight,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  orderNumberText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: colors.clayDeep,
  },
  orderDateText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.inkSoft,
  },

  // ── Upgrade Banner ──
  upgradeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFBEB',
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginBottom: 16,
  },
  upgradeBannerText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 12,
    color: '#92400E',
    lineHeight: 18,
  },
  upgradeBadge: {
    backgroundColor: '#CA8A04',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  upgradeBadgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: colors.white,
  },

  // ── Card Styles ──
  card: {
    backgroundColor: colors.paperCard,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 16,
    marginBottom: 16,
    ...shadow.card,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 14,
  },
  cardHeaderIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontFamily: fonts.display,
    fontSize: 17,
    color: colors.ink,
  },
  cardSubtitle: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.inkSoft,
    marginTop: 1,
  },
  cardHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  // ── Customer Card UI ──
  browseCustomerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.clayLight,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.clayDeep,
  },
  browseCustomerBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: colors.clayDeep,
  },
  recentCustSection: {
    marginBottom: 12,
  },
  recentCustLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    color: colors.inkSoft,
    marginBottom: 6,
  },
  recentCustRow: {
    flexDirection: 'row',
    gap: 6,
    paddingBottom: 2,
  },
  recentCustChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  recentCustChipActive: {
    backgroundColor: colors.clayLight,
    borderColor: colors.clayDeep,
  },
  recentCustChipText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.ink,
    maxWidth: 130,
  },
  recentCustChipTextActive: {
    color: colors.clayDeep,
    fontFamily: fonts.bodyBold,
  },

  // ── Generic Inputs ──
  formResponsiveRow: {
    gap: 12,
  },
  inputGroup: {
    marginBottom: 12,
  },
  fieldWrap: {
    marginBottom: 14,
  },
  inputLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.inkSoft,
    marginBottom: 6,
  },
  requiredStar: {
    color: colors.danger,
    fontFamily: fonts.bodyBold,
  },
  textInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: Platform.select({ ios: 10, default: 8 }),
  },
  textInput: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.ink,
    padding: 0,
  },
  noteInputBox: {
    alignItems: 'flex-start',
    paddingVertical: 10,
    minHeight: 80,
  },
  noteTextInput: {
    textAlignVertical: 'top',
  },

  // ── Items Revamped Section ──
  itemCountBadge: {
    backgroundColor: colors.clayLight,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radius.pill,
  },
  itemCountBadgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: colors.clayDeep,
  },
  catalogQuickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  catalogQuickBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: '#D97706',
  },
  addColumnBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.clayLight,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.clayDeep,
  },
  addColumnBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: colors.clayDeep,
  },
  activeColumnsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  activeColLabel: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.inkSoft,
  },
  activeColTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.clayLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  activeColTagText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    color: colors.clayDeep,
  },

  // ── Individual Item Card ──
  itemsListWrap: {
    gap: 12,
  },
  itemCard: {
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: 12,
  },
  itemCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  itemIndexPill: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: colors.paperCard,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemIndexText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: colors.inkSoft,
  },
  itemNameInput: {
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
    color: colors.ink,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  itemCardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  itemActionBtn: {
    padding: 6,
    borderRadius: radius.sm,
  },

  // ── Catalog typing suggestion box ──
  prodSuggestBox: {
    backgroundColor: '#FFFDF5',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: radius.sm,
    padding: 8,
    marginBottom: 10,
  },
  prodSuggestHeading: {
    fontFamily: fonts.bodyMedium,
    fontSize: 10,
    color: '#92400E',
    marginBottom: 4,
  },
  prodSuggestList: {
    gap: 4,
  },
  prodSuggestItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: radius.sm,
  },
  prodSuggestName: {
    flex: 1,
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.ink,
  },
  prodSuggestPrice: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: '#D97706',
  },

  // ── Item Card Bottom Row (Qty, Price, Total) ──
  itemCardBottomRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 8,
  },
  itemFieldMicroLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 10,
    color: colors.inkSoft,
    marginBottom: 4,
  },
  itemQtyControlWrap: {
    flex: 1.1,
    minWidth: 90,
  },
  qtyStepperBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.paperCard,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  stepperBtn: {
    width: 32,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.paper,
  },
  stepperBtnAdd: {
    backgroundColor: colors.clayLight,
  },
  qtyTextInput: {
    flex: 1,
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.ink,
    textAlign: 'center',
    paddingVertical: 6,
  },
  itemPriceInputWrap: {
    flex: 1,
    minWidth: 80,
  },
  priceInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.paperCard,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: 8,
    height: 36,
  },
  currencySymbol: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.inkSoft,
    marginRight: 4,
  },
  priceTextInput: {
    flex: 1,
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.ink,
    padding: 0,
  },
  itemSubtotalWrap: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    height: 36,
    paddingRight: 4,
    minWidth: 60,
  },
  itemSubtotalText: {
    fontFamily: fonts.display,
    fontSize: 16,
    color: colors.clayDeep,
  },

  // ── Custom Values Row inside Item Card ──
  customValuesWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  customFieldItem: {
    flex: 1,
    minWidth: 90,
  },
  customFieldItemLabel: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.inkSoft,
    marginBottom: 2,
  },
  customFieldInput: {
    backgroundColor: colors.paperCard,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.ink,
  },

  // ── Item Action Buttons ──
  itemActionButtonsRow: {
    gap: 10,
    marginTop: 14,
  },
  addCustomItemBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.clayLight,
    borderWidth: 1.5,
    borderColor: colors.clayDeep,
    borderRadius: radius.md,
    paddingVertical: 13,
    paddingHorizontal: 16,
    minHeight: 46,
  },
  addCustomItemBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 13.5,
    color: colors.clayDeep,
  },
  addCatalogItemBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#EFF6FF',
    borderWidth: 1.5,
    borderColor: '#93C5FD',
    borderRadius: radius.md,
    paddingVertical: 13,
    paddingHorizontal: 16,
    minHeight: 46,
  },
  addCatalogItemBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 13.5,
    color: '#1D4ED8',
  },

  // ── Dispatch & Method Chips ──
  methodChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  methodChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  methodChipActive: {
    backgroundColor: colors.clayDeep,
    borderColor: colors.clayDeep,
  },
  methodChipText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.ink,
  },
  methodChipTextActive: {
    color: colors.white,
    fontFamily: fonts.bodyBold,
  },
  quickDateRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
  },
  quickDateBtn: {
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  quickDateText: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.inkSoft,
  },

  // ── Financial Ledger Card ──
  financialSummaryCard: {
    backgroundColor: colors.paper,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 14,
    marginBottom: 14,
  },
  financialRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  financialLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.ink,
  },
  financialTotalVal: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.ink,
  },
  advanceInputSection: {
    marginBottom: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.line,
  },
  advanceLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  quickAdvanceRow: {
    flexDirection: 'row',
    gap: 4,
  },
  quickAdvancePill: {
    backgroundColor: colors.paperCard,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  quickAdvancePillText: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    color: colors.clayDeep,
  },
  balanceRow: {
    marginBottom: 0,
  },
  balanceLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.ink,
  },
  balanceSub: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.inkSoft,
    marginTop: 1,
  },
  balanceBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  balanceBadgePaid: {
    backgroundColor: colors.successLight,
  },
  balanceBadgeDue: {
    backgroundColor: colors.dangerLight,
  },
  balanceBadgeText: {
    fontFamily: fonts.display,
    fontSize: 16,
  },
  balanceTextPaid: {
    color: colors.success,
  },
  balanceTextDue: {
    color: colors.danger,
  },

  // ── Payment Status ──
  paymentStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusChipsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  paymentStatusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  statusPaidActive: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  statusPartialActive: {
    backgroundColor: colors.pending,
    borderColor: colors.pending,
  },
  statusPendingActive: {
    backgroundColor: colors.danger,
    borderColor: colors.danger,
  },
  paymentStatusChipText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.ink,
  },
  paymentStatusChipTextActive: {
    color: colors.white,
    fontFamily: fonts.bodyBold,
  },

  // ── Sticky Bottom Action Bar ──
  stickyBottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.paperCard,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingHorizontal: 16,
    paddingTop: 10,
    ...shadow.card,
  },
  stickyBottomContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    maxWidth: 820,
    alignSelf: 'center',
    width: '100%',
    gap: 12,
  },
  stickyTotalInfo: {
    flex: 1,
    minWidth: 100,
  },
  stickyTotalLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    color: colors.inkSoft,
  },
  stickyTotalCount: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.inkSoft,
  },
  stickyTotalAmount: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.ink,
    lineHeight: 24,
  },
  stickyBalancePending: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: colors.danger,
    marginTop: 1,
  },
  saveOrderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.clayDeep,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: radius.md,
    minWidth: 130,
    ...shadow.card,
  },
  saveOrderButtonText: {
    fontFamily: fonts.bodyBold,
    fontSize: 14.5,
    color: colors.white,
  },

  // ── Modals & Sheets ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalOverlayCenter: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalSheetContainer: {
    backgroundColor: colors.paperCard,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: 20,
    maxHeight: '80%',
    maxWidth: 640,
    width: '100%',
    alignSelf: 'center',
  },
  modalSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  modalSheetTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalSheetTitle: {
    fontFamily: fonts.display,
    fontSize: 18,
    color: colors.ink,
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
  },
  modalSearchInput: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.ink,
    padding: 0,
  },
  emptyListState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  emptyListText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.inkSoft,
  },

  // ── Catalog Modal Items ──
  catalogListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  catalogItemIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: colors.clayLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catalogItemName: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.ink,
  },
  catalogItemUnit: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.inkSoft,
    backgroundColor: colors.paper,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radius.sm,
  },
  catalogItemStock: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: '#059669',
  },
  catalogItemPriceWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  catalogItemPrice: {
    fontFamily: fonts.display,
    fontSize: 15,
    color: colors.ink,
  },
  catalogItemAddBtn: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    backgroundColor: colors.clayDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Customer Modal Items ──
  customerListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  customerAvatar: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.duskLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customerAvatarText: {
    fontFamily: fonts.display,
    fontSize: 15,
    color: colors.duskDeep,
  },
  customerItemName: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.ink,
  },
  customerItemPhone: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.inkSoft,
  },

  // ── Add Column Modal Center ──
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
