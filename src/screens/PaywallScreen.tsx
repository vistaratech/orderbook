import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Pressable, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import GlassBackButton from '../components/GlassBackButton';
import { colors, fonts, radius } from '../theme/theme';
import { getAvailablePackages, purchaseProPackage, checkProStatus, checkBasicStatus, restorePurchases } from '../storage/subscriptionStorage';

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
        <View style={styles.card}>
          <Ionicons name="star" size={40} color="#EAB308" style={{ alignSelf: 'center', marginBottom: 16 }} />
          <Text style={styles.title}>KadaiBook Subscriptions</Text>
          <Text style={styles.subtitle}>Take your business to the next level.</Text>
          
          <View style={styles.featureList}>
            <View style={styles.featureRow}>
              <Ionicons name="checkmark-circle" size={20} color={colors.success} />
              <Text style={styles.featureText}>Basic: 150 Orders, 60 Customers</Text>
            </View>
            <View style={styles.featureRow}>
              <Ionicons name="checkmark-circle" size={20} color={colors.success} />
              <Text style={styles.featureText}>Pro: Unlimited Orders & Customers</Text>
            </View>
            <View style={styles.featureRow}>
              <Ionicons name="checkmark-circle" size={20} color={colors.success} />
              <Text style={styles.featureText}>Pro: Premium Invoice Templates</Text>
            </View>
            <View style={styles.featureRow}>
              <Ionicons name="checkmark-circle" size={20} color={colors.success} />
              <Text style={styles.featureText}>Pro: Advanced PDF & Excel Exports</Text>
            </View>
          </View>
        </View>

        {isPro ? (
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

        <Pressable
          style={{ marginTop: 24, marginBottom: 16, alignSelf: 'center', padding: 8 }}
          onPress={handleRestore}
          disabled={purchasing}
        >
          <Text style={{ color: colors.clayDeep, fontFamily: fonts.bodyBold, fontSize: 14 }}>
            Restore Purchases
          </Text>
        </Pressable>
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
  },
  card: {
    backgroundColor: colors.paperCard,
    padding: 24,
    borderRadius: radius.md,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#EAB30840',
  },
  title: {
    fontFamily: fonts.bodyBold,
    fontSize: 24,
    color: colors.ink,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.inkSoft,
    textAlign: 'center',
    marginBottom: 24,
  },
  featureList: {
    gap: 12,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
    color: colors.ink,
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
});
