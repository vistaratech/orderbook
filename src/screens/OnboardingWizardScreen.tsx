import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { RootStackParamList } from '../navigation/types';
import { registerUser, loginAsGuest } from '../storage/authStorage';
import { colors, fonts, radius, shadow } from '../theme/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'OnboardingWizard'>;

const SLIDES = [
  {
    title: 'Your Digital Order Book',
    subtitle: 'Digitize your notebook orders with fulfillment tracking, status stamps, and WhatsApp receipts.',
    icon: 'book-outline' as const,
    color: colors.clayDeep,
    accent: colors.clayLight,
  },
  {
    title: 'Master Business Outflow',
    subtitle: 'Track raw materials, courier, packaging, rent, and overheads. Know your true net profit at all times.',
    icon: 'trending-up-outline' as const,
    color: colors.duskDeep,
    accent: colors.duskLight,
  },
  {
    title: 'Instant P&L & Analytics',
    subtitle: 'Get automated financial statements, best-selling product reports, and customer spend insights.',
    icon: 'bar-chart-outline' as const,
    color: colors.statusPlaced,
    accent: '#F9ECD2',
  },
];

export default function OnboardingWizardScreen({ navigation }: Props) {
  const [currentStep, setCurrentStep] = useState(0); // 0, 1, 2 = tour slides, 3 = store setup

  // Form states for Step 3
  const [businessName, setBusinessName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [saving, setSaving] = useState(false);

  const handleNext = () => {
    if (currentStep < 2) {
      setCurrentStep(currentStep + 1);
    } else {
      setCurrentStep(3); // Go to setup form
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleFinishSetup = async () => {
    if (!businessName.trim()) {
      Alert.alert('Store Name required', 'Please enter your business or store name.');
      return;
    }
    if (!ownerName.trim()) {
      Alert.alert('Name required', 'Please enter your name.');
      return;
    }
    if (!email.trim()) {
      Alert.alert('Email required', 'Please enter your email to create your account.');
      return;
    }
    if (!password.trim() || password.trim().length < 6) {
      Alert.alert('Password Required', 'Password must be at least 6 characters.');
      return;
    }
    if (pin.trim().length > 0 && pin.trim().length !== 4) {
      Alert.alert('Invalid PIN', 'Quick unlock PIN must be exactly 4 digits.');
      return;
    }

    setSaving(true);
    try {
      await registerUser({
        name: ownerName.trim(),
        businessName: businessName.trim(),
        phone: phone.trim(),
        email: email.trim(),
        password: password.trim(),
        pin: pin.trim() || undefined,
      });
      navigation.replace('MainTabs');
    } catch (e: any) {
      const code = e?.code;
      let msg = 'Could not complete setup. Please try again.';
      if (code === 'auth/email-already-in-use') {
        msg = 'This email is already registered! Please go to Log In.';
      } else if (code === 'auth/weak-password') {
        msg = 'Password is too weak. Use at least 6 characters.';
      } else if (code === 'auth/invalid-email') {
        msg = 'The email address is not valid.';
      } else if (code === 'auth/network-request-failed') {
        msg = 'Network error. Please check your internet connection.';
      }
      Alert.alert('Setup Error', msg);
    } finally {
      setSaving(false);
    }
  };

  const handleExplorePublic = async () => {
    await loginAsGuest();
    navigation.replace('MainTabs');
  };

  const handleGoToLogin = () => {
    navigation.navigate('Login');
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Top Header / Skip Bar */}
        <View style={styles.topBar}>
          {currentStep > 0 ? (
            <Pressable onPress={handleBack} style={styles.topBtn}>
              <Ionicons name="arrow-back" size={20} color={colors.ink} />
            </Pressable>
          ) : (
            <View style={{ width: 36 }} />
          )}

          {/* Dots Indicator */}
          <View style={styles.dotsRow}>
            {[0, 1, 2, 3].map((idx) => (
              <View
                key={idx}
                style={[
                  styles.dot,
                  currentStep === idx && styles.dotActive,
                  currentStep === idx && {
                    backgroundColor:
                      idx < 3 ? SLIDES[idx].color : colors.clayDeep,
                  },
                ]}
              />
            ))}
          </View>

          <Pressable onPress={handleExplorePublic} style={styles.topBtn}>
            <Text style={styles.skipText}>Public Mode</Text>
          </Pressable>
        </View>

        {/* Content Body */}
        {currentStep < 3 ? (
          <View style={styles.slideContainer}>
            {/* Icon Graphic Box */}
            <View
              style={[
                styles.iconGraphicWrap,
                { backgroundColor: SLIDES[currentStep].accent },
              ]}
            >
              <Ionicons
                name={SLIDES[currentStep].icon}
                size={70}
                color={SLIDES[currentStep].color}
              />
            </View>

            <Text style={styles.slideTitle}>{SLIDES[currentStep].title}</Text>
            <Text style={styles.slideSubtitle}>
              {SLIDES[currentStep].subtitle}
            </Text>

            <View style={styles.slideSpacer} />

            {/* Bottom Actions */}
            <View style={styles.bottomActions}>
              <Pressable
                style={[
                  styles.nextBtn,
                  { backgroundColor: SLIDES[currentStep].color },
                ]}
                onPress={handleNext}
              >
                <Text style={styles.nextBtnText}>
                  {currentStep === 2 ? 'Start Setup Wizard' : 'Next Step'}
                </Text>
                <Ionicons name="arrow-forward" size={18} color={colors.white} />
              </Pressable>

              <Pressable style={styles.loginLinkBtn} onPress={handleGoToLogin}>
                <Text style={styles.loginLinkText}>
                  Already have an account? <Text style={styles.boldUnderline}>Log In</Text>
                </Text>
              </Pressable>
            </View>
          </View>
        ) : (
          /* Step 3: Fast Store & Owner Setup Form */
          <ScrollView
            contentContainerStyle={styles.formScrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.formHeader}>
              <Text style={styles.formTitle}>Store & Security Setup</Text>
              <Text style={styles.formSubtitle}>
                Set up your business notebook and 4-digit unlock passcode.
              </Text>
            </View>

            <View style={styles.card}>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Business / Brand Name *</Text>
                <TextInput
                  style={styles.input}
                  value={businessName}
                  onChangeText={setBusinessName}
                  placeholder="e.g. Lotus Boutique, Craft Studio"
                  placeholderTextColor={colors.inkSoft}
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Owner / Your Name *</Text>
                <TextInput
                  style={styles.input}
                  value={ownerName}
                  onChangeText={setOwnerName}
                  placeholder="e.g. Ananya Kumar"
                  placeholderTextColor={colors.inkSoft}
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Business Phone Number</Text>
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
                <Text style={styles.fieldLabel}>Email Address *</Text>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  placeholder="owner@example.com"
                  placeholderTextColor={colors.inkSoft}
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Password * (min 6 characters)</Text>
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  placeholder="Create a secure password"
                  placeholderTextColor={colors.inkSoft}
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Quick 4-Digit Unlock PIN (Optional)</Text>
                <TextInput
                  style={[styles.input, { letterSpacing: 8, fontSize: 20 }]}
                  value={pin}
                  onChangeText={setPin}
                  keyboardType="number-pad"
                  maxLength={4}
                  placeholder="1234"
                  placeholderTextColor={colors.inkSoft}
                  secureTextEntry
                />
                <Text style={styles.helperText}>
                  Optional quick unlock for this device
                </Text>
              </View>
            </View>

            <Pressable
              style={styles.completeBtn}
              onPress={handleFinishSetup}
              disabled={saving}
            >
              <Text style={styles.completeBtnText}>
                {saving ? 'Setting Up…' : 'Launch Order Book 🚀'}
              </Text>
            </Pressable>

            <Pressable style={styles.loginLinkBtn} onPress={handleGoToLogin}>
              <Text style={styles.loginLinkText}>
                Or <Text style={styles.boldUnderline}>Log In</Text> with existing credentials
              </Text>
            </Pressable>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  flex: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  topBtn: {
    padding: 6,
  },
  skipText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.clayDeep,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.line,
  },
  dotActive: {
    width: 20,
  },
  slideContainer: {
    flex: 1,
    paddingHorizontal: 28,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 20,
  },
  iconGraphicWrap: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
    ...shadow.card,
  },
  slideTitle: {
    fontFamily: fonts.display,
    fontSize: 34,
    color: colors.ink,
    textAlign: 'center',
    marginBottom: 12,
  },
  slideSubtitle: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.inkSoft,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 10,
  },
  slideSpacer: {
    flex: 1,
  },
  bottomActions: {
    width: '100%',
    paddingBottom: 24,
    gap: 14,
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: radius.md,
    ...shadow.card,
  },
  nextBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    color: colors.white,
  },
  loginLinkBtn: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  loginLinkText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.inkSoft,
  },
  boldUnderline: {
    fontFamily: fonts.bodyBold,
    color: colors.clayDeep,
  },
  formScrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  formHeader: {
    marginBottom: 16,
  },
  formTitle: {
    fontFamily: fonts.display,
    fontSize: 32,
    color: colors.clayDeep,
  },
  formSubtitle: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.inkSoft,
    marginTop: 2,
  },
  card: {
    backgroundColor: colors.paperCard,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 16,
    marginBottom: 16,
    ...shadow.card,
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
  helperText: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.inkSoft,
    marginTop: 4,
  },
  completeBtn: {
    backgroundColor: colors.clayDeep,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: 'center',
    ...shadow.card,
  },
  completeBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    color: colors.white,
  },
});
