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
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { RootStackParamList } from '../navigation/types';
import { verifyResetCode, confirmNewPassword } from '../storage/authStorage';
import AppLogo from '../components/AppLogo';
import { colors, fonts, radius, shadow } from '../theme/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'ResetPassword'>;

export default function ResetPasswordScreen({ navigation, route }: Props) {
  // Extract oobCode from route params or from web window.location query string
  const [oobCode, setOobCode] = useState<string>('');
  const [accountEmail, setAccountEmail] = useState<string>('');
  const [verifying, setVerifying] = useState<boolean>(true);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  // Form states
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Verify the code on mount
  useEffect(() => {
    let code = route.params?.oobCode || '';

    // If on web, check URL query params if route param wasn't passed
    if (!code && Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        code = urlParams.get('oobCode') || '';
      } catch {}
    }

    if (!code) {
      setVerifying(false);
      setVerifyError('No password reset code was found. Please request a new password reset link.');
      return;
    }

    setOobCode(code);

    verifyResetCode(code).then((res) => {
      setVerifying(false);
      if (res.valid && res.email) {
        setAccountEmail(res.email);
      } else {
        setVerifyError(res.error || 'This password reset link is invalid or has expired.');
      }
    });
  }, [route.params?.oobCode]);

  const handleUpdatePassword = async () => {
    setFormError(null);

    if (!newPassword.trim()) {
      setFormError('Please enter your new password.');
      return;
    }

    if (newPassword.length < 6) {
      setFormError('Password must be at least 6 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setFormError('Passwords do not match. Please re-enter to confirm.');
      return;
    }

    setSaving(true);
    const res = await confirmNewPassword(oobCode, newPassword);
    setSaving(false);

    if (res.success) {
      setSuccess(true);
    } else {
      setFormError(res.error || 'Failed to update password. Please try again.');
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
          {/* Logo Header */}
          <View style={styles.logoSection}>
            <AppLogo
              size={64}
              variant="vertical"
              taglineText="Smart Business & Order Management"
            />
          </View>

          {/* Main Card */}
          <View style={styles.card}>
            {verifying ? (
              <View style={styles.stateWrap}>
                <ActivityIndicator size="large" color={colors.clayDeep} />
                <Text style={styles.stateTitle}>Verifying Reset Link…</Text>
                <Text style={styles.stateSub}>Please wait while we verify your security link.</Text>
              </View>
            ) : verifyError ? (
              <View style={styles.stateWrap}>
                <View style={styles.errorIconCircle}>
                  <Ionicons name="alert-circle-outline" size={36} color={colors.danger} />
                </View>
                <Text style={styles.stateTitle}>Link Expired or Invalid</Text>
                <Text style={styles.stateSub}>{verifyError}</Text>
                <Pressable
                  style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.85 }]}
                  onPress={() => navigation.replace('Login')}
                >
                  <Text style={styles.actionBtnText}>Go to Login</Text>
                </Pressable>
              </View>
            ) : success ? (
              <View style={styles.stateWrap}>
                <View style={styles.successIconCircle}>
                  <Ionicons name="checkmark-circle" size={48} color="#2E7D32" />
                </View>
                <Text style={styles.stateTitle}>Password Changed!</Text>
                <Text style={styles.stateSub}>
                  Your password has been updated successfully. You can now sign in with your new password.
                </Text>
                <Pressable
                  style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.85 }]}
                  onPress={() => navigation.replace('Login')}
                >
                  <Text style={styles.actionBtnText}>Sign In to KadaiBook</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <View style={styles.cardHeader}>
                  <View style={styles.headerIconBox}>
                    <Ionicons name="key-outline" size={22} color={colors.clayDeep} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>Set New Password</Text>
                    {accountEmail ? (
                      <Text style={styles.cardSubtitle} numberOfLines={1}>
                        for {accountEmail}
                      </Text>
                    ) : null}
                  </View>
                </View>

                {formError ? (
                  <View style={styles.errorBanner}>
                    <Ionicons name="alert-circle-outline" size={18} color={colors.danger} style={{ marginRight: 8 }} />
                    <Text style={styles.errorBannerText}>{formError}</Text>
                  </View>
                ) : null}

                {/* New Password */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>New Password (min. 6 characters)</Text>
                  <View style={styles.inputWrap}>
                    <Ionicons name="lock-closed-outline" size={18} color={colors.inkSoft} style={styles.inputIcon} />
                    <TextInput
                      style={[styles.textInput, { flex: 1 }]}
                      value={newPassword}
                      onChangeText={(v) => {
                        setNewPassword(v);
                        if (formError) setFormError(null);
                      }}
                      secureTextEntry={!showPassword}
                      placeholder="Enter new password"
                      placeholderTextColor={colors.inkSoft}
                      autoFocus
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

                {/* Confirm Password */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Confirm New Password</Text>
                  <View style={styles.inputWrap}>
                    <Ionicons name="shield-checkmark-outline" size={18} color={colors.inkSoft} style={styles.inputIcon} />
                    <TextInput
                      style={[styles.textInput, { flex: 1 }]}
                      value={confirmPassword}
                      onChangeText={(v) => {
                        setConfirmPassword(v);
                        if (formError) setFormError(null);
                      }}
                      secureTextEntry={!showConfirmPassword}
                      placeholder="Re-type new password"
                      placeholderTextColor={colors.inkSoft}
                    />
                    <Pressable
                      onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                      style={styles.eyeBtn}
                      hitSlop={8}
                    >
                      <Ionicons
                        name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                        size={20}
                        color={colors.inkSoft}
                      />
                    </Pressable>
                  </View>
                </View>

                {/* Submit Button */}
                <Pressable
                  style={({ pressed }) => [
                    styles.actionBtn,
                    saving && { opacity: 0.6 },
                    pressed && { opacity: 0.88 },
                  ]}
                  onPress={handleUpdatePassword}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color={colors.white} />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle-outline" size={20} color={colors.white} style={{ marginRight: 6 }} />
                      <Text style={styles.actionBtnText}>Update Password & Sign In</Text>
                    </>
                  )}
                </Pressable>

                <Pressable
                  style={styles.cancelLink}
                  onPress={() => navigation.replace('Login')}
                >
                  <Text style={styles.cancelLinkText}>Back to Sign In</Text>
                </Pressable>
              </>
            )}
          </View>
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
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 32,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.paperCard,
    borderRadius: radius.lg,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.line,
    ...shadow.card,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 18,
  },
  headerIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.clayLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.ink,
  },
  cardSubtitle: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.inkSoft,
    marginTop: 2,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.ink,
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
    height: 46,
  },
  inputIcon: {
    marginRight: 8,
  },
  textInput: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.ink,
    padding: 0,
  },
  eyeBtn: {
    padding: 6,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.clayDeep,
    paddingVertical: 14,
    borderRadius: radius.md,
    marginTop: 8,
    width: '100%',
    ...shadow.card,
  },
  actionBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    color: colors.white,
  },
  cancelLink: {
    alignItems: 'center',
    marginTop: 14,
    paddingVertical: 6,
  },
  cancelLinkText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.inkSoft,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.dangerLight,
    borderColor: colors.danger,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: 12,
    marginBottom: 16,
  },
  errorBannerText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.danger,
    flex: 1,
  },
  stateWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  stateTitle: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.ink,
    marginTop: 8,
    textAlign: 'center',
  },
  stateSub: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.inkSoft,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 12,
  },
  successIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#E8F5E9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  errorIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.dangerLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
});
