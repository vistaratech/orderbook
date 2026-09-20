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

  const faqs = [
    {
      q: 'Can I use KadaiBook on multiple phones or computers at the same time?',
      a: 'Yes! When you log in with your KadaiBook account on your other phones, tablets, or desktop web browser, all orders, products, customers, and payments sync in real-time instantly.',
    },
    {
      q: 'What happens to my orders & customer credit records if my subscription ends?',
      a: 'Your data is 100% safe and permanent. You will never lose any past orders, customer ledger entries, or invoices. You can view all existing records anytime on the Free tier.',
    },
    {
      q: 'How does WhatsApp Bill & Automated Payment Reminders work?',
      a: 'With KadaiBook Pro, you can send professional itemized invoices with your store logo and UPI QR code directly to your customer’s WhatsApp in 1 tap, and automated reminder alerts for pending balances.',
    },
    {
      q: 'Can I connect Bluetooth Thermal Printers?',
      a: 'Yes! KadaiBook supports all 2-inch and 3-inch standard ESC/POS Bluetooth thermal printers for fast receipt printing at your billing counter.',
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
              <Text style={styles.topHeaderTitle}>Subscription Plans</Text>
              <Text style={styles.topHeaderSub}>Choose the right plan for your shop</Text>
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
                color={isPro ? '#854D0E' : isBasic ? '#0369A1' : '#15803D'}
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
                {isPro ? 'Pro Active' : isBasic ? 'Basic Active' : 'Free Plan (30 Limit)'}
              </Text>
            </View>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.innerContainer}>
            {/* ── Hero Luxury Card ── */}
            <View style={styles.heroCard}>
              <View style={styles.heroGlow} />
              <View style={styles.heroBadge}>
                <Ionicons name="sparkles" size={13} color="#FDE047" />
                <Text style={styles.heroBadgeText}>KADAIBOOK PRO • RETAILERS' #1 CHOICE</Text>
              </View>
              <Text style={styles.heroTitle}>
                Scale Your Business{'\n'}With KadaiBook Pro
              </Text>
              <Text style={styles.heroTamilSubtitle}>
                கடை வியாபாரத்தை 10 மடங்கு எளிதாகவும் வேகமாகவும் மாற்றுங்கள்
              </Text>
              <Text style={styles.heroSubtitle}>
                Manage unlimited billing, automated WhatsApp credit reminders, Bluetooth thermal receipts, and real-time cloud multi-device sync.
              </Text>

              {/* 4 Trust Micro-Pills */}
              <View style={styles.heroTrustGrid}>
                <View style={styles.heroTrustPill}>
                  <Ionicons name="star" size={13} color="#FBBF24" />
                  <Text style={styles.heroTrustText}>4.9/5 Rating (10,000+ Stores)</Text>
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

            {/* ── Billing Cycle Toggle Switch ── */}
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
                      Yearly Plan
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
                  <Ionicons name="gift" size={20} color="#CA8A04" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.bestValueBannerTitle}>
                    🔥 Pro Yearly Offer: ₹1,499/year (Save ₹1,500/year!)
                  </Text>
                  <Text style={styles.bestValueBannerSub}>
                    Equivalent to just ₹125/month (₹4.1/day)! Get 100% UNLIMITED access to all orders, customers, and premium features.
                  </Text>
                </View>
              </View>
            )}

            {/* ── Interactive Plan Cards ── */}
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionHeading}>Select Your Plan</Text>
              <Text style={styles.sectionSub}>Pick the right fit for your retail shop</Text>
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
                    <Text style={styles.planSubDesc}>Basic trial for single counter</Text>
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
                      <Text style={styles.planSubDesc}>Flexible monthly starter billing</Text>
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

              {/* 3. PRO UNLIMITED TIER CARD (HIGHLIGHTED STAR) */}
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

            {/* ── Why Go Pro (Value Cards Grid) ── */}
            <Text style={styles.sectionHeading}>Why Shop Owners Choose Pro</Text>
            <View style={[styles.benefitsGrid, isDesktop && styles.benefitsGridDesktop]}>
              <View style={[styles.benefitCard, isDesktop && styles.benefitCardDesktop]}>
                <View style={[styles.benefitIconWrap, { backgroundColor: '#FEF3C7' }]}>
                  <Ionicons name="infinite" size={22} color="#D97706" />
                </View>
                <Text style={styles.benefitTitle}>Scale Without Limits</Text>
                <Text style={styles.benefitDesc}>
                  Never hit a barrier during festive rushes. Add unlimited orders, products, and customer contacts as your sales surge.
                </Text>
              </View>

              <View style={[styles.benefitCard, isDesktop && styles.benefitCardDesktop]}>
                <View style={[styles.benefitIconWrap, { backgroundColor: '#E0F2FE' }]}>
                  <Ionicons name="logo-whatsapp" size={22} color="#0284C7" />
                </View>
                <Text style={styles.benefitTitle}>Recover Unpaid Dues Fast</Text>
                <Text style={styles.benefitDesc}>
                  Automated WhatsApp payment reminders help store owners collect 80% faster without uncomfortable phone calls.
                </Text>
              </View>

              <View style={[styles.benefitCard, isDesktop && styles.benefitCardDesktop]}>
                <View style={[styles.benefitIconWrap, { backgroundColor: '#DCFCE7' }]}>
                  <Ionicons name="trending-up-outline" size={22} color="#16A34A" />
                </View>
                <Text style={styles.benefitTitle}>Deep Profit Insights</Text>
                <Text style={styles.benefitDesc}>
                  Understand your exact daily profits, high-margin items, and export clean GST-ready Excel reports for your CA.
                </Text>
              </View>

              <View style={[styles.benefitCard, isDesktop && styles.benefitCardDesktop]}>
                <View style={[styles.benefitIconWrap, { backgroundColor: '#F3E8FF' }]}>
                  <Ionicons name="phone-portrait-outline" size={22} color="#9333EA" />
                </View>
                <Text style={styles.benefitTitle}>Multi-Device Sync</Text>
                <Text style={styles.benefitDesc}>
                  Give your staff phones for billing while you monitor total store sales, cash counter, and inventory from home.
                </Text>
              </View>
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
                  "The multi-phone live sync lets my billing staff create invoices on counter tablet while I can see total sales on my mobile anywhere."
                </Text>
                <View style={styles.testimonialAuthorRow}>
                  <View style={styles.testimonialAvatar}>
                    <Text style={styles.testimonialAvatarText}>A</Text>
                  </View>
                  <View>
                    <Text style={styles.testimonialAuthorName}>A. Farooq</Text>
                    <Text style={styles.testimonialAuthorShop}>Star Textiles & Ready-mades, Chennai</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* ── FAQ Section ── */}
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionHeading}>Frequently Asked Questions</Text>
              <Text style={styles.sectionSub}>Got questions? We're here to help.</Text>
            </View>

            <View style={styles.faqContainer}>
              {faqs.map((faq, index) => {
                const isOpen = expandedFaq === index;
                return (
                  <Pressable
                    key={index}
                    style={styles.faqCard}
                    onPress={() => setExpandedFaq(isOpen ? null : index)}
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
                  In-app purchases are securely handled through Google Play & Apple App Store.
                  Upgrade on your Android or iPhone, and your Pro features will immediately unlock here on the Web Dashboard too!
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
                      You are viewing the Free plan (30 orders & customers limit). Select Basic or Pro above to upgrade!
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
                            ? `Upgrade to Pro Unlimited • ${proPriceText}`
                            : `Upgrade to Basic • ${basicPriceText}`}
                        </Text>
                      </>
                    )}
                  </Pressable>
                )}

                {/* Trust Badges */}
                <View style={styles.trustBadges}>
                  <View style={styles.trustItem}>
                    <Ionicons name="shield-checkmark" size={14} color="#16A34A" />
                    <Text style={styles.trustText}>100% Secure Checkout</Text>
                  </View>
                  <View style={styles.trustDot} />
                  <View style={styles.trustItem}>
                    <Ionicons name="flash" size={14} color="#D97706" />
                    <Text style={styles.trustText}>Instant Activation</Text>
                  </View>
                  <View style={styles.trustDot} />
                  <View style={styles.trustItem}>
                    <Ionicons name="refresh" size={14} color="#4F7C90" />
                    <Text style={styles.trustText}>Cancel Anytime</Text>
                  </View>
                </View>

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
    maxWidth: 960,
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
    backgroundColor: '#E0F2FE',
    borderColor: '#BAE6FD',
  },
  statusPillFree: {
    backgroundColor: '#DCFCE7',
    borderColor: '#BBF7D0',
  },
  statusPillText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
  },
  statusPillTextPro: {
    color: '#92400E',
  },
  statusPillTextBasic: {
    color: '#0369A1',
  },
  statusPillTextFree: {
    color: '#15803D',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 24,
    paddingBottom: 48,
    alignItems: 'center',
  },
  innerContainer: {
    width: '100%',
    maxWidth: 960,
    alignSelf: 'center',
  },

  /* ── Hero Luxury Card ── */
  heroCard: {
    backgroundColor: '#1C1917',
    borderRadius: 24,
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginBottom: 24,
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#CA8A04',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 5,
    borderWidth: 1,
    borderColor: 'rgba(202, 138, 4, 0.25)',
  },
  heroGlow: {
    position: 'absolute',
    top: -60,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(217, 119, 6, 0.18)',
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(254, 240, 138, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(253, 230, 138, 0.35)',
    marginBottom: 12,
  },
  heroBadgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 10.5,
    color: '#FDE047',
    letterSpacing: 0.8,
  },
  heroTitle: {
    fontFamily: fonts.display,
    fontSize: 26,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 6,
    lineHeight: 34,
  },
  heroTamilSubtitle: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13.5,
    color: '#FCD34D',
    textAlign: 'center',
    marginBottom: 8,
  },
  heroSubtitle: {
    fontFamily: fonts.body,
    fontSize: 13.5,
    color: '#D6D3D1',
    textAlign: 'center',
    lineHeight: 21,
    maxWidth: 500,
    marginBottom: 20,
  },
  heroTrustGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  heroTrustPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  heroTrustText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    color: '#F5F5F4',
  },

  /* ── Billing Toggle ── */
  billingToggleWrapper: {
    alignItems: 'center',
    marginBottom: 20,
  },
  billingToggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#F3EFE6',
    borderRadius: radius.pill,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.line,
  },
  billingToggleBtn: {
    paddingVertical: 10,
    paddingHorizontal: 18,
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
    gap: 6,
  },
  discountPill: {
    backgroundColor: '#16A34A',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  discountPillText: {
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },

  /* ── Best Value Callout Banner ── */
  bestValueBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FEFCE8',
    borderWidth: 1.5,
    borderColor: '#FDE047',
    borderRadius: radius.md,
    padding: 14,
    marginBottom: 24,
    shadowColor: '#CA8A04',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  bestValueBannerIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
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
    lineHeight: 17,
  },

  sectionHeading: {
    fontFamily: fonts.bodyBold,
    fontSize: 18,
    color: colors.ink,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: 16,
    marginBottom: 14,
  },
  sectionSub: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.inkSoft,
  },

  /* ── Plan Cards ── */
  plansContainer: {
    flexDirection: 'column',
    gap: 16,
    marginBottom: 28,
  },
  plansContainerDesktop: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  planCard: {
    backgroundColor: colors.paperCard,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.line,
    padding: 22,
    position: 'relative',
    shadowColor: '#2E2A24',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  planCardDesktop: {
    flex: 1,
  },
  planCardSelected: {
    borderColor: colors.clayDeep,
    backgroundColor: '#FFFDF9',
  },
  proPlanCard: {
    borderColor: '#EAB308',
    backgroundColor: '#FFFDF5',
    paddingTop: 28,
  },
  proPlanCardSelected: {
    borderColor: '#CA8A04',
    borderWidth: 2,
    backgroundColor: '#FEFCE8',
    shadowColor: '#CA8A04',
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  proRibbon: {
    position: 'absolute',
    top: -1,
    left: -1,
    right: -1,
    backgroundColor: '#CA8A04',
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 5,
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
  },
  planTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  planName: {
    fontFamily: fonts.bodyBold,
    fontSize: 19,
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
    color: '#0284C7',
  },
  starterBadge: {
    backgroundColor: '#F3E8FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  starterBadgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    color: '#7E22CE',
  },
  bestPlanTag: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  bestPlanTagText: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    color: '#15803D',
  },
  activeProBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FEF08A',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: '#FDE047',
  },
  activeProBadgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    color: '#854D0E',
  },
  planPrice: {
    fontFamily: fonts.bodyBold,
    fontSize: 20,
    color: colors.ink,
  },
  strikePrice: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.inkSoft,
    textDecorationLine: 'line-through',
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
    color: '#A16207',
    marginTop: 2,
  },
  planSubDesc: {
    fontFamily: fonts.body,
    fontSize: 11.5,
    color: colors.inkSoft,
    marginTop: 2,
  },
  proPlanPrice: {
    color: '#92400E',
  },
  planPeriod: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.inkSoft,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.line,
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
    borderColor: '#FDE68A',
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
    backgroundColor: colors.line,
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
    alignItems: 'center',
    gap: 8,
  },
  planFeatureText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.ink,
    flexShrink: 1,
    lineHeight: 18,
  },
  proFeatureText: {
    fontFamily: fonts.bodyMedium,
    color: '#713F12',
  },

  /* ── Comparison Table ── */
  comparisonTable: {
    backgroundColor: colors.paperCard,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
    marginBottom: 28,
  },
  compHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#F3EFE6',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    alignItems: 'center',
  },
  compHeaderCol: {
    flex: 1,
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: colors.inkSoft,
    textTransform: 'uppercase',
  },
  compColCenter: {
    textAlign: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
  compProHeaderCol: {
    backgroundColor: '#FEF3C7',
    paddingVertical: 6,
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
    paddingVertical: 13,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  compRowAlt: {
    backgroundColor: '#FAF7F0',
  },
  compCell: {
    flex: 1,
  },
  compCellFeature: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.ink,
    flexShrink: 1,
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
    backgroundColor: '#FEFCE8',
    paddingVertical: 4,
    borderRadius: 4,
  },
  compProText: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: '#854D0E',
    textAlign: 'center',
  },

  /* ── Value Benefits Grid ── */
  benefitsGrid: {
    flexDirection: 'column',
    gap: 16,
    marginBottom: 28,
  },
  benefitsGridDesktop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  benefitCard: {
    backgroundColor: colors.paperCard,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 20,
    width: '100%',
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
    fontSize: 15,
    color: colors.ink,
    marginBottom: 4,
  },
  benefitDesc: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.inkSoft,
    lineHeight: 19,
  },

  /* ── Testimonials Grid ── */
  testimonialsGrid: {
    flexDirection: 'column',
    gap: 14,
    marginBottom: 28,
  },
  testimonialsGridDesktop: {
    flexDirection: 'row',
  },
  testimonialCard: {
    backgroundColor: colors.paperCard,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 18,
    width: '100%',
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
    width: 34,
    height: 34,
    borderRadius: 17,
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

  /* ── FAQ Section ── */
  faqContainer: {
    gap: 10,
    marginBottom: 28,
  },
  faqCard: {
    backgroundColor: colors.paperCard,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 16,
  },
  faqHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  faqQuestion: {
    fontFamily: fonts.bodyBold,
    fontSize: 13.5,
    color: colors.ink,
    flex: 1,
  },
  faqAnswer: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.inkSoft,
    lineHeight: 20,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },

  /* ── Action / Upgrade Container ── */
  actionContainer: {
    marginTop: 8,
    alignItems: 'center',
  },
  freeActiveNotice: {
    backgroundColor: '#F3EFE6',
    padding: 16,
    borderRadius: radius.md,
    width: '100%',
    alignItems: 'center',
  },
  freeActiveNoticeText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.inkSoft,
    textAlign: 'center',
  },
  upgradeButton: {
    backgroundColor: colors.clayDeep,
    width: '100%',
    maxWidth: 480,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: radius.pill,
    shadowColor: colors.clayDeep,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  upgradeButtonPro: {
    backgroundColor: '#CA8A04',
    shadowColor: '#CA8A04',
  },
  upgradeButtonText: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    color: '#FFFFFF',
  },
  trustBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    marginBottom: 10,
  },
  trustItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  trustDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.line,
  },
  trustText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.inkSoft,
  },
  restoreBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginTop: 4,
  },
  restoreBtnText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.clayDeep,
    textDecorationLine: 'underline',
  },

  /* ── Web CTA Card ── */
  webCtaCard: {
    backgroundColor: colors.paperCard,
    borderRadius: 24,
    padding: 32,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  webCtaIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: '#F5EBE1',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  webCtaTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 21,
    color: colors.ink,
    textAlign: 'center',
    marginBottom: 8,
  },
  webCtaDesc: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.inkSoft,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 520,
    marginBottom: 24,
  },
  storeButtonsRow: {
    flexDirection: 'row',
    gap: 14,
    flexWrap: 'wrap',
    justifyContent: 'center',
    width: '100%',
  },
  storeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 14,
    minWidth: 175,
  },
  storeBadgeGoogle: {
    backgroundColor: '#1A73E8',
  },
  storeBadgeApple: {
    backgroundColor: '#000000',
  },
  storeBadgeSub: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: 'rgba(255,255,255,0.8)',
    textTransform: 'uppercase',
  },
  storeBadgeMain: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    color: '#FFFFFF',
  },
});
