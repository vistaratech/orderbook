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
import { getCustomer, saveCustomer } from '../storage/customerStorage';
import { useLanguage } from '../i18n/LanguageContext';
import { colors, fonts, radius, shadow } from '../theme/theme';
import GlassBackButton from '../components/GlassBackButton';
import { SafeAreaView } from 'react-native-safe-area-context';

type Props = NativeStackScreenProps<RootStackParamList, 'CustomerForm'>;

export default function CustomerFormScreen({ navigation, route }: Props) {
  const { t } = useLanguage();
  const customerId = route.params?.customerId;
  const isEditing = !!customerId;

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    navigation.setOptions({
      title: isEditing ? t('customers.editCustomer') : t('customers.addCustomerBtn'),
    });
  }, [isEditing, navigation, t]);

  useEffect(() => {
    if (customerId) {
      getCustomer(customerId).then((c) => {
        if (!c) return;
        setName(c.name);
        setPhone(c.phone || '');
        setEmail(c.email || '');
        setAddress(c.address || '');
        setNotes(c.notes || '');
      });
    }
  }, [customerId]);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Name required', 'Please enter customer name.');
      return;
    }

    setSaving(true);
    await saveCustomer({
      id: customerId,
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim() || undefined,
      address: address.trim() || undefined,
      notes: notes.trim() || undefined,
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
                {isEditing ? t('customers.editCustomer', 'Edit Customer') : t('customers.addCustomerBtn', 'Add Customer')}
              </Text>
            </View>
          </View>

          <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Ionicons name="person-outline" size={18} color={colors.clayDeep} />
            <Text style={styles.sectionTitle}>{t('customers.customerProfileTitle')}</Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{t('customers.name')} *</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Priya Sharma"
              placeholderTextColor={colors.inkSoft}
              autoFocus={!isEditing}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{t('customers.phone')}</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              placeholder="10-digit mobile number"
              placeholderTextColor={colors.inkSoft}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{t('customers.email')}</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholder="Optional email"
              placeholderTextColor={colors.inkSoft}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{t('customers.address')}</Text>
            <TextInput
              style={[styles.input, { minHeight: 50 }]}
              value={address}
              onChangeText={setAddress}
              placeholder="Street, City, Pincode"
              placeholderTextColor={colors.inkSoft}
              multiline
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{t('common.notes')}</Text>
            <TextInput
              style={[styles.input, { minHeight: 50 }]}
              value={notes}
              onChangeText={setNotes}
              placeholder="e.g. Preferred courier, special packaging, VIP client"
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
            {saving ? t('common.loading') : isEditing ? t('common.update') : t('customers.saveCustomerBtn')}
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
  saveBtn: {
    backgroundColor: colors.clayDeep,
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
