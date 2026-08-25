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
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { RootStackParamList } from '../navigation/types';
import {
  exportAllData,
  importAllData,
  clearAllData,
  backupToFirebaseCloud,
  restoreFromFirebaseCloud,
} from '../storage/backupStorage';
import { getAuthState, logout, setPinCode, UserAccount } from '../storage/authStorage';
import { confirmAction } from '../utils/dialog';
import { colors, fonts, radius, shadow } from '../theme/theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const BUSINESS_KEY = 'order_book:business_profile';

interface BusinessProfile {
  businessName: string;
  phone: string;
  address: string;
  taxId?: string;
  currency: string;
}

export default function SettingsScreen() {
  const navigation = useNavigation<Nav>();
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [newPin, setNewPin] = useState('');
  const [profile, setProfile] = useState<BusinessProfile>({
    businessName: '',
    phone: '',
    address: '',
    taxId: '',
    currency: '₹ INR',
  });
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [cloudSyncing, setCloudSyncing] = useState(false);
  const [showImportBox, setShowImportBox] = useState(false);
  const [importJsonText, setImportJsonText] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const auth = await getAuthState();
      setCurrentUser(auth.user);

      const raw = await AsyncStorage.getItem(BUSINESS_KEY);
      if (raw) {
        setProfile(JSON.parse(raw));
      } else if (auth.user?.businessName) {
        setProfile((prev) => ({
          ...prev,
          businessName: auth.user!.businessName,
          phone: auth.user!.phone,
        }));
      }
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!profile.businessName.trim()) {
      Alert.alert('Required', 'Business name is required.');
      return;
    }
    setSavingProfile(true);
    try {
      await AsyncStorage.setItem(BUSINESS_KEY, JSON.stringify(profile));
      Alert.alert('Saved', 'Business profile updated successfully!');
    } catch {
      Alert.alert('Error', 'Could not save profile.');
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
        title: 'Order Book Backup',
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
      Alert.alert('☁️ Cloud Backup Success', `All store data backed up to Firebase Realtime Database at ${res.timestamp}!`);
    } else {
      Alert.alert('Cloud Backup Failed', res.error || 'Could not connect to Firebase database.');
    }
  };

  const handleCloudRestore = () => {
    confirmAction({
      title: '☁️ Restore from Firebase',
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
      title: '⚠️ Clear All Data',
      message: 'This will permanently delete all orders, expenses, customers, and catalog items. This action CANNOT be undone!',
      confirmText: 'Delete Everything',
      cancelText: 'Cancel',
      destructive: true,
      onConfirm: async () => {
        await clearAllData();
        Alert.alert('Cleared', 'All records have been removed.');
      },
    });
  };

  if (loading) {
    return (
      <View style={styles.screen}>
        <ActivityIndicator color={colors.clayDeep} style={{ marginTop: 40 }} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {/* Account & Security Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Account & Passcode</Text>
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
              {currentUser?.role === 'guest' ? 'Public Visitor' : 'Store Owner'}
            </Text>
          </View>
        </View>
        <Text style={styles.sectionSub}>Manage your unlock PIN and session access</Text>

        {currentUser?.name ? (
          <View style={styles.userCard}>
            <View style={styles.userAvatar}>
              <Text style={styles.userAvatarText}>{currentUser.name.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.userName}>{currentUser.name}</Text>
              <Text style={styles.userEmail}>{currentUser.email || 'No email'}</Text>
            </View>
          </View>
        ) : null}

        {/* Change PIN Box */}
        <View style={styles.pinChangeBox}>
          <Text style={styles.fieldLabel}>Set New 4-Digit Unlock PIN</Text>
          <View style={styles.pinInputRow}>
            <TextInput
              style={styles.pinInput}
              value={newPin}
              onChangeText={setNewPin}
              keyboardType="number-pad"
              maxLength={4}
              placeholder="e.g. 5678"
              placeholderTextColor={colors.inkSoft}
              secureTextEntry
            />
            <Pressable style={styles.updatePinBtn} onPress={handleUpdatePin}>
              <Text style={styles.updatePinBtnText}>Update PIN</Text>
            </Pressable>
          </View>
        </View>

        {/* Onboarding Wizard shortcut */}
        <Pressable style={styles.wizardBtn} onPress={handleRelaunchWizard}>
          <Ionicons name="sparkles-outline" size={16} color={colors.duskDeep} />
          <Text style={styles.wizardBtnText}>Re-open Setup Wizard / Feature Tour</Text>
        </Pressable>

        {/* Logout Button */}
        <Pressable style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={16} color={colors.danger} />
          <Text style={styles.logoutBtnText}>Log Out of Session</Text>
        </Pressable>
      </View>

      {/* Business Profile Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Business Profile</Text>
        <Text style={styles.sectionSub}>Used on receipts, invoices & shared reports</Text>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Business / Store Name</Text>
          <TextInput
            style={styles.input}
            value={profile.businessName}
            onChangeText={(v) => setProfile({ ...profile, businessName: v })}
            placeholder="e.g. Handmade Studio & Crafts"
            placeholderTextColor={colors.inkSoft}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Business Contact / Phone</Text>
          <TextInput
            style={styles.input}
            value={profile.phone}
            onChangeText={(v) => setProfile({ ...profile, phone: v })}
            placeholder="e.g. +91 98765 43210"
            placeholderTextColor={colors.inkSoft}
            keyboardType="phone-pad"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Business Address / City</Text>
          <TextInput
            style={[styles.input, { minHeight: 45 }]}
            value={profile.address}
            onChangeText={(v) => setProfile({ ...profile, address: v })}
            placeholder="e.g. 12 Bazaar Street, Chennai"
            placeholderTextColor={colors.inkSoft}
            multiline
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>GST / Tax ID (Optional)</Text>
          <TextInput
            style={styles.input}
            value={profile.taxId}
            onChangeText={(v) => setProfile({ ...profile, taxId: v })}
            placeholder="e.g. 33AAAAA0000A1Z5"
            placeholderTextColor={colors.inkSoft}
          />
        </View>

        <Pressable style={styles.saveProfileBtn} onPress={handleSaveProfile} disabled={savingProfile}>
          <Text style={styles.saveProfileBtnText}>{savingProfile ? 'Saving…' : 'Save Business Profile'}</Text>
        </Pressable>
      </View>

      {/* Firebase Cloud Sync & Backup Section */}
      <View style={[styles.section, { borderColor: '#E0C895', backgroundColor: '#FCF9F3' }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <Ionicons name="cloud-done" size={20} color={colors.clayDeep} />
          <Text style={styles.sectionTitle}>Firebase Cloud Backup</Text>
        </View>
        <Text style={styles.sectionSub}>Sync your orders, customers & ledger to Firebase Realtime Database</Text>

        <View style={styles.backupActions}>
          <Pressable
            style={[styles.backupBtn, { backgroundColor: colors.clayDeep }]}
            onPress={handleCloudBackup}
            disabled={cloudSyncing}
          >
            {cloudSyncing ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <>
                <Ionicons name="cloud-upload" size={18} color={colors.white} />
                <Text style={styles.backupBtnText}>Backup to Cloud</Text>
              </>
            )}
          </Pressable>

          <Pressable
            style={[styles.backupBtn, { backgroundColor: colors.paperCard, borderWidth: 1, borderColor: colors.clayDeep }]}
            onPress={handleCloudRestore}
            disabled={cloudSyncing}
          >
            <Ionicons name="cloud-download" size={18} color={colors.clayDeep} />
            <Text style={[styles.backupBtnText, { color: colors.clayDeep }]}>Restore Cloud</Text>
          </Pressable>
        </View>
      </View>

      {/* Local JSON Backup Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Local File Backup</Text>
        <Text style={styles.sectionSub}>Export / import JSON file locally</Text>

        <View style={styles.backupActions}>
          <Pressable style={styles.backupBtn} onPress={handleExport}>
            <Ionicons name="download-outline" size={18} color={colors.white} />
            <Text style={styles.backupBtnText}>Export Backup JSON</Text>
          </Pressable>

          <Pressable
            style={[styles.backupBtn, { backgroundColor: colors.paperCard, borderWidth: 1, borderColor: colors.duskDeep }]}
            onPress={() => setShowImportBox(!showImportBox)}
          >
            <Ionicons name="code-download-outline" size={18} color={colors.duskDeep} />
            <Text style={[styles.backupBtnText, { color: colors.duskDeep }]}>
              {showImportBox ? 'Hide Import Box' : 'Import JSON'}
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
            <Pressable style={styles.applyRestoreBtn} onPress={handleImport}>
              <Text style={styles.applyRestoreText}>Apply Restore</Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* Danger Zone */}
      <View style={[styles.section, styles.dangerSection]}>
        <Text style={[styles.sectionTitle, { color: colors.danger }]}>Danger Zone</Text>
        <Text style={styles.sectionSub}>Irreversible actions on local records</Text>

        <Pressable style={styles.clearBtn} onPress={handleClearAll}>
          <Ionicons name="trash" size={16} color={colors.danger} />
          <Text style={styles.clearBtnText}>Reset / Clear All Records</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  content: {
    padding: 16,
    paddingBottom: 60,
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
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
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
  sectionTitle: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.clayDeep,
    marginBottom: 2,
  },
  sectionSub: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.inkSoft,
    marginBottom: 14,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.paper,
    padding: 10,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: 14,
  },
  userAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.clayDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatarText: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.white,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.ink,
  },
  userEmail: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.inkSoft,
  },
  pinChangeBox: {
    marginBottom: 14,
  },
  pinInputRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  pinInput: {
    flex: 1,
    fontFamily: fonts.bodyBold,
    fontSize: 18,
    letterSpacing: 6,
    color: colors.ink,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    borderStyle: 'dashed',
    paddingVertical: 6,
  },
  updatePinBtn: {
    backgroundColor: colors.duskDeep,
    paddingHorizontal: 14,
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  updatePinBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: colors.white,
  },
  wizardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
    paddingVertical: 10,
    marginBottom: 10,
  },
  wizardBtnText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.duskDeep,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.dangerLight,
    borderRadius: radius.sm,
    paddingVertical: 10,
  },
  logoutBtnText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
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
    borderStyle: 'dashed',
    paddingVertical: 6,
  },
  saveProfileBtn: {
    backgroundColor: colors.clayDeep,
    borderRadius: radius.sm,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  saveProfileBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
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
    borderRadius: radius.sm,
    paddingVertical: 12,
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
    borderStyle: 'dashed',
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
    borderRadius: radius.sm,
    paddingVertical: 12,
  },
  clearBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.danger,
  },
});
