import React, { useState, useEffect, useRef } from 'react';
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
  Linking,
  Dimensions,
  Animated,
  Easing,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path, G, Rect, Defs, RadialGradient, Stop, Text as SvgText } from 'react-native-svg';

import { RootStackParamList } from '../navigation/types';
import {
  loginWithPassword,
  loginAsGuest,
  sendResetPassword,
  registerUser,
} from '../storage/authStorage';
import { useGoogleAuth } from '../hooks/useGoogleAuth';
import { useLanguage } from '../i18n/LanguageContext';
import GoogleIcon from '../components/GoogleIcon';
import AppLogo from '../components/AppLogo';
import LoginDesktopLeftPanel from '../components/LoginDesktopLeftPanel';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function LoginScreen({ navigation, route }: Props) {
  const { language, setLanguage, currentLangOption, availableLanguages } = useLanguage();
  const { width: windowWidth } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === 'web' && windowWidth >= 960;
  const [showLangModal, setShowLangModal] = useState(false);
  const [authTab, setAuthTab] = useState<'login' | 'register'>(route?.params?.initialTab || 'login');

  // Update tab if route param changes
  useEffect(() => {
    if (route?.params?.initialTab) {
      setAuthTab(route.params.initialTab);
    }
  }, [route?.params?.initialTab]);

  // Email login state
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
  const [registering, setRegistering] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [focusedInput, setFocusedInput] = useState<string | null>(null);

  // ─── Animations ──────────────────────────────────────────────────
  // 1. Entrance staggered animations
  const headerFade = useRef(new Animated.Value(0)).current;
  const headerScale = useRef(new Animated.Value(0.88)).current;
  const headerTranslateY = useRef(new Animated.Value(-16)).current;

  const switcherFade = useRef(new Animated.Value(0)).current;
  const switcherTranslateY = useRef(new Animated.Value(14)).current;

  const cardFade = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(0.95)).current;
  const cardTranslateY = useRef(new Animated.Value(22)).current;

  const bottomFade = useRef(new Animated.Value(0)).current;
  const bottomTranslateY = useRef(new Animated.Value(18)).current;

  // 2. Ambient floating loop for script decorations
  const floatAnim = useRef(new Animated.Value(0)).current;

  // 3. Tab switch transition
  const tabFade = useRef(new Animated.Value(1)).current;
  const tabTranslateX = useRef(new Animated.Value(0)).current;

  // 4. Button press micro-scales
  const primaryBtnScale = useRef(new Animated.Value(1)).current;
  const googleBtnScale = useRef(new Animated.Value(1)).current;
  const guestBtnScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Staggered entrance animation sequence
    Animated.parallel([
      // Header: spring pop & fade
      Animated.parallel([
        Animated.timing(headerFade, {
          toValue: 1,
          duration: 420,
          useNativeDriver: true,
        }),
        Animated.spring(headerScale, {
          toValue: 1,
          friction: 6,
          tension: 45,
          useNativeDriver: true,
        }),
        Animated.timing(headerTranslateY, {
          toValue: 0,
          duration: 420,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),

      // Switcher: slides up
      Animated.sequence([
        Animated.delay(100),
        Animated.parallel([
          Animated.timing(switcherFade, {
            toValue: 1,
            duration: 350,
            useNativeDriver: true,
          }),
          Animated.spring(switcherTranslateY, {
            toValue: 0,
            friction: 7,
            useNativeDriver: true,
          }),
        ]),
      ]),

      // Card: smooth scale & slide
      Animated.sequence([
        Animated.delay(180),
        Animated.parallel([
          Animated.timing(cardFade, {
            toValue: 1,
            duration: 450,
            useNativeDriver: true,
          }),
          Animated.spring(cardScale, {
            toValue: 1,
            friction: 7,
            tension: 40,
            useNativeDriver: true,
          }),
          Animated.timing(cardTranslateY, {
            toValue: 0,
            duration: 450,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
      ]),

      // Bottom features & scenery
      Animated.sequence([
        Animated.delay(280),
        Animated.parallel([
          Animated.timing(bottomFade, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(bottomTranslateY, {
            toValue: 0,
            duration: 500,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
      ]),
    ]).start();

    // Floating loop for script elements
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -3.5,
          duration: 2000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 3.5,
          duration: 2000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  // ─── Smooth Tab Switch Handler ──────────────────────────────────────
  const handleTabSwitch = (newTab: 'login' | 'register') => {
    if (newTab === authTab) return;
    setErrorMessage(null);

    const slideOutOffset = newTab === 'register' ? -14 : 14;

    Animated.parallel([
      Animated.timing(tabFade, {
        toValue: 0,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(tabTranslateX, {
        toValue: slideOutOffset,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setAuthTab(newTab);
      tabTranslateX.setValue(-slideOutOffset);
      Animated.parallel([
        Animated.timing(tabFade, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.spring(tabTranslateX, {
          toValue: 0,
          friction: 7,
          tension: 50,
          useNativeDriver: true,
        }),
      ]).start();
    });
  };

  // Button press micro-animation helpers
  const pressIn = (anim: Animated.Value) => {
    Animated.spring(anim, {
      toValue: 0.965,
      speed: 35,
      bounciness: 0,
      useNativeDriver: true,
    }).start();
  };

  const pressOut = (anim: Animated.Value) => {
    Animated.spring(anim, {
      toValue: 1,
      friction: 4,
      tension: 60,
      useNativeDriver: true,
    }).start();
  };

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

  // ─── Email Login Handler ───────────────────────────────────────────
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

    setRegistering(true);
    try {
      await registerUser({
        name: ownerName.trim(),
        businessName: businessName.trim(),
        email: regEmail.trim(),
        phone: phone.trim(),
        password: regPassword.trim(),
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
      } else if (code === 'auth/network-request-failed') {
        msg = 'Network connection error. Please check your internet.';
      }
      setErrorMessage(msg);
      Alert.alert('Registration Error', msg);
    } finally {
      setRegistering(false);
    }
  };

  // ─── Guest Access ──────────────────────────────────────────────────
  const handleGuestExplore = async () => {
    await loginAsGuest();
    navigation.replace('MainTabs');
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
      setForgotSuccess(
        `Password reset email sent to ${forgotEmail.trim()}! Please check your inbox (and spam folder).`
      );
    } else {
      setForgotError(result.error || 'Failed to send password reset email.');
    }
  };

  // ── Right-side login form content (used both mobile & desktop) ──
  const loginFormContent = (
    <>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            isDesktopWeb && styles.scrollContentDesktop,
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
          overScrollMode="never"
        >
          {/* ── Subtle Ambient Warm Glow for Mobile ── */}
          {!isDesktopWeb && (
            <View style={styles.mobileAmbientGlow} pointerEvents="none">
              <Svg width={SCREEN_WIDTH} height={200} viewBox={`0 0 ${SCREEN_WIDTH} 200`}>
                <Defs>
                  <RadialGradient id="mobileHalo" cx="50%" cy="12%" rx="55%" ry="55%">
                    <Stop offset="0%" stopColor="#ECD5BF" stopOpacity="0.45" />
                    <Stop offset="60%" stopColor="#FAF6F0" stopOpacity="0.12" />
                    <Stop offset="100%" stopColor="#FAF6F0" stopOpacity="0" />
                  </RadialGradient>
                </Defs>
                <Rect x="0" y="0" width={SCREEN_WIDTH} height={200} fill="url(#mobileHalo)" />
              </Svg>
            </View>
          )}

          {/* ── Top Bar: Language Selector (Top Right) ── */}
          <View style={styles.topBarRow}>
            <Pressable
              style={({ pressed }) => [
                styles.langDropdownBtn,
                pressed && { opacity: 0.8 },
              ]}
              onPress={() => setShowLangModal(true)}
            >
              <Ionicons name="globe-outline" size={15} color="#2D2B28" />
              <Text style={styles.langDropdownText}>
                {currentLangOption.label}
              </Text>
              <Ionicons name="chevron-down" size={13} color="#4A463F" />
            </Pressable>
          </View>

          {/* ── Animated Center Brand Header ───────────── */}
          <Animated.View
            style={[
              styles.brandContainer,
              {
                opacity: headerFade,
                transform: [
                  { translateY: headerTranslateY },
                  { scale: headerScale },
                ],
              },
            ]}
          >
            <View style={styles.logoWrapper}>
              <AppLogo size={64} variant="icon" />
            </View>
            <Text style={styles.brandTitle}>
              <Text style={styles.brandTitleKadai}>Kadai</Text>
              <Text style={styles.brandTitleBook}>Book</Text>
            </Text>
            <Text style={styles.brandSubtitle}>
              Manage orders, invoices and expenses anywhere
            </Text>
          </Animated.View>

          {/* ── Animated Segmented Switcher (Sign In / Create Account) ─ */}
          <Animated.View
            style={[
              styles.switcherContainer,
              {
                opacity: switcherFade,
                transform: [{ translateY: switcherTranslateY }],
              },
            ]}
          >
            <Pressable
              style={[
                styles.switcherTab,
                authTab === 'login' && styles.switcherTabActive,
              ]}
              onPress={() => handleTabSwitch('login')}
            >
              <Ionicons
                name="log-in-outline"
                size={17}
                color={authTab === 'login' ? '#FFFFFF' : '#38322B'}
              />
              <Text
                style={[
                  styles.switcherText,
                  authTab === 'login' && styles.switcherTextActive,
                ]}
              >
                Sign In
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.switcherTab,
                authTab === 'register' && styles.switcherTabActive,
              ]}
              onPress={() => handleTabSwitch('register')}
            >
              <Ionicons
                name="person-add-outline"
                size={16}
                color={authTab === 'register' ? '#FFFFFF' : '#38322B'}
              />
              <Text
                style={[
                  styles.switcherText,
                  authTab === 'register' && styles.switcherTextActive,
                ]}
              >
                Create Account
              </Text>
            </Pressable>
          </Animated.View>

          {/* ── Animated Card Container with "Simple Smart Reliable" script on the right ── */}
          <Animated.View
            style={[
              styles.cardContainer,
              {
                opacity: cardFade,
                transform: [
                  { translateY: cardTranslateY },
                  { scale: cardScale },
                ],
              },
            ]}
          >
            {/* ── Main White Card ─────────────────────────── */}
            <View style={[styles.card, isDesktopWeb && styles.cardDesktop]}>
              {/* Inline Error Message */}
              {errorMessage ? (
                <View style={styles.errorBanner}>
                  <Ionicons
                    name="alert-circle-outline"
                    size={18}
                    color="#B9483D"
                    style={{ marginRight: 6 }}
                  />
                  <Text style={styles.errorBannerText}>{errorMessage}</Text>
                  <Pressable
                    onPress={() => setErrorMessage(null)}
                    hitSlop={8}
                    style={{ padding: 2 }}
                  >
                    <Ionicons name="close-circle" size={16} color="#B9483D" />
                  </Pressable>
                </View>
              ) : null}

              {/* Animated Tab Content (cross-fading on tab switch) */}
              <Animated.View
                style={{
                  opacity: tabFade,
                  transform: [{ translateX: tabTranslateX }],
                }}
              >
                {authTab === 'login' ? (
                  <>
                    {/* 1. Continue with Google */}
                    <Animated.View style={{ transform: [{ scale: googleBtnScale }] }}>
                      <Pressable
                        style={[
                          styles.googleBtn,
                          googleLoading && styles.disabledBtn,
                        ]}
                        onPress={handleGoogleSignIn}
                        onPressIn={() => pressIn(googleBtnScale)}
                        onPressOut={() => pressOut(googleBtnScale)}
                        disabled={googleLoading || loading}
                      >
                        {googleLoading ? (
                          <ActivityIndicator size="small" color="#1C1917" />
                        ) : (
                          <>
                            <GoogleIcon size={19} />
                            <Text style={styles.googleBtnText}>Continue with Google</Text>
                          </>
                        )}
                      </Pressable>
                    </Animated.View>

                    {/* 2. Divider: or sign in with email */}
                    <View style={styles.divider}>
                      <View style={styles.dividerLine} />
                      <Text style={styles.dividerText}>or sign in with email</Text>
                      <View style={styles.dividerLine} />
                    </View>

                    {/* 3. Email Address Field */}
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Email Address</Text>
                      <View
                        style={[
                          styles.inputBox,
                          focusedInput === 'email' && styles.inputBoxFocused,
                        ]}
                      >
                        <Ionicons
                          name="mail-outline"
                          size={18}
                          color={focusedInput === 'email' ? '#A5513E' : '#7C7467'}
                          style={styles.inputIcon}
                        />
                        <TextInput
                          style={styles.textInput}
                          value={email}
                          onFocus={() => setFocusedInput('email')}
                          onBlur={() => setFocusedInput(null)}
                          onChangeText={(val) => {
                            setEmail(val);
                            if (errorMessage) setErrorMessage(null);
                          }}
                          keyboardType="email-address"
                          autoCapitalize="none"
                          autoComplete="email"
                          placeholder="e.g. store@kadaibook.in"
                          placeholderTextColor="#9E9689"
                        />
                      </View>
                    </View>

                    {/* 4. Password Field */}
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Password</Text>
                      <View
                        style={[
                          styles.inputBox,
                          focusedInput === 'password' && styles.inputBoxFocused,
                        ]}
                      >
                        <Ionicons
                          name="lock-closed-outline"
                          size={18}
                          color={focusedInput === 'password' ? '#A5513E' : '#7C7467'}
                          style={styles.inputIcon}
                        />
                        <TextInput
                          style={[styles.textInput, { flex: 1 }]}
                          value={password}
                          onFocus={() => setFocusedInput('password')}
                          onBlur={() => setFocusedInput(null)}
                          onChangeText={(val) => {
                            setPassword(val);
                            if (errorMessage) setErrorMessage(null);
                          }}
                          secureTextEntry={!showPassword}
                          autoComplete="password"
                          placeholder="Enter your account password"
                          placeholderTextColor="#9E9689"
                        />
                        <Pressable
                          onPress={() => setShowPassword(!showPassword)}
                          style={styles.eyeBtn}
                          hitSlop={8}
                        >
                          <Ionicons
                            name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                            size={19}
                            color={focusedInput === 'password' ? '#A5513E' : '#7C7467'}
                          />
                        </Pressable>
                      </View>
                    </View>

                    {/* 5. Forgot Password */}
                    <Pressable
                      style={styles.forgotBtn}
                      onPress={handleForgotPassword}
                      hitSlop={6}
                    >
                      <Text style={styles.forgotBtnText}>Forgot Password?</Text>
                    </Pressable>

                    {/* 6. Sign In to Store Button */}
                    <Animated.View style={{ transform: [{ scale: primaryBtnScale }] }}>
                      <Pressable
                        style={[
                          styles.primaryBtn,
                          loading && styles.disabledBtn,
                        ]}
                        onPress={handleEmailLogin}
                        onPressIn={() => pressIn(primaryBtnScale)}
                        onPressOut={() => pressOut(primaryBtnScale)}
                        disabled={loading || googleLoading}
                      >
                        {loading ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <>
                            <Ionicons name="log-in-outline" size={19} color="#FFFFFF" />
                            <Text style={styles.primaryBtnText}>Sign In to Store</Text>
                            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" style={{ marginLeft: 2 }} />
                          </>
                        )}
                      </Pressable>
                    </Animated.View>

                    {/* 7. Divider: or */}
                    <View style={[styles.divider, { marginVertical: 12 }]}>
                      <View style={styles.dividerLine} />
                      <Text style={styles.dividerText}>or</Text>
                      <View style={styles.dividerLine} />
                    </View>

                    {/* 8. Explore as Guest / Public Visitor */}
                    <Animated.View style={{ transform: [{ scale: guestBtnScale }] }}>
                      <Pressable
                        style={styles.secondaryBtn}
                        onPress={handleGuestExplore}
                        onPressIn={() => pressIn(guestBtnScale)}
                        onPressOut={() => pressOut(guestBtnScale)}
                      >
                        <Ionicons
                          name="person-outline"
                          size={17}
                          color="#2B2724"
                          style={{ marginRight: 6 }}
                        />
                        <Text style={styles.secondaryBtnText}>
                          Explore as Guest / Public Visitor
                        </Text>
                      </Pressable>
                    </Animated.View>
                  </>
                ) : (
                  <>
                    {/* Google Sign Up */}
                    <Animated.View style={{ transform: [{ scale: googleBtnScale }] }}>
                      <Pressable
                        style={[
                          styles.googleBtn,
                          googleLoading && styles.disabledBtn,
                        ]}
                        onPress={handleGoogleSignIn}
                        onPressIn={() => pressIn(googleBtnScale)}
                        onPressOut={() => pressOut(googleBtnScale)}
                        disabled={googleLoading || registering}
                      >
                        {googleLoading ? (
                          <ActivityIndicator size="small" color="#1C1917" />
                        ) : (
                          <>
                            <GoogleIcon size={19} />
                            <Text style={styles.googleBtnText}>Continue with Google</Text>
                          </>
                        )}
                      </Pressable>
                    </Animated.View>

                    {/* Divider */}
                    <View style={styles.divider}>
                      <View style={styles.dividerLine} />
                      <Text style={styles.dividerText}>or register with details</Text>
                      <View style={styles.dividerLine} />
                    </View>

                    {/* Business Name */}
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Store / Business Name *</Text>
                      <View
                        style={[
                          styles.inputBox,
                          focusedInput === 'busName' && styles.inputBoxFocused,
                        ]}
                      >
                        <Ionicons
                          name="storefront-outline"
                          size={18}
                          color={focusedInput === 'busName' ? '#A5513E' : '#7C7467'}
                          style={styles.inputIcon}
                        />
                        <TextInput
                          style={styles.textInput}
                          value={businessName}
                          onFocus={() => setFocusedInput('busName')}
                          onBlur={() => setFocusedInput(null)}
                          onChangeText={(val) => {
                            setBusinessName(val);
                            if (errorMessage) setErrorMessage(null);
                          }}
                          placeholder="e.g. Balaji Traders"
                          placeholderTextColor="#9E9689"
                        />
                      </View>
                    </View>

                    {/* Owner Name */}
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Your Name *</Text>
                      <View
                        style={[
                          styles.inputBox,
                          focusedInput === 'ownerName' && styles.inputBoxFocused,
                        ]}
                      >
                        <Ionicons
                          name="person-outline"
                          size={18}
                          color={focusedInput === 'ownerName' ? '#A5513E' : '#7C7467'}
                          style={styles.inputIcon}
                        />
                        <TextInput
                          style={styles.textInput}
                          value={ownerName}
                          onFocus={() => setFocusedInput('ownerName')}
                          onBlur={() => setFocusedInput(null)}
                          onChangeText={(val) => {
                            setOwnerName(val);
                            if (errorMessage) setErrorMessage(null);
                          }}
                          placeholder="e.g. Ramesh Kumar"
                          placeholderTextColor="#9E9689"
                        />
                      </View>
                    </View>

                    {/* Email Address */}
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Email Address *</Text>
                      <View
                        style={[
                          styles.inputBox,
                          focusedInput === 'regEmail' && styles.inputBoxFocused,
                        ]}
                      >
                        <Ionicons
                          name="mail-outline"
                          size={18}
                          color={focusedInput === 'regEmail' ? '#A5513E' : '#7C7467'}
                          style={styles.inputIcon}
                        />
                        <TextInput
                          style={styles.textInput}
                          value={regEmail}
                          onFocus={() => setFocusedInput('regEmail')}
                          onBlur={() => setFocusedInput(null)}
                          onChangeText={(val) => {
                            setRegEmail(val);
                            if (errorMessage) setErrorMessage(null);
                          }}
                          keyboardType="email-address"
                          autoCapitalize="none"
                          placeholder="store@example.com"
                          placeholderTextColor="#9E9689"
                        />
                      </View>
                    </View>

                    {/* Phone */}
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Phone Number</Text>
                      <View
                        style={[
                          styles.inputBox,
                          focusedInput === 'phone' && styles.inputBoxFocused,
                        ]}
                      >
                        <Ionicons
                          name="call-outline"
                          size={18}
                          color={focusedInput === 'phone' ? '#A5513E' : '#7C7467'}
                          style={styles.inputIcon}
                        />
                        <TextInput
                          style={styles.textInput}
                          value={phone}
                          onFocus={() => setFocusedInput('phone')}
                          onBlur={() => setFocusedInput(null)}
                          onChangeText={(val) => {
                            setPhone(val);
                            if (errorMessage) setErrorMessage(null);
                          }}
                          keyboardType="phone-pad"
                          placeholder="10-digit mobile number"
                          placeholderTextColor="#9E9689"
                        />
                      </View>
                    </View>

                    {/* Password */}
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Password * (min 6)</Text>
                      <View
                        style={[
                          styles.inputBox,
                          focusedInput === 'regPassword' && styles.inputBoxFocused,
                        ]}
                      >
                        <Ionicons
                          name="lock-closed-outline"
                          size={18}
                          color={focusedInput === 'regPassword' ? '#A5513E' : '#7C7467'}
                          style={styles.inputIcon}
                        />
                        <TextInput
                          style={[styles.textInput, { flex: 1 }]}
                          value={regPassword}
                          onFocus={() => setFocusedInput('regPassword')}
                          onBlur={() => setFocusedInput(null)}
                          onChangeText={(val) => {
                            setRegPassword(val);
                            if (errorMessage) setErrorMessage(null);
                          }}
                          secureTextEntry={!showRegPassword}
                          placeholder="Enter secure password"
                          placeholderTextColor="#9E9689"
                        />
                        <Pressable
                          onPress={() => setShowRegPassword(!showRegPassword)}
                          style={styles.eyeBtn}
                          hitSlop={8}
                        >
                          <Ionicons
                            name={showRegPassword ? 'eye-off-outline' : 'eye-outline'}
                            size={19}
                            color={focusedInput === 'regPassword' ? '#A5513E' : '#7C7467'}
                          />
                        </Pressable>
                      </View>
                    </View>

                    {/* Create Account Primary Button */}
                    <Animated.View style={{ transform: [{ scale: primaryBtnScale }] }}>
                      <Pressable
                        style={[
                          styles.primaryBtn,
                          registering && styles.disabledBtn,
                        ]}
                        onPress={handleRegister}
                        onPressIn={() => pressIn(primaryBtnScale)}
                        onPressOut={() => pressOut(primaryBtnScale)}
                        disabled={registering || googleLoading}
                      >
                        {registering ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <>
                            <Ionicons name="person-add-outline" size={19} color="#FFFFFF" />
                            <Text style={styles.primaryBtnText}>Create Store Account</Text>
                          </>
                        )}
                      </Pressable>
                    </Animated.View>
                  </>
                )}
              </Animated.View>
            </View>

          </Animated.View>

          {/* ── Animated Below Card Section (Badges, Links & Scenery) ── */}
          <Animated.View
            style={{
              width: '100%',
              alignItems: 'center',
              opacity: bottomFade,
              transform: [{ translateY: bottomTranslateY }],
            }}
          >
            {/* Toggle Link */}
            <View style={styles.toggleRow}>
              {authTab === 'login' ? (
                <Pressable
                  onPress={() => handleTabSwitch('register')}
                  hitSlop={6}
                >
                  <Text style={styles.toggleText}>
                    Don't have an account?{' '}
                    <Text style={styles.toggleHighlight}>Create Account</Text>
                  </Text>
                </Pressable>
              ) : (
                <Pressable
                  onPress={() => handleTabSwitch('login')}
                  hitSlop={6}
                >
                  <Text style={styles.toggleText}>
                    Already have an account?{' '}
                    <Text style={styles.toggleHighlight}>Sign In</Text>
                  </Text>
                </Pressable>
              )}
            </View>

            {/* Three Trust Feature Badges */}
            <View style={styles.featureBadgesRow}>
              {/* Badge 1: 100% Safe */}
              <View style={styles.featureBadgePill}>
                <Ionicons name="shield-checkmark" size={13} color="#3E7D50" />
                <Text style={styles.featureBadgeLabel}>100% Safe</Text>
              </View>

              {/* Badge 2: Trusted by Businesses */}
              <View style={styles.featureBadgePill}>
                <Ionicons name="heart" size={13} color="#A5513E" />
                <Text style={styles.featureBadgeLabel}>Trusted Stores</Text>
              </View>

              {/* Badge 3: Always Here to Help */}
              <View style={styles.featureBadgePill}>
                <Ionicons name="headset" size={13} color="#4A6588" />
                <Text style={styles.featureBadgeLabel}>24/7 Support</Text>
              </View>
            </View>

            {/* Privacy Policy & Terms Link at bottom */}
            <View style={styles.legalFooter}>
              <Text style={styles.legalText}>
                By continuing, you agree to our{' '}
                <Text
                  style={styles.legalLink}
                  onPress={() => Linking.openURL('https://kadaibook.in/privacy')}
                >
                  Privacy Policy
                </Text>
                {' & '}
                <Text
                  style={styles.legalLink}
                  onPress={() => Linking.openURL('https://kadaibook.in/terms')}
                >
                  Terms of Service
                </Text>
              </Text>
            </View>
          </Animated.View>
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
                  <Ionicons name="key-outline" size={22} color="#A5513E" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalTitle}>Reset Password</Text>
                  <Text style={styles.modalSub}>
                    Enter your registered email to receive a password reset link.
                  </Text>
                </View>
                <Pressable
                  onPress={() => setShowForgotModal(false)}
                  style={styles.modalCloseBtn}
                  hitSlop={8}
                >
                  <Ionicons name="close" size={20} color="#6E6659" />
                </Pressable>
              </View>

              {/* Success Banner */}
              {forgotSuccess ? (
                <View style={styles.forgotSuccessBox}>
                  <Ionicons
                    name="checkmark-circle"
                    size={20}
                    color="#2E7D32"
                    style={{ marginRight: 8 }}
                  />
                  <Text style={styles.forgotSuccessText}>{forgotSuccess}</Text>
                </View>
              ) : null}

              {/* Error Banner */}
              {forgotError ? (
                <View style={styles.forgotErrorBox}>
                  <Ionicons
                    name="alert-circle-outline"
                    size={20}
                    color="#B9483D"
                    style={{ marginRight: 8 }}
                  />
                  <Text style={styles.forgotErrorText}>{forgotError}</Text>
                </View>
              ) : null}

              {!forgotSuccess ? (
                <>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Registered Email Address</Text>
                    <View style={styles.inputBox}>
                      <Ionicons
                        name="mail-outline"
                        size={18}
                        color="#6E6659"
                        style={styles.inputIcon}
                      />
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
                        placeholderTextColor="#8E8678"
                        autoFocus
                      />
                      {forgotEmail.length > 0 && (
                        <Pressable onPress={() => setForgotEmail('')} hitSlop={8}>
                          <Ionicons name="close-circle" size={18} color="#6E6659" />
                        </Pressable>
                      )}
                    </View>
                  </View>

                  <Pressable
                    style={({ pressed }) => [
                      styles.primaryBtn,
                      forgotLoading && styles.disabledBtn,
                      pressed && { opacity: 0.88 },
                    ]}
                    onPress={handleSendResetEmail}
                    disabled={forgotLoading}
                  >
                    {forgotLoading ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Ionicons
                          name="paper-plane-outline"
                          size={18}
                          color="#FFFFFF"
                          style={{ marginRight: 6 }}
                        />
                        <Text style={styles.primaryBtnText}>Send Reset Link</Text>
                      </>
                    )}
                  </Pressable>
                </>
              ) : (
                <Pressable
                  style={({ pressed }) => [
                    styles.primaryBtn,
                    { marginTop: 14 },
                    pressed && { opacity: 0.88 },
                  ]}
                  onPress={() => setShowForgotModal(false)}
                >
                  <Text style={styles.primaryBtnText}>Back to Sign In</Text>
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
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setShowLangModal(false)}
          />
          <View style={styles.langModalCard}>
            <View style={styles.langModalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={styles.langIconCircle}>
                  <Ionicons name="language" size={20} color="#A5513E" />
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
                <Ionicons name="close" size={20} color="#6E6659" />
              </Pressable>
            </View>

            <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
              <View style={{ gap: 8 }}>
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
                      <Text style={{ fontSize: 20 }}>{item.flag}</Text>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.langGridNative,
                            isActive && { color: '#A5513E' },
                          ]}
                        >
                          {item.nativeLabel}
                        </Text>
                        <Text
                          style={[
                            styles.langGridEnglish,
                            isActive && { color: '#A5513E' },
                          ]}
                        >
                          {item.label}
                        </Text>
                      </View>
                      {isActive && (
                        <Ionicons
                          name="checkmark-circle"
                          size={18}
                          color="#A5513E"
                        />
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );

  // ── Desktop Web: Two-column split layout ──
  if (isDesktopWeb) {
    return (
      <View style={styles.desktopRoot}>
        {/* Left Panel: Branding + Illustration */}
        <View style={styles.desktopLeftPanel}>
          <LoginDesktopLeftPanel />
        </View>

        {/* Right Panel: Login Form */}
        <View style={styles.desktopRightPanel}>
          <SafeAreaView style={[styles.screen, styles.desktopRightInner]} edges={['top', 'bottom']}>
            {loginFormContent}
          </SafeAreaView>

          {/* Bottom Right Botanical Leaf Accent */}
          <View style={styles.leafAccentRight} pointerEvents="none">
            <Svg width={90} height={140} viewBox="0 0 90 140">
              <G opacity={0.65}>
                <Path d="M 90 140 Q 60 100, 45 40" stroke="#5A6D52" strokeWidth="2.5" fill="none" />
                <Path d="M 45 40 Q 15 35, 10 15 Q 35 20, 45 40 Z" fill="#6B8062" />
                <Path d="M 52 70 Q 20 68, 12 50 Q 38 55, 52 70 Z" fill="#7D9474" />
                <Path d="M 60 100 Q 25 102, 18 85 Q 45 88, 60 100 Z" fill="#5E7356" />
              </G>
            </Svg>
          </View>
        </View>
      </View>
    );
  }

  // ── Mobile: Single-column layout ──
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      {loginFormContent}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FAF6F0', // Soft warm cream base
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'web' ? 14 : 8,
    paddingBottom: 28,
    alignItems: 'center',
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    flexGrow: 1,
    justifyContent: 'flex-start',
    zIndex: 1,
  },
  scrollContentDesktop: {
    paddingBottom: 24,
    paddingTop: 16,
    justifyContent: 'center',
    maxWidth: 460,
  },

  mobileAmbientGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 200,
    alignItems: 'center',
    zIndex: 0,
  },

  // ── Top Bar with Language Selector ──
  topBarRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 8,
    zIndex: 10,
  },
  langDropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 5.5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#EFE7DC',
    shadowColor: '#3A2E2B',
    shadowOffset: { width: 0, height: 1.5 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  langDropdownText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 12,
    color: '#2D2B28',
  },

  // ── Brand Header (Center) ──
  brandContainer: {
    alignItems: 'center',
    marginBottom: 16,
    zIndex: 2,
  },
  logoWrapper: {
    shadowColor: '#A5513E',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 4,
    marginBottom: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTitle: {
    fontSize: 28,
    lineHeight: 34,
    marginTop: 4,
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  brandTitleKadai: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#1B1917', // Dark charcoal/black
  },
  brandTitleBook: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#A5513E', // Warm terracotta rust
  },
  brandSubtitle: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12.5,
    color: '#71695E',
    marginTop: 3,
    textAlign: 'center',
  },

  // ── Segmented Switcher (Sign In / Create Account) ──
  switcherContainer: {
    flexDirection: 'row',
    backgroundColor: '#EDE6DB',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E0D6C8',
    padding: 3.5,
    width: '100%',
    maxWidth: 320,
    marginBottom: 14,
    shadowColor: '#3A2E2B',
    shadowOffset: { width: 0, height: 1.5 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
    zIndex: 2,
  },
  switcherTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 20,
  },
  switcherTabActive: {
    backgroundColor: '#A5513E', // Active terracotta pill
    shadowColor: '#A5513E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.22,
    shadowRadius: 5,
    elevation: 3,
  },
  switcherText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 12.5,
    color: '#524B42',
  },
  switcherTextActive: {
    color: '#FFFFFF',
    fontFamily: 'PlusJakartaSans_700Bold',
  },

  // ── Card Container & Simple Smart Wrap ──
  cardContainer: {
    width: '100%',
    position: 'relative',
    alignItems: 'center',
    zIndex: 2,
  },

  // ── Main Form Card ──
  card: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#ECE4D8',
    paddingHorizontal: 20,
    paddingVertical: 20,
    shadowColor: '#2B2118',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.07,
    shadowRadius: 20,
    elevation: 5,
  },
  cardDesktop: {
    paddingHorizontal: 28,
    paddingVertical: 26,
    borderRadius: 26,
  },

  // ── Google Button ──
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E5DED4',
    borderRadius: 13,
    height: 48,
    shadowColor: '#3A2E2B',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  googleBtnText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 14,
    color: '#1C1917',
  },

  // ── Divider ──
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#ECE5DB',
  },
  dividerText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 11.5,
    color: '#887E71',
    paddingHorizontal: 10,
  },

  // ── Input Fields ──
  inputGroup: {
    marginBottom: 10,
  },
  inputLabel: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 12.5,
    color: '#2E2721',
    marginBottom: 5,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FBF9F5',
    borderWidth: 1.5,
    borderColor: '#E5DDD0',
    borderRadius: 13,
    paddingHorizontal: 12,
    height: 48,
  },
  inputBoxFocused: {
    borderColor: '#A5513E',
    backgroundColor: '#FFFFFF',
    shadowColor: '#A5513E',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 5,
    elevation: 2,
  },
  inputIcon: {
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 14,
    color: '#1C1917',
    height: '100%',
  },
  eyeBtn: {
    padding: 6,
    marginLeft: 2,
  },

  // ── Forgot Password Link ──
  forgotBtn: {
    alignSelf: 'flex-end',
    marginTop: 2,
    marginBottom: 12,
  },
  forgotBtnText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 12.5,
    color: '#A5513E',
  },

  // ── Primary Action Button (Sign In to Store) ──
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: '#A5513E',
    height: 50,
    borderRadius: 13,
    shadowColor: '#A5513E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.26,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryBtnText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 15,
    color: '#FFFFFF',
  },

  // ── Secondary Action Button (Guest) ──
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8F5EE',
    borderWidth: 1.5,
    borderColor: '#E2D9CD',
    height: 46,
    borderRadius: 13,
  },
  secondaryBtnText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13.5,
    color: '#2B2520',
  },

  disabledBtn: {
    opacity: 0.6,
  },

  // ── Below Card: Toggle Link ──
  toggleRow: {
    marginTop: 14,
    marginBottom: 10,
    alignItems: 'center',
  },
  toggleText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12.5,
    color: '#38322B',
  },
  toggleHighlight: {
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#A5513E',
  },

  // ── Trust Feature Badges Row (Secure & Safe, Trusted, Support) ──
  featureBadgesRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    marginBottom: 6,
    flexWrap: 'wrap',
  },
  featureBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#EFE8DD',
    paddingHorizontal: 10,
    paddingVertical: 5.5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2D8C9',
  },
  featureBadgeLabel: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 11,
    color: '#4B443B',
    textAlign: 'center',
  },

  // ── Error Banner ──
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FCEBE9',
    borderColor: '#E8A59C',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 14,
  },
  errorBannerText: {
    flex: 1,
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12.5,
    color: '#B9483D',
    lineHeight: 17,
  },

  // ── Legal Footer ──
  legalFooter: {
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 10,
    marginBottom: 14,
  },
  legalText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 11,
    color: '#7C7467',
    textAlign: 'center',
    lineHeight: 16,
  },
  legalLink: {
    color: '#A5513E',
    fontFamily: 'PlusJakartaSans_600SemiBold',
    textDecorationLine: 'underline',
  },

  // ── Modal Styles ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCenterWrap: {
    width: '100%',
    maxWidth: 420,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#EFE7DD',
    padding: 22,
    shadowColor: '#3A2E2B',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 6,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  modalIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#F3E5DC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 18,
    color: '#1B1917',
  },
  modalSub: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12,
    color: '#6E6659',
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 6,
  },
  forgotSuccessBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    borderColor: '#A5D6A7',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  forgotSuccessText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12.5,
    color: '#2E7D32',
    flex: 1,
    lineHeight: 17,
  },
  forgotErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FCEBE9',
    borderColor: '#E8A59C',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  forgotErrorText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12.5,
    color: '#B9483D',
    flex: 1,
  },

  // ── Language Modal ──
  langModalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#EFE7DD',
    padding: 20,
    shadowColor: '#3A2E2B',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 6,
  },
  langModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EFE7DD',
  },
  langIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3E5DC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  langModalTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 15,
    color: '#1B1917',
  },
  langModalSub: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 11.5,
    color: '#6E6659',
  },
  langGridCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F8F7F4',
    borderWidth: 1,
    borderColor: '#E6E1D7',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  langGridCardActive: {
    backgroundColor: '#F3E5DC',
    borderColor: '#A5513E',
  },
  langGridNative: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 13.5,
    color: '#1B1917',
  },
  langGridEnglish: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 11.5,
    color: '#6E6659',
  },

  // ── Desktop Two-Column Layout ──
  desktopRoot: {
    flex: 1,
    flexDirection: 'row',
    width: '100%' as any,
    height: '100%' as any,
    backgroundColor: '#FAF6F0',
  },
  desktopLeftPanel: {
    flex: 1,
    maxWidth: '45%' as any,
    minWidth: 380,
    height: '100%' as any,
  },
  desktopRightPanel: {
    flex: 1,
    height: '100%' as any,
    backgroundColor: '#FAF6F0',
  },
  desktopRightInner: {
    flex: 1,
    overflow: 'hidden' as any,
  },
  leafAccentRight: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    zIndex: 0,
  },
});
