import React, { useState, useEffect } from 'react';
import { StyleSheet, Platform, View, Text, Pressable, useWindowDimensions } from 'react-native';
import { createBottomTabNavigator, BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { MainTabParamList } from './types';
import DashboardScreen from '../screens/DashboardScreen';
import OrderListScreen from '../screens/OrderListScreen';
import ExpensesScreen from '../screens/ExpensesScreen';
import ReportsScreen from '../screens/ReportsScreen';
import CustomerListScreen from '../screens/CustomerListScreen';
import ProductListScreen from '../screens/ProductListScreen';
import PurchaseListScreen from '../screens/PurchaseListScreen';
import EstimateListScreen from '../screens/EstimateListScreen';
import HistoryScreen from '../screens/HistoryScreen';
import SettingsScreen from '../screens/SettingsScreen';
import MoreScreen from '../screens/MoreScreen';
import InvoiceTemplateCustomizerScreen from '../screens/InvoiceTemplateCustomizerScreen';
import BusinessProfileScreen from '../screens/BusinessProfileScreen';
import SaaSSidebar from '../components/SaaSSidebar';
import { DesktopSidebarContext } from '../components/DesktopLayout';
import { useLanguage } from '../i18n/LanguageContext';
import { useTour } from '../context/TourContext';
import { hasCompletedTour } from '../storage/tourStorage';
import TourTarget from '../components/tour/TourTarget';
import AppTourOverlay from '../components/tour/AppTourOverlay';
import { colors, fonts, radius, shadow } from '../theme/theme';
import { assertSubscriptionLimit } from '../utils/subscriptionGuard';

const Tab = createBottomTabNavigator<MainTabParamList>();

const TAB_URL_MAP: Record<string, string> = {
  DashboardTab: '/',
  OrdersTab: '/orders',
  ExpensesTab: '/expenses',
  ReportsTab: '/reports',
  CustomerList: '/customers',
  ProductList: '/products',
  PurchaseList: '/purchases',
  EstimateList: '/estimates',
  History: '/history',
  Settings: '/settings',
  InvoiceTemplateCustomizer: '/invoice-customizer',
  BusinessProfile: '/profile',
  MoreTab: '/more',
};

function getTabFromPath(pathname: string): string {
  const clean = (pathname || '').replace(/^\/+|\/+$/g, '').toLowerCase();
  switch (clean) {
    case 'orders':
    case 'orders-all':
      return 'OrdersTab';
    case 'expenses':
      return 'ExpensesTab';
    case 'reports':
      return 'ReportsTab';
    case 'customers':
      return 'CustomerList';
    case 'products':
      return 'ProductList';
    case 'purchases':
      return 'PurchaseList';
    case 'estimates':
      return 'EstimateList';
    case 'history':
      return 'History';
    case 'invoice-customizer':
      return 'InvoiceTemplateCustomizer';
    case 'profile':
    case 'business-profile':
      return 'BusinessProfile';
    case 'settings':
      return 'Settings';
    case 'more':
      return 'MoreTab';
    case 'dashboard':
    case '':
    default:
      return 'DashboardTab';
  }
}

function CentralOrderBottomBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const { setTabSwitcher } = useTour();
  const currentRoute = state.routes[state.index]?.name;
  const isTabActive = (tabName: string) => currentRoute === tabName;

  useEffect(() => {
    setTabSwitcher((tabName: string) => {
      navigation.navigate(tabName as any);
    });
  }, [navigation, setTabSwitcher]);

  return (
    <View
      style={[
        styles.customTabBarContainer,
        { paddingBottom: Math.max(insets.bottom, 8) },
      ]}
    >
      {/* Tab 1: Home */}
      <Pressable
        style={styles.tabItem}
        onPress={() => navigation.navigate('DashboardTab')}
      >
        <Ionicons
          name={isTabActive('DashboardTab') ? 'home' : 'home-outline'}
          size={22}
          color={isTabActive('DashboardTab') ? colors.clayDeep : colors.inkSoft}
        />
        <Text
          style={[
            styles.tabItemLabel,
            isTabActive('DashboardTab') && styles.tabItemLabelActive,
          ]}
        >
          {t('nav.dashboard', 'Home')}
        </Text>
      </Pressable>

      {/* Tab 2: Orders */}
      <Pressable
        style={styles.tabItem}
        onPress={() => navigation.navigate('OrdersTab')}
      >
        <Ionicons
          name={isTabActive('OrdersTab') ? 'receipt' : 'receipt-outline'}
          size={22}
          color={isTabActive('OrdersTab') ? colors.clayDeep : colors.inkSoft}
        />
        <Text
          style={[
            styles.tabItemLabel,
            isTabActive('OrdersTab') && styles.tabItemLabelActive,
          ]}
        >
          {t('nav.orders', 'Orders')}
        </Text>
      </Pressable>

      {/* Tab 3: Central "New Order" Elevated Action Button */}
      <TourTarget targetKey="new-order-fab">
        <Pressable
          style={({ pressed }) => [
            styles.centralActionWrap,
            pressed && styles.centralActionWrapPressed,
          ]}
          onPress={async () => {
            const allowed = await assertSubscriptionLimit({
              type: 'order',
              actionName: 'create a new order',
              navigation,
            });
            if (!allowed) return;
            (navigation as any).navigate('OrderForm');
          }}
        >
          <View style={styles.centralFabCircle}>
            <Ionicons name="add" size={26} color={colors.white} />
          </View>
          <Text style={styles.centralFabLabel}>New Order</Text>
        </Pressable>
      </TourTarget>

      {/* Tab 4: Expenses */}
      <Pressable
        style={styles.tabItem}
        onPress={() => navigation.navigate('ExpensesTab')}
      >
        <Ionicons
          name={isTabActive('ExpensesTab') ? 'wallet' : 'wallet-outline'}
          size={22}
          color={isTabActive('ExpensesTab') ? colors.clayDeep : colors.inkSoft}
        />
        <Text
          style={[
            styles.tabItemLabel,
            isTabActive('ExpensesTab') && styles.tabItemLabelActive,
          ]}
        >
          {t('nav.expenses', 'Expenses')}
        </Text>
      </Pressable>

      {/* Tab 5: More */}
      <TourTarget targetKey="more-menu-hub">
        <Pressable
          style={styles.tabItem}
          onPress={() => navigation.navigate('MoreTab')}
        >
          <Ionicons
            name={isTabActive('MoreTab') ? 'grid' : 'grid-outline'}
            size={22}
            color={isTabActive('MoreTab') ? colors.clayDeep : colors.inkSoft}
          />
          <Text
            style={[
              styles.tabItemLabel,
              isTabActive('MoreTab') && styles.tabItemLabelActive,
            ]}
          >
            {t('nav.more', 'More')}
          </Text>
        </Pressable>
      </TourTarget>
    </View>
  );
}

export default function TabNavigator() {
  const { t } = useLanguage();
  const { width } = useWindowDimensions();
  const { setTabSwitcher, startTour } = useTour();
  const isDesktop = Platform.OS === 'web' && width >= 768;

  const getInitialTab = (): string => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const fromPath = getTabFromPath(window.location.pathname);
      if (fromPath) return fromPath;
      try {
        const saved = sessionStorage.getItem('order_book:active_desktop_tab');
        if (saved) return saved;
      } catch {}
    }
    return 'DashboardTab';
  };

  const initial = getInitialTab();
  const [activeTab, setActiveTab] = useState<string>(initial);
  const [visitedTabs, setVisitedTabs] = useState<Record<string, boolean>>({ [initial]: true, DashboardTab: true });

  const handleSelectTab = (tab: string) => {
    if (!tab) return;
    setActiveTab(tab);
    setVisitedTabs((prev) => (prev[tab] ? prev : { ...prev, [tab]: true }));
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        sessionStorage.setItem('order_book:active_desktop_tab', tab);
        const targetUrl = TAB_URL_MAP[tab] || '/';
        if (window.location.pathname !== targetUrl) {
          window.history.replaceState(null, '', targetUrl);
        }
      } catch {}
    }
  };

  // Sync tab with browser back/forward buttons
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const handlePopState = () => {
        const tab = getTabFromPath(window.location.pathname);
        if (tab && tab !== activeTab) {
          setActiveTab(tab);
          setVisitedTabs((prev) => (prev[tab] ? prev : { ...prev, [tab]: true }));
        }
      };
      window.addEventListener('popstate', handlePopState);
      return () => window.removeEventListener('popstate', handlePopState);
    }
  }, [activeTab]);

  // Register desktop tab switcher
  useEffect(() => {
    if (isDesktop) {
      setTabSwitcher((tabName: string) => {
        handleSelectTab(tabName);
      });
    }
  }, [isDesktop, setTabSwitcher]);

  // First-time visitor check for interactive onboarding tour
  useEffect(() => {
    hasCompletedTour().then((completed) => {
      if (!completed) {
        const timer = setTimeout(() => {
          startTour(0);
        }, 800);
        return () => clearTimeout(timer);
      }
    });
  }, [startTour]);

  if (isDesktop) {
    return (
      <View style={{ flex: 1 }}>
        <DesktopSidebarContext.Provider value={true}>
          <View style={styles.desktopLayout}>
            <SaaSSidebar
              currentTabName={activeTab}
              onSelectTab={handleSelectTab}
            />
            <View style={styles.desktopMainContent}>
              {visitedTabs['DashboardTab'] && (
                <View style={[styles.tabContentContainer, activeTab !== 'DashboardTab' && styles.tabHidden]}>
                  <DashboardScreen />
                </View>
              )}
              {visitedTabs['OrdersTab'] && (
                <View style={[styles.tabContentContainer, activeTab !== 'OrdersTab' && styles.tabHidden]}>
                  <OrderListScreen />
                </View>
              )}
              {visitedTabs['ExpensesTab'] && (
                <View style={[styles.tabContentContainer, activeTab !== 'ExpensesTab' && styles.tabHidden]}>
                  <ExpensesScreen />
                </View>
              )}
              {visitedTabs['ReportsTab'] && (
                <View style={[styles.tabContentContainer, activeTab !== 'ReportsTab' && styles.tabHidden]}>
                  <ReportsScreen />
                </View>
              )}
              {visitedTabs['CustomerList'] && (
                <View style={[styles.tabContentContainer, activeTab !== 'CustomerList' && styles.tabHidden]}>
                  <CustomerListScreen />
                </View>
              )}
              {visitedTabs['ProductList'] && (
                <View style={[styles.tabContentContainer, activeTab !== 'ProductList' && styles.tabHidden]}>
                  <ProductListScreen />
                </View>
              )}
              {visitedTabs['PurchaseList'] && (
                <View style={[styles.tabContentContainer, activeTab !== 'PurchaseList' && styles.tabHidden]}>
                  <PurchaseListScreen />
                </View>
              )}
              {visitedTabs['EstimateList'] && (
                <View style={[styles.tabContentContainer, activeTab !== 'EstimateList' && styles.tabHidden]}>
                  <EstimateListScreen />
                </View>
              )}
              {visitedTabs['History'] && (
                <View style={[styles.tabContentContainer, activeTab !== 'History' && styles.tabHidden]}>
                  <HistoryScreen />
                </View>
              )}
              {visitedTabs['Settings'] && (
                <View style={[styles.tabContentContainer, activeTab !== 'Settings' && styles.tabHidden]}>
                  <SettingsScreen />
                </View>
              )}
              {visitedTabs['InvoiceTemplateCustomizer'] && (
                <View style={[styles.tabContentContainer, activeTab !== 'InvoiceTemplateCustomizer' && styles.tabHidden]}>
                  <InvoiceTemplateCustomizerScreen />
                </View>
              )}
              {visitedTabs['BusinessProfile'] && (
                <View style={[styles.tabContentContainer, activeTab !== 'BusinessProfile' && styles.tabHidden]}>
                  <BusinessProfileScreen />
                </View>
              )}
              {visitedTabs['MoreTab'] && (
                <View style={[styles.tabContentContainer, activeTab !== 'MoreTab' && styles.tabHidden]}>
                  <MoreScreen />
                </View>
              )}
            </View>
          </View>
        </DesktopSidebarContext.Provider>
        <AppTourOverlay />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <Tab.Navigator
        tabBar={(props) => <CentralOrderBottomBar {...props} />}
        screenOptions={{
          headerShown: false,
        }}
      >
        <Tab.Screen
          name="DashboardTab"
          component={DashboardScreen}
        />
        <Tab.Screen
          name="OrdersTab"
          component={OrderListScreen}
        />
        <Tab.Screen
          name="ExpensesTab"
          component={ExpensesScreen}
        />
        <Tab.Screen
          name="ReportsTab"
          component={ReportsScreen}
        />
        <Tab.Screen
          name="MoreTab"
          component={MoreScreen}
        />
      </Tab.Navigator>
      <AppTourOverlay />
    </View>
  );
}

const styles = StyleSheet.create({
  desktopLayout: {
    flex: 1,
    flexDirection: 'row',
    width: '100%',
    height: '100%',
    backgroundColor: colors.paper,
  },
  desktopMainContent: {
    flex: 1,
    height: '100%',
    backgroundColor: colors.paper,
    position: 'relative',
  },
  tabContentContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  tabHidden: {
    display: 'none',
  },

  // ─── Custom Mobile Bottom Bar with Central New Order Button ───
  customTabBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: colors.paperCard,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: 6,
    paddingHorizontal: 8,
    ...shadow.card,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    gap: 2,
  },
  tabItemLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 10,
    color: colors.inkSoft,
  },
  tabItemLabelActive: {
    color: colors.clayDeep,
    fontFamily: fonts.bodyBold,
  },
  centralActionWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    marginTop: -16,
    gap: 2,
  },
  centralActionWrapPressed: {
    transform: [{ scale: 0.94 }],
    opacity: 0.9,
  },
  centralFabCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.clayDeep,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: colors.clayDeep,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    borderWidth: 3,
    borderColor: colors.paperCard,
  },
  centralFabLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    color: colors.clayDeep,
    letterSpacing: 0.2,
  },
});
