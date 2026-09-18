import React, { useState, useRef } from 'react';
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
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { RootStackParamList } from '../navigation/types';
import { registerUser, loginAsGuest } from '../storage/authStorage';
import { saveBusinessProfile } from '../storage/businessProfileStorage';
import AppLogo from '../components/AppLogo';
import Onboarding3DStage from '../components/Onboarding3DStage';
import { colors, fonts, radius, shadow } from '../theme/theme';
import {
  BusinessType,
  BUSINESS_TYPES_LIST,
  BUSINESS_TYPE_PRESETS,
} from '../config/businessTypes';

type Props = NativeStackScreenProps<RootStackParamList, 'OnboardingWizard'>;

interface ValueBullet {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  desc: string;
  color: string;
}

interface TourSlide {
  title: string;
  badge: string;
  subtitle: string;
  bgColor: string;
  themeColor: string;
  accent: string;
  bullets: ValueBullet[];
}

const SLIDES: TourSlide[] = [
  {
    title: 'Your Digital KadaiBook',
    badge: 'ORDER DISCIPLINE & KHATA',
    subtitle: 'Digitize notebook orders with instant WhatsApp receipts, fulfillment tracking, and zero paper chaos.',
    bgColor: '#F6F1E7', // Warm Kraft
    themeColor: colors.clayDeep,
    accent: colors.clayLight,
    bullets: [
      {
        icon: 'logo-whatsapp',
        label: '1-Tap WhatsApp Receipts',
        desc: 'Send itemized bills with payment QR codes directly to customer chat.',
        color: '#25D366',
      },
      {
        icon: 'pricetags-outline',
        label: 'Visual Fulfillment Stages',
        desc: 'Move orders across Placed → Packed → Dispatched → Delivered.',
        color: colors.statusDispatched,
      },
      {
        icon: 'flash-outline',
        label: 'Quick Khata Logging',
        desc: 'Log customer requests, items, and advance deposits in 5 seconds.',
        color: colors.pending,
      },
    ],
  },
  {
    title: 'Master Business Outflow',
    badge: 'EXPENSE CONTROL & CASHFLOW',
    subtitle: 'Track raw materials, couriers, packaging, and rent. Know your true take-home profit on every sale.',
    bgColor: '#F1F5F7', // Soft Dusk
    themeColor: colors.duskDeep,
    accent: colors.duskLight,
    bullets: [
      {
        icon: 'pie-chart-outline',
        label: 'Categorized Cost Tracking',
        desc: 'Tag fabric, courier, packaging, and overheads to spot cost spikes.',
        color: colors.clayDeep,
      },
      {
        icon: 'pulse-outline',
        label: 'Live Net Margin Radar',
        desc: 'Automatic cost deduction reveals your true take-home cash.',
        color: colors.inflow,
      },
      {
        icon: 'shield-checkmark-outline',
        label: 'Zero Cashflow Leaks',
        desc: 'Catch shipping overages and supplier price hikes before they hurt reserves.',
        color: colors.duskDeep,
      },
    ],
  },
  {
    title: 'Instant P&L & Analytics',
    badge: 'AUTOMATED INTELLIGENCE',
    subtitle: 'Get automated monthly financial statements, best-selling product reports, and customer spend insights.',
    bgColor: '#FAF6ED', // Golden Cream
    themeColor: colors.statusPlaced,
    accent: '#F9ECD2',
    bullets: [
      {
        icon: 'document-text-outline',
        label: 'Automated Monthly P&L',
        desc: 'Tax-ready financial statements generated without an accountant.',
        color: colors.statusPlaced,
      },
      {
        icon: 'star-outline',
        label: 'Star Products Detector',
        desc: 'Spot high-margin catalog items driving 80% of store revenue.',
        color: '#D48827',
      },
      {
        icon: 'people-outline',
        label: 'VIP Buyer Khata Insights',
        desc: 'Track repeat customer history, lifetime value, and credit dues.',
        color: colors.duskDeep,
      },
    ],
  },
];

export default function OnboardingWizardScreen({ navigation }: Props) {
  const [currentStep, setCurrentStep] = useState(0); // 0, 1, 2 = 3D tour slides, 3 = store setup

  // Form states for Step 3
  const [businessName, setBusinessName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [selectedBusinessType, setSelectedBusinessType] = useState<BusinessType>('general');

  // Animation values
  const slideFadeAnim = useRef(new Animated.Value(1)).current;
  const slideTranslateAnim = useRef(new Animated.Value(0)).current;
  const nextBtnScale = useRef(new Animated.Value(1)).current;

  // Trigger animation on step transition
  const animateStepTransition = (nextStepIdx: number) => {
    slideFadeAnim.setValue(0);
    slideTranslateAnim.setValue(18);

    Animated.parallel([
      Animated.timing(slideFadeAnim, {
        toValue: 1,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(slideTranslateAnim, {
        toValue: 0,
        friction: 8,
        tension: 55,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleStepJump = (idx: number) => {
    if (idx === currentStep) return;
    setCurrentStep(idx);
    animateStepTransition(idx);
  };

  const handleNext = () => {
    if (currentStep < 2) {
      const nextIdx = currentStep + 1;
      setCurrentStep(nextIdx);
      animateStepTransition(nextIdx);
    } else {
      setCurrentStep(3); // Go to setup form
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      const prevIdx = currentStep - 1;
      setCurrentStep(prevIdx);
      if (prevIdx < 3) {
        animateStepTransition(prevIdx);
      }
    }
  };

  const pressIn = (anim: Animated.Value) => {
    Animated.spring(anim, {
      toValue: 0.96,
      friction: 8,
      tension: 100,
      useNativeDriver: true,
    }).start();
  };

  const pressOut = (anim: Animated.Value) => {
    Animated.spring(anim, {
      toValue: 1,
      friction: 5,
      tension: 80,
      useNativeDriver: true,
    }).start();
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

    setSaving(true);
    try {
      await registerUser({
        name: ownerName.trim(),
        businessName: businessName.trim(),
        phone: phone.trim(),
        email: email.trim(),
        password: password.trim(),
      });

      // Save business type to profile
      await saveBusinessProfile({
        businessName: businessName.trim(),
        phone: phone.trim(),
        businessType: selectedBusinessType,
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

  const currentSlide = SLIDES[currentStep] || SLIDES[0];

  return (
    <SafeAreaView
      style={[
        styles.screen,
        { backgroundColor: currentStep < 3 ? currentSlide.bgColor : colors.paper },
      ]}
      edges={['top', 'bottom']}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* ── Stories-Style Top Navigation Bar ── */}
        <View style={styles.topBar}>
          {currentStep > 0 ? (
            <Pressable onPress={handleBack} style={styles.topBackBtn}>
              <Ionicons name="arrow-back" size={20} color={colors.ink} />
            </Pressable>
          ) : (
            <View style={{ width: 36 }} />
          )}

          {/* ── Segmented Story Progress Bar ── */}
          <View style={styles.segmentedBar}>
            {[0, 1, 2].map((idx) => {
              const isPast = currentStep > idx;
              const isCurrent = currentStep === idx;
              return (
                <Pressable
                  key={idx}
                  style={styles.segmentTrack}
                  onPress={() => handleStepJump(idx)}
                >
                  <View
                    style={[
                      styles.segmentFill,
                      (isPast || isCurrent) && {
                        backgroundColor:
                          idx < 3 ? SLIDES[idx].themeColor : colors.clayDeep,
                        width: isCurrent ? '100%' : '100%',
                        opacity: isPast ? 0.6 : isCurrent ? 1 : 0,
                      },
                    ]}
                  />
                </Pressable>
              );
            })}
          </View>

          <Pressable onPress={handleExplorePublic} style={styles.visitorBtn}>
            <Text style={[styles.visitorText, { color: currentSlide.themeColor }]}>
              Visitor Mode
            </Text>
          </Pressable>
        </View>

        {/* Content Body: 3D Tour Slides */}
        {currentStep < 3 ? (
          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.slideScrollContent}
            showsVerticalScrollIndicator={false}
          >
            <Animated.View
              style={[
                styles.slideAnimatedContainer,
                {
                  opacity: slideFadeAnim,
                  transform: [{ translateY: slideTranslateAnim }],
                },
              ]}
            >
              {/* Category Badge */}
              <View style={styles.badgePill}>
                <Text style={[styles.badgeText, { color: currentSlide.themeColor }]}>
                  {currentSlide.badge}
                </Text>
              </View>

              {/* Title & Subtitle */}
              <Text style={styles.slideTitle}>{currentSlide.title}</Text>
              <Text style={styles.slideSubtitle}>{currentSlide.subtitle}</Text>

              {/* ── Central Hero 3D Diorama Stage with Live Micro-Playground ── */}
              <Onboarding3DStage step={currentStep} />

              {/* ── Bite-Sized Superpower Points ── */}
              <View style={styles.bulletsSection}>
                {currentSlide.bullets.map((b, idx) => (
                  <View key={idx} style={styles.bulletCard}>
                    <View style={[styles.bulletIconBox, { backgroundColor: b.color + '18' }]}>
                      <Ionicons name={b.icon} size={18} color={b.color} />
                    </View>
                    <View style={styles.bulletTextWrap}>
                      <Text style={styles.bulletTitle}>{b.label}</Text>
                      <Text style={styles.bulletDesc}>{b.desc}</Text>
                    </View>
                  </View>
                ))}
              </View>

              {/* Bottom Actions */}
              <View style={styles.bottomActions}>
                <Animated.View style={{ transform: [{ scale: nextBtnScale }] }}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.nextBtn,
                      { backgroundColor: currentSlide.themeColor },
                      pressed && { opacity: 0.9 },
                    ]}
                    onPressIn={() => pressIn(nextBtnScale)}
                    onPressOut={() => pressOut(nextBtnScale)}
                    onPress={handleNext}
                  >
                    <Text style={styles.nextBtnText}>
                      {currentStep === 2 ? 'Start Store Setup' : 'Next Step'}
                    </Text>
                    <Ionicons name="arrow-forward" size={18} color={colors.white} />
                  </Pressable>
                </Animated.View>

                <Pressable style={styles.loginLinkBtn} onPress={handleGoToLogin}>
                  <Text style={styles.loginLinkText}>
                    Already have an account?{' '}
                    <Text style={[styles.boldUnderline, { color: currentSlide.themeColor }]}>
                      Log In
                    </Text>
                  </Text>
                </Pressable>
              </View>
            </Animated.View>
          </ScrollView>
        ) : (
          /* Step 3: Fast Store & Owner Setup Form */
          <ScrollView
            contentContainerStyle={styles.formScrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.formHeader}>
              <View style={{ alignItems: 'center', marginBottom: 10 }}>
                <AppLogo size={52} variant="icon" />
              </View>
              <Text style={styles.formTitle}>Store & Security Setup</Text>
              <Text style={styles.formSubtitle}>
                Set up your business notebook and 4-digit unlock passcode.
              </Text>
            </View>

            {/* Business Type Selector Grid */}
            <View style={styles.card}>
              <Text style={[styles.fieldLabel, { marginBottom: 12 }]}>What type of business do you run?</Text>
              <View style={styles.typeGrid}>
                {BUSINESS_TYPES_LIST.map((typeKey) => {
                  const preset = BUSINESS_TYPE_PRESETS[typeKey];
                  const isSelected = selectedBusinessType === typeKey;
                  return (
                    <Pressable
                      key={typeKey}
                      style={[
                        styles.typeCard,
                        isSelected && styles.typeCardSelected,
                      ]}
                      onPress={() => setSelectedBusinessType(typeKey)}
                    >
                      <View style={[
                        styles.typeIconBox,
                        isSelected && { backgroundColor: colors.clayDeep },
                      ]}>
                        <Ionicons
                          name={preset.icon as any}
                          size={20}
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
                  placeholder="your.email@example.com"
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
                  placeholder="Create password"
                  placeholderTextColor={colors.inkSoft}
                />
              </View>
            </View>

            <Pressable
              style={({ pressed }) => [styles.finishBtn, saving && { opacity: 0.6 }, pressed && { opacity: 0.85 }]}
              onPress={handleFinishSetup}
              disabled={saving}
            >
              <Text style={styles.finishBtnText}>
                {saving ? 'Creating Store…' : 'Finish & Open KadaiBook'}
              </Text>
            </Pressable>

            <Pressable style={styles.loginLinkBtn} onPress={handleGoToLogin}>
              <Text style={styles.loginLinkText}>
                Already registered? <Text style={styles.boldUnderline}>Log In</Text>
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

  // ── Stories-Style Top Navigation Bar ──
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  topBackBtn: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  segmentedBar: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    maxWidth: 240,
  },
  segmentTrack: {
    flex: 1,
    height: 4.5,
    borderRadius: 3,
    backgroundColor: 'rgba(46, 42, 36, 0.12)',
    overflow: 'hidden',
  },
  segmentFill: {
    height: '100%',
    borderRadius: 3,
  },
  visitorBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radius.sm,
    backgroundColor: colors.paperCard,
    borderWidth: 1,
    borderColor: colors.line,
  },
  visitorText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11.5,
  },

  // Slide Body
  slideScrollContent: {
    flexGrow: 1,
    paddingHorizontal: 18,
    paddingTop: 4,
    paddingBottom: 28,
  },
  slideAnimatedContainer: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    alignItems: 'center',
  },

  badgePill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: radius.sm,
    backgroundColor: colors.paperCard,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: 8,
  },
  badgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    letterSpacing: 0.8,
  },

  slideTitle: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.ink,
    textAlign: 'center',
    marginBottom: 4,
    letterSpacing: 0.2,
  },
  slideSubtitle: {
    fontFamily: fonts.body,
    fontSize: 12.5,
    color: colors.inkSoft,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 10,
    marginBottom: 6,
  },

  // Bullets Section
  bulletsSection: {
    width: '100%',
    gap: 7,
    marginVertical: 10,
  },
  bulletCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.paperCard,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    ...shadow.card,
  },
  bulletIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bulletTextWrap: {
    flex: 1,
    gap: 1,
  },
  bulletTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 12.5,
    color: colors.ink,
  },
  bulletDesc: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.inkSoft,
    lineHeight: 15,
  },

  // Bottom Actions
  bottomActions: {
    width: '100%',
    gap: 10,
    marginTop: 6,
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: radius.md,
    ...shadow.card,
  },
  nextBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 15,
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
  },

  // Setup Form Step (Step 3)
  formScrollContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 40,
  },
  formHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  formTitle: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.clayDeep,
  },
  formSubtitle: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.inkSoft,
    textAlign: 'center',
    marginTop: 2,
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
  finishBtn: {
    backgroundColor: colors.clayDeep,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: 'center',
    ...shadow.card,
  },
  finishBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
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
    paddingVertical: 12,
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
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.clayLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  typeLabel: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.inkSoft,
    textAlign: 'center',
  },
});
