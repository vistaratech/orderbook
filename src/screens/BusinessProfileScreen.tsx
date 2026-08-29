import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import * as ImagePicker from 'expo-image-picker';

import { colors, fonts, radius, shadow } from '../theme/theme';
import {
  getBusinessProfile,
  saveBusinessProfile,
  BusinessProfile,
} from '../storage/businessProfileStorage';
import AppLogo from '../components/AppLogo';
import GlassBackButton from '../components/GlassBackButton';
import { useLanguage } from '../i18n/LanguageContext';
import {
  BusinessType,
  BUSINESS_TYPES_LIST,
  BUSINESS_TYPE_PRESETS,
} from '../config/businessTypes';

export default function BusinessProfileScreen() {
  const navigation = useNavigation();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [businessName, setBusinessName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [gstin, setGstin] = useState('');
  const [tagline, setTagline] = useState('');
  const [logoUri, setLogoUri] = useState('');
  const [bankDetails, setBankDetails] = useState('');
  const [businessType, setBusinessType] = useState<BusinessType>('general');

  useEffect(() => {
    getBusinessProfile().then((profile) => {
      setBusinessName(profile.businessName || '');
      setPhone(profile.phone || '');
      setEmail(profile.email || '');
      setAddress(profile.address || '');
      setGstin(profile.gstin || '');
      setTagline(profile.tagline || '');
      setLogoUri(profile.logoUri || '');
      setBankDetails(profile.bankDetails || '');
      setBusinessType(profile.businessType || 'general');
      setLoading(false);
    });
  }, []);

  const handlePickLogo = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Permission Needed',
          'Please allow access to your photo gallery to select a logo image.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        if (asset.base64) {
          const mime = asset.mimeType || 'image/png';
          setLogoUri(`data:${mime};base64,${asset.base64}`);
        } else if (asset.uri) {
          setLogoUri(asset.uri);
        }
      }
    } catch (err) {
      console.error('Error picking logo image:', err);
      Alert.alert('Error', 'Could not open image picker.');
    }
  };

  const handleSave = async () => {
    if (!businessName.trim()) {
      Alert.alert('Required Field', 'Please enter your Business / Shop Name.');
      return;
    }

    setSaving(true);
    try {
      await saveBusinessProfile({
        businessName: businessName.trim(),
        phone: phone.trim(),
        email: email.trim(),
        address: address.trim(),
        gstin: gstin.trim(),
        tagline: tagline.trim(),
        logoUri: logoUri.trim(),
        bankDetails: bankDetails.trim(),
        businessType,
      });

      Alert.alert('Success', 'Business profile & invoice branding saved successfully!');
      navigation.goBack();
    } catch (err) {
      Alert.alert('Error', 'Failed to save business profile.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.loaderWrap}>
          <ActivityIndicator color={colors.clayDeep} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      {/* Top Header Bar */}
      <View style={styles.topHeader}>
        <GlassBackButton label={t('common.back')} />
        <View style={{ flex: 1 }}>
          <Text style={styles.topHeaderTitle}>{t('profile.title')}</Text>
          <Text style={styles.topHeaderSub}>{t('profile.subtitle')}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header Banner */}
        <View style={styles.bannerCard}>
          <View style={styles.bannerIconWrap}>
            {logoUri ? (
              <Image source={{ uri: logoUri }} style={styles.logoImage} />
            ) : (
              <AppLogo size={44} variant="icon" />
            )}
          </View>
          <View style={styles.bannerTextBlock}>
            <Text style={styles.bannerTitle}>{t('profile.title')}</Text>
            <Text style={styles.bannerSubtitle}>{t('profile.subtitle')}</Text>
          </View>
        </View>

        {/* ─── Business Type Selector ─── */}
        <View style={styles.card}>
          <Text style={styles.cardSectionTitle}>{t('products.category')}</Text>
          <View style={styles.typeGrid}>
            {BUSINESS_TYPES_LIST.map((typeKey) => {
              const preset = BUSINESS_TYPE_PRESETS[typeKey];
              const isSelected = businessType === typeKey;
              return (
                <Pressable
                  key={typeKey}
                  style={[
                    styles.typeCard,
                    isSelected && styles.typeCardSelected,
                  ]}
                  onPress={() => setBusinessType(typeKey)}
                >
                  <View style={[
                    styles.typeIconBox,
                    isSelected && { backgroundColor: colors.clayDeep },
                  ]}>
                    <Ionicons
                      name={preset.icon as any}
                      size={18}
                      color={isSelected ? colors.white : colors.clayDeep}
                    />
                  </View>
                  <Text style={[
                    styles.typeLabel,
                    isSelected && { color: colors.clayDeep, fontFamily: fonts.bodyBold },
                  ]}>
                    {preset.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* ─── Basic Company Info ─── */}
        <View style={styles.card}>
          <Text style={styles.cardSectionTitle}>{t('profile.shopName')}</Text>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>{t('profile.shopName')} *</Text>
            <TextInput
              style={styles.input}
              value={businessName}
              onChangeText={setBusinessName}
              placeholder="e.g. KadaiBook Store"
              placeholderTextColor={colors.inkSoft}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>{t('profile.tagline')}</Text>
            <TextInput
              style={styles.input}
              value={tagline}
              onChangeText={setTagline}
              placeholder="e.g. Quality Wholesale Fabrics & Apparel"
              placeholderTextColor={colors.inkSoft}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>{t('profile.uploadLogo')}</Text>
            <View style={styles.logoPickerRow}>
              {logoUri ? (
                <View style={styles.logoPreviewWrap}>
                  <Image source={{ uri: logoUri }} style={styles.logoPreviewImage} />
                  <Pressable
                    style={styles.logoRemoveBtn}
                    onPress={() => setLogoUri('')}
                  >
                    <Ionicons name="close-circle" size={20} color={colors.danger} />
                  </Pressable>
                </View>
              ) : (
                <View style={styles.logoPlaceholderBox}>
                  <Ionicons name="image-outline" size={28} color={colors.inkSoft} />
                  <Text style={styles.logoPlaceholderText}>{t('profile.uploadLogo')}</Text>
                </View>
              )}

              <View style={styles.logoPickerActions}>
                <Pressable
                  style={({ pressed }) => [
                    styles.pickLogoBtn,
                    pressed && { opacity: 0.85 },
                  ]}
                  onPress={handlePickLogo}
                >
                  <Ionicons name="camera-outline" size={16} color={colors.white} />
                  <Text style={styles.pickLogoBtnText}>
                    {logoUri ? t('profile.changeLogo') : t('profile.uploadLogo')}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>

        {/* ─── Contact & Address ─── */}
        <View style={styles.card}>
          <View style={styles.sectionHeaderTitleRow}>
            <Ionicons name="location-outline" size={16} color={colors.clayDeep} />
            <Text style={styles.cardSectionTitle}>{t('customers.address')}</Text>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>{t('profile.phone')}</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              placeholder="e.g. +91 9876543210"
              placeholderTextColor={colors.inkSoft}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>{t('profile.email')}</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              placeholder="e.g. sales@mybusiness.com"
              placeholderTextColor={colors.inkSoft}
              autoCapitalize="none"
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>{t('profile.address')}</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={address}
              onChangeText={setAddress}
              multiline
              numberOfLines={3}
              placeholder="e.g. No 42, Main Bazaar, Chennai"
              placeholderTextColor={colors.inkSoft}
            />
          </View>
        </View>

        {/* ─── Tax & Bank Details ─── */}
        <View style={styles.card}>
          <View style={styles.sectionHeaderTitleRow}>
            <Ionicons name="card-outline" size={16} color={colors.clayDeep} />
            <Text style={styles.cardSectionTitle}>{t('profile.bankDetails')}</Text>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>{t('profile.gstin')}</Text>
            <TextInput
              style={styles.input}
              value={gstin}
              onChangeText={setGstin}
              placeholder="e.g. 33AAAAA0000A1Z5"
              placeholderTextColor={colors.inkSoft}
              autoCapitalize="characters"
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>{t('profile.bankDetails')}</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={bankDetails}
              onChangeText={setBankDetails}
              multiline
              numberOfLines={2}
              placeholder="e.g. UPI ID: shop@upi • GPay: 9876543210"
              placeholderTextColor={colors.inkSoft}
            />
          </View>
        </View>

        {/* Save Action Button */}
        <Pressable
          style={({ pressed }) => [
            styles.saveBtn,
            saving && { opacity: 0.7 },
            pressed && { opacity: 0.85 },
          ]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <>
              <Ionicons name="checkmark-done" size={20} color={colors.white} />
              <Text style={styles.saveBtnText}>{t('profile.saveProfileBtn')}</Text>
            </>
          )}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: {
    padding: 20,
    paddingBottom: 60,
    width: '100%',
    maxWidth: 860,
    alignSelf: 'center',
  },
  loaderWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  bannerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.clayLight,
    padding: 16,
    borderRadius: radius.md,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.clayDeep,
  },
  bannerIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.paperCard,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logoImage: { width: 44, height: 44, borderRadius: 22, resizeMode: 'cover' },
  bannerTextBlock: { flex: 1 },
  bannerTitle: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.clayDeep },
  bannerSubtitle: { fontFamily: fonts.body, fontSize: 11, color: colors.inkSoft, marginTop: 2 },

  card: {
    backgroundColor: colors.paperCard,
    borderRadius: radius.md,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.line,
    ...shadow.card,
  },
  sectionHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  cardSectionTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.ink,
  },
  fieldGroup: { marginBottom: 14 },
  label: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.ink, marginBottom: 5 },
  input: {
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.ink,
  },
  textArea: {
    height: 64,
    textAlignVertical: 'top',
  },
  hint: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.inkSoft,
    marginTop: 4,
  },

  logoPickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.paper,
    padding: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
  },
  logoPreviewWrap: {
    position: 'relative',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.paperCard,
  },
  logoPreviewImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    resizeMode: 'cover',
  },
  logoRemoveBtn: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: colors.white,
    borderRadius: 10,
  },
  logoPlaceholderBox: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.paperCard,
    borderWidth: 1,
    borderColor: colors.line,
    borderStyle: 'dashed' as any,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoPlaceholderText: {
    fontSize: 7,
    fontFamily: fonts.body,
    color: colors.inkSoft,
    marginTop: 2,
  },
  logoPickerActions: {
    flex: 1,
  },
  pickLogoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.clayDeep,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.sm,
    alignSelf: 'flex-start',
  },
  pickLogoBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: colors.white,
  },

  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.clayDeep,
    borderRadius: radius.md,
    paddingVertical: 14,
    marginTop: 10,
    ...shadow.card,
  },
  saveBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    color: colors.white,
  },

  // Business Type Selector Grid
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  typeCard: {
    width: '30%' as any,
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paperCard,
  },
  typeCardSelected: {
    borderColor: colors.clayDeep,
    backgroundColor: colors.clayLight,
    borderWidth: 2,
  },
  typeIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.clayLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  typeLabel: {
    fontFamily: fonts.body,
    fontSize: 9,
    color: colors.inkSoft,
    textAlign: 'center',
  },

  // Custom Header Styles
  topHeader: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.paper,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  backBtn: {
    padding: 4,
  },
  topHeaderTitle: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.ink,
  },
  topHeaderSub: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.inkSoft,
  },
});
