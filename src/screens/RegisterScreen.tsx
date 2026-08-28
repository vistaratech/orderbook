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
import { colors, fonts, radius, shadow } from '../theme/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Register'>;

export default function RegisterScreen({ navigation }: Props) {
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
            <Text style={styles.title}>Create Store Account</Text>
            <Text style={styles.subtitle}>
              Set up your business order book and secure passcode
            </Text>
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
              {googleLoading ? 'Connecting…' : 'Sign up with Google'}
            </Text>
          </Pressable>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or register with email</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Form Card */}
          <View style={styles.card}>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Business / Store Name *</Text>
              <TextInput
                style={styles.input}
                value={businessName}
                onChangeText={setBusinessName}
                placeholder="e.g. Modern Craft Boutique"
                placeholderTextColor={colors.inkSoft}
                autoFocus
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Owner Name *</Text>
              <TextInput
                style={styles.input}
                value={ownerName}
                onChangeText={setOwnerName}
                placeholder="e.g. Priya"
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
                placeholder="e.g. store@orderbook.com"
                placeholderTextColor={colors.inkSoft}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Phone Number</Text>
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
              <Text style={styles.fieldLabel}>Password * (min 6 characters)</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholder="Create a password"
                placeholderTextColor={colors.inkSoft}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Quick 4-Digit PIN (Default: 1234)</Text>
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
              {saving ? 'Creating Account…' : 'Register & Enter Order Book'}
            </Text>
          </Pressable>

          <Pressable
            style={styles.loginLink}
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={styles.loginLinkText}>
              Already registered? <Text style={styles.loginBold}>Log In</Text>
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
