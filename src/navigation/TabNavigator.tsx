import React, { useState } from 'react';
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
import { colors, fonts, radius, shadow } from '../theme/theme';

const Tab = createBottomTabNavigator<MainTabParamList>();

function CentralOrderBottomBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const currentRoute = state.routes[state.index]?.name;
  const isTabActive = (tabName: string) => currentRoute === tabName;

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
      <Pressable
        style={({ pressed }) => [
          styles.centralActionWrap,
          pressed && styles.centralActionWrapPressed,
        ]}
        onPress={() => (navigation as any).navigate('OrderForm')}
      >
        <View style={styles.centralFabCircle}>
          <Ionicons name="add" size={26} color={colors.white} />
        </View>
        <Text style={styles.centralFabLabel}>New Order</Text>
      </Pressable>

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
    </View>
  );
}

export default function TabNavigator() {
  const { t } = useLanguage();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= 768;
  const [activeTab, setActiveTab] = useState<string>('DashboardTab');
  const [visitedTabs, setVisitedTabs] = useState<Record<string, boolean>>({ DashboardTab: true });

  const handleSelectTab = (tab: string) => {
    if (!tab) return;
    setActiveTab(tab);
    setVisitedTabs((prev) => (prev[tab] ? prev : { ...prev, [tab]: true }));
  };

  if (isDesktop) {
    return (
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
    );
  }

  return (
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
