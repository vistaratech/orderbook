import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Pressable, ScrollView, Alert, Platform, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import GlassBackButton from '../components/GlassBackButton';
import { colors, fonts, radius } from '../theme/theme';
import { getAvailablePackages, purchaseProPackage, checkProStatus, checkBasicStatus, restorePurchases } from '../storage/subscriptionStorage';

const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=in.kadaibook.app';
const APP_STORE_URL = 'https://apps.apple.com/app/kadaibook/id6743072498';

export default function PaywallScreen() {
  const navigation = useNavigation();
  const [packages, setPackages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [isPro, setIsPro] = useState(false);
  const [isBasic, setIsBasic] = useState(false);

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

      if (!proStatus) {
        const pkgs = await getAvailablePackages();
        // Show all packages (e.g. Basic Monthly, Pro Monthly, Pro Yearly)
        setPackages(pkgs);
      }
    } catch (e) {
      console.warn("Failed to load subscription data", e);
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (pkg: any) => {
    setPurchasing(true);
    const success = await purchaseProPackage(pkg);
    setPurchasing(false);
    
    if (success) {
      Alert.alert("Success!", "Subscription activated! Thank you for upgrading.");
      navigation.goBack();
    } else {
      Alert.alert("Purchase failed", "Could not complete the purchase. Please try again.");
    }
  };

  const handleRestore = async () => {
    setPurchasing(true);
    const success = await restorePurchases();
    setPurchasing(false);
    if (success) {
      Alert.alert("Success", "Your purchases have been restored.");
      await loadData();
    } else {
      Alert.alert("Notice", "No active subscriptions found to restore.");
    }
  };

  if (loading) {
    return (
      <View style={[styles.screen, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={colors.clayDeep} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.topHeader}>
        <GlassBackButton label="Back" />
        <View style={{ flex: 1 }}>
          <Text style={styles.topHeaderTitle}>Upgrade to Pro</Text>
          <Text style={styles.topHeaderSub}>Unlock premium features</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* ── Hero Section ── */}
        <View style={styles.heroSection}>
          <View style={styles.heroIconWrap}>
            <Ionicons name="sparkles" size={32} color="#EAB308" />
          </View>
          <Text style={styles.title}>Unlock the Full Power{'\n'}of KadaiBook</Text>
          <Text style={styles.subtitle}>
            Choose the plan that fits your business. Upgrade anytime.
          </Text>
        </View>

        {/* ── Plan Comparison ── */}
        <View style={styles.comparisonCard}>
          <Text style={styles.comparisonTitle}>Plan Comparison</Text>

          {/* Table Header */}
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Feature</Text>
            <Text style={[styles.tableHeaderCell, styles.tableHeaderCellCenter]}>Free</Text>
            <Text style={[styles.tableHeaderCell, styles.tableHeaderCellCenter]}>Basic</Text>
            <Text style={[styles.tableHeaderCell, styles.tableHeaderCellCenter, styles.tableHeaderPro]}>Pro</Text>
          </View>

          {/* Rows */}
          {[
            { feature: 'Orders', free: '50', basic: '150', pro: 'Unlimited', icon: 'receipt-outline' },
            { feature: 'Customers', free: '20', basic: '60', pro: 'Unlimited', icon: 'people-outline' },
            { feature: 'Invoice Templates', free: '1 Default', basic: '1 Default', pro: 'All Premium', icon: 'document-text-outline' },
            { feature: 'PDF / Excel Export', free: '—', basic: '—', pro: '✓', icon: 'download-outline' },
            { feature: 'Share Reports', free: '—', basic: '—', pro: '✓', icon: 'share-social-outline' },
            { feature: 'Business Analytics', free: 'Basic', basic: 'Basic', pro: 'Advanced', icon: 'bar-chart-outline' },
            { feature: 'Priority Support', free: '—', basic: '—', pro: '✓', icon: 'headset-outline' },
          ].map((row, idx) => (
            <View key={idx} style={[styles.tableRow, idx % 2 === 0 && styles.tableRowAlt]}>
              <View style={[styles.tableCell, { flex: 2, flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
                <Ionicons name={row.icon as any} size={16} color={colors.inkSoft} />
                <Text style={styles.tableCellText}>{row.feature}</Text>
              </View>
              <Text style={[styles.tableCell, styles.tableCellCenter, styles.tableCellTextMuted]}>
                {row.free}
              </Text>
              <Text style={[styles.tableCell, styles.tableCellCenter, styles.tableCellTextMuted]}>
                {row.basic}
              </Text>
              <Text style={[styles.tableCell, styles.tableCellCenter, styles.tableCellTextPro]}>
                {row.pro}
              </Text>
            </View>
          ))}
        </View>

        {/* ── Pro Highlights ── */}
        <View style={styles.highlightsCard}>
          <Text style={styles.highlightsTitle}>Why Go Pro?</Text>
          {[
            { icon: 'infinite-outline', text: 'Create unlimited orders & manage unlimited customers' },
            { icon: 'color-palette-outline', text: 'Access all premium invoice templates with custom branding' },
            { icon: 'analytics-outline', text: 'Advanced business analytics & financial reports' },
            { icon: 'cloud-download-outline', text: 'Export orders as PDF & Excel for accounting' },
            { icon: 'share-social-outline', text: 'Share business reports via WhatsApp & email' },
          ].map((item, idx) => (
            <View key={idx} style={styles.highlightRow}>
              <View style={styles.highlightIconWrap}>
                <Ionicons name={item.icon as any} size={18} color="#CA8A04" />
              </View>
              <Text style={styles.highlightText}>{item.text}</Text>
            </View>
          ))}
        </View>


        {Platform.OS === 'web' ? (
          /* ── Web: Download App CTA ── */
          <View style={styles.webUpgradeCard}>
            <View style={styles.webUpgradeIconRow}>
              <Ionicons name="phone-portrait-outline" size={36} color={colors.clayDeep} />
            </View>
            <Text style={styles.webUpgradeTitle}>
              Download the App to Upgrade
            </Text>
            <Text style={styles.webUpgradeSub}>
              In-app subscriptions are available exclusively on our mobile app.
              Download KadaiBook from the Play Store or App Store to unlock Pro features.
            </Text>

            <Pressable
              style={({ pressed }) => [
                styles.storeBtn,
                styles.storeBtnGoogle,
                pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
              ]}
              onPress={() => Linking.openURL(PLAY_STORE_URL)}
            >
              <Ionicons name="logo-google-playstore" size={22} color="#FFFFFF" />
              <View>
                <Text style={styles.storeBtnLabel}>GET IT ON</Text>
                <Text style={styles.storeBtnTitle}>Google Play</Text>
              </View>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.storeBtn,
                styles.storeBtnApple,
                pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
              ]}
              onPress={() => Linking.openURL(APP_STORE_URL)}
            >
              <Ionicons name="logo-apple" size={24} color="#FFFFFF" />
              <View>
                <Text style={styles.storeBtnLabel}>Download on the</Text>
                <Text style={styles.storeBtnTitle}>App Store</Text>
              </View>
            </Pressable>
          </View>
        ) : isPro ? (
          <View style={styles.activeContainer}>
            <Text style={styles.activeText}>You are currently on the Pro plan! Enjoy all premium features.</Text>
          </View>
        ) : packages.length > 0 ? (
          packages.map((pkg) => (
            <Pressable
              key={pkg.identifier}
              style={({ pressed }) => [
                styles.packageCard,
                pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
              ]}
              onPress={() => handlePurchase(pkg)}
              disabled={purchasing}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.packageTitle}>{pkg.product.title}</Text>
                <Text style={styles.packageDesc}>{pkg.product.description}</Text>
              </View>
              <View style={styles.priceContainer}>
                <Text style={styles.packagePrice}>{pkg.product.priceString}</Text>
              </View>
            </Pressable>
          ))
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="refresh-circle-outline" size={48} color={colors.clayDeep} style={{ marginBottom: 12 }} />
            <Text style={[styles.emptyText, { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.ink, marginBottom: 8 }]}>
              Loading Subscription Plans...
            </Text>
            <Text style={styles.emptyText}>
              Connecting to Google Play. This may take a moment on first launch.
            </Text>
            <Pressable
              style={{
                marginTop: 20,
                backgroundColor: colors.clayDeep,
                paddingHorizontal: 28,
                paddingVertical: 13,
                borderRadius: 50,
              }}
              onPress={loadData}
            >
              <Text style={{ color: '#fff', fontFamily: fonts.bodyBold, fontSize: 15 }}>
                Tap to Retry
              </Text>
            </Pressable>
          </View>
        )}

        {Platform.OS !== 'web' && (
          <Pressable
            style={{ marginTop: 24, marginBottom: 16, alignSelf: 'center', padding: 8 }}
            onPress={handleRestore}
            disabled={purchasing}
          >
            <Text style={{ color: colors.clayDeep, fontFamily: fonts.bodyBold, fontSize: 14 }}>
              Restore Purchases
            </Text>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  topHeaderTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 20,
    color: colors.ink,
  },
  topHeaderSub: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.inkSoft,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  /* ── Hero ── */
  heroSection: {
    alignItems: 'center',
    marginBottom: 24,
    paddingTop: 8,
  },
  heroIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 16,
    backgroundColor: '#FEF9C3',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontFamily: fonts.bodyBold,
    fontSize: 22,
    color: colors.ink,
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 30,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.inkSoft,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 320,
  },
  /* ── Comparison Table ── */
  comparisonCard: {
    backgroundColor: colors.paperCard,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: 20,
    overflow: 'hidden',
  },
  comparisonTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    color: colors.ink,
    padding: 16,
    paddingBottom: 0,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    marginTop: 12,
    backgroundColor: '#F8F5EE',
  },
  tableHeaderCell: {
    flex: 1,
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: colors.inkSoft,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tableHeaderCellCenter: {
    textAlign: 'center',
  },
  tableHeaderPro: {
    color: '#CA8A04',
  },
  tableRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  tableRowAlt: {
    backgroundColor: '#FAFAF5',
  },
  tableCell: {
    flex: 1,
  },
  tableCellCenter: {
    textAlign: 'center',
  },
  tableCellText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.ink,
    flexShrink: 1,
  },
  tableCellTextMuted: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.inkSoft,
  },
  tableCellTextPro: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: '#854D0E',
  },
  /* ── Highlights ── */
  highlightsCard: {
    backgroundColor: '#FFFBEB',
    borderRadius: radius.md,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginBottom: 24,
  },
  highlightsTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    color: '#92400E',
    marginBottom: 14,
  },
  highlightRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  highlightIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  highlightText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: '#78350F',
    lineHeight: 20,
    flex: 1,
    paddingTop: 6,
  },
  packageCard: {
    backgroundColor: colors.clayDeep,
    padding: 20,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  packageTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 18,
    color: colors.white,
    marginBottom: 4,
  },
  packageDesc: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
  },
  priceContainer: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  packagePrice: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    color: colors.white,
  },
  activeContainer: {
    padding: 16,
    backgroundColor: '#E0F2FE',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#0284C740',
  },
  activeText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
    color: '#0369A1',
    textAlign: 'center',
  },
  emptyContainer: {
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.inkSoft,
    textAlign: 'center',
  },
  emptyStep: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.ink,
    lineHeight: 20,
    paddingHorizontal: 4,
  },
  /* ── Web: Download App Styles ── */
  webUpgradeCard: {
    backgroundColor: colors.paperCard,
    borderRadius: radius.md,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  webUpgradeIconRow: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: '#F1E8D9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  webUpgradeTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 20,
    color: colors.ink,
    textAlign: 'center',
    marginBottom: 10,
  },
  webUpgradeSub: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.inkSoft,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
    maxWidth: 400,
  },
  storeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    width: '100%',
    maxWidth: 280,
    marginBottom: 12,
  },
  storeBtnGoogle: {
    backgroundColor: '#1A73E8',
  },
  storeBtnApple: {
    backgroundColor: '#000000',
  },
  storeBtnLabel: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: 'rgba(255,255,255,0.8)',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  storeBtnTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 17,
    color: '#FFFFFF',
  },
});
