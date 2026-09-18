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
        'In-app purchases are available on our Android and iOS apps. Please download the app from Google Play or App Store to upgrade.'
      );
      return;
    }

    let targetPkg = pkgToBuy;
    if (!targetPkg && packages.length > 0) {
      if (selectedTier === 'basic') {
        targetPkg = packages.find((p) =>
          p.identifier.toLowerCase().includes('basic') ||
          p.product.identifier.toLowerCase().includes('basic')
        ) || packages[0];
      } else {
        targetPkg = packages.find((p) =>
          p.identifier.toLowerCase().includes('pro') ||
          p.product.identifier.toLowerCase().includes('pro')
        ) || packages[0];
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

  const basicPkg = packages.find((p) =>
    p.identifier.toLowerCase().includes('basic') ||
    p.product.identifier.toLowerCase().includes('basic')
  );
  const proPkg = packages.find((p) =>
    p.identifier.toLowerCase().includes('pro') ||
    p.product.identifier.toLowerCase().includes('pro')
  ) || packages[0];

  const basicPriceText = basicPkg ? basicPkg.product.priceString : '₹99 / mo';
  const proPriceText = proPkg ? proPkg.product.priceString : '₹249 / mo';

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      {/* ── Top Header ── */}
      <View style={styles.topHeader}>
        <View style={styles.topHeaderInner}>
          <GlassBackButton label="Back" />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.topHeaderTitle}>Subscription Plans</Text>
            <Text style={styles.topHeaderSub}>Choose the right plan for your shop</Text>
          </View>
          <View style={styles.statusPill}>
            <Text style={styles.statusPillText}>
              {isPro ? 'Pro Active' : isBasic ? 'Basic Active' : 'Free Plan'}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.innerContainer}>
          {/* ── Hero Banner ── */}
          <View style={styles.heroCard}>
            <View style={styles.heroBadge}>
              <Ionicons name="sparkles" size={14} color="#D97706" />
              <Text style={styles.heroBadgeText}>ELEVATE YOUR BUSINESS</Text>
            </View>
            <Text style={styles.heroTitle}>
              Unlock the Full Power{'\n'}of KadaiBook
            </Text>
            <Text style={styles.heroSubtitle}>
              Grow without limits. Manage orders, customize invoices, and gain deep business insights.
            </Text>
          </View>

          {/* ── Interactive Plan Cards (Side-by-side on Desktop, Stacked on Mobile) ── */}
          <Text style={styles.sectionHeading}>Select a Plan</Text>

          <View style={[styles.plansContainer, isDesktop && styles.plansContainerDesktop]}>
            {/* FREE TIER CARD */}
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
                        <Text style={styles.currentBadgeText}>Current</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.planPrice}>
                    ₹0 <Text style={styles.planPeriod}>/ forever</Text>
                  </Text>
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
                  <Text style={styles.planFeatureText}>10 Orders / month</Text>
                </View>
                <View style={styles.planFeatureItem}>
                  <Ionicons name="checkmark-circle" size={16} color="#16A34A" />
                  <Text style={styles.planFeatureText}>10 Customers limit</Text>
                </View>
                <View style={styles.planFeatureItem}>
                  <Ionicons name="checkmark-circle" size={16} color="#16A34A" />
                  <Text style={styles.planFeatureText}>1 Standard Template</Text>
                </View>
                <View style={styles.planFeatureItem}>
                  <Ionicons name="checkmark-circle" size={16} color="#16A34A" />
                  <Text style={styles.planFeatureText}>Cloud Sync & Backup</Text>
                </View>
              </View>
            </Pressable>

            {/* BASIC TIER CARD */}
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
                        <Text style={styles.currentBadgeText}>Current</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.planPrice}>{basicPriceText}</Text>
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
                  <Text style={styles.planFeatureText}>Standard Invoicing</Text>
                </View>
                <View style={styles.planFeatureItem}>
                  <Ionicons name="checkmark-circle" size={16} color="#16A34A" />
                  <Text style={styles.planFeatureText}>Cloud Sync & Backup</Text>
                </View>
              </View>
            </Pressable>

            {/* PRO TIER CARD (HIGHLIGHTED) */}
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
                <Ionicons name="star" size={12} color="#FFFFFF" />
                <Text style={styles.proRibbonText}>MOST POPULAR • UNLIMITED</Text>
              </View>
              <View style={styles.planCardHeader}>
                <View>
                  <View style={styles.planTitleRow}>
                    <Text style={[styles.planName, styles.proPlanName]}>Pro</Text>
                    {isPro && (
                      <View style={styles.currentBadge}>
                        <Text style={styles.currentBadgeText}>Active</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.planPrice, styles.proPlanPrice]}>{proPriceText}</Text>
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
                  <Ionicons name="infinite" size={16} color="#CA8A04" />
                  <Text style={[styles.planFeatureText, styles.proFeatureText]}>
                    Unlimited Orders & Customers
                  </Text>
                </View>
                <View style={styles.planFeatureItem}>
                  <Ionicons name="checkmark-circle" size={16} color="#16A34A" />
                  <Text style={[styles.planFeatureText, styles.proFeatureText]}>
                    All 6+ Premium Templates & Logo
                  </Text>
                </View>
                <View style={styles.planFeatureItem}>
                  <Ionicons name="checkmark-circle" size={16} color="#16A34A" />
                  <Text style={[styles.planFeatureText, styles.proFeatureText]}>
                    PDF & Excel Export Reports
                  </Text>
                </View>
                <View style={styles.planFeatureItem}>
                  <Ionicons name="checkmark-circle" size={16} color="#16A34A" />
                  <Text style={[styles.planFeatureText, styles.proFeatureText]}>
                    Advanced Profit & Analytics
                  </Text>
                </View>
                <View style={styles.planFeatureItem}>
                  <Ionicons name="checkmark-circle" size={16} color="#16A34A" />
                  <Text style={[styles.planFeatureText, styles.proFeatureText]}>
                    Priority Customer Support
                  </Text>
                </View>
              </View>
            </Pressable>
          </View>

          {/* ── Detailed Comparison Matrix ── */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeading}>Plan Comparison</Text>
            <Text style={styles.sectionSub}>Detailed breakdown</Text>
          </View>

          <View style={styles.comparisonTable}>
            {/* Header */}
            <View style={styles.compHeaderRow}>
              <Text style={[styles.compHeaderCol, { flex: 2.5 }]}>Features</Text>
              <Text style={[styles.compHeaderCol, styles.compColCenter]}>Free</Text>
              <Text style={[styles.compHeaderCol, styles.compColCenter]}>Basic</Text>
              <View style={[styles.compHeaderCol, styles.compColCenter, styles.compProHeaderCol]}>
                <Text style={styles.compProHeaderText}>Pro</Text>
              </View>
            </View>

            {/* Feature Rows */}
            {[
              { name: 'Monthly Orders Limit', free: '10', basic: '150', pro: 'Unlimited', icon: 'receipt-outline' },
              { name: 'Customer Contacts Limit', free: '10', basic: '60', pro: 'Unlimited', icon: 'people-outline' },
              { name: 'Invoice Templates', free: '1 Default', basic: '1 Default', pro: 'All Premium', icon: 'document-text-outline' },
              { name: 'Custom Logo & Branding', free: '—', basic: '—', pro: '✓', icon: 'color-palette-outline' },
              { name: 'PDF & Excel Export', free: '—', basic: '—', pro: '✓', icon: 'download-outline' },
              { name: 'Business Reports', free: 'Basic', basic: 'Basic', pro: 'Advanced', icon: 'bar-chart-outline' },
              { name: 'WhatsApp Invoicing', free: '✓', basic: '✓', pro: '✓', icon: 'logo-whatsapp' },
              { name: 'Cloud Multi-Device Sync', free: '✓', basic: '✓', pro: '✓', icon: 'cloud-done-outline' },
              { name: 'Priority Support', free: '—', basic: '—', pro: '✓', icon: 'headset-outline' },
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
          <Text style={styles.sectionHeading}>Why Upgrade to Pro?</Text>
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
                Make your brand stand out with customizable premium invoice designs and instant PDF downloads.
              </Text>
            </View>

            <View style={[styles.benefitCard, isDesktop && styles.benefitCardDesktop]}>
              <View style={[styles.benefitIconWrap, { backgroundColor: '#DCFCE7' }]}>
                <Ionicons name="trending-up-outline" size={22} color="#16A34A" />
              </View>
              <Text style={styles.benefitTitle}>Deep Profit Insights</Text>
              <Text style={styles.benefitDesc}>
                Understand margins, track unpaid customer balances, and optimize expense categories effortlessly.
              </Text>
            </View>

            <View style={[styles.benefitCard, isDesktop && styles.benefitCardDesktop]}>
              <View style={[styles.benefitIconWrap, { backgroundColor: '#F3E8FF' }]}>
                <Ionicons name="shield-checkmark-outline" size={22} color="#9333EA" />
              </View>
              <Text style={styles.benefitTitle}>Secure & Tax-Ready</Text>
              <Text style={styles.benefitDesc}>
                Export tax-compliant Excel sheets in 1-click for your CA or accounting software.
              </Text>
            </View>
          </View>

          {/* ── Web vs Mobile Purchase CTA ── */}
          {Platform.OS === 'web' ? (
            <View style={styles.webCtaCard}>
              <View style={styles.webCtaIconWrap}>
                <Ionicons name="phone-portrait" size={32} color={colors.clayDeep} />
              </View>
              <Text style={styles.webCtaTitle}>Upgrade on KadaiBook Mobile</Text>
              <Text style={styles.webCtaDesc}>
                Subscriptions are managed securely via Google Play and Apple App Store.
                Install the mobile app to upgrade to Pro and access all features across your web dashboard!
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

              {/* Trust Badges */}
              <View style={styles.trustBadges}>
                <View style={styles.trustItem}>
                  <Ionicons name="shield-checkmark" size={14} color="#16A34A" />
                  <Text style={styles.trustText}>Secure Checkout</Text>
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
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  statusPillText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: '#92400E',
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

  /* ── Hero Banner ── */
  heroCard: {
    backgroundColor: '#2E2A24',
    borderRadius: radius.lg,
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginBottom: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF3C725',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: '#FDE68A40',
    marginBottom: 12,
  },
  heroBadgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: '#FDE68A',
    letterSpacing: 0.8,
  },
  heroTitle: {
    fontFamily: fonts.display,
    fontSize: 24,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 32,
  },
  heroSubtitle: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: '#DCD3C0',
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 420,
  },

  sectionHeading: {
    fontFamily: fonts.bodyBold,
    fontSize: 18,
    color: colors.ink,
    marginBottom: 14,
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
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.line,
    padding: 20,
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
    paddingTop: 24,
  },
  proPlanCardSelected: {
    borderColor: '#CA8A04',
    borderWidth: 2,
    backgroundColor: '#FEFCE8',
    shadowColor: '#CA8A04',
    shadowOpacity: 0.15,
    shadowRadius: 10,
  },
  proRibbon: {
    position: 'absolute',
    top: -1,
    left: -1,
    right: -1,
    backgroundColor: '#CA8A04',
    borderTopLeftRadius: radius.md,
    borderTopRightRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 4,
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
  planPrice: {
    fontFamily: fonts.bodyBold,
    fontSize: 18,
    color: colors.ink,
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
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
    marginBottom: 28,
  },
  compHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#F3EFE6',
    paddingVertical: 12,
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
    paddingVertical: 4,
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
    paddingVertical: 12,
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
    paddingVertical: 3,
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
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 18,
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
    borderRadius: radius.lg,
    padding: 28,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  webCtaIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: '#F5EBE1',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  webCtaTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 20,
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
    maxWidth: 460,
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
    borderRadius: 12,
    minWidth: 170,
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
