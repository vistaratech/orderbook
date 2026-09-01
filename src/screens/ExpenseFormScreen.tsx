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
import { ExpenseCategory, EXPENSE_CATEGORIES } from '../types/order';
import { getExpense, saveExpense } from '../storage/expenseStorage';
import { formatDate, todayIso } from '../utils/format';
import { colors, fonts, radius, shadow, categoryColor } from '../theme/theme';
import { getBusinessProfile } from '../storage/businessProfileStorage';
import { getBusinessPreset } from '../config/businessTypes';
import { useLanguage } from '../i18n/LanguageContext';
import GlassBackButton from '../components/GlassBackButton';
import { SafeAreaView } from 'react-native-safe-area-context';

type Props = NativeStackScreenProps<RootStackParamList, 'ExpenseForm'>;

const PAYMENT_METHODS = ['UPI', 'Cash', 'Card', 'Bank Transfer', 'Other'];

export default function ExpenseFormScreen({ navigation, route }: Props) {
  const { t } = useLanguage();
  const expenseId = route.params?.expenseId;
  const isEditing = !!expenseId;

  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<string>('Raw Materials');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(formatDate(todayIso()));
  const [paymentMethod, setPaymentMethod] = useState('UPI');
  const [saving, setSaving] = useState(false);
  const [categoriesList, setCategoriesList] = useState<string[]>(EXPENSE_CATEGORIES as any);

  useEffect(() => {
    navigation.setOptions({
      title: isEditing ? t('expenses.editExpense') : t('expenses.newExpense'),
    });
  }, [isEditing, navigation, t]);

  useEffect(() => {
    getBusinessProfile().then((profile) => {
      const preset = getBusinessPreset(profile.businessType);
      if (preset.expenseCategories && preset.expenseCategories.length > 0) {
        setCategoriesList(preset.expenseCategories);
        if (!expenseId) {
          setCategory(preset.expenseCategories[0]);
        }
      }
    });

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
                {isEditing ? t('expenses.editExpense', 'Edit Expense') : t('expenses.newExpense', 'Record Outflow')}
              </Text>
            </View>
          </View>

          {/* Amount Section */}
          <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Ionicons name="wallet-outline" size={18} color={colors.outflow} />
            <Text style={styles.sectionTitle}>{t('expenses.amount')}</Text>
          </View>
          <View style={styles.amountInputRow}>
            <Text style={styles.currencySymbol}>₹</Text>
            <TextInput
              style={styles.amountInput}
              value={amount}
              onChangeText={(v) => setAmount(v.replace(/^0+(?=\d)/, ''))}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={colors.inkSoft}
              autoFocus={!isEditing}
              selectTextOnFocus
            />
          </View>
        </View>

        {/* Category Picker */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Ionicons name="pricetag-outline" size={18} color={colors.duskDeep} />
            <Text style={styles.sectionTitle}>{t('expenses.category')}</Text>
          </View>
          <View style={styles.categoryGrid}>
            {categoriesList.map((cat) => {
              const active = cat === category;
              const color = categoryColor[cat as ExpenseCategory] || colors.duskDeep;
              return (
                <Pressable
                  key={cat}
                  style={({ pressed }) => [
                    styles.categoryChip,
                    active && { backgroundColor: color, borderColor: color },
                    pressed && { opacity: 0.8 },
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
          <View style={styles.sectionHeaderRow}>
            <Ionicons name="document-text-outline" size={18} color={colors.clayDeep} />
            <Text style={styles.sectionTitle}>{t('common.details')}</Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{t('expenses.description')}</Text>
            <TextInput
              style={[styles.input, { minHeight: 50 }]}
              value={description}
              onChangeText={setDescription}
              placeholder="e.g. Cotton fabric roll, bubble wrap, electricity"
              placeholderTextColor={colors.inkSoft}
              multiline
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>{t('common.date')}</Text>
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
            <Text style={styles.fieldLabel}>{t('expenses.paymentMode')}</Text>
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
        <Pressable
          style={({ pressed }) => [styles.saveBtn, saving && { opacity: 0.6 }, pressed && { opacity: 0.85 }]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.saveBtnText}>{saving ? t('common.loading') : isEditing ? t('common.update') : t('expenses.saveExpenseBtn')}</Text>
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
    borderRadius: 16,
    paddingHorizontal: 14,
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
    ...shadow.card,
  },
  saveBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    color: colors.white,
  },
});
