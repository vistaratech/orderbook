import React, { useState, useEffect } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { RootStackParamList } from '../navigation/types';
import { registerUser } from '../storage/authStorage';
import { useGoogleAuth } from '../hooks/useGoogleAuth';
import AppLogo from '../components/AppLogo';
import { useLanguage } from '../i18n/LanguageContext';
import { colors, fonts, radius, shadow } from '../theme/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Register'>;

export default function RegisterScreen({ navigation }: Props) {
  const { t } = useLanguage();
  const [businessName, setBusinessName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [saving, setSaving] = useState(false);

  // ─── Google Sign Up ─────────────────────────────────────────────
  const { signInWithGoogle, loading: googleLoading, error: googleError } = useGoogleAuth({
    onSuccess: () => navigation.replace('MainTabs'),
  });

  useEffect(() => {
    if (googleError) {
      Alert.alert('Google Sign-In', googleError);
    }
  }, [googleError]);

  const handleGoogleSignUp = async () => {
    await signInWithGoogle();
  };

  const handleRegister = async () => {
    if (!businessName.trim()) {
      Alert.alert('Store Name required', 'Please enter your business or store name.');
      return;
    }
    if (!ownerName.trim()) {
      Alert.alert('Name required', 'Please enter your name.');
      return;
    }
    if (!email.trim()) {
      Alert.alert('Email required', 'Please enter your email.');
      return;
    }
    if (!password.trim() || password.trim().length < 6) {
      Alert.alert('Password Required', 'Password must be at least 6 characters long.');
      return;
    }
    if (pin.trim().length > 0 && pin.trim().length !== 4) {
      Alert.alert('Invalid PIN', 'Quick PIN must be exactly 4 digits.');
      return;
    }

    setSaving(true);
    try {
      await registerUser({
        name: ownerName.trim(),
        businessName: businessName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        password: password.trim(),
        pin: pin.trim() || undefined,
      });
      navigation.replace('MainTabs');
    } catch (e: any) {
      const code = e?.code;
      let msg = 'Registration failed. Please check your details and try again.';
      if (code === 'auth/email-already-in-use') {
        msg = 'This email is already registered! Please go to Log In.';
      } else if (code === 'auth/weak-password') {
        msg = 'Password is too weak. Please use at least 6 characters.';
      } else if (code === 'auth/invalid-email') {
        msg = 'The email address is formatted incorrectly.';
      } else if (code === 'auth/operation-not-allowed') {
        msg = 'Email/Password provider is not enabled in your Firebase Console.';
      } else if (code === 'auth/network-request-failed') {
        msg = 'Network connection error. Please check your internet.';
      }
      Alert.alert('Registration Error', msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={{ alignItems: 'center', marginBottom: 12 }}>
              <AppLogo size={56} variant="icon" />
            </View>
            <Text style={styles.title}>{t('auth.registerTitle')}</Text>
            <Text style={styles.subtitle}>
              {t('auth.registerSubtitle')}
            </Text>
          </View>

          {/* ── Top Auth Tabs (Sign In / Create Account) ──── */}
          <View style={styles.modeTabs}>
            <Pressable
              style={styles.modeTab}
              onPress={() => navigation.navigate('Login')}
            >
              <Ionicons
                name="log-in-outline"
                size={16}
                color={colors.inkSoft}
              />
              <Text style={styles.modeTabText}>
                {t('auth.signInTab')}
              </Text>
            </Pressable>

            <Pressable
              style={[styles.modeTab, styles.modeTabActive]}
            >
              <Ionicons
                name="person-add-outline"
                size={15}
                color={colors.white}
              />
              <Text
                style={[
                  styles.modeTabText,
                  styles.modeTabTextActive,
                ]}
              >
                {t('auth.createAccountTab')}
              </Text>
            </Pressable>
          </View>

          {/* Google Sign Up Button */}
          <Pressable
            style={({ pressed }) => [
              styles.googleBtn,
              googleLoading && styles.googleBtnDisabled,
              pressed && { opacity: 0.85 },
            ]}
            onPress={handleGoogleSignUp}
            disabled={googleLoading || saving}
          >
            <Ionicons name="logo-google" size={18} color="#EA4335" />
            <Text style={styles.googleBtnText}>
              {googleLoading ? 'Connecting…' : t('auth.googleSignUp')}
            </Text>
          </Pressable>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>{t('auth.orEmailSignUp')}</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Form Card */}
          <View style={styles.card}>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>{t('auth.businessName')} *</Text>
              <TextInput
                style={styles.input}
                value={businessName}
                onChangeText={setBusinessName}
                placeholder={t('auth.businessNamePlaceholder')}
                placeholderTextColor={colors.inkSoft}
                autoFocus
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>{t('auth.ownerName')} *</Text>
              <TextInput
                style={styles.input}
                value={ownerName}
                onChangeText={setOwnerName}
                placeholder={t('auth.ownerNamePlaceholder')}
                placeholderTextColor={colors.inkSoft}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>{t('auth.email')} *</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholder={t('auth.emailPlaceholder')}
                placeholderTextColor={colors.inkSoft}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>{t('auth.phone')}</Text>
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                placeholder={t('auth.phonePlaceholder')}
                placeholderTextColor={colors.inkSoft}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>{t('auth.password')} * (min 6)</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholder={t('auth.passwordPlaceholder')}
                placeholderTextColor={colors.inkSoft}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>{t('auth.quickPin')} {t('auth.pinOptional')}</Text>
              <TextInput
                style={[styles.input, { letterSpacing: 8, fontSize: 18 }]}
                value={pin}
                onChangeText={setPin}
                keyboardType="number-pad"
                maxLength={4}
                secureTextEntry
                placeholder="1234"
                placeholderTextColor={colors.inkSoft}
              />
            </View>
          </View>

          <Pressable
            style={({ pressed }) => [styles.submitBtn, saving && { opacity: 0.6 }, pressed && { opacity: 0.85 }]}
            onPress={handleRegister}
            disabled={saving}
          >
            <Text style={styles.submitBtnText}>
              {saving ? 'Creating Account…' : t('auth.createAccountBtn')}
            </Text>
          </Pressable>

          <Pressable
            style={styles.loginLink}
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={styles.loginLinkText}>
              {t('auth.haveAccount')}{' '}
              <Text style={styles.loginBold}>{t('auth.signIn')}</Text>
            </Text>
          </Pressable>
        </ScrollView>
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
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  header: {
    marginBottom: 16,
    alignItems: 'center',
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 34,
    color: colors.clayDeep,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.inkSoft,
    marginTop: 2,
    textAlign: 'center',
  },
  modeTabs: {
    flexDirection: 'row',
    backgroundColor: colors.paperCard,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 3,
    width: '100%',
    marginBottom: 20,
  },
  modeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 18,
  },
  modeTabActive: {
    backgroundColor: colors.clayDeep,
  },
  modeTabText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.inkSoft,
  },
  modeTabTextActive: {
    color: colors.white,
    fontFamily: fonts.bodyBold,
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.paperCard,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingVertical: 14,
    marginBottom: 4,
    ...shadow.card,
  },
  googleBtnDisabled: {
    opacity: 0.6,
  },
  googleBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    color: colors.ink,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 14,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.line,
  },
  dividerText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.inkSoft,
    marginHorizontal: 12,
  },
  card: {
    backgroundColor: colors.paperCard,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 18,
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
    borderStyle: 'dashed' as any,
    paddingVertical: 6,
  },
  submitBtn: {
    backgroundColor: colors.clayDeep,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: 'center',
    ...shadow.card,
  },
  submitBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    color: colors.white,
  },
  loginLink: {
    alignItems: 'center',
    marginTop: 16,
    paddingVertical: 6,
  },
  loginLinkText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.inkSoft,
  },
  loginBold: {
    fontFamily: fonts.bodyBold,
    color: colors.clayDeep,
  },
});
