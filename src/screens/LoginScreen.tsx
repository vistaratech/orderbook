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
} from '../storage/authStorage';
import { useGoogleAuth } from '../hooks/useGoogleAuth';
import AppLogo from '../components/AppLogo';
import { colors, fonts, radius, shadow } from '../theme/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

type LoginMode = 'email' | 'pin';

export default function LoginScreen({ navigation }: Props) {
  const [mode, setMode] = useState<LoginMode>('email');

  // Email state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // PIN state
  const [pin, setPin] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // ─── Google Sign In ────────────────────────────────────────────────
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
          {/* ── Logo & Brand ─────────────────────────────── */}
          <View style={styles.brandHeader}>
            <AppLogo
              size={84}
              variant="vertical"
              taglineText="Smart Business & Order Management"
            />
          </View>

          {/* ── Mode Switcher ────────────────────────────── */}
          <View style={styles.modeTabs}>
            <Pressable
              style={[styles.modeTab, mode === 'email' && styles.modeTabActive]}
              onPress={() => {
                setMode('email');
                setErrorMessage(null);
              }}
            >
              <Ionicons
                name="mail-outline"
                size={16}
                color={mode === 'email' ? colors.white : colors.inkSoft}
              />
              <Text
                style={[
                  styles.modeTabText,
                  mode === 'email' && styles.modeTabTextActive,
                ]}
              >
                Email & Password
              </Text>
            </Pressable>

            <Pressable
              style={[styles.modeTab, mode === 'pin' && styles.modeTabActive]}
              onPress={() => {
                setMode('pin');
                setPin('');
                setErrorMessage(null);
              }}
            >
              <Ionicons
                name="keypad-outline"
                size={16}
                color={mode === 'pin' ? colors.white : colors.inkSoft}
              />
              <Text
                style={[
                  styles.modeTabText,
                  mode === 'pin' && styles.modeTabTextActive,
                ]}
              >
                Quick PIN
              </Text>
            </Pressable>
          </View>

          {/* ── Email Login Form ─────────────────────────── */}
          {mode === 'email' ? (
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
                    <Text style={styles.googleBtnText}>Continue with Google</Text>
                  </>
                )}
              </Pressable>

              {/* Divider */}
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or sign in with email</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* Email */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Email Address</Text>
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
                    placeholder="your.email@example.com"
                    placeholderTextColor={colors.inkSoft}
                  />
                </View>
              </View>

              {/* Password */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Password</Text>
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
                    placeholder="Enter your password"
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
                <Text style={styles.forgotText}>Forgot password?</Text>
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
                    <Text style={styles.signInBtnText}>Sign In</Text>
                  </>
                )}
              </Pressable>

              {/* Divider */}
              <View style={[styles.divider, { marginVertical: 14 }]}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* Guest Explore */}
              <Pressable style={styles.guestBtn} onPress={handleGuestExplore}>
                <Ionicons name="eye-outline" size={16} color={colors.duskDeep} />
                <Text style={styles.guestBtnText}>Explore as Visitor (no account)</Text>
              </Pressable>
            </View>
          ) : (
            /* ── PIN Login ──────────────────────────────── */
            <View style={styles.pinSection}>
              <Text style={styles.pinInstruction}>
                Enter your 4-digit unlock passcode
              </Text>

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

              <View style={styles.pinDotsRow}>
                {[0, 1, 2, 3].map((idx) => (
                  <View
                    key={idx}
                    style={[styles.pinDot, pin.length > idx && styles.pinDotFilled]}
                  />
                ))}
              </View>

              <View style={styles.keypad}>
                {[
                  ['1', '2', '3'],
                  ['4', '5', '6'],
                  ['7', '8', '9'],
                  ['', '0', 'del'],
                ].map((row, rIdx) => (
                  <View key={rIdx} style={styles.keypadRow}>
                    {row.map((btn, cIdx) => {
                      if (btn === '') {
                        return <View key={cIdx} style={styles.keypadBtnEmpty} />;
                      }
                      if (btn === 'del') {
                        return (
                          <Pressable
                            key={cIdx}
                            style={({ pressed }) => [styles.keypadBtn, pressed && { opacity: 0.7 }]}
                            onPress={handlePinDelete}
                          >
                            <Ionicons name="backspace-outline" size={24} color={colors.ink} />
                          </Pressable>
                        );
                      }
                      return (
                        <Pressable
                          key={cIdx}
                          style={({ pressed }) => [styles.keypadBtn, pressed && { opacity: 0.7 }]}
                          onPress={() => handlePinDigit(btn)}
                        >
                          <Text style={styles.keypadBtnText}>{btn}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ))}
              </View>

              <Text style={styles.pinHint}>
                Use the PIN you set during registration
              </Text>
            </View>
          )}

          {/* ── Bottom Links ─────────────────────────────── */}
          <View style={styles.footerLinks}>
            <Pressable
              style={styles.createAccountLink}
              onPress={() => navigation.navigate('Register')}
            >
              <Text style={styles.createAccountText}>
                Don't have an account?{' '}
                <Text style={styles.createAccountBold}>Create Account</Text>
              </Text>
            </Pressable>

            <Pressable
              style={styles.wizardLink}
              onPress={() => navigation.navigate('OnboardingWizard')}
            >
              <Ionicons name="sparkles-outline" size={14} color={colors.clayDeep} />
              <Text style={styles.wizardLinkText}>Launch Setup Wizard</Text>
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
                  <Text style={styles.modalTitle}>Reset Password</Text>
                  <Text style={styles.modalSub}>
                    Enter your email to receive a password reset link
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
                    <Text style={styles.inputLabel}>Registered Email Address</Text>
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
                        <Text style={styles.sendResetBtnText}>Send Reset Link</Text>
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
                  <Text style={styles.sendResetBtnText}>Back to Sign In</Text>
                </Pressable>
              )}
            </View>
          </KeyboardAvoidingView>
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
    paddingTop: 28,
    paddingBottom: 40,
    alignItems: 'center',
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
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
    padding: 20,
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
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.inkSoft,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.paper,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.ink,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
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
    backgroundColor: colors.clayDeep,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...shadow.card,
  },
  signInBtnDisabled: {
    opacity: 0.7,
  },
  signInBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    color: colors.white,
  },
  divider: {
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
    fontSize: 12,
    color: colors.inkSoft,
    marginHorizontal: 12,
  },
  guestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.duskDeep,
    backgroundColor: colors.paper,
  },
  guestBtnText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.duskDeep,
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
    marginBottom: 24,
  },
  pinDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.line,
    backgroundColor: 'transparent',
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

  // ── Forgot Password Modal Styles ──
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
    backgroundColor: colors.paperCard,
    borderRadius: radius.lg,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.line,
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
});

