import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  StyleSheet,
  Alert,
  Share,
  ActivityIndicator,
  Image,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

import { RootStackParamList } from '../navigation/types';
import {
  exportAllData,
  importAllData,
  clearAllData,
  backupToFirebaseCloud,
  restoreFromFirebaseCloud,
} from '../storage/backupStorage';
import { getAuthState, logout, setPinCode, UserAccount } from '../storage/authStorage';
import {
  getBusinessProfile,
  saveBusinessProfile,
  BusinessProfile,
} from '../storage/businessProfileStorage';
import { confirmAction } from '../utils/dialog';
import AppLogo from '../components/AppLogo';
import GlassBackButton from '../components/GlassBackButton';
import DesktopLayout from '../components/DesktopLayout';
import { useLanguage } from '../i18n/LanguageContext';
import { colors, fonts, radius, shadow } from '../theme/theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function SettingsScreen() {
  const navigation = useNavigation<Nav>();
  const { language, setLanguage, t, currentLangOption, availableLanguages } = useLanguage();
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [newPin, setNewPin] = useState('');
  const [profile, setProfile] = useState<BusinessProfile>({
    businessName: '',
    phone: '',
    email: '',
    address: '',
    gstin: '',
    tagline: '',
    logoUri: '',
    bankDetails: '',
  });
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [cloudSyncing, setCloudSyncing] = useState(false);
  const [showImportBox, setShowImportBox] = useState(false);
  const [importJsonText, setImportJsonText] = useState('');

  // Accordion Expand/Collapse States
  const [showBusinessProfile, setShowBusinessProfile] = useState(false);
  const [showCloudBackup, setShowCloudBackup] = useState(false);
  const [showLocalBackup, setShowLocalBackup] = useState(false);
  const [showDangerZone, setShowDangerZone] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const auth = await getAuthState();
      setCurrentUser(auth.user);

      const b = await getBusinessProfile();
      setProfile({
        businessName: b.businessName || auth.user?.businessName || '',
        phone: b.phone || auth.user?.phone || '',
        email: b.email || auth.user?.email || '',
        address: b.address || '',
        gstin: b.gstin || '',
        tagline: b.tagline || '',
        logoUri: b.logoUri || '',
        bankDetails: b.bankDetails || '',
      });
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const handlePickLogo = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission Needed', 'Please allow access to gallery to select logo image.');
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
          setProfile((prev) => ({ ...prev, logoUri: `data:${mime};base64,${asset.base64}` }));
        } else if (asset.uri) {
          setProfile((prev) => ({ ...prev, logoUri: asset.uri }));
        }
      }
    } catch (err) {
      console.error('Error picking logo image:', err);
    }
  };

  const handleSaveProfile = async () => {
    if (!profile.businessName.trim()) {
      Alert.alert('Required Field', 'Business / Shop Name is required.');
      return;
    }
    setSavingProfile(true);
    try {
      await saveBusinessProfile(profile);
      Alert.alert('Saved', 'Business profile & invoice branding saved successfully!');
    } catch {
      Alert.alert('Error', 'Could not save business profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleUpdatePin = async () => {
    if (newPin.trim().length !== 4) {
      Alert.alert('Invalid PIN', 'PIN must be exactly 4 digits.');
      return;
    }
    await setPinCode(newPin.trim());
    setNewPin('');
    Alert.alert('Success', 'Passcode PIN updated successfully!');
  };

  const handleLogout = () => {
    confirmAction({
      title: 'Log Out',
      message: 'Are you sure you want to log out of your session?',
      confirmText: 'Log Out',
      cancelText: 'Cancel',
      destructive: true,
      onConfirm: async () => {
        await logout();
        navigation.reset({
          index: 0,
          routes: [{ name: 'Login' }],
        });
      },
    });
  };

  const handleRelaunchWizard = () => {
    navigation.navigate('OnboardingWizard');
  };

  const handleExport = async () => {
    try {
      const data = await exportAllData();
      await Share.share({
        title: 'KadaiBook Backup',
        message: data,
      });
    } catch (e) {
      Alert.alert('Export Error', 'Could not export data.');
    }
  };

  const handleImport = async () => {
    if (!importJsonText.trim()) {
      Alert.alert('Empty Data', 'Please paste the backup JSON text.');
      return;
    }
    confirmAction({
      title: 'Confirm Restore',
      message: 'Restoring data will merge / overwrite existing items. Continue?',
      confirmText: 'Restore',
      cancelText: 'Cancel',
      onConfirm: async () => {
        const success = await importAllData(importJsonText);
        if (success) {
          setImportJsonText('');
          setShowImportBox(false);
          Alert.alert('Success', 'Data restored successfully! Please restart or refresh the app.');
        } else {
          Alert.alert('Invalid Format', 'The pasted text is not valid backup JSON.');
        }
      },
    });
  };

  const handleCloudBackup = async () => {
    setCloudSyncing(true);
    const res = await backupToFirebaseCloud();
    setCloudSyncing(false);
    if (res.success) {
      Alert.alert('Cloud Backup Success', `All store data backed up to Cloud Firestore at ${res.timestamp}!`);
    } else {
      Alert.alert('Cloud Backup Failed', res.error || 'Could not connect to Firebase database.');
    }
  };

  const handleCloudRestore = () => {
    confirmAction({
      title: 'Restore from Firebase',
      message: 'This will download and restore your saved records from Firebase Cloud. Continue?',
      confirmText: 'Restore Now',
      cancelText: 'Cancel',
      onConfirm: async () => {
        setCloudSyncing(true);
        const res = await restoreFromFirebaseCloud();
        setCloudSyncing(false);
        if (res.success) {
          Alert.alert('Success', 'Cloud data restored successfully! Restarting view.');
        } else {
          Alert.alert('Restore Failed', res.error || 'No backup found on Firebase.');
        }
      },
    });
  };

  const handleClearAll = () => {
    confirmAction({
      title: 'Clear All Data',
      message: 'This will permanently delete all orders, expenses, customers, and catalog items. This action CANNOT be undone!',
      confirmText: 'Delete Everything',
      cancelText: 'Cancel',
      destructive: true,
      onConfirm: async () => {
        await clearAllData();
        Alert.alert('Cleared', 'All records have been removed.');
        await loadSettings();
      },
    });
  };

  if (loading) {
    return (
      <View style={[styles.screen, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={colors.clayDeep} size="large" />
      </View>
    );
  }

  return (
    <DesktopLayout currentTabName="Settings">
      <SafeAreaView style={styles.screen} edges={['top']}>
        {/* Top Header Bar */}
        <View style={styles.topHeader}>
          <GlassBackButton label={t('common.back')} />
          <View style={{ flex: 1 }}>
            <Text style={styles.topHeaderTitle}>{t('settings.title')}</Text>
            <Text style={styles.topHeaderSub}>{t('settings.subtitle')}</Text>
          </View>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ─── App Language Selection Card ─── */}
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="language-outline" size={18} color={colors.clayDeep} />
                <Text style={styles.sectionTitle}>{t('settings.languageSection')}</Text>
              </View>
              <View style={styles.activeLangBadge}>
                <Text style={styles.activeLangBadgeText}>{currentLangOption.nativeLabel}</Text>
              </View>
            </View>
            <Text style={styles.sectionSub}>{t('settings.languageSubtitle')}</Text>

            <View style={styles.langGrid}>
              {availableLanguages.map((item) => {
                const isActive = language === item.code;
                return (
                  <Pressable
                    key={item.code}
                    style={({ pressed }) => [
                      styles.langCard,
                      isActive && styles.langCardActive,
                      pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] },
                    ]}
                    onPress={() => setLanguage(item.code)}
                  >
                    <View style={styles.langTopRow}>
                      <Text style={styles.langFlag}>{item.flag}</Text>
                      {isActive && (
                        <Ionicons name="checkmark-circle" size={14} color={colors.white} />
                      )}
                    </View>
                    <Text
                      style={[styles.langNative, isActive && styles.langNativeActive]}
                      numberOfLines={1}
                    >
                      {item.nativeLabel}
                    </Text>
                    <Text
                      style={[styles.langEnglish, isActive && styles.langEnglishActive]}
                      numberOfLines={1}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* ─── Account & Security Section ─── */}
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="key-outline" size={18} color={colors.clayDeep} />
                <Text style={styles.sectionTitle}>{t('settings.accountSecurity')}</Text>
              </View>
              <View
                style={[
                  styles.roleBadge,
                  { backgroundColor: currentUser?.role === 'guest' ? colors.duskLight : colors.clayLight },
                ]}
              >
                <Text
                  style={[
                    styles.roleBadgeText,
                    { color: currentUser?.role === 'guest' ? colors.duskDeep : colors.clayDeep },
                  ]}
                >
                  {currentUser?.role === 'guest' ? t('settings.publicVisitor') : t('settings.storeOwner')}
                </Text>
              </View>
            </View>

            {currentUser?.name ? (
              <View style={styles.userCard}>
                <View style={styles.userAvatar}>
                  <Text style={styles.userAvatarText}>{currentUser.name.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{currentUser.name}</Text>
                  <Text style={styles.userEmail}>{currentUser.email || currentUser.phone || 'KadaiBook User'}</Text>
                </View>
              </View>
            ) : null}

            {/* Quick PIN Security Box */}
            <View style={styles.pinSecurityCard}>
              <View style={styles.pinSecurityHeader}>
                <Ionicons name="shield-checkmark-outline" size={16} color={colors.duskDeep} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.pinSecurityTitle}>{t('settings.securityPinTitle')}</Text>
                  <Text style={styles.pinSecuritySub}>{t('settings.securityPinSub')}</Text>
                </View>
              </View>

              <View style={styles.pinInputRow}>
                <TextInput
                  style={styles.pinInput}
                  value={newPin}
                  onChangeText={setNewPin}
                  keyboardType="number-pad"
                  maxLength={4}
                  placeholder="••••"
                  placeholderTextColor={colors.inkSoft}
                  secureTextEntry
                />
                <Pressable
                  style={({ pressed }) => [
                    styles.updatePinBtn,
                    pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
                  ]}
                  onPress={handleUpdatePin}
                >
                  <Text style={styles.updatePinBtnText}>{t('settings.updatePinBtn')}</Text>
                </Pressable>
              </View>
            </View>

            {/* Onboarding Wizard shortcut */}
            <Pressable
              style={({ pressed }) => [styles.wizardBtn, pressed && { opacity: 0.8 }]}
              onPress={handleRelaunchWizard}
            >
              <Ionicons name="sparkles-outline" size={16} color={colors.duskDeep} />
              <Text style={styles.wizardBtnText}>{t('settings.reopenWizard')}</Text>
            </Pressable>

            {/* Logout Button */}
            <Pressable
              style={({ pressed }) => [styles.logoutBtn, pressed && { opacity: 0.8 }]}
              onPress={handleLogout}
            >
              <Ionicons name="log-out-outline" size={16} color={colors.danger} />
              <Text style={styles.logoutBtnText}>{t('settings.logoutBtn')}</Text>
            </Pressable>
          </View>

          {/* ─── Expandable Business Profile Section ─── */}
          <View style={styles.section}>
            <Pressable
              style={styles.accordionHeader}
              onPress={() => setShowBusinessProfile(!showBusinessProfile)}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                <Ionicons name="business-outline" size={18} color={colors.clayDeep} />
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={styles.sectionTitle}>{t('settings.businessProfile')}</Text>
                  <Text style={styles.sectionSub} numberOfLines={1}>
                    {profile.businessName ? profile.businessName : t('settings.businessProfileSub')}
                  </Text>
                </View>
              </View>
              <Ionicons
                name={showBusinessProfile ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={colors.clayDeep}
              />
            </Pressable>

            {showBusinessProfile && (
              <View style={{ marginTop: 14 }}>
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>{t('settings.shopName')} *</Text>
                  <TextInput
                    style={styles.input}
                    value={profile.businessName}
                    onChangeText={(v) => setProfile((prev) => ({ ...prev, businessName: v }))}
                    placeholder="e.g. KadaiBook Store"
                    placeholderTextColor={colors.inkSoft}
                  />
                </View>

                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>{t('settings.tagline')}</Text>
                  <TextInput
                    style={styles.input}
                    value={profile.tagline || ''}
                    onChangeText={(v) => setProfile((prev) => ({ ...prev, tagline: v }))}
                    placeholder="e.g. Quality Wholesale Fabrics & Retail"
                    placeholderTextColor={colors.inkSoft}
                  />
                </View>

                {/* Company Logo Photo Picker */}
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>{t('settings.logo')}</Text>
                  <View style={styles.logoPickerRow}>
                    {profile.logoUri ? (
                      <View style={styles.logoPreviewWrap}>
                        <Image source={{ uri: profile.logoUri }} style={styles.logoPreviewImage} />
                        <Pressable
                          style={styles.logoRemoveBtn}
                          onPress={() => setProfile((prev) => ({ ...prev, logoUri: '' }))}
                        >
                          <Ionicons name="close-circle" size={20} color={colors.danger} />
                        </Pressable>
                      </View>
                    ) : (
                      <View style={styles.logoPlaceholderBox}>
                        <Ionicons name="image-outline" size={24} color={colors.inkSoft} />
                        <Text style={styles.logoPlaceholderText}>No Logo</Text>
                      </View>
                    )}

                    <View style={styles.logoPickerActions}>
                      <Pressable
                        style={({ pressed }) => [styles.pickLogoBtn, pressed && { opacity: 0.85 }]}
                        onPress={handlePickLogo}
                      >
                        <Ionicons name="camera-outline" size={15} color={colors.white} />
                        <Text style={styles.pickLogoBtnText}>
                          {profile.logoUri ? 'Change Logo Photo' : 'Choose Logo Photo'}
                        </Text>
                      </Pressable>
                      <Text style={styles.hint}>
                        Logo photo printed on invoices and receipts!
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>{t('settings.phone')}</Text>
                  <TextInput
                    style={styles.input}
                    value={profile.phone}
                    onChangeText={(v) => setProfile((prev) => ({ ...prev, phone: v }))}
                    placeholder="e.g. +91 9876543210"
                    placeholderTextColor={colors.inkSoft}
                    keyboardType="phone-pad"
                  />
                </View>

                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>{t('settings.email')}</Text>
                  <TextInput
                    style={styles.input}
                    value={profile.email || ''}
                    onChangeText={(v) => setProfile((prev) => ({ ...prev, email: v }))}
                    placeholder="e.g. sales@mybusiness.com"
                    placeholderTextColor={colors.inkSoft}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>

                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>{t('settings.address')}</Text>
                  <TextInput
                    style={[styles.input, { minHeight: 54, textAlignVertical: 'top' }]}
                    value={profile.address}
                    onChangeText={(v) => setProfile((prev) => ({ ...prev, address: v }))}
                    placeholder="e.g. No 42, Main Bazaar, City"
                    placeholderTextColor={colors.inkSoft}
                    multiline
                    numberOfLines={2}
                  />
                </View>

                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>{t('settings.gstin')}</Text>
                  <TextInput
                    style={styles.input}
                    value={profile.gstin || ''}
                    onChangeText={(v) => setProfile((prev) => ({ ...prev, gstin: v }))}
                    placeholder="e.g. 33AAAAA0000A1Z5"
                    placeholderTextColor={colors.inkSoft}
                    autoCapitalize="characters"
                  />
                </View>

                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>{t('settings.bankDetails')}</Text>
                  <TextInput
                    style={[styles.input, { minHeight: 54, textAlignVertical: 'top' }]}
                    value={profile.bankDetails || ''}
                    onChangeText={(v) => setProfile((prev) => ({ ...prev, bankDetails: v }))}
                    placeholder="e.g. UPI ID: mybusiness@upi • GPay: 9876543210"
                    placeholderTextColor={colors.inkSoft}
                    multiline
                    numberOfLines={2}
                  />
                </View>

                <Pressable
                  style={({ pressed }) => [
                    styles.saveProfileBtn,
                    savingProfile && { opacity: 0.6 },
                    pressed && { opacity: 0.88, transform: [{ scale: 0.99 }] },
                  ]}
                  onPress={handleSaveProfile}
                  disabled={savingProfile}
                >
                  {savingProfile ? (
                    <ActivityIndicator color={colors.white} size="small" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle" size={18} color={colors.white} />
                      <Text style={styles.saveProfileBtnText}>{t('settings.saveBranding')}</Text>
                    </>
                  )}
                </Pressable>
              </View>
            )}
          </View>

          {/* ─── Expandable Firebase Cloud Sync & Backup Section ─── */}
          <View style={[styles.section, { borderColor: '#E0C895', backgroundColor: '#FCF9F3' }]}>
            <Pressable
              style={styles.accordionHeader}
              onPress={() => setShowCloudBackup(!showCloudBackup)}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                <Ionicons name="cloud-done" size={20} color={colors.clayDeep} />
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={styles.sectionTitle}>{t('settings.cloudBackup')}</Text>
                  <Text style={styles.sectionSub} numberOfLines={1}>{t('settings.cloudBackupSub')}</Text>
                </View>
              </View>
              <Ionicons
                name={showCloudBackup ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={colors.clayDeep}
              />
            </Pressable>

            {showCloudBackup && (
              <View style={[styles.backupActions, { marginTop: 14 }]}>
                <Pressable
                  style={({ pressed }) => [
                    styles.backupBtn,
                    { backgroundColor: colors.clayDeep },
                    pressed && { opacity: 0.85 },
                  ]}
                  onPress={handleCloudBackup}
                  disabled={cloudSyncing}
                >
                  {cloudSyncing ? (
                    <ActivityIndicator size="small" color={colors.white} />
                  ) : (
                    <>
                      <Ionicons name="cloud-upload" size={18} color={colors.white} />
                      <Text style={styles.backupBtnText}>{t('settings.backupToCloud')}</Text>
                    </>
                  )}
                </Pressable>

                <Pressable
                  style={({ pressed }) => [
                    styles.backupBtn,
                    { backgroundColor: colors.paperCard, borderWidth: 1, borderColor: colors.clayDeep },
                    pressed && { opacity: 0.85 },
                  ]}
                  onPress={handleCloudRestore}
                  disabled={cloudSyncing}
                >
                  <Ionicons name="cloud-download" size={18} color={colors.clayDeep} />
                  <Text style={[styles.backupBtnText, { color: colors.clayDeep }]}>{t('settings.restoreCloud')}</Text>
                </Pressable>
              </View>
            )}
          </View>

          {/* ─── Expandable Local JSON File Backup Section ─── */}
          <View style={styles.section}>
            <Pressable
              style={styles.accordionHeader}
              onPress={() => setShowLocalBackup(!showLocalBackup)}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                <Ionicons name="document-text-outline" size={18} color={colors.duskDeep} />
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={styles.sectionTitle}>{t('settings.localBackup')}</Text>
                  <Text style={styles.sectionSub} numberOfLines={1}>{t('settings.localBackupSub')}</Text>
                </View>
              </View>
              <Ionicons
                name={showLocalBackup ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={colors.duskDeep}
              />
            </Pressable>

            {showLocalBackup && (
              <View style={{ marginTop: 14 }}>
                <View style={styles.backupActions}>
                  <Pressable
                    style={({ pressed }) => [styles.backupBtn, pressed && { opacity: 0.85 }]}
                    onPress={handleExport}
                  >
                    <Ionicons name="download-outline" size={18} color={colors.white} />
                    <Text style={styles.backupBtnText}>{t('settings.exportJson')}</Text>
                  </Pressable>

                  <Pressable
                    style={({ pressed }) => [
                      styles.backupBtn,
                      { backgroundColor: colors.paperCard, borderWidth: 1, borderColor: colors.duskDeep },
                      pressed && { opacity: 0.85 },
                    ]}
                    onPress={() => setShowImportBox(!showImportBox)}
                  >
                    <Ionicons name="code-download-outline" size={18} color={colors.duskDeep} />
                    <Text style={[styles.backupBtnText, { color: colors.duskDeep }]}>
                      {showImportBox ? 'Hide Import Box' : t('settings.importJson')}
                    </Text>
                  </Pressable>
                </View>

                {showImportBox && (
                  <View style={styles.importBox}>
                    <Text style={styles.fieldLabel}>Paste Backup JSON text here:</Text>
                    <TextInput
                      style={styles.jsonInput}
                      value={importJsonText}
                      onChangeText={setImportJsonText}
                      placeholder="Paste the exported JSON data here…"
                      placeholderTextColor={colors.inkSoft}
                      multiline
                    />
                    <Pressable
                      style={({ pressed }) => [styles.applyRestoreBtn, pressed && { opacity: 0.85 }]}
                      onPress={handleImport}
                    >
                      <Text style={styles.applyRestoreText}>Apply Restore</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            )}
          </View>

          {/* ─── Expandable Danger Zone Section ─── */}
          <View style={[styles.section, styles.dangerSection]}>
            <Pressable
              style={styles.accordionHeader}
              onPress={() => setShowDangerZone(!showDangerZone)}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                <Ionicons name="warning-outline" size={18} color={colors.danger} />
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={[styles.sectionTitle, { color: colors.danger }]}>{t('settings.dangerZone')}</Text>
                  <Text style={styles.sectionSub} numberOfLines={1}>{t('settings.dangerZoneSub')}</Text>
                </View>
              </View>
              <Ionicons
                name={showDangerZone ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={colors.danger}
              />
            </Pressable>

            {showDangerZone && (
              <View style={{ marginTop: 14 }}>
                <Pressable
                  style={({ pressed }) => [styles.clearBtn, pressed && { opacity: 0.85 }]}
                  onPress={handleClearAll}
                >
                  <Ionicons name="trash" size={16} color={colors.danger} />
                  <Text style={styles.clearBtnText}>Reset / Clear All Records</Text>
                </Pressable>
              </View>
            )}
          </View>

          {/* Brand Footer */}
          <View style={{ alignItems: 'center', marginTop: 16, marginBottom: 20 }}>
            <AppLogo
              size={50}
              variant="vertical"
              showTagline
              taglineText="KadaiBook v1.5.0 • kadaibook.in"
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    </DesktopLayout>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  content: {
    padding: 20,
    paddingBottom: 60,
    width: '100%',
    maxWidth: 900,
    alignSelf: 'center',
  },
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
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  sectionTitle: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.clayDeep,
  },
  sectionSub: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.inkSoft,
    marginTop: 2,
  },
  accordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  roleBadgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
  },
  dangerSection: {
    borderColor: colors.dangerLight,
    borderLeftWidth: 4,
    borderLeftColor: colors.danger,
  },
  activeLangBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: colors.clayLight,
    borderWidth: 1,
    borderColor: 'rgba(184, 80, 66, 0.2)',
  },
  activeLangBadgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: colors.clayDeep,
  },
  langGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  langCard: {
    width: '31.5%',
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  langCardActive: {
    backgroundColor: colors.clayDeep,
    borderColor: colors.clayDeep,
    ...shadow.card,
  },
  langTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginBottom: 3,
  },
  langFlag: {
    fontSize: 14,
    fontFamily: fonts.bodyBold,
    color: colors.inkSoft,
  },
  langNative: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.ink,
    textAlign: 'center',
  },
  langNativeActive: {
    color: colors.white,
  },
  langEnglish: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.inkSoft,
    textAlign: 'center',
    marginTop: 1,
  },
  langEnglishActive: {
    color: 'rgba(255, 255, 255, 0.85)',
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.paper,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    marginTop: 12,
    marginBottom: 14,
  },
  userAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.clayDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatarText: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.white,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    color: colors.ink,
  },
  userEmail: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.inkSoft,
    marginTop: 2,
  },
  pinSecurityCard: {
    backgroundColor: colors.paper,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 12,
    marginBottom: 14,
  },
  pinSecurityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  pinSecurityTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.ink,
  },
  pinSecuritySub: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.inkSoft,
    marginTop: 1,
  },
  pinInputRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  pinInput: {
    flex: 1,
    backgroundColor: colors.paperCard,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontFamily: fonts.bodyBold,
    fontSize: 18,
    letterSpacing: 8,
    color: colors.ink,
    textAlign: 'center',
  },
  updatePinBtn: {
    backgroundColor: colors.duskDeep,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadow.card,
  },
  updatePinBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.white,
  },
  wizardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingVertical: 11,
    marginBottom: 10,
  },
  wizardBtnText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.duskDeep,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFF5F5',
    borderWidth: 1,
    borderColor: 'rgba(235, 87, 87, 0.3)',
    borderRadius: radius.md,
    paddingVertical: 11,
  },
  logoutBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.danger,
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
  saveProfileBtn: {
    backgroundColor: colors.clayDeep,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
    ...shadow.card,
  },
  saveProfileBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.white,
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
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.paperCard,
  },
  logoPreviewImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
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
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.paperCard,
    borderWidth: 1,
    borderColor: colors.line,
    borderStyle: 'dashed' as any,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoPlaceholderText: {
    fontSize: 8,
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
    paddingVertical: 7,
    borderRadius: radius.sm,
    alignSelf: 'flex-start',
  },
  pickLogoBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: colors.white,
  },
  backupActions: {
    gap: 10,
  },
  backupBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.duskDeep,
    borderRadius: radius.md,
    paddingVertical: 13,
    ...shadow.card,
  },
  backupBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.white,
  },
  importBox: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    borderStyle: 'dashed' as any,
  },
  jsonInput: {
    backgroundColor: colors.paper,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 10,
    fontFamily: 'monospace',
    fontSize: 11,
    color: colors.ink,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 10,
  },
  applyRestoreBtn: {
    backgroundColor: colors.clayDeep,
    borderRadius: radius.sm,
    paddingVertical: 10,
    alignItems: 'center',
  },
  applyRestoreText: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.white,
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: radius.md,
    paddingVertical: 12,
  },
  clearBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.danger,
  },
});

