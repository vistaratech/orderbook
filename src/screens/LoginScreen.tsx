import React, { useState, useEffect } from 'react';
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
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { RootStackParamList } from '../navigation/types';
import {
  loginWithPin,
  loginWithPassword,
  loginAsGuest,
  sendResetPassword,
  registerUser,
} from '../storage/authStorage';
import { useGoogleAuth } from '../hooks/useGoogleAuth';
import AppLogo from '../components/AppLogo';
import { useLanguage } from '../i18n/LanguageContext';
import { colors, fonts, radius, shadow } from '../theme/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

type LoginMode = 'email' | 'pin';

export default function LoginScreen({ navigation, route }: Props) {
  const { language, setLanguage, t, currentLangOption, availableLanguages } = useLanguage();
  const [showLangModal, setShowLangModal] = useState(false);
  const [authTab, setAuthTab] = useState<'login' | 'register'>(route?.params?.initialTab || 'login');
  const [mode, setMode] = useState<LoginMode>('email');

  // Update tab if route param changes
  useEffect(() => {
    if (route?.params?.initialTab) {
      setAuthTab(route.params.initialTab);
    }
  }, [route?.params?.initialTab]);

  // Email state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Register state
  const [businessName, setBusinessName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [regPin, setRegPin] = useState('');
  const [registering, setRegistering] = useState(false);

  // PIN state
  const [pin, setPin] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // ─── Google Sign In / Up ───────────────────────────────────────────
  const { signInWithGoogle, loading: googleLoading, error: googleError } = useGoogleAuth({
    onSuccess: () => navigation.replace('MainTabs'),
  });

  useEffect(() => {
    if (googleError) {
      setErrorMessage(googleError);
      Alert.alert('Google Sign-In', googleError);
    }
  }, [googleError]);

  const handleGoogleSignIn = async () => {
    setErrorMessage(null);
    await signInWithGoogle();
  };

  // ─── Register Handler ─────────────────────────────────────────────
  const handleRegister = async () => {
    setErrorMessage(null);
    if (!businessName.trim()) {
      const msg = 'Please enter your business or store name.';
      setErrorMessage(msg);
      Alert.alert('Store Name Required', msg);
      return;
    }
    if (!ownerName.trim()) {
      const msg = 'Please enter your name.';
      setErrorMessage(msg);
      Alert.alert('Name Required', msg);
      return;
    }
    if (!regEmail.trim()) {
      const msg = 'Please enter your email.';
      setErrorMessage(msg);
      Alert.alert('Email Required', msg);
      return;
    }
    if (!regPassword.trim() || regPassword.trim().length < 6) {
      const msg = 'Password must be at least 6 characters long.';
      setErrorMessage(msg);
      Alert.alert('Password Required', msg);
      return;
    }
    if (regPin.trim().length > 0 && regPin.trim().length !== 4) {
      const msg = 'Quick PIN must be exactly 4 digits.';
      setErrorMessage(msg);
      Alert.alert('Invalid PIN', msg);
      return;
    }

    setRegistering(true);
    try {
      await registerUser({
        name: ownerName.trim(),
        businessName: businessName.trim(),
        email: regEmail.trim(),
        phone: phone.trim(),
        password: regPassword.trim(),
        pin: regPin.trim() || undefined,
      });
      navigation.replace('MainTabs');
    } catch (e: any) {
      const code = e?.code;
      let msg = 'Registration failed. Please check your details and try again.';
      if (code === 'auth/email-already-in-use') {
        msg = 'This email is already registered! Please switch to Sign In.';
      } else if (code === 'auth/weak-password') {
        msg = 'Password is too weak. Please use at least 6 characters.';
      } else if (code === 'auth/invalid-email') {
        msg = 'The email address is formatted incorrectly.';
      } else if (code === 'auth/operation-not-allowed') {
        msg = 'Email/Password provider is not enabled in your Firebase Console.';
      } else if (code === 'auth/network-request-failed') {
        msg = 'Network connection error. Please check your internet.';
      }
      setErrorMessage(msg);
      Alert.alert('Registration Error', msg);
    } finally {
      setRegistering(false);
    }
  };

  // ─── Email Login ──────────────────────────────────────────────────
  const handleEmailLogin = async () => {
    setErrorMessage(null);
    if (!email.trim()) {
      const msg = 'Please enter your email address.';
      setErrorMessage(msg);
      Alert.alert('Email Required', msg);
      return;
    }
    if (!password) {
      const msg = 'Please enter your password.';
      setErrorMessage(msg);
      Alert.alert('Password Required', msg);
      return;
    }

    setLoading(true);
    const result = await loginWithPassword(email.trim(), password);
    setLoading(false);
    if (result.success) {
      navigation.replace('MainTabs');
    } else {
      const msg = result.error || 'Invalid email or password. Please check your credentials.';
      setErrorMessage(msg);
      Alert.alert('Login Failed', msg);
    }
  };

  // ─── PIN Login ────────────────────────────────────────────────────
  const handlePinDigit = (digit: string) => {
    if (errorMessage) setErrorMessage(null);
    if (pin.length < 4) {
      const newPin = pin + digit;
      setPin(newPin);
      if (newPin.length === 4) {
        verifyPin(newPin);
      }
    }
  };

  const handlePinDelete = () => {
    if (errorMessage) setErrorMessage(null);
    if (pin.length > 0) {
      setPin(pin.slice(0, -1));
    }
  };

  const verifyPin = async (inputPin: string) => {
    setLoading(true);
    setErrorMessage(null);
    const ok = await loginWithPin(inputPin);
    setLoading(false);
    if (ok) {
      navigation.replace('MainTabs');
    } else {
      const msg = 'Incorrect PIN. The PIN you entered is incorrect.';
      setErrorMessage(msg);
      Alert.alert('Incorrect PIN', msg);
      setPin('');
    }
  };

  // ─── Forgot Password State & Handler ─────────────────────────────
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState<string | null>(null);
  const [forgotError, setForgotError] = useState<string | null>(null);

  const handleForgotPassword = () => {
    setForgotEmail(email.trim());
    setForgotError(null);
    setForgotSuccess(null);
    setShowForgotModal(true);
  };

  const handleSendResetEmail = async () => {
    setForgotError(null);
    setForgotSuccess(null);
    if (!forgotEmail.trim() || !forgotEmail.includes('@')) {
      setForgotError('Please enter a valid email address.');
      return;
    }

    setForgotLoading(true);
    const result = await sendResetPassword(forgotEmail.trim());
    setForgotLoading(false);

    if (result.success) {
      setForgotSuccess(`Password reset email sent to ${forgotEmail.trim()}! Please check your inbox (and spam folder) to set a new password.`);
    } else {
      setForgotError(result.error || 'Failed to send password reset email.');
    }
  };

  // ─── Guest ────────────────────────────────────────────────────────
  const handleGuestExplore = async () => {
    await loginAsGuest();
    navigation.replace('MainTabs');
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
          {/* ── Top Bar with Language Selector ────────── */}
          <View style={styles.topBarRow}>
            <Pressable
              style={({ pressed }) => [
                styles.langDropdownBtn,
                pressed && { opacity: 0.8 },
              ]}
              onPress={() => setShowLangModal(true)}
            >
              <Ionicons name="globe-outline" size={15} color={colors.clayDeep} />
              <Text style={styles.langDropdownText}>
                {currentLangOption.flag} {currentLangOption.nativeLabel}
              </Text>
              <Ionicons name="chevron-down" size={13} color={colors.inkSoft} />
            </Pressable>
          </View>

          {/* ── Logo & Brand ─────────────────────────────── */}
          <View style={styles.brandHeader}>
            <AppLogo
              size={84}
              variant="vertical"
              taglineText={t('auth.subtitle')}
            />
          </View>

          {/* ── Top Auth Tabs (Sign In / Create Account) ──── */}
          <View style={styles.modeTabs}>
            <Pressable
              style={[styles.modeTab, authTab === 'login' && styles.modeTabActive]}
              onPress={() => {
                setErrorMessage(null);
                setAuthTab('login');
              }}
            >
              <Ionicons
                name="log-in-outline"
                size={16}
                color={authTab === 'login' ? colors.white : colors.inkSoft}
              />
              <Text
                style={[
                  styles.modeTabText,
                  authTab === 'login' && styles.modeTabTextActive,
                ]}
              >
                {t('auth.signInTab')}
              </Text>
            </Pressable>

            <Pressable
              style={[styles.modeTab, authTab === 'register' && styles.modeTabActive]}
              onPress={() => {
                setErrorMessage(null);
                setAuthTab('register');
              }}
            >
              <Ionicons
                name="person-add-outline"
                size={15}
                color={authTab === 'register' ? colors.white : colors.inkSoft}
              />
              <Text
                style={[
                  styles.modeTabText,
                  authTab === 'register' && styles.modeTabTextActive,
                ]}
              >
                {t('auth.createAccountTab')}
              </Text>
            </Pressable>
          </View>

          {/* ── Auth Form Card (Sign In / Register) ─────────── */}
          {authTab === 'login' ? (
            <View style={styles.emailCard}>
              {/* Inline Error Message */}
              {errorMessage ? (
                <View style={styles.errorContainer}>
                  <Ionicons name="alert-circle-outline" size={20} color={colors.danger} style={styles.errorIcon} />
                  <Text style={styles.errorText}>{errorMessage}</Text>
                  <Pressable onPress={() => setErrorMessage(null)} style={styles.errorDismissBtn} hitSlop={8}>
                    <Ionicons name="close-circle" size={18} color={colors.danger} />
                  </Pressable>
                </View>
              ) : null}

              {/* Google Sign In Button */}
              <Pressable
                style={({ pressed }) => [
                  styles.googleBtn,
                  googleLoading && styles.googleBtnDisabled,
                  pressed && { opacity: 0.85 },
                ]}
                onPress={handleGoogleSignIn}
                disabled={googleLoading || loading}
              >
                {googleLoading ? (
                  <ActivityIndicator size="small" color={colors.ink} />
                ) : (
                  <>
                    <Ionicons name="logo-google" size={18} color="#EA4335" />
                    <Text style={styles.googleBtnText}>{t('auth.googleSignIn')}</Text>
                  </>
                )}
              </Pressable>

              {/* Divider */}
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>{t('auth.orEmailSignIn')}</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* Email */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{t('auth.email')}</Text>
                <View style={styles.inputWrap}>
                  <Ionicons name="mail-outline" size={18} color={colors.inkSoft} style={styles.inputIcon} />
                  <TextInput
                    style={styles.textInput}
                    value={email}
                    onChangeText={(val) => {
                      setEmail(val);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    placeholder={t('auth.emailPlaceholder')}
                    placeholderTextColor={colors.inkSoft}
                  />
                </View>
              </View>

              {/* Password */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{t('auth.password')}</Text>
                <View style={styles.inputWrap}>
                  <Ionicons name="lock-closed-outline" size={18} color={colors.inkSoft} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.textInput, { flex: 1 }]}
                    value={password}
                    onChangeText={(val) => {
                      setPassword(val);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    secureTextEntry={!showPassword}
                    autoComplete="password"
                    placeholder={t('auth.passwordPlaceholder')}
                    placeholderTextColor={colors.inkSoft}
                  />
                  <Pressable
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.eyeBtn}
                    hitSlop={8}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color={colors.inkSoft}
                    />
                  </Pressable>
                </View>
              </View>

              {/* Forgot Password */}
              <Pressable style={styles.forgotBtn} onPress={handleForgotPassword}>
                <Text style={styles.forgotText}>{t('auth.forgotPassword')}</Text>
              </Pressable>

              {/* Sign In Button */}
              <Pressable
                style={({ pressed }) => [
                  styles.signInBtn,
                  loading && styles.signInBtnDisabled,
                  pressed && { opacity: 0.85 },
                ]}
                onPress={handleEmailLogin}
                disabled={loading || googleLoading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <>
                    <Ionicons name="log-in-outline" size={20} color={colors.white} />
                    <Text style={styles.signInBtnText}>{t('auth.signInBtn')}</Text>
                  </>
                )}
              </Pressable>

              {/* Divider */}
              <View style={[styles.divider, { marginVertical: 14 }]}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>{t('auth.or')}</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* Guest Explore */}
              <Pressable style={styles.guestBtn} onPress={handleGuestExplore}>
                <Ionicons name="eye-outline" size={16} color={colors.duskDeep} />
                <Text style={styles.guestBtnText}>{t('auth.guestExplore')}</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.emailCard}>
              {/* Inline Error Message */}
              {errorMessage ? (
                <View style={styles.errorContainer}>
                  <Ionicons name="alert-circle-outline" size={20} color={colors.danger} style={styles.errorIcon} />
                  <Text style={styles.errorText}>{errorMessage}</Text>
                  <Pressable onPress={() => setErrorMessage(null)} style={styles.errorDismissBtn} hitSlop={8}>
                    <Ionicons name="close-circle" size={18} color={colors.danger} />
                  </Pressable>
                </View>
              ) : null}

              {/* Google Sign Up Button */}
              <Pressable
                style={({ pressed }) => [
                  styles.googleBtn,
                  googleLoading && styles.googleBtnDisabled,
                  pressed && { opacity: 0.85 },
                ]}
                onPress={handleGoogleSignIn}
                disabled={googleLoading || registering}
              >
                {googleLoading ? (
                  <ActivityIndicator size="small" color={colors.ink} />
                ) : (
                  <>
                    <Ionicons name="logo-google" size={18} color="#EA4335" />
                    <Text style={styles.googleBtnText}>{t('auth.googleSignUp')}</Text>
                  </>
                )}
              </Pressable>

              {/* Divider */}
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>{t('auth.orEmailSignUp')}</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* Business Name */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{t('auth.businessName')} *</Text>
                <View style={styles.inputWrap}>
                  <Ionicons name="storefront-outline" size={18} color={colors.inkSoft} style={styles.inputIcon} />
                  <TextInput
                    style={styles.textInput}
                    value={businessName}
                    onChangeText={(val) => {
                      setBusinessName(val);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    placeholder={t('auth.businessNamePlaceholder')}
                    placeholderTextColor={colors.inkSoft}
                  />
                </View>
              </View>

              {/* Owner Name */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{t('auth.ownerName')} *</Text>
                <View style={styles.inputWrap}>
                  <Ionicons name="person-outline" size={18} color={colors.inkSoft} style={styles.inputIcon} />
                  <TextInput
                    style={styles.textInput}
                    value={ownerName}
                    onChangeText={(val) => {
                      setOwnerName(val);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    placeholder={t('auth.ownerNamePlaceholder')}
                    placeholderTextColor={colors.inkSoft}
                  />
                </View>
              </View>

              {/* Email */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{t('auth.email')} *</Text>
                <View style={styles.inputWrap}>
                  <Ionicons name="mail-outline" size={18} color={colors.inkSoft} style={styles.inputIcon} />
                  <TextInput
                    style={styles.textInput}
                    value={regEmail}
                    onChangeText={(val) => {
                      setRegEmail(val);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    placeholder={t('auth.emailPlaceholder')}
                    placeholderTextColor={colors.inkSoft}
                  />
                </View>
              </View>

              {/* Phone */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{t('auth.phone')}</Text>
                <View style={styles.inputWrap}>
                  <Ionicons name="call-outline" size={18} color={colors.inkSoft} style={styles.inputIcon} />
                  <TextInput
                    style={styles.textInput}
                    value={phone}
                    onChangeText={(val) => {
                      setPhone(val);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    keyboardType="phone-pad"
                    placeholder={t('auth.phonePlaceholder')}
                    placeholderTextColor={colors.inkSoft}
                  />
                </View>
              </View>

              {/* Password */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{t('auth.password')} * (min 6)</Text>
                <View style={styles.inputWrap}>
                  <Ionicons name="lock-closed-outline" size={18} color={colors.inkSoft} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.textInput, { flex: 1 }]}
                    value={regPassword}
                    onChangeText={(val) => {
                      setRegPassword(val);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    secureTextEntry={!showRegPassword}
                    placeholder={t('auth.passwordPlaceholder')}
                    placeholderTextColor={colors.inkSoft}
                  />
                  <Pressable
                    onPress={() => setShowRegPassword(!showRegPassword)}
                    style={styles.eyeBtn}
                    hitSlop={8}
                  >
                    <Ionicons
                      name={showRegPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color={colors.inkSoft}
                    />
                  </Pressable>
                </View>
              </View>

              {/* Quick PIN */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{t('auth.quickPin')} {t('auth.pinOptional')}</Text>
                <View style={styles.inputWrap}>
                  <Ionicons name="keypad-outline" size={18} color={colors.inkSoft} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.textInput, { letterSpacing: 6, fontSize: 16 }]}
                    value={regPin}
                    onChangeText={(val) => {
                      setRegPin(val);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    keyboardType="number-pad"
                    maxLength={4}
                    secureTextEntry
                    placeholder="1234"
                    placeholderTextColor={colors.inkSoft}
                  />
                </View>
              </View>

              {/* Create Account Button */}
              <Pressable
                style={({ pressed }) => [
                  styles.signInBtn,
                  registering && styles.signInBtnDisabled,
                  pressed && { opacity: 0.85 },
                ]}
                onPress={handleRegister}
                disabled={registering || googleLoading}
              >
                {registering ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <>
                    <Ionicons name="person-add-outline" size={19} color={colors.white} />
                    <Text style={styles.signInBtnText}>{t('auth.createAccountBtn')}</Text>
                  </>
                )}
              </Pressable>
            </View>
          )}

          {/* ── Bottom Links ─────────────────────────────── */}
          <View style={styles.footerLinks}>
            {authTab === 'login' ? (
              <Pressable
                style={styles.createAccountLink}
                onPress={() => {
                  setErrorMessage(null);
                  setAuthTab('register');
                }}
              >
                <Text style={styles.createAccountText}>
                  {t('auth.noAccount')}{' '}
                  <Text style={styles.createAccountBold}>{t('auth.createAccount')}</Text>
                </Text>
              </Pressable>
            ) : (
              <Pressable
                style={styles.createAccountLink}
                onPress={() => {
                  setErrorMessage(null);
                  setAuthTab('login');
                }}
              >
                <Text style={styles.createAccountText}>
                  {t('auth.haveAccount')}{' '}
                  <Text style={styles.createAccountBold}>{t('auth.signIn')}</Text>
                </Text>
              </Pressable>
            )}

            <Pressable
              style={styles.wizardLink}
              onPress={() => navigation.navigate('OnboardingWizard')}
            >
              <Ionicons name="sparkles-outline" size={14} color={colors.clayDeep} />
              <Text style={styles.wizardLinkText}>{t('auth.launchWizard')}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ─── Forgot Password Modal ──────────────────────── */}
      <Modal
        visible={showForgotModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowForgotModal(false)}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.modalCenterWrap}
          >
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <View style={styles.modalIconWrap}>
                  <Ionicons name="key-outline" size={22} color={colors.clayDeep} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalTitle}>{t('auth.resetPasswordTitle')}</Text>
                  <Text style={styles.modalSub}>
                    {t('auth.resetPasswordSub')}
                  </Text>
                </View>
                <Pressable
                  onPress={() => setShowForgotModal(false)}
                  style={styles.modalCloseBtn}
                  hitSlop={8}
                >
                  <Ionicons name="close" size={20} color={colors.inkSoft} />
                </Pressable>
              </View>

              {/* Success Banner */}
              {forgotSuccess ? (
                <View style={styles.forgotSuccessBox}>
                  <Ionicons name="checkmark-circle" size={20} color={colors.success} style={{ marginRight: 8 }} />
                  <Text style={styles.forgotSuccessText}>{forgotSuccess}</Text>
                </View>
              ) : null}

              {/* Error Banner */}
              {forgotError ? (
                <View style={styles.forgotErrorBox}>
                  <Ionicons name="alert-circle-outline" size={20} color={colors.danger} style={{ marginRight: 8 }} />
                  <Text style={styles.forgotErrorText}>{forgotError}</Text>
                </View>
              ) : null}

              {!forgotSuccess ? (
                <>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>{t('auth.registeredEmail')}</Text>
                    <View style={styles.inputWrap}>
                      <Ionicons name="mail-outline" size={18} color={colors.inkSoft} style={styles.inputIcon} />
                      <TextInput
                        style={styles.textInput}
                        value={forgotEmail}
                        onChangeText={(val) => {
                          setForgotEmail(val);
                          if (forgotError) setForgotError(null);
                        }}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoComplete="email"
                        placeholder="your.email@example.com"
                        placeholderTextColor={colors.inkSoft}
                        autoFocus
                      />
                      {forgotEmail.length > 0 && (
                        <Pressable onPress={() => setForgotEmail('')} hitSlop={8}>
                          <Ionicons name="close-circle" size={18} color={colors.inkSoft} />
                        </Pressable>
                      )}
                    </View>
                  </View>

                  <Pressable
                    style={({ pressed }) => [
                      styles.sendResetBtn,
                      forgotLoading && { opacity: 0.6 },
                      pressed && { opacity: 0.85 },
                    ]}
                    onPress={handleSendResetEmail}
                    disabled={forgotLoading}
                  >
                    {forgotLoading ? (
                      <ActivityIndicator size="small" color={colors.white} />
                    ) : (
                      <>
                        <Ionicons name="paper-plane-outline" size={18} color={colors.white} style={{ marginRight: 6 }} />
                        <Text style={styles.sendResetBtnText}>{t('auth.sendResetLink')}</Text>
                      </>
                    )}
                  </Pressable>
                </>
              ) : (
                <Pressable
                  style={({ pressed }) => [
                    styles.sendResetBtn,
                    { backgroundColor: colors.clayDeep, marginTop: 14 },
                    pressed && { opacity: 0.85 },
                  ]}
                  onPress={() => setShowForgotModal(false)}
                >
                  <Text style={styles.sendResetBtnText}>{t('auth.backToSignIn')}</Text>
                </Pressable>
              )}
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* ─── Choose Language Modal ─── */}
      <Modal
        visible={showLangModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLangModal(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowLangModal(false)} />
          <View style={styles.langModalCard}>
            <View style={styles.langModalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={styles.langIconCircle}>
                  <Ionicons name="language" size={20} color={colors.clayDeep} />
                </View>
                <View>
                  <Text style={styles.langModalTitle}>Choose Language / மொழி</Text>
                  <Text style={styles.langModalSub}>Select your preferred language</Text>
                </View>
              </View>
              <Pressable
                onPress={() => setShowLangModal(false)}
                style={styles.modalCloseBtn}
                hitSlop={8}
              >
                <Ionicons name="close" size={20} color={colors.inkSoft} />
              </Pressable>
            </View>

            <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
              <View style={styles.langGrid}>
                {availableLanguages.map((item) => {
                  const isActive = language === item.code;
                  return (
                    <Pressable
                      key={item.code}
                      style={({ pressed }) => [
                        styles.langGridCard,
                        isActive && styles.langGridCardActive,
                        pressed && { opacity: 0.85 },
                      ]}
                      onPress={() => {
                        setLanguage(item.code);
                        setShowLangModal(false);
                      }}
                    >
                      <Text style={styles.langGridFlag}>{item.flag}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.langGridNative, isActive && styles.langGridNativeActive]}>
                          {item.nativeLabel}
                        </Text>
                        <Text style={[styles.langGridEnglish, isActive && styles.langGridEnglishActive]}>
                          {item.label}
                        </Text>
                      </View>
                      {isActive && (
                        <Ionicons name="checkmark-circle" size={18} color={colors.clayDeep} />
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
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
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
    alignItems: 'center',
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },

  // ── Top Bar with Language Selector ──
  topBarRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 12,
  },
  langDropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.paperCard,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.line,
    ...shadow.card,
  },
  langDropdownText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.ink,
  },

  // ── Brand Header ──
  brandHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },

  // ── Mode Tabs ──
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

  // ── Email Card ──
  emailCard: {
    width: '100%',
    backgroundColor: colors.paperCard,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 22,
    ...shadow.card,
  },
  // ── Error Banner ──
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.dangerLight,
    borderColor: colors.danger,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
    gap: 8,
  },
  errorIcon: {
    marginRight: 2,
  },
  errorText: {
    flex: 1,
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.danger,
    lineHeight: 18,
  },
  errorDismissBtn: {
    padding: 2,
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.paper,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingVertical: 13,
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
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.inkSoft,
    marginBottom: 6,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    height: 48,
  },
  inputIcon: {
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.ink,
    height: '100%',
  },
  eyeBtn: {
    padding: 4,
    marginLeft: 4,
  },
  forgotBtn: {
    alignSelf: 'flex-end',
    marginBottom: 16,
    marginTop: -6,
  },
  forgotText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.clayDeep,
  },
  signInBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.clayDeep,
    paddingVertical: 14,
    borderRadius: radius.md,
    ...shadow.card,
  },
  signInBtnDisabled: {
    opacity: 0.6,
  },
  signInBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    color: colors.white,
  },
  // ── Divider ──
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  dividerWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.line,
  },
  dividerText: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.inkSoft,
    paddingHorizontal: 12,
  },
  // ── Guest Button ──
  guestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.line,
    paddingVertical: 12,
    borderRadius: radius.md,
  },
  guestBtnText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.inkSoft,
  },

  // ── PIN Section ──
  pinSection: {
    width: '100%',
    alignItems: 'center',
  },
  pinInstruction: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.inkSoft,
    marginBottom: 16,
  },
  pinDotsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 28,
  },
  pinDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.line,
    backgroundColor: colors.paper,
  },
  pinDotFilled: {
    backgroundColor: colors.clayDeep,
    borderColor: colors.clayDeep,
  },
  keypad: {
    width: '100%',
    maxWidth: 280,
    gap: 12,
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  keypadBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.paperCard,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.card,
  },
  keypadBtnEmpty: {
    width: 72,
    height: 72,
  },
  keypadBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 24,
    color: colors.ink,
  },
  pinHint: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.inkSoft,
    marginTop: 16,
  },

  // ── Footer Links ──
  footerLinks: {
    width: '100%',
    alignItems: 'center',
    marginTop: 24,
    gap: 12,
  },
  createAccountLink: {
    paddingVertical: 6,
  },
  createAccountText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.inkSoft,
  },
  createAccountBold: {
    fontFamily: fonts.bodyBold,
    color: colors.clayDeep,
  },
  wizardLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  wizardLinkText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.clayDeep,
  },

  // ── Modals & Overlay ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCenterWrap: {
    width: '100%',
    maxWidth: 440,
  },
  modalCard: {
    width: '100%',
    backgroundColor: colors.paperCard,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 24,
    ...shadow.card,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  modalIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
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
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 6,
    borderRadius: radius.sm,
  },
  forgotSuccessBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    borderColor: '#A5D6A7',
    borderWidth: 1,
    borderRadius: radius.md,
    padding: 14,
    marginBottom: 16,
  },
  forgotSuccessText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: '#2E7D32',
    flex: 1,
    lineHeight: 18,
  },
  forgotErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.dangerLight,
    borderColor: colors.danger,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: 12,
    marginBottom: 14,
  },
  forgotErrorText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.danger,
    flex: 1,
  },
  sendResetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.clayDeep,
    paddingVertical: 14,
    borderRadius: radius.md,
    marginTop: 10,
    ...shadow.card,
  },
  sendResetBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    color: colors.white,
  },

  // ── Language Selection Modal Styles ──
  langModalCard: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: colors.paperCard,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 20,
    ...shadow.card,
  },
  langModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  langIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.clayLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  langModalTitle: {
    fontFamily: fonts.display,
    fontSize: 16,
    color: colors.ink,
  },
  langModalSub: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.inkSoft,
    marginTop: 1,
  },
  langGrid: {
    gap: 8,
  },
  langGridCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  langGridCardActive: {
    backgroundColor: colors.clayLight,
    borderColor: colors.clayDeep,
  },
  langGridFlag: {
    fontSize: 20,
  },
  langGridNative: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.ink,
  },
  langGridNativeActive: {
    color: colors.clayDeep,
  },
  langGridEnglish: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.inkSoft,
  },
  langGridEnglishActive: {
    color: colors.clayDeep,
  },
  langSelectorRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  langPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: colors.paperCard,
    borderWidth: 1,
    borderColor: colors.line,
  },
  langPillActive: {
    backgroundColor: colors.clayLight,
    borderColor: colors.clayDeep,
  },
  langPillFlag: {
    fontSize: 15,
  },
  langPillText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.inkSoft,
  },
  langPillTextActive: {
    fontFamily: fonts.bodyBold,
    color: colors.clayDeep,
  },
});


