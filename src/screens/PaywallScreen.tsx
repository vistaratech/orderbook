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
        'In-app purchases are securely processed via Google Play and Apple App Store. Please download the KadaiBook app on your phone to upgrade.'
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
                  p.product?.identifier?.toLowerCase().includes('basic')) &&
                (p.packageType === 'ANNUAL' ||
                  p.identifier.toLowerCase().includes('year') ||
                  p.product?.identifier?.toLowerCase().includes('annual'))
            ) ||
            packages.find((p) => p.identifier.toLowerCase().includes('basic')) ||
            packages[0];
        } else {
          targetPkg =
            packages.find(
              (p) =>
                (p.identifier.toLowerCase().includes('basic') ||
                  p.product?.identifier?.toLowerCase().includes('basic')) &&
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
                  p.product?.identifier?.toLowerCase().includes('pro')) &&
                (p.packageType === 'ANNUAL' ||
                  p.identifier.toLowerCase().includes('year') ||
                  p.product?.identifier?.toLowerCase().includes('annual'))
            ) ||
            packages.find((p) => p.identifier.toLowerCase().includes('pro')) ||
            packages[0];
        } else {
          targetPkg =
            packages.find(
              (p) =>
                (p.identifier.toLowerCase().includes('pro') ||
                  p.product?.identifier?.toLowerCase().includes('pro')) &&
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

  const toggleFaq = (index: number) => {
    setExpandedFaq(expandedFaq === index ? null : index);
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

  return (
    <DesktopLayout currentTabName="PaywallScreen">
      <SafeAreaView style={styles.screen} edges={['top']}>
        {/* ── Top Header ── */}
        <View style={styles.topHeader}>
          <View style={styles.topHeaderInner}>
            <GlassBackButton label="Back" />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.topHeaderTitle}>Subscription &amp; Pricing Plans</Text>
              <Text style={styles.topHeaderSub}>Choose the right power plan for your shop</Text>
            </View>
            <View
              style={[
                styles.statusPill,
                isPro ? styles.statusPillPro : isBasic ? styles.statusPillBasic : styles.statusPillFree,
              ]}
            >
              <Ionicons
                name={isPro ? 'sparkles' : isBasic ? 'star' : 'shield-checkmark-outline'}
                size={12}
                color={isPro ? '#854D0E' : isBasic ? '#1E40AF' : '#4B5563'}
              />
              <Text
                style={[
                  styles.statusPillText,
                  isPro ? styles.statusPillTextPro : isBasic ? styles.statusPillTextBasic : styles.statusPillTextFree,
                ]}
              >
                {isPro ? '👑 Pro Active' : isBasic ? '⭐ Basic Active' : 'Free Plan'}
              </Text>
            </View>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.innerContainer}>
            {/* ── Hero Banner ── */}
            <View style={styles.heroCard}>
              <View style={styles.heroGlow} />
              <View style={styles.heroBadge}>
                <Ionicons name="sparkles" size={13} color="#FDE047" />
                <Text style={styles.heroBadgeText}>ELEVATE YOUR BUSINESS AUTOMATION</Text>
              </View>
              <Text style={styles.heroTitle}>
                Scale Without Limits with{'\n'}
                <Text style={styles.heroTitleHighlight}>KadaiBook Pro</Text>
              </Text>
              <Text style={styles.heroSubtitle}>
                Manage unlimited customer orders, instant thermal &amp; WhatsApp bills, automated balance reminders, and deep profit insights.
              </Text>

              {/* Quick Social Proof Metrics */}
              <View style={styles.heroStatsRow}>
                <View style={styles.heroStatItem}>
                  <Text style={styles.heroStatNum}>1,000+</Text>
                  <Text style={styles.heroStatLabel}>Active Shops</Text>
                </View>
                <View style={styles.heroStatDivider} />
                <View style={styles.heroStatItem}>
                  <Text style={styles.heroStatNum}>4.9 ★</Text>
                  <Text style={styles.heroStatLabel}>Merchant Rating</Text>
                </View>
                <View style={styles.heroStatDivider} />
                <View style={styles.heroStatItem}>
                  <Text style={styles.heroStatNum}>100%</Text>
                  <Text style={styles.heroStatLabel}>Safe &amp; Encrypted</Text>
                </View>
              </View>
            </View>

            {/* ── Billing Cycle Toggle (Monthly vs Yearly) ── */}
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
                    Monthly Billing
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
                    <Text
                      style={[
                        styles.billingToggleText,
                        billingPeriod === 'yearly' && styles.billingToggleTextActiveYearly,
                      ]}
                    >
                      👑 Yearly Plan
                    </Text>
                    <View style={styles.discountPill}>
                      <Text style={styles.discountPillText}>SAVE 50%</Text>
                    </View>
                  </View>
                </Pressable>
              </View>
            </View>

            {/* ── Best Value Callout Banner ── */}
            {billingPeriod === 'yearly' && (
              <View style={styles.bestValueBanner}>
                <View style={styles.bestValueBannerIconWrap}>
                  <Ionicons name="gift" size={22} color="#CA8A04" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.bestValueBannerTitle}>
                    🔥 Best Value Deal: Pro Yearly @ ₹1,499/year (Just ₹125/month)
                  </Text>
                  <Text style={styles.bestValueBannerSub}>
                    Save ₹1,500 every year! Enjoy 100% UNLIMITED orders, customers, premium invoice logos, and VIP support.
                  </Text>
                </View>
              </View>
            )}

            {/* ── Interactive Plan Cards Grid ── */}
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionHeading}>Select Your Plan</Text>
              <Text style={styles.sectionSub}>No long-term lock-in • Switch or cancel anytime</Text>
            </View>

            <View style={[styles.plansContainer, isDesktop && styles.plansContainerDesktop]}>
              {/* ── FREE TIER CARD ── */}
              <Pressable
                style={({ pressed }) => [
                  styles.planCard,
                  isDesktop && styles.planCardDesktop,
                  selectedTier === 'free' && styles.planCardSelected,
                  pressed && { opacity: 0.95 },
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
                    <Text style={styles.planPeriodSub}>Basic essentials for new shops</Text>
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
                    <Ionicons name="checkmark-circle" size={17} color="#16A34A" />
                    <Text style={styles.planFeatureText}>30 Orders / month</Text>
                  </View>
                  <View style={styles.planFeatureItem}>
                    <Ionicons name="checkmark-circle" size={17} color="#16A34A" />
                    <Text style={styles.planFeatureText}>30 Customers limit</Text>
                  </View>
                  <View style={styles.planFeatureItem}>
                    <Ionicons name="checkmark-circle" size={17} color="#16A34A" />
                    <Text style={styles.planFeatureText}>20 Products catalog</Text>
                  </View>
                  <View style={styles.planFeatureItem}>
                    <Ionicons name="checkmark-circle" size={17} color="#16A34A" />
                    <Text style={styles.planFeatureText}>1 Default Bill Template</Text>
                  </View>
                  <View style={styles.planFeatureItem}>
                    <Ionicons name="checkmark-circle" size={17} color="#16A34A" />
                    <Text style={styles.planFeatureText}>Cloud Sync &amp; Backup</Text>
                  </View>
                  <View style={styles.planFeatureItem}>
                    <Ionicons name="close-circle-outline" size={17} color="#9CA3AF" />
                    <Text style={[styles.planFeatureText, styles.planFeatureTextDisabled]}>
                      Custom Shop Logo &amp; Branding
                    </Text>
                  </View>
                </View>

                <View style={styles.cardActionArea}>
                  <View style={[styles.cardBtn, styles.cardBtnFree]}>
                    <Text style={styles.cardBtnTextFree}>
                      {!isBasic && !isPro ? 'Active Current Plan' : 'Free Tier'}
                    </Text>
                  </View>
                </View>
              </Pressable>

              {/* ── BASIC TIER CARD ── */}
              <Pressable
                style={({ pressed }) => [
                  styles.planCard,
                  isDesktop && styles.planCardDesktop,
                  selectedTier === 'basic' && styles.planCardSelected,
                  pressed && { opacity: 0.95 },
                ]}
                onPress={() => setSelectedTier('basic')}
              >
                <View style={styles.planCardHeader}>
                  <View>
                    <View style={styles.planTitleRow}>
                      <Text style={styles.planName}>Basic</Text>
                      {isBasic && !isPro && (
                        <View style={styles.currentBadge}>
                          <Text style={styles.currentBadgeText}>Active Plan</Text>
                        </View>
                      )}
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                      <Text style={styles.planPrice}>{basicPriceText}</Text>
                      {billingPeriod === 'yearly' && <Text style={styles.strikePrice}>₹1,188</Text>}
                    </View>
                    {billingPeriod === 'yearly' ? (
                      <Text style={styles.planPeriodSub}>₹75/mo • Save 25%</Text>
                    ) : (
                      <Text style={styles.planPeriodSub}>For growing shops</Text>
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
                    <Ionicons name="checkmark-circle" size={17} color="#16A34A" />
                    <Text style={styles.planFeatureText}>150 Orders / month</Text>
                  </View>
                  <View style={styles.planFeatureItem}>
                    <Ionicons name="checkmark-circle" size={17} color="#16A34A" />
                    <Text style={styles.planFeatureText}>60 Customers limit</Text>
                  </View>
                  <View style={styles.planFeatureItem}>
                    <Ionicons name="checkmark-circle" size={17} color="#16A34A" />
                    <Text style={styles.planFeatureText}>20 Products catalog</Text>
                  </View>
                  <View style={styles.planFeatureItem}>
                    <Ionicons name="checkmark-circle" size={17} color="#16A34A" />
                    <Text style={styles.planFeatureText}>Standard Invoicing</Text>
                  </View>
                  <View style={styles.planFeatureItem}>
                    <Ionicons name="checkmark-circle" size={17} color="#16A34A" />
                    <Text style={styles.planFeatureText}>Cloud Sync &amp; Backup</Text>
                  </View>
                  <View style={styles.planFeatureItem}>
                    <Ionicons name="close-circle-outline" size={17} color="#9CA3AF" />
                    <Text style={[styles.planFeatureText, styles.planFeatureTextDisabled]}>
                      P&amp;L Advanced Analytics
                    </Text>
                  </View>
                </View>

                <View style={styles.cardActionArea}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.cardBtn,
                      styles.cardBtnBasic,
                      pressed && { opacity: 0.9 },
                    ]}
                    onPress={() => {
                      setSelectedTier('basic');
                      if (Platform.OS !== 'web') handlePurchase();
                    }}
                  >
                    <Text style={styles.cardBtnTextBasic}>
                      {isBasic && !isPro ? 'Active Plan' : `Get Basic (${basicPriceText})`}
                    </Text>
                  </Pressable>
                </View>
              </Pressable>

              {/* ── PRO TIER CARD (HERO / FEATURED) ── */}
              <Pressable
                style={({ pressed }) => [
                  styles.planCard,
                  styles.proPlanCard,
                  isDesktop && styles.planCardDesktop,
                  selectedTier === 'pro' && styles.proPlanCardSelected,
                  pressed && { opacity: 0.95 },
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
                        <View style={styles.currentBadge}>
                          <Text style={styles.currentBadgeText}>Active</Text>
                        </View>
                      )}
                      {billingPeriod === 'yearly' && (
                        <View style={styles.bestPlanTag}>
                          <Text style={styles.bestPlanTagText}>Best Plan</Text>
                        </View>
                      )}
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                      <Text style={[styles.planPrice, styles.proPlanPrice]}>{proPriceText}</Text>
                      {billingPeriod === 'yearly' && <Text style={styles.strikePrice}>₹2,999</Text>}
                    </View>
                    {billingPeriod === 'yearly' ? (
                      <Text style={styles.proPeriodSub}>✨ Just ₹125/month • Save ₹1,500/year</Text>
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
                    <Text style={[styles.planFeatureText, styles.proFeatureText, { fontWeight: '700' }]}>
                      Unlimited Orders (No monthly limit)
                    </Text>
                  </View>
                  <View style={styles.planFeatureItem}>
                    <Ionicons name="infinite" size={17} color="#CA8A04" />
                    <Text style={[styles.planFeatureText, styles.proFeatureText, { fontWeight: '700' }]}>
                      Unlimited Customers &amp; Products
                    </Text>
                  </View>
                  <View style={styles.planFeatureItem}>
                    <Ionicons name="checkmark-circle" size={17} color="#16A34A" />
                    <Text style={[styles.planFeatureText, styles.proFeatureText]}>
                      All 6+ Premium Templates &amp; Custom Logo
                    </Text>
                  </View>
                  <View style={styles.planFeatureItem}>
                    <Ionicons name="checkmark-circle" size={17} color="#16A34A" />
                    <Text style={[styles.planFeatureText, styles.proFeatureText]}>
                      PDF &amp; Excel Export + GST Tax Reports
                    </Text>
                  </View>
                  <View style={styles.planFeatureItem}>
                    <Ionicons name="checkmark-circle" size={17} color="#16A34A" />
                    <Text style={[styles.planFeatureText, styles.proFeatureText]}>
                      Automated Payment Reminders (WhatsApp/SMS)
                    </Text>
                  </View>
                  <View style={styles.planFeatureItem}>
                    <Ionicons name="checkmark-circle" size={17} color="#16A34A" />
                    <Text style={[styles.planFeatureText, styles.proFeatureText]}>
                      Advanced Profit &amp; Loss Analytics
                    </Text>
                  </View>
                  <View style={styles.planFeatureItem}>
                    <Ionicons name="checkmark-circle" size={17} color="#16A34A" />
                    <Text style={[styles.planFeatureText, styles.proFeatureText]}>
                      24/7 Dedicated VIP Priority Support
                    </Text>
                  </View>
                </View>

                <View style={styles.cardActionArea}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.cardBtn,
                      styles.cardBtnPro,
                      pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] },
                    ]}
                    onPress={() => {
                      setSelectedTier('pro');
                      if (Platform.OS !== 'web') handlePurchase();
                    }}
                  >
                    <Ionicons name="sparkles" size={16} color="#FFFFFF" />
                    <Text style={styles.cardBtnTextPro}>
                      {isPro ? '👑 Pro Active' : `Get Pro Unlimited (${proPriceText})`}
                    </Text>
                  </Pressable>
                </View>
              </Pressable>
            </View>

            {/* ── Detailed Comparison Matrix ── */}
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionHeading}>Plan Comparison</Text>
              <Text style={styles.sectionSub}>Detailed feature breakdown across tiers</Text>
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
                { name: 'Product Catalog Items', free: '20', basic: '20', pro: 'Unlimited', icon: 'pricetags-outline' },
                { name: 'Invoice Templates', free: '1 Default', basic: '1 Default', pro: 'All 6+ Premium', icon: 'document-text-outline' },
                { name: 'Custom Logo & Branding', free: '—', basic: '—', pro: '✓ Yes', icon: 'color-palette-outline' },
                { name: 'PDF & Excel Export', free: '—', basic: '—', pro: '✓ Unlimited', icon: 'download-outline' },
                { name: 'Business P&L Reports', free: 'Basic', basic: 'Basic', pro: 'Advanced', icon: 'bar-chart-outline' },
                { name: 'WhatsApp Invoicing', free: '✓ Yes', basic: '✓ Yes', pro: '✓ Unlimited', icon: 'logo-whatsapp' },
                { name: 'Cloud Multi-Device Sync', free: '✓ Yes', basic: '✓ Yes', pro: '✓ Live Instant', icon: 'cloud-done-outline' },
                { name: 'VIP Priority Support', free: '—', basic: '—', pro: '✓ 24/7 VIP', icon: 'headset-outline' },
              ].map((item, index) => (
                <View key={index} style={[styles.compRow, index % 2 === 1 && styles.compRowAlt]}>
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

            {/* ── Why Go Pro (Value Cards Grid) ── */}
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionHeading}>Why Shop Owners Upgrade to Pro?</Text>
              <Text style={styles.sectionSub}>Everything built to maximize your daily counter profits</Text>
            </View>

            <View style={[styles.benefitsGrid, isDesktop && styles.benefitsGridDesktop]}>
              <View style={[styles.benefitCard, isDesktop && styles.benefitCardDesktop]}>
                <View style={[styles.benefitIconWrap, { backgroundColor: '#FEF3C7' }]}>
                  <Ionicons name="infinite" size={22} color="#D97706" />
                </View>
                <Text style={styles.benefitTitle}>Scale Without Limits</Text>
                <Text style={styles.benefitDesc}>
                  Never hit a ceiling. Add unlimited orders, products, and customer contacts as your sales surge.
                </Text>
              </View>

              <View style={[styles.benefitCard, isDesktop && styles.benefitCardDesktop]}>
                <View style={[styles.benefitIconWrap, { backgroundColor: '#E0F2FE' }]}>
                  <Ionicons name="brush-outline" size={22} color="#0284C7" />
                </View>
                <Text style={styles.benefitTitle}>Professional Invoices</Text>
                <Text style={styles.benefitDesc}>
                  Make your brand stand out with customizable premium invoice designs, shop logos, and instant PDF downloads.
                </Text>
              </View>

              <View style={[styles.benefitCard, isDesktop && styles.benefitCardDesktop]}>
                <View style={[styles.benefitIconWrap, { backgroundColor: '#DCFCE7' }]}>
                  <Ionicons name="trending-up-outline" size={22} color="#16A34A" />
                </View>
                <Text style={styles.benefitTitle}>Deep Profit Insights</Text>
                <Text style={styles.benefitDesc}>
                  Understand margins, track unpaid customer balances (கடன் கணக்கு), and optimize expense categories effortlessly.
                </Text>
              </View>

              <View style={[styles.benefitCard, isDesktop && styles.benefitCardDesktop]}>
                <View style={[styles.benefitIconWrap, { backgroundColor: '#F3E8FF' }]}>
                  <Ionicons name="shield-checkmark-outline" size={22} color="#9333EA" />
                </View>
                <Text style={styles.benefitTitle}>Secure &amp; Tax-Ready</Text>
                <Text style={styles.benefitDesc}>
                  Export tax-compliant Excel &amp; PDF sheets in 1-click for your CA or GST accounting software.
                </Text>
              </View>
            </View>

            {/* ── Merchant Testimonials & Social Proof ── */}
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionHeading}>Loved by Retail Merchants</Text>
              <Text style={styles.sectionSub}>See what shop owners say about KadaiBook</Text>
            </View>

            <View style={[styles.testimonialGrid, isDesktop && styles.testimonialGridDesktop]}>
              <View style={[styles.testimonialCard, isDesktop && styles.testimonialCardDesktop]}>
                <View style={styles.testimonialRating}>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Ionicons key={s} name="star" size={14} color="#F59E0B" />
                  ))}
                </View>
                <Text style={styles.testimonialQuote}>
                  "KadaiBook Pro has completely automated my daily billing and WhatsApp reminders. My credit collections are 2x faster now!"
                </Text>
                <View style={styles.testimonialAuthor}>
                  <Text style={styles.testimonialAuthorName}>S. Murugan</Text>
                  <Text style={styles.testimonialAuthorShop}>Murugan Provision Stores, Madurai</Text>
                </View>
              </View>

              <View style={[styles.testimonialCard, isDesktop && styles.testimonialCardDesktop]}>
                <View style={styles.testimonialRating}>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Ionicons key={s} name="star" size={14} color="#F59E0B" />
                  ))}
                </View>
                <Text style={styles.testimonialQuote}>
                  "The custom logo invoices and thermal printer support look super professional. My customers love the instant WhatsApp bill."
                </Text>
                <View style={styles.testimonialAuthor}>
                  <Text style={styles.testimonialAuthorName}>K. Rajesh</Text>
                  <Text style={styles.testimonialAuthorShop}>Sri Krishna Textiles, Coimbatore</Text>
                </View>
              </View>

              <View style={[styles.testimonialCard, isDesktop && styles.testimonialCardDesktop]}>
                <View style={styles.testimonialRating}>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Ionicons key={s} name="star" size={14} color="#F59E0B" />
                  ))}
                </View>
                <Text style={styles.testimonialQuote}>
                  "Unlimited orders and real-time cloud multi-device sync is a lifesaver for my busy billing counter and warehouse."
                </Text>
                <View style={styles.testimonialAuthor}>
                  <Text style={styles.testimonialAuthorName}>M. Fathima</Text>
                  <Text style={styles.testimonialAuthorShop}>City Supermarket, Chennai</Text>
                </View>
              </View>
            </View>

            {/* ── Interactive FAQ Accordion ── */}
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionHeading}>Frequently Asked Questions</Text>
              <Text style={styles.sectionSub}>Everything you need to know about KadaiBook subscriptions</Text>
            </View>

            <View style={styles.faqList}>
              {[
                {
                  q: 'How do I pay for my subscription?',
                  a: 'Subscriptions are processed securely through Google Play and Apple App Store. You can pay via UPI (GPay, PhonePe, Paytm), Credit/Debit Cards, NetBanking, and Wallet.',
                },
                {
                  q: 'Can I switch from Monthly to Yearly or cancel anytime?',
                  a: 'Yes! There are no lock-in contracts. You can upgrade to Yearly (Save 50%) or cancel your subscription at any time directly through your Google Play or Apple App Store settings.',
                },
                {
                  q: 'What happens to my data if my plan expires?',
                  a: 'Your data is 100% safe and permanently stored. You will never lose any past orders, customer ledger entries, or reports. You will simply be moved to the Free tier limits.',
                },
                {
                  q: 'Does KadaiBook work on both Mobile and Web Desktop?',
                  a: 'Yes! With KadaiBook Cloud Sync, your account seamlessly updates in real-time across your Android phones, iOS devices, tablets, and Web browser (kadaibook.in).',
                },
                {
                  q: 'Can I get a GST tax invoice for my subscription?',
                  a: 'Yes! Google Play and Apple App Store automatically generate tax-compliant invoices with GST breakdown for all subscription purchases.',
                },
              ].map((faq, index) => {
                const isOpen = expandedFaq === index;
                return (
                  <Pressable
                    key={index}
                    style={styles.faqItem}
                    onPress={() => toggleFaq(index)}
                  >
                    <View style={styles.faqHeader}>
                      <Text style={styles.faqQuestion}>{faq.q}</Text>
                      <Ionicons
                        name={isOpen ? 'chevron-up' : 'chevron-down'}
                        size={18}
                        color={colors.inkSoft}
                      />
                    </View>
                    {isOpen && <Text style={styles.faqAnswer}>{faq.a}</Text>}
                  </Pressable>
                );
              })}
            </View>

            {/* ── Web vs Mobile Purchase CTA ── */}
            {Platform.OS === 'web' ? (
              <View style={styles.webCtaCard}>
                <View style={styles.webCtaIconWrap}>
                  <Ionicons name="phone-portrait" size={32} color={colors.clayDeep} />
                </View>
                <Text style={styles.webCtaTitle}>Upgrade on KadaiBook Mobile App</Text>
                <Text style={styles.webCtaDesc}>
                  Subscriptions are managed securely via Google Play and Apple App Store.
                  Install the mobile app to upgrade to Pro and access all features seamlessly across your web dashboard!
                </Text>

                <View style={styles.storeButtonsRow}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.storeBadge,
                      styles.storeBadgeGoogle,
                      pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
                    ]}
                    onPress={() => Linking.openURL(PLAY_STORE_URL)}
                  >
                    <Ionicons name="logo-google-playstore" size={20} color="#FFFFFF" />
                    <View>
                      <Text style={styles.storeBadgeSub}>GET IT ON</Text>
                      <Text style={styles.storeBadgeMain}>Google Play</Text>
                    </View>
                  </Pressable>

                  <Pressable
                    style={({ pressed }) => [
                      styles.storeBadge,
                      styles.storeBadgeApple,
                      pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
                    ]}
                    onPress={() => Linking.openURL(APP_STORE_URL)}
                  >
                    <Ionicons name="logo-apple" size={22} color="#FFFFFF" />
                    <View>
                      <Text style={styles.storeBadgeSub}>Download on</Text>
                      <Text style={styles.storeBadgeMain}>App Store</Text>
                    </View>
                  </Pressable>
                </View>
              </View>
            ) : (
              <View style={styles.actionContainer}>
                {selectedTier === 'free' ? (
                  <View style={styles.freeActiveNotice}>
                    <Text style={styles.freeActiveNoticeText}>
                      You are viewing the Free plan. Select Basic or Pro above to upgrade!
                    </Text>
                  </View>
                ) : (
                  <Pressable
                    style={({ pressed }) => [
                      styles.upgradeButton,
                      selectedTier === 'pro' && styles.upgradeButtonPro,
                      purchasing && { opacity: 0.7 },
                      pressed && { transform: [{ scale: 0.98 }] },
                    ]}
                    onPress={() => handlePurchase()}
                    disabled={purchasing}
                  >
                    {purchasing ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <>
                        <Ionicons
                          name={selectedTier === 'pro' ? 'sparkles' : 'arrow-up-circle'}
                          size={20}
                          color="#FFFFFF"
                        />
                        <Text style={styles.upgradeButtonText}>
                          {selectedTier === 'pro'
                            ? `Upgrade to Pro • ${proPriceText}`
                            : `Upgrade to Basic • ${basicPriceText}`}
                        </Text>
                      </>
                    )}
                  </Pressable>
                )}

                {/* Restore purchases */}
                <Pressable
                  style={styles.restoreBtn}
                  onPress={handleRestore}
                  disabled={purchasing}
                >
                  <Text style={styles.restoreBtnText}>Restore Previous Purchases</Text>
                </Pressable>
              </View>
            )}

            {/* Trust Badges */}
            <View style={styles.trustBadges}>
              <View style={styles.trustItem}>
                <Ionicons name="shield-checkmark" size={15} color="#16A34A" />
                <Text style={styles.trustText}>256-Bit SSL Checkout</Text>
              </View>
              <View style={styles.trustDot} />
              <View style={styles.trustItem}>
                <Ionicons name="flash" size={15} color="#D97706" />
                <Text style={styles.trustText}>Instant Activation</Text>
              </View>
              <View style={styles.trustDot} />
              <View style={styles.trustItem}>
                <Ionicons name="refresh" size={15} color="#4F7C90" />
                <Text style={styles.trustText}>Cancel Anytime</Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </DesktopLayout>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  topHeader: {
    width: '100%',
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    backgroundColor: colors.paperCard,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  topHeaderInner: {
    width: '100%',
    maxWidth: 1080,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
  },
  topHeaderTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 18,
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
  statusPillPro: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
  },
  statusPillBasic: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  statusPillFree: {
    backgroundColor: '#F3F4F6',
    borderColor: '#E5E7EB',
  },
  statusPillText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
  },
  statusPillTextPro: {
    color: '#92400E',
  },
  statusPillTextBasic: {
    color: '#1E40AF',
  },
  statusPillTextFree: {
    color: '#4B5563',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 24,
    paddingBottom: 56,
    alignItems: 'center',
  },
  innerContainer: {
    width: '100%',
    maxWidth: 1080,
    alignSelf: 'center',
  },

  /* ── Hero Banner ── */
  heroCard: {
    backgroundColor: '#24201B',
    borderRadius: 22,
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginBottom: 28,
    shadowColor: '#CA8A04',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 5,
    position: 'relative',
    overflow: 'hidden',
  },
  heroGlow: {
    position: 'absolute',
    top: -60,
    width: 320,
    height: 120,
    backgroundColor: 'rgba(217, 119, 6, 0.15)',
    borderRadius: 160,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(254, 240, 138, 0.15)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(253, 224, 71, 0.3)',
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
    textAlign: 'center',
    marginBottom: 10,
    lineHeight: 34,
  },
  heroTitleHighlight: {
    color: '#FACC15',
  },
  heroSubtitle: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: '#D1C7B7',
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 580,
    marginBottom: 20,
  },
  heroStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  heroStatItem: {
    alignItems: 'center',
  },
  heroStatNum: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: '#FEF08A',
  },
  heroStatLabel: {
    fontFamily: fonts.body,
    fontSize: 10.5,
    color: '#A8A29E',
  },
  heroStatDivider: {
    width: 1,
    height: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },

  /* ── Billing Toggle ── */
  billingToggleWrapper: {
    alignItems: 'center',
    marginBottom: 20,
  },
  billingToggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#EFEBE1',
    borderRadius: radius.pill,
    padding: 5,
    borderWidth: 1,
    borderColor: colors.line,
  },
  billingToggleBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: radius.pill,
  },
  billingToggleBtnActive: {
    backgroundColor: colors.paperCard,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  billingToggleBtnActiveYearly: {
    backgroundColor: '#FEF08A',
    shadowColor: '#CA8A04',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
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
    gap: 8,
  },
  discountPill: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  discountPillText: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    color: '#FFFFFF',
  },

  /* ── Best Value Banner ── */
  bestValueBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEFCE8',
    borderWidth: 1.5,
    borderColor: '#FDE047',
    borderRadius: radius.md,
    padding: 14,
    marginBottom: 24,
    gap: 12,
  },
  bestValueBannerIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FEF08A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bestValueBannerTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 13.5,
    color: '#854D0E',
    marginBottom: 2,
  },
  bestValueBannerSub: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: '#A16207',
    lineHeight: 16,
  },

  /* ── Section Titles ── */
  sectionHeaderRow: {
    marginBottom: 16,
    marginTop: 8,
  },
  sectionHeading: {
    fontFamily: fonts.bodyBold,
    fontSize: 18,
    color: colors.ink,
    marginBottom: 3,
  },
  sectionSub: {
    fontFamily: fonts.body,
    fontSize: 12.5,
    color: colors.inkSoft,
  },

  /* ── Plan Cards Container ── */
  plansContainer: {
    gap: 16,
    marginBottom: 32,
  },
  plansContainerDesktop: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  planCard: {
    flex: 1,
    backgroundColor: colors.paperCard,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: colors.line,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    justifyContent: 'space-between',
  },
  planCardDesktop: {
    minHeight: 460,
  },
  planCardSelected: {
    borderColor: colors.clayDeep,
    backgroundColor: '#FFFDF9',
  },
  proPlanCard: {
    borderColor: '#FACC15',
    backgroundColor: '#FFFEF5',
    borderWidth: 2,
    shadowColor: '#CA8A04',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 14,
    elevation: 4,
    position: 'relative',
  },
  proPlanCardSelected: {
    borderColor: '#D97706',
    backgroundColor: '#FFFDEB',
  },
  proRibbon: {
    position: 'absolute',
    top: -1,
    left: -1,
    right: -1,
    backgroundColor: '#CA8A04',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  proRibbonText: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  planCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginTop: 10,
  },
  planTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  planName: {
    fontFamily: fonts.bodyBold,
    fontSize: 18,
    color: colors.ink,
  },
  proPlanName: {
    color: '#854D0E',
  },
  currentBadge: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  currentBadgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    color: '#0369A1',
  },
  bestPlanTag: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  bestPlanTagText: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    color: '#15803D',
  },
  planPrice: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.ink,
    marginTop: 2,
  },
  proPlanPrice: {
    color: '#713F12',
  },
  strikePrice: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.inkSoft,
    textDecorationLine: 'line-through',
  },
  planPeriod: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.inkSoft,
  },
  planPeriodSub: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11.5,
    color: '#15803D',
    marginTop: 2,
  },
  proPeriodSub: {
    fontFamily: fonts.bodyBold,
    fontSize: 11.5,
    color: '#B45309',
    marginTop: 2,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterSelected: {
    borderColor: colors.clayDeep,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.clayDeep,
  },
  proRadioOuter: {
    borderColor: '#FDE047',
  },
  proRadioOuterSelected: {
    borderColor: '#CA8A04',
  },
  proRadioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#CA8A04',
  },
  planDivider: {
    height: 1,
    backgroundColor: colors.line,
    marginVertical: 14,
  },
  proPlanDivider: {
    backgroundColor: '#FEF08A',
  },
  planFeatureList: {
    gap: 10,
    marginBottom: 18,
  },
  planFeatureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  planFeatureText: {
    fontFamily: fonts.body,
    fontSize: 12.5,
    color: colors.ink,
    flex: 1,
  },
  proFeatureText: {
    color: '#451A03',
  },
  planFeatureTextDisabled: {
    color: '#9CA3AF',
    textDecorationLine: 'line-through',
  },
  cardActionArea: {
    marginTop: 'auto',
    paddingTop: 8,
  },
  cardBtn: {
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  cardBtnFree: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cardBtnTextFree: {
    fontFamily: fonts.bodyBold,
    fontSize: 12.5,
    color: '#6B7280',
  },
  cardBtnBasic: {
    backgroundColor: colors.paper,
    borderWidth: 1.5,
    borderColor: colors.clayDeep,
  },
  cardBtnTextBasic: {
    fontFamily: fonts.bodyBold,
    fontSize: 12.5,
    color: colors.clayDeep,
  },
  cardBtnPro: {
    backgroundColor: '#CA8A04',
    shadowColor: '#CA8A04',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  cardBtnTextPro: {
    fontFamily: fonts.bodyBold,
    fontSize: 12.5,
    color: '#FFFFFF',
  },

  /* ── Comparison Table ── */
  comparisonTable: {
    backgroundColor: colors.paperCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
    marginBottom: 32,
  },
  compHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#EFEBE1',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  compHeaderCol: {
    flex: 1,
    fontFamily: fonts.bodyBold,
    fontSize: 12.5,
    color: colors.ink,
  },
  compColCenter: {
    textAlign: 'center',
    justifyContent: 'center',
    alignItems: 'center',
  },
  compProHeaderCol: {
    backgroundColor: '#FEF08A',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  compProHeaderText: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: '#854D0E',
    textAlign: 'center',
  },
  compRow: {
    flexDirection: 'row',
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    alignItems: 'center',
  },
  compRowAlt: {
    backgroundColor: '#FAF7F0',
  },
  compCell: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 12,
  },
  compCellFeature: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.ink,
  },
  compMuted: {
    color: colors.inkSoft,
  },
  compBasic: {
    color: colors.ink,
    fontFamily: fonts.bodyMedium,
  },
  compProCol: {
    backgroundColor: 'rgba(254, 240, 138, 0.25)',
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  compProText: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: '#854D0E',
    textAlign: 'center',
  },

  /* ── Benefit Cards Grid ── */
  benefitsGrid: {
    gap: 14,
    marginBottom: 32,
  },
  benefitsGridDesktop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  benefitCard: {
    backgroundColor: colors.paperCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 16,
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
    marginBottom: 10,
  },
  benefitTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 14.5,
    color: colors.ink,
    marginBottom: 4,
  },
  benefitDesc: {
    fontFamily: fonts.body,
    fontSize: 12.5,
    color: colors.inkSoft,
    lineHeight: 18,
  },

  /* ── Merchant Testimonials ── */
  testimonialGrid: {
    gap: 14,
    marginBottom: 32,
  },
  testimonialGridDesktop: {
    flexDirection: 'row',
  },
  testimonialCard: {
    flex: 1,
    backgroundColor: colors.paperCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 18,
  },
  testimonialCardDesktop: {
    minHeight: 180,
  },
  testimonialRating: {
    flexDirection: 'row',
    gap: 2,
    marginBottom: 8,
  },
  testimonialQuote: {
    fontFamily: fonts.body,
    fontSize: 12.5,
    color: colors.ink,
    lineHeight: 18,
    fontStyle: 'italic',
    marginBottom: 12,
  },
  testimonialAuthor: {
    marginTop: 'auto',
  },
  testimonialAuthorName: {
    fontFamily: fonts.bodyBold,
    fontSize: 12.5,
    color: colors.clayDeep,
  },
  testimonialAuthorShop: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.inkSoft,
  },

  /* ── FAQ Accordion ── */
  faqList: {
    gap: 10,
    marginBottom: 32,
  },
  faqItem: {
    backgroundColor: colors.paperCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 14,
  },
  faqHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  faqQuestion: {
    fontFamily: fonts.bodyBold,
    fontSize: 13.5,
    color: colors.ink,
    flex: 1,
  },
  faqAnswer: {
    fontFamily: fonts.body,
    fontSize: 12.5,
    color: colors.inkSoft,
    lineHeight: 18,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },

  /* ── Web CTA Card ── */
  webCtaCard: {
    backgroundColor: '#FFFBEB',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#FDE047',
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
  },
  webCtaIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FEF08A',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  webCtaTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 17,
    color: '#713F12',
    marginBottom: 6,
    textAlign: 'center',
  },
  webCtaDesc: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: '#854D0E',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 520,
    marginBottom: 18,
  },
  storeButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  storeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  storeBadgeGoogle: {
    backgroundColor: '#1E293B',
  },
  storeBadgeApple: {
    backgroundColor: '#0F172A',
  },
  storeBadgeSub: {
    fontFamily: fonts.body,
    fontSize: 9,
    color: '#CBD5E1',
    letterSpacing: 0.5,
  },
  storeBadgeMain: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: '#FFFFFF',
  },

  /* ── Action / Upgrade Mobile Container ── */
  actionContainer: {
    width: '100%',
    marginBottom: 16,
  },
  freeActiveNotice: {
    backgroundColor: '#F3F4F6',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  freeActiveNoticeText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.inkSoft,
    textAlign: 'center',
  },
  upgradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.clayDeep,
    paddingVertical: 15,
    borderRadius: 14,
    shadowColor: colors.clayDeep,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  upgradeButtonPro: {
    backgroundColor: '#CA8A04',
    shadowColor: '#CA8A04',
  },
  upgradeButtonText: {
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    color: '#FFFFFF',
  },
  restoreBtn: {
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  restoreBtnText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.inkSoft,
    textDecorationLine: 'underline',
  },

  /* ── Trust Badges ── */
  trustBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    flexWrap: 'wrap',
    marginTop: 8,
  },
  trustItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  trustText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.inkSoft,
  },
  trustDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.inkSoft,
    opacity: 0.5,
  },
});
