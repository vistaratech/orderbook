import React from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { RootStackParamList } from '../navigation/types';
import AppLogo from '../components/AppLogo';
import { useLanguage } from '../i18n/LanguageContext';
import { colors, fonts, radius, shadow } from '../theme/theme';
import useCollapsibleHeader from '../hooks/useCollapsibleHeader';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function MoreScreen() {
  const navigation = useNavigation<Nav>();
  const { t } = useLanguage();

  const {
    onScroll,
    scrollEventThrottle,
    headerAnimatedStyle,
    onHeaderLayout,
    headerHeight,
  } = useCollapsibleHeader({ initialHeight: 70 });

  const menuItems = [
    {
      title: t('reports.title', 'Financial Reports'),
      subtitle: t('reports.subtitle', 'P&L, cash flow, top items & customers'),
      icon: 'bar-chart' as const,
      color: '#0284C7',
      bg: '#E0F2FE',
      action: () => (navigation as any).navigate('MainTabs', { screen: 'ReportsTab' }),
    },
    {
      title: t('more.storeActivity'),
      subtitle: t('more.storeActivitySub'),
      icon: 'time' as const,
      color: colors.inflow,
      bg: '#E8F5E9',
      action: () => navigation.navigate('History'),
    },
    {
      title: t('more.businessProfile'),
      subtitle: t('more.businessProfileSub'),
      icon: 'business' as const,
      color: colors.clayDeep,
      bg: colors.clayLight,
      action: () => navigation.navigate('BusinessProfile'),
    },
    {
      title: t('more.customerDirectory'),
      subtitle: t('more.customerDirectorySub'),
      icon: 'people' as const,
      color: colors.duskDeep,
      bg: colors.duskLight,
      action: () => navigation.navigate('CustomerList'),
    },
    {
      title: t('more.productCatalog'),
      subtitle: t('more.productCatalogSub'),
      icon: 'pricetags' as const,
      color: colors.statusPlaced,
      bg: '#FFF8E1',
      action: () => navigation.navigate('ProductList'),
    },
    {
      title: t('purchases.title', 'Purchases'),
      subtitle: t('purchases.menuSubtitle', 'Track supplier bills & stock purchases'),
      icon: 'cart' as const,
      color: '#6E9E71',
      bg: '#E8F5E9',
      action: () => navigation.navigate('PurchaseList'),
    },
    {
      title: t('estimates.title', 'Estimates / Quotations'),
      subtitle: t('estimates.menuSubtitle', 'Create quotes & convert to orders'),
      icon: 'document-text' as const,
      color: '#9B84B0',
      bg: '#F3E5F5',
      action: () => navigation.navigate('EstimateList'),
    },
    {
      title: t('invoice.templateTitle', 'Bill & Invoice Templates'),
      subtitle: t('invoice.templateSubtitle', 'Customize bills, 8 styles, UPI QR & colors'),
      icon: 'color-palette' as const,
      color: '#0284C7',
      bg: '#E0F2FE',
      action: () => navigation.navigate('InvoiceTemplateCustomizer'),
    },
    {
      title: t('more.settingsAndBackup'),
      subtitle: t('more.settingsAndBackupSub'),
      icon: 'settings' as const,
      color: colors.ink,
      bg: colors.paperCard,
      action: () => navigation.navigate('Settings'),
    },
  ];

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      {/* ─── Collapsible Header Bar ─── */}
      <Animated.View
        style={[styles.fixedHeaderContainer, headerAnimatedStyle]}
        onLayout={onHeaderLayout}
      >
        <View style={styles.header}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <AppLogo size={40} variant="icon" />
            <View>
              <Text style={styles.title}>{t('more.title')}</Text>
              <Text style={styles.subtitle}>{t('more.subtitle')}</Text>
            </View>
          </View>
        </View>
      </Animated.View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: headerHeight + 12 }]}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={scrollEventThrottle}
      >
        <View style={styles.menuList}>
          {menuItems.map((item) => (
            <Pressable
              key={item.title}
              style={({ pressed }) => [
                styles.menuCard,
                pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
              ]}
              onPress={item.action}
            >
              <View style={[styles.iconBox, { backgroundColor: item.bg }]}>
                <Ionicons name={item.icon} size={22} color={item.color} />
              </View>
              <View style={styles.menuInfo}>
                <Text style={styles.menuTitle}>{item.title}</Text>
                <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.inkSoft} />
            </Pressable>
          ))}
        </View>

        {/* Business Guide Note */}
        <View style={styles.infoCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <AppLogo size={28} variant="icon" />
            <Text style={styles.infoTitle}>About KadaiBook</Text>
          </View>
          <Text style={styles.infoText}>
            All order data, outflow records, customer profiles, and catalog entries are stored on your device and synced in real-time to Cloud Firestore when signed in. Use the Backup tool in Settings to manage your data copies.
          </Text>
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
  fixedHeaderContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.paper,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    paddingHorizontal: 20,
    zIndex: 20,
    maxWidth: 760,
    width: '100%',
    alignSelf: 'center',
    ...shadow.card,
  },
  header: {
    paddingVertical: 12,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
    maxWidth: 760,
    width: '100%',
    alignSelf: 'center',
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 28,
    color: colors.ink,
    lineHeight: 32,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.inkSoft,
    marginTop: 1,
  },
  menuList: {
    gap: 12,
    marginBottom: 20,
  },
  menuCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.paperCard,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 16,
    gap: 14,
    ...shadow.card,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuInfo: {
    flex: 1,
  },
  menuTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    color: colors.ink,
  },
  menuSubtitle: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.inkSoft,
    marginTop: 2,
  },
  infoCard: {
    backgroundColor: colors.paperCard,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 16,
    ...shadow.card,
  },
  infoTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.ink,
  },
  infoText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.inkSoft,
    lineHeight: 18,
  },
});
