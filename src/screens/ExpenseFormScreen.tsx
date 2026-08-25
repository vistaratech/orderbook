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
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { ExpenseCategory, EXPENSE_CATEGORIES } from '../types/order';
import { getExpense, saveExpense } from '../storage/expenseStorage';
import { formatDate, todayIso } from '../utils/format';
import { colors, fonts, radius, categoryColor } from '../theme/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'ExpenseForm'>;

const PAYMENT_METHODS = ['UPI', 'Cash', 'Card', 'Bank Transfer', 'Other'];

export default function ExpenseFormScreen({ navigation, route }: Props) {
  const expenseId = route.params?.expenseId;
  const isEditing = !!expenseId;

  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('Raw Materials');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(formatDate(todayIso()));
  const [paymentMethod, setPaymentMethod] = useState('UPI');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    navigation.setOptions({
      title: isEditing ? 'Edit Expense' : 'Record Outflow',
    });
  }, [isEditing, navigation]);

  useEffect(() => {
    if (expenseId) {
      getExpense(expenseId).then((exp) => {
        if (!exp) return;
        setAmount(String(exp.amount));
        setCategory(exp.category);
        setDescription(exp.description);
        setDate(exp.date);
        setPaymentMethod(exp.paymentMethod);
      });
    }
  }, [expenseId]);

  const handleSave = async () => {
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      Alert.alert('Amount required', 'Please enter a valid expense amount.');
      return;
    }
    if (!description.trim()) {
      Alert.alert('Description required', 'Enter what this expense was for.');
      return;
    }

    setSaving(true);
    await saveExpense({
      id: expenseId,
      amount: parsedAmount,
      category,
      description: description.trim(),
      date: date.trim() || todayIso(),
      paymentMethod,
    });
    setSaving(false);
    navigation.goBack();
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Amount Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Expense Amount</Text>
          <View style={styles.amountInputRow}>
            <Text style={styles.currencySymbol}>₹</Text>
            <TextInput
              style={styles.amountInput}
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={colors.inkSoft}
              autoFocus={!isEditing}
            />
          </View>
        </View>

        {/* Category Picker */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Category</Text>
          <View style={styles.categoryGrid}>
            {EXPENSE_CATEGORIES.map((cat) => {
              const active = cat === category;
              const color = categoryColor[cat] || colors.clayDeep;
              return (
                <Pressable
                  key={cat}
                  style={[
                    styles.categoryChip,
                    active && { backgroundColor: color, borderColor: color },
                  ]}
                  onPress={() => setCategory(cat)}
                >
                  <Text style={[styles.categoryChipText, active && styles.categoryChipTextActive]}>
                    {cat}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Details Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Details</Text>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Description / Notes</Text>
            <TextInput
              style={[styles.input, { minHeight: 50 }]}
              value={description}
              onChangeText={setDescription}
              placeholder="e.g. Cotton fabric roll, bubble wrap, shop electricity"
              placeholderTextColor={colors.inkSoft}
              multiline
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>Date</Text>
              <TextInput
                style={styles.input}
                value={date}
                onChangeText={setDate}
                placeholder="DD-MM-YYYY"
                placeholderTextColor={colors.inkSoft}
              />
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Payment Mode</Text>
            <View style={styles.chipRow}>
              {PAYMENT_METHODS.map((pm) => {
                const active = pm === paymentMethod;
                return (
                  <Pressable
                    key={pm}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setPaymentMethod(pm)}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{pm}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>

        {/* Save Button */}
        <Pressable style={styles.saveBtn} onPress={handleSave} disabled={saving}>
          <Text style={styles.saveBtnText}>{saving ? 'Saving…' : isEditing ? 'Update Expense' : 'Save Expense'}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
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
  },
  section: {
    backgroundColor: colors.paperCard,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 16,
    marginBottom: 16,
    overflow: 'hidden',
  },
  sectionTitle: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.clayDeep,
    marginBottom: 10,
  },
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: colors.outflow,
    paddingBottom: 6,
  },
  currencySymbol: {
    fontFamily: fonts.display,
    fontSize: 36,
    color: colors.outflow,
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    fontFamily: fonts.bodyBold,
    fontSize: 32,
    color: colors.ink,
    padding: 0,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: colors.paper,
  },
  categoryChipText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.ink,
  },
  categoryChipTextActive: {
    fontFamily: fonts.bodyBold,
    color: colors.white,
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
    borderStyle: 'dashed',
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
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.paper,
  },
  chipActive: {
    backgroundColor: colors.duskDeep,
    borderColor: colors.duskDeep,
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
    backgroundColor: colors.outflow,
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
