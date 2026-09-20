import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  ScrollView,
  Alert,
  Platform,
  Linking,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import GlassBackButton from '../components/GlassBackButton';
import DesktopLayout from '../components/DesktopLayout';
import { colors, fonts, radius } from '../theme/theme';
import {
  getAvailablePackages,
  purchaseProPackage,
  checkProStatus,
  checkBasicStatus,
  restorePurchases,
} from '../storage/subscriptionStorage';

const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=in.kadaibook.app';
const APP_STORE_URL = 'https://apps.apple.com/app/kadaibook/id6743072498';

type SelectedTier = 'free' | 'basic' | 'pro';
type BillingPeriod = 'yearly' | 'monthly';
type ShopScale = 'small' | 'medium' | 'large';

export default function PaywallScreen() {
  const navigation = useNavigation();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const [packages, setPackages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [isPro, setIsPro] = useState(false);
  const [isBasic, setIsBasic] = useState(false);
  const [selectedTier, setSelectedTier] = useState<SelectedTier>('pro');
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('yearly');
  const [shopScale, setShopScale] = useState<ShopScale>('medium');
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const proStatus = await checkProStatus();
      const basicStatus = await checkBasicStatus();
      setIsPro(proStatus);
      setIsBasic(basicStatus);

      if (proStatus) {
        setSelectedTier('pro');
      } else if (basicStatus) {
        setSelectedTier('basic');
      } else {
        setSelectedTier('pro');
      }

      if (Platform.OS !== 'web') {
        const pkgs = await getAvailablePackages();
        setPackages(pkgs);
      }
    } catch (e) {
      console.warn('Failed to load subscription data', e);
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (pkgToBuy?: any) => {
    if (Platform.OS === 'web') {
      Alert.alert(
        'Mobile App Required',
        'In-app purchases are managed securely on our Android and iOS apps. Please download KadaiBook from Google Play or App Store to upgrade your account, or open this account on your phone!'
      );
      return;
    }

    let targetPkg = pkgToBuy;
    if (!targetPkg && packages.length > 0) {
      if (selectedTier === 'basic') {
        if (billingPeriod === 'yearly') {
          targetPkg =
            packages.find(
              (p) =>
                (p.identifier.toLowerCase().includes('basic') ||
                  p.product.identifier.toLowerCase().includes('basic')) &&
                (p.packageType === 'ANNUAL' ||
                  p.identifier.toLowerCase().includes('year') ||
                  p.product.identifier.toLowerCase().includes('annual'))
            ) ||
            packages.find((p) => p.identifier.toLowerCase().includes('basic')) ||
            packages[0];
        } else {
          targetPkg =
            packages.find(
              (p) =>
                (p.identifier.toLowerCase().includes('basic') ||
                  p.product.identifier.toLowerCase().includes('basic')) &&
                (p.packageType === 'MONTHLY' || p.identifier.toLowerCase().includes('month'))
            ) ||
            packages.find((p) => p.identifier.toLowerCase().includes('basic')) ||
            packages[0];
        }
      } else {
        if (billingPeriod === 'yearly') {
          targetPkg =
            packages.find(
              (p) =>
                (p.identifier.toLowerCase().includes('pro') ||
                  p.product.identifier.toLowerCase().includes('pro')) &&
                (p.packageType === 'ANNUAL' ||
                  p.identifier.toLowerCase().includes('year') ||
                  p.product.identifier.toLowerCase().includes('annual'))
            ) ||
            packages.find((p) => p.identifier.toLowerCase().includes('pro')) ||
            packages[0];
        } else {
          targetPkg =
            packages.find(
              (p) =>
                (p.identifier.toLowerCase().includes('pro') ||
                  p.product.identifier.toLowerCase().includes('pro')) &&
                (p.packageType === 'MONTHLY' || p.identifier.toLowerCase().includes('month'))
            ) ||
            packages.find((p) => p.identifier.toLowerCase().includes('pro')) ||
            packages[0];
        }
      }
    }

    if (!targetPkg) {
      Alert.alert('Notice', 'Subscription package details are loading. Please try again in a moment.');
      return;
    }

    setPurchasing(true);
    const success = await purchaseProPackage(targetPkg);
    setPurchasing(false);

    if (success) {
      Alert.alert('Success! 🎉', 'Your subscription is now active! Thank you for supporting KadaiBook.');
      navigation.goBack();
    } else {
      Alert.alert('Purchase Failed', 'Could not complete the purchase. Please try again.');
    }
  };

  const handleRestore = async () => {
    setPurchasing(true);
    const success = await restorePurchases();
    setPurchasing(false);
    if (success) {
      Alert.alert('Success', 'Your purchases have been successfully restored.');
      await loadData();
    } else {
      Alert.alert('Notice', 'No active subscriptions found to restore.');
    }
  };

  if (loading) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator color={colors.clayDeep} size="large" />
      </View>
    );
  }

  const basicPriceText = billingPeriod === 'yearly' ? '₹899 / yr' : '₹99 / mo';
  const proPriceText = billingPeriod === 'yearly' ? '₹1,499 / yr' : '₹249 / mo';

  // ROI Calculator dynamic numbers
  const roiData = {
    small: {
      orders: '1 - 30 bills / mo',
      timeSaved: '15 Hours / mo',
      debtRecovered: '₹4,500 / mo',
      costPerDay: '₹4.10 / day',
      recommendation: 'Free Plan fits well, upgrade to Basic/Pro when bills increase.',
      tamilNote: 'ஆரம்ப கட்ட கடைக்கு 30 பில் இலவசம் போதுமானது.',
    },
    medium: {
      orders: '30 - 150 bills / mo',
      timeSaved: '35 Hours / mo',
      debtRecovered: '₹12,500 / mo',
      costPerDay: '₹4.10 / day (₹125/mo)',
      recommendation: 'Pro Unlimited is recommended for WhatsApp reminders & fast thermal billing.',
      tamilNote: 'ப்ரோ பிளான் மூலம் மாதம் ₹12,500+ வரை பாக்கி வசூல் & 35 மணி நேரம் மிச்சம்!',
    },
    large: {
      orders: '150+ bills / mo',
      timeSaved: '60+ Hours / mo',
      debtRecovered: '₹28,000 / mo',
      costPerDay: '₹4.10 / day (₹125/mo)',
      recommendation: 'Pro Unlimited essential for multi-device counter billing & unlimited orders.',
      tamilNote: 'அன்லிமிடெட் பில்லிங், பல போன்களில் சின்க், ஜிஎஸ்டி ரிப்போர்ட் — 100% தடையில்லா வியாபாரம்!',
    },
  }[shopScale];

  const faqs = [
    {
      q: 'Can I use KadaiBook on multiple phones or computers at the same time?',
      a: 'Yes! When you log in with your KadaiBook account on your other phones, tablets, or desktop web browser, all orders, products, customers, and payments sync in real-time instantly.',
    },
    {
      q: 'What happens to my orders & customer credit records if my subscription ends?',
      a: 'Your data is 100% safe and permanent. You will never lose any past orders, customer ledger entries, or invoices. You can view and download all existing records anytime on the Free tier.',
    },
    {
      q: 'How does WhatsApp Bill & Automated Payment Reminders work?',
      a: 'With KadaiBook Pro, you can send professional itemized invoices with your store logo and UPI QR code directly to your customer’s WhatsApp in 1 tap, and automated reminder alerts for pending balances.',
    },
    {
      q: 'Can I connect Bluetooth Thermal Printers?',
      a: 'Yes! KadaiBook supports all 2-inch and 3-inch standard ESC/POS Bluetooth thermal printers for fast receipt printing at your billing counter.',
    },
    {
      q: 'Is there a free trial or refund policy?',
      a: 'You can start completely free with 30 orders & 30 customers every month. If you upgrade to Pro and feel it is not suited for your store within 7 days, contact our WhatsApp support for full assistance.',
    },
  ];

  return (
    <DesktopLayout currentTabName="PaywallScreen">
      <SafeAreaView style={styles.screen} edges={['top']}>
        {/* ── Top Header ── */}
        <View style={styles.topHeader}>
          <View style={styles.topHeaderInner}>
            <GlassBackButton label="Back" />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.topHeaderTitle}>Subscription & Plans</Text>
              <Text style={styles.topHeaderSub}>Choose the right power for your shop</Text>
            </View>
            <View
              style={[
                styles.statusPill,
                isPro ? styles.statusPillPro : isBasic ? styles.statusPillBasic : styles.statusPillFree,
              ]}
            >
              <Ionicons
                name={isPro ? 'sparkles' : isBasic ? 'star' : 'leaf-outline'}
                size={12}
                color={isPro ? '#CA8A04' : isBasic ? '#38BDF8' : '#4ADE80'}
              />
              <Text
                style={[
                  styles.statusPillText,
                  isPro
                    ? styles.statusPillTextPro
                    : isBasic
                    ? styles.statusPillTextBasic
                    : styles.statusPillTextFree,
                ]}
              >
                {isPro ? 'Pro Active' : isBasic ? 'Basic Active' : 'Free (30 Limit)'}
              </Text>
            </View>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.innerContainer}>
            {/* ── Hero Luxury Dark Card ── */}
            <View style={styles.heroCard}>
              <View style={styles.heroGlowAmber} />
              <View style={styles.heroGlowRose} />
              
              <View style={styles.heroBadge}>
                <Ionicons name="sparkles" size={13} color="#FDE047" />
                <Text style={styles.heroBadgeText}>KADAIBOOK PRO EDITION • 10,000+ SHOPS</Text>
              </View>

              <Text style={styles.heroTitle}>
                One Small Subscription.{'\n'}
                <Text style={styles.heroTitleAccent}>Unstoppable Shop Growth.</Text>
              </Text>

              <Text style={styles.heroTamilSubtitle}>
                ஒரே ஒரு சந்தா • தடையில்லா வியாபார வளர்ச்சி!
              </Text>

              <Text style={styles.heroSubtitle}>
                Unlock unlimited billing, automated WhatsApp credit reminders, Bluetooth thermal printing, and real-time cloud sync across all your phones and desktop.
              </Text>

              {/* 4 Trust Micro-Pills */}
              <View style={styles.heroTrustGrid}>
                <View style={styles.heroTrustPill}>
                  <Ionicons name="star" size={13} color="#FBBF24" />
                  <Text style={styles.heroTrustText}>4.9/5 Rating (10K+ Stores)</Text>
                </View>
                <View style={styles.heroTrustPill}>
                  <Ionicons name="flash" size={13} color="#60A5FA" />
                  <Text style={styles.heroTrustText}>Instant Activation</Text>
                </View>
                <View style={styles.heroTrustPill}>
                  <Ionicons name="shield-checkmark" size={13} color="#34D399" />
                  <Text style={styles.heroTrustText}>100% Data Security</Text>
                </View>
                <View style={styles.heroTrustPill}>
                  <Ionicons name="sync" size={13} color="#F472B6" />
                  <Text style={styles.heroTrustText}>Cancel Anytime</Text>
                </View>
              </View>
            </View>

            {/* ── Interactive ROI & Savings Calculator ── */}
            <View style={styles.roiCard}>
              <View style={styles.roiHeaderRow}>
                <View style={styles.roiIconWrap}>
                  <Ionicons name="calculator-outline" size={20} color="#CA8A04" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.roiTitle}>Smart Shop ROI & Profit Calculator</Text>
                  <Text style={styles.roiSub}>கணக்கு & லாப கால்குலேட்டர் — Select your monthly bill volume</Text>
                </View>
              </View>

              {/* Volume Switcher Tabs */}
              <View style={styles.roiTabsRow}>
                <Pressable
                  style={[styles.roiTabBtn, shopScale === 'small' && styles.roiTabBtnActive]}
                  onPress={() => setShopScale('small')}
                >
                  <Text style={[styles.roiTabText, shopScale === 'small' && styles.roiTabTextActive]}>
                    🛒 Small Shop{'\n'}(1-30 Bills)
                  </Text>
                </Pressable>

                <Pressable
                  style={[styles.roiTabBtn, shopScale === 'medium' && styles.roiTabBtnActive]}
                  onPress={() => setShopScale('medium')}
                >
                  <Text style={[styles.roiTabText, shopScale === 'medium' && styles.roiTabTextActive]}>
                    🏪 Active Retailer{'\n'}(30-150 Bills)
                  </Text>
                </Pressable>

                <Pressable
                  style={[styles.roiTabBtn, shopScale === 'large' && styles.roiTabBtnActive]}
                  onPress={() => setShopScale('large')}
                >
                  <Text style={[styles.roiTabText, shopScale === 'large' && styles.roiTabTextActive]}>
                    🏢 Supermart{'\n'}(150+ Bills)
                  </Text>
                </Pressable>
              </View>

              {/* Dynamic Metric Tiles */}
              <View style={styles.roiMetricsGrid}>
                <View style={styles.roiMetricTile}>
                  <Ionicons name="time-outline" size={18} color="#0284C7" />
                  <Text style={styles.roiMetricValue}>{roiData.timeSaved}</Text>
                  <Text style={styles.roiMetricLabel}>Bookkeeping Time Saved</Text>
                </View>

                <View style={[styles.roiMetricTile, { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }]}>
                  <Ionicons name="cash-outline" size={18} color="#16A34A" />
                  <Text style={[styles.roiMetricValue, { color: '#15803D' }]}>{roiData.debtRecovered}</Text>
                  <Text style={styles.roiMetricLabel}>Recovered Unpaid Debts</Text>
                </View>

                <View style={[styles.roiMetricTile, { backgroundColor: '#FEFCE8', borderColor: '#FEF08A' }]}>
                  <Ionicons name="cafe-outline" size={18} color="#CA8A04" />
                  <Text style={[styles.roiMetricValue, { color: '#854D0E' }]}>{roiData.costPerDay}</Text>
                  <Text style={styles.roiMetricLabel}>Pro Cost / Day</Text>
                </View>
              </View>

              {/* Tamil Insight Box */}
              <View style={styles.roiTamilCallout}>
                <Ionicons name="sparkles" size={14} color="#CA8A04" />
                <Text style={styles.roiTamilCalloutText}>{roiData.tamilNote}</Text>
              </View>
            </View>

            {/* ── Billing Cycle Slider Switch ── */}
            <View style={styles.billingToggleWrapper}>
              <View style={styles.billingToggleContainer}>
                <Pressable
                  style={[
                    styles.billingToggleBtn,
                    billingPeriod === 'monthly' && styles.billingToggleBtnActive,
                  ]}
                  onPress={() => setBillingPeriod('monthly')}
                >
                  <Text
                    style={[
                      styles.billingToggleText,
                      billingPeriod === 'monthly' && styles.billingToggleTextActive,
                    ]}
                  >
                    Monthly (Flexible)
                  </Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.billingToggleBtn,
                    billingPeriod === 'yearly' && styles.billingToggleBtnActiveYearly,
                  ]}
                  onPress={() => setBillingPeriod('yearly')}
                >
                  <View style={styles.yearlyToggleRow}>
                    <Ionicons
                      name="flame"
                      size={14}
                      color={billingPeriod === 'yearly' ? '#854D0E' : '#D97706'}
                    />
                    <Text
                      style={[
                        styles.billingToggleText,
                        billingPeriod === 'yearly' && styles.billingToggleTextActiveYearly,
                      ]}
                    >
                      Yearly (Save 50%)
                    </Text>
                    <View style={styles.discountPill}>
                      <Text style={styles.discountPillText}>50% OFF</Text>
                    </View>
                  </View>
                </Pressable>
              </View>
            </View>

            {/* ── Value Callout Banner ── */}
            {billingPeriod === 'yearly' && (
              <View style={styles.bestValueBanner}>
                <View style={styles.bestValueBannerIconWrap}>
                  <Ionicons name="gift" size={22} color="#CA8A04" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.bestValueBannerTitle}>
                    🔥 Pro Yearly Offer: ₹1,499/year (Save ₹1,500/year!)
                  </Text>
                  <Text style={styles.bestValueBannerSub}>
                    Equivalent to just ₹125/month (₹4.1/day)! Less than a cup of tea for 100% UNLIMITED business power.
                  </Text>
                </View>
              </View>
            )}

            {/* ── Interactive 3-Tier Plan Cards ── */}
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionHeading}>Select Your Plan</Text>
              <Text style={styles.sectionSub}>Transparent pricing • No hidden fees</Text>
            </View>

            <View style={[styles.plansContainer, isDesktop && styles.plansContainerDesktop]}>
              {/* 1. FREE TIER CARD */}
              <Pressable
                style={({ pressed }) => [
                  styles.planCard,
                  isDesktop && styles.planCardDesktop,
                  selectedTier === 'free' && styles.planCardSelected,
                  pressed && { opacity: 0.9 },
                ]}
                onPress={() => setSelectedTier('free')}
              >
                <View style={styles.planCardHeader}>
                  <View>
                    <View style={styles.planTitleRow}>
                      <Text style={styles.planName}>Free</Text>
                      {!isBasic && !isPro && (
                        <View style={styles.currentBadge}>
                          <Text style={styles.currentBadgeText}>Current Plan</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.planPrice}>
                      ₹0 <Text style={styles.planPeriod}>/ forever</Text>
                    </Text>
                    <Text style={styles.planSubDesc}>Basic starter limit for small shops</Text>
                  </View>
                  <View
                    style={[
                      styles.radioOuter,
                      selectedTier === 'free' && styles.radioOuterSelected,
                    ]}
                  >
                    {selectedTier === 'free' && <View style={styles.radioInner} />}
                  </View>
                </View>
                <View style={styles.planDivider} />
                <View style={styles.planFeatureList}>
                  <View style={styles.planFeatureItem}>
                    <Ionicons name="checkmark-circle" size={16} color="#16A34A" />
                    <Text style={styles.planFeatureText}>30 Orders / month</Text>
                  </View>
                  <View style={styles.planFeatureItem}>
                    <Ionicons name="checkmark-circle" size={16} color="#16A34A" />
                    <Text style={styles.planFeatureText}>30 Customers limit</Text>
                  </View>
                  <View style={styles.planFeatureItem}>
                    <Ionicons name="checkmark-circle" size={16} color="#16A34A" />
                    <Text style={styles.planFeatureText}>20 Products catalog</Text>
                  </View>
                  <View style={styles.planFeatureItem}>
                    <Ionicons name="checkmark-circle" size={16} color="#16A34A" />
                    <Text style={styles.planFeatureText}>1 Default Bill Template</Text>
                  </View>
                  <View style={styles.planFeatureItem}>
                    <Ionicons name="checkmark-circle" size={16} color="#16A34A" />
                    <Text style={styles.planFeatureText}>Real-time Cloud Backup</Text>
                  </View>
                </View>
              </Pressable>

              {/* 2. BASIC TIER CARD */}
              <Pressable
                style={({ pressed }) => [
                  styles.planCard,
                  isDesktop && styles.planCardDesktop,
                  selectedTier === 'basic' && styles.planCardSelected,
                  pressed && { opacity: 0.9 },
                ]}
                onPress={() => setSelectedTier('basic')}
              >
                <View style={styles.planCardHeader}>
                  <View>
                    <View style={styles.planTitleRow}>
                      <Text style={styles.planName}>Basic</Text>
                      {isBasic && !isPro && (
                        <View style={styles.currentBadge}>
                          <Text style={styles.currentBadgeText}>Current Plan</Text>
                        </View>
                      )}
                      <View style={styles.starterBadge}>
                        <Text style={styles.starterBadgeText}>Starter</Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                      <Text style={styles.planPrice}>{basicPriceText}</Text>
                      {billingPeriod === 'yearly' && (
                        <Text style={styles.strikePrice}>₹1,188</Text>
                      )}
                    </View>
                    {billingPeriod === 'yearly' ? (
                      <Text style={styles.planPeriodSub}>₹75/mo • Save 25%</Text>
                    ) : (
                      <Text style={styles.planSubDesc}>Flexible monthly starter plan</Text>
                    )}
                  </View>
                  <View
                    style={[
                      styles.radioOuter,
                      selectedTier === 'basic' && styles.radioOuterSelected,
                    ]}
                  >
                    {selectedTier === 'basic' && <View style={styles.radioInner} />}
                  </View>
                </View>
                <View style={styles.planDivider} />
                <View style={styles.planFeatureList}>
                  <View style={styles.planFeatureItem}>
                    <Ionicons name="checkmark-circle" size={16} color="#16A34A" />
                    <Text style={styles.planFeatureText}>150 Orders / month</Text>
                  </View>
                  <View style={styles.planFeatureItem}>
                    <Ionicons name="checkmark-circle" size={16} color="#16A34A" />
                    <Text style={styles.planFeatureText}>60 Customers limit</Text>
                  </View>
                  <View style={styles.planFeatureItem}>
                    <Ionicons name="checkmark-circle" size={16} color="#16A34A" />
                    <Text style={styles.planFeatureText}>20 Products catalog</Text>
                  </View>
                  <View style={styles.planFeatureItem}>
                    <Ionicons name="checkmark-circle" size={16} color="#16A34A" />
                    <Text style={styles.planFeatureText}>Standard Invoicing & PDF</Text>
                  </View>
                  <View style={styles.planFeatureItem}>
                    <Ionicons name="checkmark-circle" size={16} color="#16A34A" />
                    <Text style={styles.planFeatureText}>Cloud Sync & Backup</Text>
                  </View>
                </View>
              </Pressable>

              {/* 3. PRO UNLIMITED TIER CARD (THE STAR HERO) */}
              <Pressable
                style={({ pressed }) => [
                  styles.planCard,
                  styles.proPlanCard,
                  isDesktop && styles.planCardDesktop,
                  selectedTier === 'pro' && styles.proPlanCardSelected,
                  pressed && { opacity: 0.9 },
                ]}
                onPress={() => setSelectedTier('pro')}
              >
                <View style={styles.proRibbon}>
                  <Ionicons name="star" size={13} color="#FFFFFF" />
                  <Text style={styles.proRibbonText}>
                    {billingPeriod === 'yearly'
                      ? '👑 BEST VALUE • SAVE 50% • EVERYTHING UNLIMITED'
                      : '⭐ MOST POPULAR • EVERYTHING UNLIMITED'}
                  </Text>
                </View>
                <View style={styles.planCardHeader}>
                  <View>
                    <View style={styles.planTitleRow}>
                      <Text style={[styles.planName, styles.proPlanName]}>Pro Unlimited</Text>
                      {isPro && (
                        <View style={styles.activeProBadge}>
                          <Ionicons name="checkmark-done" size={11} color="#854D0E" />
                          <Text style={styles.activeProBadgeText}>Active</Text>
                        </View>
                      )}
                      {billingPeriod === 'yearly' && (
                        <View style={styles.bestPlanTag}>
                          <Text style={styles.bestPlanTagText}>Best Choice</Text>
                        </View>
                      )}
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                      <Text style={[styles.planPrice, styles.proPlanPrice]}>{proPriceText}</Text>
                      {billingPeriod === 'yearly' && (
                        <Text style={styles.strikePrice}>₹2,999</Text>
                      )}
                    </View>
                    {billingPeriod === 'yearly' ? (
                      <Text style={styles.proPeriodSub}>✨ Just ₹125/month (₹4.1/day) • Save ₹1,500/yr</Text>
                    ) : (
                      <Text style={styles.proPeriodSub}>Full access with monthly flexibility</Text>
                    )}
                  </View>
                  <View
                    style={[
                      styles.radioOuter,
                      styles.proRadioOuter,
                      selectedTier === 'pro' && styles.proRadioOuterSelected,
                    ]}
                  >
                    {selectedTier === 'pro' && <View style={styles.proRadioInner} />}
                  </View>
                </View>
                <View style={[styles.planDivider, styles.proPlanDivider]} />
                <View style={styles.planFeatureList}>
                  <View style={styles.planFeatureItem}>
                    <Ionicons name="infinite" size={17} color="#CA8A04" />
                    <Text style={[styles.planFeatureText, styles.proFeatureText, { fontFamily: fonts.bodyBold }]}>
                      Unlimited Orders (No monthly limit)
                    </Text>
                  </View>
                  <View style={styles.planFeatureItem}>
                    <Ionicons name="infinite" size={17} color="#CA8A04" />
                    <Text style={[styles.planFeatureText, styles.proFeatureText, { fontFamily: fonts.bodyBold }]}>
                      Unlimited Customers & Products
                    </Text>
                  </View>
                  <View style={styles.planFeatureItem}>
                    <Ionicons name="checkmark-circle" size={16} color="#16A34A" />
                    <Text style={[styles.planFeatureText, styles.proFeatureText]}>
                      All 6+ Premium Templates & Shop Logo
                    </Text>
                  </View>
                  <View style={styles.planFeatureItem}>
                    <Ionicons name="checkmark-circle" size={16} color="#16A34A" />
                    <Text style={[styles.planFeatureText, styles.proFeatureText]}>
                      PDF & Excel Export + GST Reports
                    </Text>
                  </View>
                  <View style={styles.planFeatureItem}>
                    <Ionicons name="checkmark-circle" size={16} color="#16A34A" />
                    <Text style={[styles.planFeatureText, styles.proFeatureText]}>
                      Automated Payment Reminders (WhatsApp/SMS)
                    </Text>
                  </View>
                  <View style={styles.planFeatureItem}>
                    <Ionicons name="checkmark-circle" size={16} color="#16A34A" />
                    <Text style={[styles.planFeatureText, styles.proFeatureText]}>
                      Advanced Profit & Loss Business Analytics
                    </Text>
                  </View>
                  <View style={styles.planFeatureItem}>
                    <Ionicons name="checkmark-circle" size={16} color="#16A34A" />
                    <Text style={[styles.planFeatureText, styles.proFeatureText]}>
                      24/7 Priority VIP Support & Phone Assistance
                    </Text>
                  </View>
                </View>
              </Pressable>
            </View>

            {/* ── Interactive 4 Key Feature Highlight Cards ── */}
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionHeading}>Why Shop Owners Choose Pro</Text>
              <Text style={styles.sectionSub}>Tools crafted to save 3+ hours daily</Text>
            </View>

            <View style={[styles.benefitsGrid, isDesktop && styles.benefitsGridDesktop]}>
              <View style={[styles.benefitCard, isDesktop && styles.benefitCardDesktop]}>
                <View style={[styles.benefitIconWrap, { backgroundColor: '#FEF3C7' }]}>
                  <Ionicons name="infinite" size={22} color="#D97706" />
                </View>
                <Text style={styles.benefitTitle}>Zero Order Limits</Text>
                <Text style={styles.benefitDesc}>
                  Never get blocked during busy festive crowds. Record hundreds of orders every single day without interruption.
                </Text>
              </View>

              <View style={[styles.benefitCard, isDesktop && styles.benefitCardDesktop]}>
                <View style={[styles.benefitIconWrap, { backgroundColor: '#E0F2FE' }]}>
                  <Ionicons name="logo-whatsapp" size={22} color="#0284C7" />
                </View>
                <Text style={styles.benefitTitle}>Recover Unpaid Dues Fast</Text>
                <Text style={styles.benefitDesc}>
                  Automated WhatsApp payment reminders help store owners collect credit balances 80% faster with 1-tap UPI links.
                </Text>
              </View>

              <View style={[styles.benefitCard, isDesktop && styles.benefitCardDesktop]}>
                <View style={[styles.benefitIconWrap, { backgroundColor: '#DCFCE7' }]}>
                  <Ionicons name="trending-up-outline" size={22} color="#16A34A" />
                </View>
                <Text style={styles.benefitTitle}>Deep Profit Analytics</Text>
                <Text style={styles.benefitDesc}>
                  Track exact daily profits, revenue trends, top-selling inventory items, and export GST-ready Excel sheets for your CA.
                </Text>
              </View>

              <View style={[styles.benefitCard, isDesktop && styles.benefitCardDesktop]}>
                <View style={[styles.benefitIconWrap, { backgroundColor: '#F3E8FF' }]}>
                  <Ionicons name="phone-portrait-outline" size={22} color="#9333EA" />
                </View>
                <Text style={styles.benefitTitle}>Multi-Device Sync</Text>
                <Text style={styles.benefitDesc}>
                  Give staff phones or tablets for counter billing while you monitor total sales, cash in hand, and inventory from home.
                </Text>
              </View>
            </View>

            {/* ── Detailed Comparison Matrix ── */}
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionHeading}>Plan Comparison</Text>
              <Text style={styles.sectionSub}>Detailed feature breakdown</Text>
            </View>

            <View style={styles.comparisonTable}>
              {/* Header */}
              <View style={styles.compHeaderRow}>
                <Text style={[styles.compHeaderCol, { flex: 2.5 }]}>Features</Text>
                <Text style={[styles.compHeaderCol, styles.compColCenter]}>Free</Text>
                <Text style={[styles.compHeaderCol, styles.compColCenter]}>Basic</Text>
                <View style={[styles.compHeaderCol, styles.compColCenter, styles.compProHeaderCol]}>
                  <Text style={styles.compProHeaderText}>Pro Unlimited</Text>
                </View>
              </View>

              {/* Feature Rows */}
              {[
                { name: 'Monthly Orders Limit', free: '30', basic: '150', pro: 'Unlimited', icon: 'receipt-outline' },
                { name: 'Customer Contacts Limit', free: '30', basic: '60', pro: 'Unlimited', icon: 'people-outline' },
                { name: 'Product Catalog Items', free: '20', basic: '20', pro: 'Unlimited', icon: 'pricetag-outline' },
                { name: 'Invoice Templates', free: '1 Default', basic: '1 Default', pro: 'All Premium (6+)', icon: 'document-text-outline' },
                { name: 'Custom Logo & Branding', free: '—', basic: '—', pro: '✓', icon: 'color-palette-outline' },
                { name: 'PDF & Excel Export', free: '—', basic: '—', pro: '✓', icon: 'download-outline' },
                { name: 'Financial P&L Reports', free: 'Basic', basic: 'Basic', pro: 'Advanced + GST', icon: 'bar-chart-outline' },
                { name: 'WhatsApp Invoicing', free: '✓', basic: '✓', pro: '✓ Unlimited', icon: 'logo-whatsapp' },
                { name: 'Automated Credit Reminders', free: '—', basic: '—', pro: '✓', icon: 'notifications-outline' },
                { name: 'Cloud Multi-Device Sync', free: '✓', basic: '✓', pro: '✓ Real-time', icon: 'cloud-done-outline' },
                { name: 'Bluetooth Thermal Printer', free: '✓', basic: '✓', pro: '✓ 2" & 3"', icon: 'print-outline' },
                { name: 'Priority VIP Support', free: '—', basic: '—', pro: '✓ 24/7 Dedicated', icon: 'headset-outline' },
              ].map((item, index) => (
                <View
                  key={index}
                  style={[
                    styles.compRow,
                    index % 2 === 1 && styles.compRowAlt,
                  ]}
                >
                  <View style={[styles.compCell, { flex: 2.5, flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
                    <Ionicons name={item.icon as any} size={16} color={colors.inkSoft} />
                    <Text style={styles.compCellFeature}>{item.name}</Text>
                  </View>
                  <Text style={[styles.compCell, styles.compColCenter, styles.compMuted]}>
                    {item.free}
                  </Text>
                  <Text style={[styles.compCell, styles.compColCenter, styles.compBasic]}>
                    {item.basic}
                  </Text>
                  <View style={[styles.compCell, styles.compColCenter, styles.compProCol]}>
                    <Text style={styles.compProText}>{item.pro}</Text>
                  </View>
                </View>
              ))}
            </View>

            {/* ── Real Customer Testimonials ── */}
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionHeading}>Loved by Tamil Nadu Shop Owners</Text>
              <Text style={styles.sectionSub}>Real store experiences</Text>
            </View>

            <View style={[styles.testimonialsGrid, isDesktop && styles.testimonialsGridDesktop]}>
              <View style={[styles.testimonialCard, isDesktop && styles.testimonialCardDesktop]}>
                <View style={styles.testimonialRating}>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Ionicons key={i} name="star" size={14} color="#F59E0B" />
                  ))}
                </View>
                <Text style={styles.testimonialQuote}>
                  "KadaiBook Pro helped me collect over ₹45,000 pending customer balances within 2 weeks using WhatsApp reminders. Best investment for our store."
                </Text>
                <View style={styles.testimonialAuthorRow}>
                  <View style={styles.testimonialAvatar}>
                    <Text style={styles.testimonialAvatarText}>M</Text>
                  </View>
                  <View>
                    <Text style={styles.testimonialAuthorName}>K. Murugan</Text>
                    <Text style={styles.testimonialAuthorShop}>Murugan Supermarket, Madurai</Text>
                  </View>
                </View>
              </View>

              <View style={[styles.testimonialCard, isDesktop && styles.testimonialCardDesktop]}>
                <View style={styles.testimonialRating}>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Ionicons key={i} name="star" size={14} color="#F59E0B" />
                  ))}
                </View>
                <Text style={styles.testimonialQuote}>
                  "Unlimited bills and Bluetooth thermal printer billing made our counter 3x faster during evening crowds. Very smooth and easy to use."
                </Text>
                <View style={styles.testimonialAuthorRow}>
                  <View style={styles.testimonialAvatar}>
                    <Text style={styles.testimonialAvatarText}>R</Text>
                  </View>
                  <View>
                    <Text style={styles.testimonialAuthorName}>S. Ramesh</Text>
                    <Text style={styles.testimonialAuthorShop}>Sri Krishna Bakery, Coimbatore</Text>
                  </View>
                </View>
              </View>

              <View style={[styles.testimonialCard, isDesktop && styles.testimonialCardDesktop]}>
                <View style={styles.testimonialRating}>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Ionicons key={i} name="star" size={14} color="#F59E0B" />
                  ))}
                </View>
                <Text style={styles.testimonialQuote}>
                  "The real-time sync between my counter billing tablet and my personal phone is a lifesaver. I can check daily collections from anywhere."
                </Text>
                <View style={styles.testimonialAuthorRow}>
                  <View style={styles.testimonialAvatar}>
                    <Text style={styles.testimonialAvatarText}>A</Text>
                  </View>
                  <View>
                    <Text style={styles.testimonialAuthorName}>V. Annamalai</Text>
                    <Text style={styles.testimonialAuthorShop}>Annamalai Textiles, Chennai</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* ── Interactive FAQs ── */}
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionHeading}>Frequently Asked Questions</Text>
              <Text style={styles.sectionSub}>Everything you need to know</Text>
            </View>

            <View style={styles.faqContainer}>
              {faqs.map((faq, idx) => {
                const isOpen = expandedFaq === idx;
                return (
                  <Pressable
                    key={idx}
                    style={styles.faqCard}
                    onPress={() => setExpandedFaq(isOpen ? null : idx)}
                  >
                    <View style={styles.faqHeader}>
                      <Text style={styles.faqQuestion}>{faq.q}</Text>
                      <Ionicons
                        name={isOpen ? 'chevron-up' : 'chevron-down'}
                        size={18}
                        color={colors.inkSoft}
                      />
                    </View>
                    {isOpen && (
                      <View style={styles.faqBody}>
                        <Text style={styles.faqAnswer}>{faq.a}</Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>

            {/* ── Web CTA Card (For Web Users) ── */}
            {Platform.OS === 'web' && (
              <View style={styles.webCtaCard}>
                <View style={styles.webCtaIconWrap}>
                  <Ionicons name="phone-portrait" size={28} color={colors.clayDeep} />
                </View>
                <Text style={styles.webCtaTitle}>Ready to Upgrade Your Shop?</Text>
                <Text style={styles.webCtaSub}>
                  Open KadaiBook on your Android phone or iPhone to subscribe with 1 tap via Google Play / App Store. All Pro features will instantly sync to this web account!
                </Text>

                <View style={styles.appStoreButtonsRow}>
                  <Pressable
                    style={styles.storeBadgeBtn}
                    onPress={() => Linking.openURL(PLAY_STORE_URL)}
                  >
                    <Ionicons name="logo-google-playstore" size={20} color="#FFFFFF" />
                    <View>
                      <Text style={styles.storeBadgeSub}>GET IT ON</Text>
                      <Text style={styles.storeBadgeTitle}>Google Play</Text>
                    </View>
                  </Pressable>

                  <Pressable
                    style={[styles.storeBadgeBtn, { backgroundColor: '#000000' }]}
                    onPress={() => Linking.openURL(APP_STORE_URL)}
                  >
                    <Ionicons name="logo-apple" size={20} color="#FFFFFF" />
                    <View>
                      <Text style={styles.storeBadgeSub}>Download on the</Text>
                      <Text style={styles.storeBadgeTitle}>App Store</Text>
                    </View>
                  </Pressable>
                </View>
              </View>
            )}

            {/* ── Action / Upgrade Container (Mobile Native) ── */}
            {Platform.OS !== 'web' && (
              <View style={styles.actionContainer}>
                {selectedTier === 'free' ? (
                  <View style={styles.freeActiveBanner}>
                    <Ionicons name="checkmark-circle" size={20} color="#16A34A" />
                    <Text style={styles.freeActiveBannerText}>
                      You are using the Free Plan (30 orders/mo). Select Pro or Basic above anytime to upgrade.
                    </Text>
                  </View>
                ) : (
                  <>
                    <Pressable
                      style={({ pressed }) => [
                        styles.upgradeButton,
                        purchasing && { opacity: 0.6 },
                        pressed && { transform: [{ scale: 0.98 }] },
                      ]}
                      onPress={() => handlePurchase()}
                      disabled={purchasing}
                    >
                      {purchasing ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <>
                          <Ionicons name="sparkles" size={20} color="#FFFFFF" />
                          <Text style={styles.upgradeButtonText}>
                            {selectedTier === 'pro'
                              ? `Unlock Pro Unlimited • ${proPriceText}`
                              : `Get Basic Plan • ${basicPriceText}`}
                          </Text>
                          <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                        </>
                      )}
                    </Pressable>

                    <Text style={styles.guaranteeText}>
                      🔒 Cancel anytime in Google Play / App Store • 100% Secure Checkout
                    </Text>

                    <Pressable
                      style={({ pressed }) => [styles.restoreButton, pressed && { opacity: 0.6 }]}
                      onPress={handleRestore}
                      disabled={purchasing}
                    >
                      <Text style={styles.restoreButtonText}>Already purchased? Restore Purchases</Text>
                    </Pressable>
                  </>
                )}
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </DesktopLayout>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F8F6F0',
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  topHeader: {
    backgroundColor: 'rgba(248, 246, 240, 0.95)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
    paddingVertical: 12,
    paddingHorizontal: 16,
    zIndex: 10,
  },
  topHeaderInner: {
    maxWidth: 1000,
    width: '100%',
    marginHorizontal: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topHeaderTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    color: colors.ink,
  },
  topHeaderSub: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.inkSoft,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  statusPillFree: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  statusPillBasic: {
    backgroundColor: '#F0F9FF',
    borderColor: '#BAE6FD',
  },
  statusPillPro: {
    backgroundColor: '#FEFCE8',
    borderColor: '#FEF08A',
  },
  statusPillText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
  },
  statusPillTextFree: {
    color: '#15803D',
  },
  statusPillTextBasic: {
    color: '#0284C7',
  },
  statusPillTextPro: {
    color: '#A16207',
  },
  scrollContent: {
    paddingBottom: 60,
  },
  innerContainer: {
    maxWidth: 1000,
    width: '100%',
    marginHorizontal: 'auto',
    paddingHorizontal: 16,
    paddingTop: 16,
  },

  /* ── Hero Dark Card ── */
  heroCard: {
    backgroundColor: '#14120E',
    borderRadius: 24,
    padding: 28,
    position: 'relative',
    overflow: 'hidden',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 8,
  },
  heroGlowAmber: {
    position: 'absolute',
    top: -80,
    right: -80,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(202, 138, 4, 0.25)',
    opacity: 0.8,
  },
  heroGlowRose: {
    position: 'absolute',
    bottom: -80,
    left: -80,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(185, 102, 89, 0.22)',
    opacity: 0.8,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: 'rgba(254, 240, 138, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(254, 240, 138, 0.35)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radius.pill,
    marginBottom: 14,
  },
  heroBadgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: '#FDE047',
    letterSpacing: 0.8,
  },
  heroTitle: {
    fontFamily: fonts.display,
    fontSize: 26,
    color: '#FFFFFF',
    lineHeight: 32,
    marginBottom: 6,
  },
  heroTitleAccent: {
    color: '#FBBF24',
  },
  heroTamilSubtitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: '#FDE68A',
    marginBottom: 10,
  },
  heroSubtitle: {
    fontFamily: fonts.body,
    fontSize: 13.5,
    color: '#D4CDC0',
    lineHeight: 20,
    marginBottom: 20,
  },
  heroTrustGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  heroTrustPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  heroTrustText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11.5,
    color: '#E6E1D8',
  },

  /* ── ROI & Profit Calculator ── */
  roiCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E8E2D5',
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  roiHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  roiIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FEF9C3',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FDE047',
  },
  roiTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    color: colors.ink,
  },
  roiSub: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.inkSoft,
  },
  roiTabsRow: {
    flexDirection: 'row',
    backgroundColor: '#F5EFE4',
    padding: 4,
    borderRadius: radius.md,
    gap: 4,
    marginBottom: 16,
  },
  roiTabBtn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roiTabBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  roiTabText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11.5,
    color: colors.inkSoft,
    textAlign: 'center',
    lineHeight: 15,
  },
  roiTabTextActive: {
    fontFamily: fonts.bodyBold,
    color: colors.ink,
  },
  roiMetricsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  roiMetricTile: {
    flex: 1,
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: radius.md,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roiMetricValue: {
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    color: '#0369A1',
    marginTop: 4,
    marginBottom: 2,
    textAlign: 'center',
  },
  roiMetricLabel: {
    fontFamily: fonts.body,
    fontSize: 10.5,
    color: colors.inkSoft,
    textAlign: 'center',
  },
  roiTamilCallout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  roiTamilCalloutText: {
    flex: 1,
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: '#854D0E',
    lineHeight: 16,
  },

  /* ── Billing Toggle Switch ── */
  billingToggleWrapper: {
    alignItems: 'center',
    marginBottom: 16,
  },
  billingToggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#EBE5D8',
    padding: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  billingToggleBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: radius.pill,
  },
  billingToggleBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  billingToggleBtnActiveYearly: {
    backgroundColor: '#FEF08A',
    shadowColor: '#CA8A04',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 4,
  },
  billingToggleText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.inkSoft,
  },
  billingToggleTextActive: {
    fontFamily: fonts.bodyBold,
    color: colors.ink,
  },
  billingToggleTextActiveYearly: {
    fontFamily: fonts.bodyBold,
    color: '#854D0E',
  },
  yearlyToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  discountPill: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  discountPillText: {
    fontFamily: fonts.bodyBold,
    fontSize: 9.5,
    color: '#FFFFFF',
  },

  /* ── Best Value Callout ── */
  bestValueBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEFCE8',
    borderWidth: 1.5,
    borderColor: '#FACC15',
    borderRadius: radius.lg,
    padding: 16,
    gap: 14,
    marginBottom: 24,
    shadowColor: '#CA8A04',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
  },
  bestValueBannerIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#FEF08A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bestValueBannerTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 14.5,
    color: '#854D0E',
    marginBottom: 2,
  },
  bestValueBannerSub: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: '#713F12',
    lineHeight: 16,
  },

  /* ── Section Header ── */
  sectionHeaderRow: {
    marginBottom: 16,
    marginTop: 10,
  },
  sectionHeading: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.ink,
    marginBottom: 2,
  },
  sectionSub: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.inkSoft,
  },

  /* ── Plans Container ── */
  plansContainer: {
    gap: 16,
    marginBottom: 28,
  },
  plansContainerDesktop: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  planCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: '#E8E2D5',
    padding: 24,
    position: 'relative',
    shadowColor: '#2E2A24',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  planCardDesktop: {
    flex: 1,
  },
  planCardSelected: {
    borderColor: colors.clayDeep,
    backgroundColor: '#FFFAF8',
  },
  proPlanCard: {
    borderColor: '#EAB308',
    backgroundColor: '#FFFDF5',
    paddingTop: 30,
    shadowColor: '#CA8A04',
    shadowOpacity: 0.15,
    shadowRadius: 14,
    elevation: 4,
  },
  proPlanCardSelected: {
    borderColor: '#CA8A04',
    borderWidth: 2.5,
    backgroundColor: '#FEFCE8',
    shadowColor: '#CA8A04',
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 6,
  },
  proRibbon: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#CA8A04',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
  },
  proRibbonText: {
    fontFamily: fonts.bodyBold,
    fontSize: 10.5,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  planCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  planTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  planName: {
    fontFamily: fonts.bodyBold,
    fontSize: 20,
    color: colors.ink,
  },
  proPlanName: {
    color: '#854D0E',
  },
  currentBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  currentBadgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 9.5,
    color: '#15803D',
  },
  starterBadge: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  starterBadgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 9.5,
    color: '#0369A1',
  },
  activeProBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FEF08A',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  activeProBadgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 9.5,
    color: '#854D0E',
  },
  bestPlanTag: {
    backgroundColor: '#FEF08A',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  bestPlanTagText: {
    fontFamily: fonts.bodyBold,
    fontSize: 9.5,
    color: '#A16207',
  },
  planPrice: {
    fontFamily: fonts.bodyBold,
    fontSize: 22,
    color: colors.ink,
  },
  proPlanPrice: {
    color: '#854D0E',
  },
  strikePrice: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.inkSoft,
    textDecorationLine: 'line-through',
  },
  planPeriodSub: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: '#15803D',
    marginTop: 2,
  },
  proPeriodSub: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: '#A16207',
    marginTop: 2,
  },
  planSubDesc: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.inkSoft,
    marginTop: 2,
  },
  planPeriod: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.inkSoft,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#D4CDC0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterSelected: {
    borderColor: colors.clayDeep,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.clayDeep,
  },
  proRadioOuter: {
    borderColor: '#FACC15',
  },
  proRadioOuterSelected: {
    borderColor: '#CA8A04',
  },
  proRadioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#CA8A04',
  },
  planDivider: {
    height: 1,
    backgroundColor: '#EFEAE0',
    marginVertical: 14,
  },
  proPlanDivider: {
    backgroundColor: '#FEF08A',
  },
  planFeatureList: {
    gap: 10,
  },
  planFeatureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  planFeatureText: {
    fontFamily: fonts.body,
    fontSize: 13.5,
    color: colors.ink,
    flexShrink: 1,
    lineHeight: 19,
  },
  proFeatureText: {
    fontFamily: fonts.bodyMedium,
    color: '#451A03',
  },

  /* ── Comparison Table ── */
  comparisonTable: {
    backgroundColor: '#FFFFFF',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#E8E2D5',
    overflow: 'hidden',
    marginBottom: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  compHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#F5EFE4',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E2D5',
    alignItems: 'center',
  },
  compHeaderCol: {
    flex: 1,
    fontFamily: fonts.bodyBold,
    fontSize: 12.5,
    color: colors.ink,
  },
  compColCenter: {
    textAlign: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
  compProHeaderCol: {
    backgroundColor: '#FEF08A',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: radius.sm,
  },
  compProHeaderText: {
    fontFamily: fonts.bodyBold,
    fontSize: 12.5,
    color: '#854D0E',
    textAlign: 'center',
  },
  compRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.04)',
    alignItems: 'center',
  },
  compRowAlt: {
    backgroundColor: '#FAF8F4',
  },
  compCell: {
    flex: 1,
  },
  compCellFeature: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12.5,
    color: colors.ink,
  },
  compMuted: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.inkSoft,
  },
  compBasic: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.ink,
  },
  compProCol: {
    backgroundColor: '#FFFDF5',
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  compProText: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: '#854D0E',
  },

  /* ── Benefits Grid ── */
  benefitsGrid: {
    gap: 12,
    marginBottom: 28,
  },
  benefitsGridDesktop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  benefitCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#E8E2D5',
    padding: 20,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  benefitCardDesktop: {
    width: '48.8%',
  },
  benefitIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  benefitTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    color: colors.ink,
    marginBottom: 4,
  },
  benefitDesc: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.inkSoft,
    lineHeight: 19,
  },

  /* ── Testimonials ── */
  testimonialsGrid: {
    gap: 12,
    marginBottom: 28,
  },
  testimonialsGridDesktop: {
    flexDirection: 'row',
  },
  testimonialCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#E8E2D5',
    padding: 20,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  testimonialCardDesktop: {
    flex: 1,
  },
  testimonialRating: {
    flexDirection: 'row',
    gap: 3,
    marginBottom: 10,
  },
  testimonialQuote: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.ink,
    lineHeight: 20,
    marginBottom: 14,
    fontStyle: 'italic',
  },
  testimonialAuthorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  testimonialAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F5EBE1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  testimonialAvatarText: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.clayDeep,
  },
  testimonialAuthorName: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.ink,
  },
  testimonialAuthorShop: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.inkSoft,
  },

  /* ── FAQ ── */
  faqContainer: {
    gap: 10,
    marginBottom: 28,
  },
  faqCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#E8E2D5',
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  faqQuestion: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.ink,
    flex: 1,
  },
  faqBody: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#EFEAE0',
  },
  faqAnswer: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.inkSoft,
    lineHeight: 20,
  },

  /* ── Action / Upgrade Container ── */
  actionContainer: {
    marginTop: 10,
    gap: 12,
  },
  upgradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#CA8A04',
    paddingVertical: 16,
    borderRadius: 16,
    shadowColor: '#CA8A04',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  upgradeButtonText: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  guaranteeText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.inkSoft,
    textAlign: 'center',
  },
  restoreButton: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  restoreButtonText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.inkSoft,
    textDecorationLine: 'underline',
  },
  freeActiveBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: radius.md,
    padding: 16,
  },
  freeActiveBannerText: {
    flex: 1,
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: '#15803D',
    lineHeight: 18,
  },

  /* ── Web CTA Card ── */
  webCtaCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 32,
    borderWidth: 1.5,
    borderColor: '#E8E2D5',
    alignItems: 'center',
    textAlign: 'center',
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  webCtaIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FBECE8',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  webCtaTitle: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.ink,
    marginBottom: 8,
    textAlign: 'center',
  },
  webCtaSub: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.inkSoft,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 580,
    marginBottom: 24,
  },
  appStoreButtonsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 14,
  },
  storeBadgeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#0F172A',
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 14,
  },
  storeBadgeSub: {
    fontFamily: fonts.body,
    fontSize: 9.5,
    color: '#94A3B8',
    textTransform: 'uppercase',
  },
  storeBadgeTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: '#FFFFFF',
  },
});
