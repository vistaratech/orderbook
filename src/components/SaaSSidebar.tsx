import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { RootStackParamList } from '../navigation/types';
import { colors, fonts, radius, shadow } from '../theme/theme';
import AppLogo from './AppLogo';
import { getAuthState, logout, UserAccount } from '../storage/authStorage';
import { getBusinessProfile, BusinessProfile } from '../storage/businessProfileStorage';
import { addDataListener } from '../storage/firebaseSync';
import { useLanguage } from '../i18n/LanguageContext';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const SIDEBAR_COLLAPSED_KEY = 'order_book:sidebar_collapsed';

interface SaaSSidebarProps {
  currentTabName?: string;
  onSelectTab?: (tabName: string) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export default function SaaSSidebar({
  currentTabName,
  onSelectTab,
  collapsed: propCollapsed,
  onToggleCollapse: propOnToggleCollapse,
}: SaaSSidebarProps) {
  const navigation = useNavigation<Nav>();
  const { t } = useLanguage();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= 768;

  const [user, setUser] = useState<UserAccount | null>(null);
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [internalCollapsed, setInternalCollapsed] = useState<boolean>(false);

  // Sync internal collapsed state with AsyncStorage
  useEffect(() => {
    AsyncStorage.getItem(SIDEBAR_COLLAPSED_KEY).then((val) => {
      if (val !== null) {
        setInternalCollapsed(val === 'true');
      }
    });
  }, []);

  const isCollapsed = propCollapsed !== undefined ? propCollapsed : internalCollapsed;

  const toggleCollapse = async () => {
    if (propOnToggleCollapse) {
      propOnToggleCollapse();
    }
    const nextState = !isCollapsed;
    setInternalCollapsed(nextState);
    await AsyncStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(nextState));
  };

  const loadUserInfo = async () => {
    try {
      const [authState, bp] = await Promise.all([getAuthState(), getBusinessProfile()]);
      setUser(authState.user);
      setProfile(bp);
    } catch {}
  };

  useEffect(() => {
    loadUserInfo();
    const unsub = addDataListener(() => {
      loadUserInfo();
    });
    return () => unsub();
  }, []);

  const handleNav = (tabName: string, stackScreenName?: keyof RootStackParamList) => {
    if (onSelectTab && tabName) {
      onSelectTab(tabName);
      if (isDesktop && navigation.canGoBack()) {
        navigation.navigate('MainTabs');
      }
      return;
    }
    if (stackScreenName) {
      navigation.navigate(stackScreenName as any);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigation.reset({
      index: 0,
      routes: [{ name: 'Login' }],
    });
  };

  const navItems = [
    {
      group: 'WORKSPACE',
      items: [
        {
          key: 'DashboardTab',
          label: t('nav.dashboard'),
          icon: 'home-outline' as const,
          activeIcon: 'home' as const,
          action: () => handleNav('DashboardTab'),
        },
        {
          key: 'OrdersTab',
          label: t('nav.orders'),
          icon: 'receipt-outline' as const,
          activeIcon: 'receipt' as const,
          action: () => handleNav('OrdersTab'),
        },
        {
          key: 'ExpensesTab',
          label: t('nav.expenses'),
          icon: 'wallet-outline' as const,
          activeIcon: 'wallet' as const,
          action: () => handleNav('ExpensesTab'),
        },
        {
          key: 'ReportsTab',
          label: t('nav.reports'),
          icon: 'bar-chart-outline' as const,
          activeIcon: 'bar-chart' as const,
          action: () => handleNav('ReportsTab'),
        },
      ],
    },
    {
      group: 'MANAGEMENT',
      items: [
        {
          key: 'CustomerList',
          label: t('nav.customers'),
          icon: 'people-outline' as const,
          activeIcon: 'people' as const,
          action: () => handleNav('CustomerList', 'CustomerList'),
        },
        {
          key: 'ProductList',
          label: t('nav.products'),
          icon: 'pricetags-outline' as const,
          activeIcon: 'pricetags' as const,
          action: () => handleNav('ProductList', 'ProductList'),
        },
        {
          key: 'PurchaseList',
          label: t('purchases.title', 'Purchases'),
          icon: 'cart-outline' as const,
          activeIcon: 'cart' as const,
          action: () => handleNav('PurchaseList', 'PurchaseList'),
        },
        {
          key: 'EstimateList',
          label: t('estimates.title', 'Estimates / Quotes'),
          icon: 'document-text-outline' as const,
          activeIcon: 'document-text' as const,
          action: () => handleNav('EstimateList', 'EstimateList'),
        },
        {
          key: 'History',
          label: t('nav.history'),
          icon: 'time-outline' as const,
          activeIcon: 'time' as const,
          action: () => handleNav('History', 'History'),
        },
      ],
    },
    {
      group: 'PREFERENCES',
      items: [
        {
          key: 'Settings',
          label: t('nav.settings'),
          icon: 'settings-outline' as const,
          activeIcon: 'settings' as const,
          action: () => handleNav('Settings', 'Settings'),
        },
      ],
    },
  ];

  return (
    <View style={[styles.sidebar, isCollapsed && styles.sidebarCollapsed]}>
      {/* ─── Header & Brand ─── */}
      <View style={[styles.brandHeader, isCollapsed && styles.brandHeaderCollapsed]}>
        <AppLogo size={isCollapsed ? 32 : 36} variant="icon" />

        {!isCollapsed ? (
          <View style={styles.brandTextWrap}>
            <Text style={styles.brandTitle} numberOfLines={1}>
              {profile?.businessName || 'KadaiBook'}
            </Text>
            <Text style={styles.brandSubtitle} numberOfLines={1}>
              {profile?.tagline || 'Business Management'}
            </Text>
          </View>
        ) : null}

        <Pressable
          style={({ pressed }) => [styles.collapseToggleBtn, pressed && { opacity: 0.7 }]}
          onPress={toggleCollapse}
          hitSlop={8}
          // @ts-ignore
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <Ionicons
            name={isCollapsed ? 'chevron-forward-outline' : 'chevron-back-outline'}
            size={16}
            color={colors.inkSoft}
          />
        </Pressable>
      </View>

      {/* ─── Quick Action Button ─── */}
      <Pressable
        style={({ pressed }) => [
          styles.quickOrderBtn,
          isCollapsed && styles.quickOrderBtnCollapsed,
          pressed && { opacity: 0.85 },
        ]}
        onPress={() => navigation.navigate('OrderForm')}
        // @ts-ignore
        title="New Order"
      >
        <Ionicons name="add" size={isCollapsed ? 24 : 18} color={colors.white} />
        {!isCollapsed && <Text style={styles.quickOrderBtnText}>New Order</Text>}
      </Pressable>

      {/* ─── Navigation Groups ─── */}
      <ScrollView
        style={styles.navScroll}
        contentContainerStyle={styles.navScrollContent}
        showsVerticalScrollIndicator={false}
      >
        {navItems.map((group) => (
          <View key={group.group} style={styles.navGroup}>
            {!isCollapsed ? (
              <Text style={styles.navGroupLabel}>{group.group}</Text>
            ) : (
              <View style={styles.navGroupDivider} />
            )}

            {group.items.map((item) => {
              const isActive = currentTabName === item.key;
              return (
                <Pressable
                  key={item.key}
                  style={({ pressed }) => [
                    styles.navItemWrap,
                    isCollapsed && styles.navItemWrapCollapsed,
                    pressed && { opacity: 0.8 },
                  ]}
                  onPress={item.action}
                  // @ts-ignore
                  title={isCollapsed ? item.label : undefined}
                >
                  <View
                    style={[
                      styles.navItemBox,
                      isCollapsed && styles.navItemBoxCollapsed,
                      isActive && styles.navItemActive,
                    ]}
                  >
                    <Ionicons
                      name={isActive ? item.activeIcon : item.icon}
                      size={20}
                      color={isActive ? colors.clayDeep : colors.inkSoft}
                      style={isCollapsed ? undefined : styles.navItemIcon}
                    />

                    {!isCollapsed && (
                      <Text
                        style={[
                          styles.navItemLabel,
                          isActive && styles.navItemLabelActive,
                        ]}
                      >
                        {item.label}
                      </Text>
                    )}

                    {isActive ? (
                      <View style={isCollapsed ? styles.activeIndicatorCollapsed : styles.activeIndicator} />
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))}
      </ScrollView>

      {/* ─── Footer: User Account & Sign Out ─── */}
      <View style={[styles.userFooter, isCollapsed && styles.userFooterCollapsed]}>
        <View
          style={styles.userAvatar}
          // @ts-ignore
          title={user?.name || profile?.businessName || 'Store Admin'}
        >
          <Text style={styles.userAvatarText}>
            {(user?.name || profile?.businessName || 'U').charAt(0).toUpperCase()}
          </Text>
        </View>

        {!isCollapsed ? (
          <View style={styles.userInfo}>
            <Text style={styles.userName} numberOfLines={1}>
              {user?.name || profile?.businessName || 'Store Admin'}
            </Text>
            <Text style={styles.userRole} numberOfLines={1}>
              {user?.email || 'Logged In'}
            </Text>
          </View>
        ) : null}

        <Pressable
          style={({ pressed }) => [
            styles.logoutBtn,
            isCollapsed && styles.logoutBtnCollapsed,
            pressed && { opacity: 0.7 },
          ]}
          onPress={handleLogout}
          hitSlop={8}
          // @ts-ignore
          title="Sign out"
        >
          <Ionicons name="log-out-outline" size={18} color={colors.inkSoft} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: 250,
    height: '100%',
    backgroundColor: colors.paperCard,
    borderRightWidth: 1,
    borderRightColor: colors.line,
    display: 'flex',
    flexDirection: 'column',
    paddingVertical: 16,
    paddingHorizontal: 14,
    ...Platform.select({
      web: {
        position: 'sticky' as any,
        top: 0,
        height: '100vh' as any,
        userSelect: 'none' as any,
        transition: 'width 0.2s ease, padding 0.2s ease' as any,
      },
    }),
  },
  sidebarCollapsed: {
    width: 72,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  brandHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    marginBottom: 14,
    width: '100%',
  },
  brandHeaderCollapsed: {
    flexDirection: 'column',
    gap: 10,
    paddingBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  brandTextWrap: {
    flex: 1,
  },
  brandTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.ink,
  },
  brandSubtitle: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.inkSoft,
    marginTop: 1,
  },
  collapseToggleBtn: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 'auto',
  },
  quickOrderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.clayDeep,
    paddingVertical: 10,
    borderRadius: radius.md,
    marginBottom: 16,
    width: '100%',
    ...shadow.card,
  },
  quickOrderBtnCollapsed: {
    width: 44,
    height: 44,
    borderRadius: 22,
    paddingVertical: 0,
    alignSelf: 'center',
    justifyContent: 'center',
  },
  quickOrderBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.white,
  },
  navScroll: {
    flex: 1,
    width: '100%',
  },
  navScrollContent: {
    paddingBottom: 10,
    alignItems: 'center',
  },
  navGroup: {
    marginBottom: 14,
    width: '100%',
  },
  navGroupLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    color: colors.inkSoft,
    letterSpacing: 0.8,
    marginBottom: 6,
    paddingHorizontal: 8,
  },
  navGroupDivider: {
    height: 1,
    width: 28,
    backgroundColor: colors.line,
    marginVertical: 8,
    alignSelf: 'center',
  },
  navItemWrap: {
    width: '100%',
    marginBottom: 3,
  },
  navItemWrapCollapsed: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  navItemBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: radius.sm,
    position: 'relative',
    width: '100%',
  },
  navItemBoxCollapsed: {
    width: 44,
    height: 44,
    borderRadius: 12,
    paddingHorizontal: 0,
    paddingVertical: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navItemActive: {
    backgroundColor: colors.clayLight,
  },
  navItemIcon: {
    marginRight: 10,
  },
  navItemLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.inkSoft,
    flex: 1,
  },
  navItemLabelActive: {
    fontFamily: fonts.bodyBold,
    color: colors.clayDeep,
  },
  activeIndicator: {
    width: 4,
    height: 16,
    borderRadius: 2,
    backgroundColor: colors.clayDeep,
    position: 'absolute',
    right: 6,
  },
  activeIndicatorCollapsed: {
    width: 3,
    height: 20,
    borderRadius: 2,
    backgroundColor: colors.clayDeep,
    position: 'absolute',
    left: 2,
  },
  userFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    marginTop: 'auto',
    width: '100%',
  },
  userFooterCollapsed: {
    flexDirection: 'column',
    gap: 8,
    alignItems: 'center',
    paddingHorizontal: 0,
  },
  userAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.clayLight,
    borderWidth: 1,
    borderColor: colors.clayDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatarText: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.clayDeep,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: colors.ink,
  },
  userRole: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.inkSoft,
  },
  logoutBtn: {
    padding: 6,
    borderRadius: radius.sm,
  },
  logoutBtnCollapsed: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
  },
});
