import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { RootStackParamList } from '../navigation/types';
import { colors, fonts, radius, shadow } from '../theme/theme';
import AppLogo from './AppLogo';
import { getAuthState, logout, UserAccount } from '../storage/authStorage';
import { getBusinessProfile, BusinessProfile } from '../storage/businessProfileStorage';
import { addDataListener } from '../storage/firebaseSync';

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface SaaSSidebarProps {
  currentTabName?: string;
  onSelectTab?: (tabName: string) => void;
}

export default function SaaSSidebar({ currentTabName, onSelectTab }: SaaSSidebarProps) {
  const navigation = useNavigation<Nav>();
  const [user, setUser] = useState<UserAccount | null>(null);
  const [profile, setProfile] = useState<BusinessProfile | null>(null);

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
          label: 'Dashboard',
          icon: 'home-outline' as const,
          activeIcon: 'home' as const,
          action: () => handleNav('DashboardTab'),
        },
        {
          key: 'OrdersTab',
          label: 'Orders & Pipeline',
          icon: 'receipt-outline' as const,
          activeIcon: 'receipt' as const,
          action: () => handleNav('OrdersTab'),
        },
        {
          key: 'ExpensesTab',
          label: 'Expenses & Outflow',
          icon: 'wallet-outline' as const,
          activeIcon: 'wallet' as const,
          action: () => handleNav('ExpensesTab'),
        },
        {
          key: 'ReportsTab',
          label: 'Financial Reports',
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
          label: 'Customers',
          icon: 'people-outline' as const,
          activeIcon: 'people' as const,
          action: () => handleNav('', 'CustomerList'),
        },
        {
          key: 'ProductList',
          label: 'Product Catalog',
          icon: 'pricetags-outline' as const,
          activeIcon: 'pricetags' as const,
          action: () => handleNav('', 'ProductList'),
        },
        {
          key: 'History',
          label: 'Store Activity',
          icon: 'time-outline' as const,
          activeIcon: 'time' as const,
          action: () => handleNav('', 'History'),
        },
      ],
    },
    {
      group: 'PREFERENCES',
      items: [
        {
          key: 'Settings',
          label: 'Settings & Profile',
          icon: 'settings-outline' as const,
          activeIcon: 'settings' as const,
          action: () => handleNav('', 'Settings'),
        },
      ],
    },
  ];

  return (
    <View style={styles.sidebar}>
      {/* ─── Header & Brand ─── */}
      <View style={styles.brandHeader}>
        <AppLogo size={36} variant="icon" />
        <View style={styles.brandTextWrap}>
          <Text style={styles.brandTitle} numberOfLines={1}>
            {profile?.businessName || 'OrderBook'}
          </Text>
          <Text style={styles.brandSubtitle} numberOfLines={1}>
            {profile?.tagline || 'Business Management'}
          </Text>
        </View>
      </View>

      {/* ─── Quick Action ─── */}
      <Pressable
        style={({ pressed }) => [styles.quickOrderBtn, pressed && { opacity: 0.85 }]}
        onPress={() => navigation.navigate('OrderForm')}
      >
        <Ionicons name="add-circle" size={18} color={colors.white} />
        <Text style={styles.quickOrderBtnText}>New Order</Text>
      </Pressable>

      {/* ─── Navigation Groups ─── */}
      <ScrollView
        style={styles.navScroll}
        contentContainerStyle={styles.navScrollContent}
        showsVerticalScrollIndicator={false}
      >
        {navItems.map((group) => (
          <View key={group.group} style={styles.navGroup}>
            <Text style={styles.navGroupLabel}>{group.group}</Text>
            {group.items.map((item) => {
              const isActive = currentTabName === item.key;
              return (
                <Pressable
                  key={item.key}
                  style={({ pressed }) => [
                    styles.navItem,
                    isActive && styles.navItemActive,
                    pressed && { opacity: 0.8 },
                  ]}
                  onPress={item.action}
                >
                  <Ionicons
                    name={isActive ? item.activeIcon : item.icon}
                    size={18}
                    color={isActive ? colors.clayDeep : colors.inkSoft}
                    style={styles.navItemIcon}
                  />
                  <Text
                    style={[
                      styles.navItemLabel,
                      isActive && styles.navItemLabelActive,
                    ]}
                  >
                    {item.label}
                  </Text>
                  {isActive ? <View style={styles.activeIndicator} /> : null}
                </Pressable>
              );
            })}
          </View>
        ))}
      </ScrollView>

      {/* ─── Footer: User Account & Sign Out ─── */}
      <View style={styles.userFooter}>
        <View style={styles.userAvatar}>
          <Text style={styles.userAvatarText}>
            {(user?.name || profile?.businessName || 'U').charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.userName} numberOfLines={1}>
            {user?.name || profile?.businessName || 'Store Admin'}
          </Text>
          <Text style={styles.userRole} numberOfLines={1}>
            {user?.email || 'Logged In'}
          </Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.logoutBtn, pressed && { opacity: 0.7 }]}
          onPress={handleLogout}
          hitSlop={8}
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
    paddingVertical: 18,
    paddingHorizontal: 14,
    ...Platform.select({
      web: {
        position: 'sticky' as any,
        top: 0,
        height: '100vh' as any,
        userSelect: 'none' as any,
      },
    }),
  },
  brandHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    marginBottom: 16,
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
  quickOrderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.clayDeep,
    paddingVertical: 10,
    borderRadius: radius.md,
    marginBottom: 16,
    ...shadow.card,
  },
  quickOrderBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.white,
  },
  navScroll: {
    flex: 1,
  },
  navScrollContent: {
    paddingBottom: 10,
  },
  navGroup: {
    marginBottom: 14,
  },
  navGroupLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    color: colors.inkSoft,
    letterSpacing: 0.8,
    marginBottom: 6,
    paddingHorizontal: 8,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: radius.sm,
    marginBottom: 2,
    position: 'relative',
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
  userFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    marginTop: 'auto',
  },
  userAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
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
});
