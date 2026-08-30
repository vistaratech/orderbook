import React, { useState } from 'react';
import { StyleSheet, Platform, View, useWindowDimensions } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import { MainTabParamList } from './types';
import DashboardScreen from '../screens/DashboardScreen';
import OrderListScreen from '../screens/OrderListScreen';
import ExpensesScreen from '../screens/ExpensesScreen';
import ReportsScreen from '../screens/ReportsScreen';
import CustomerListScreen from '../screens/CustomerListScreen';
import ProductListScreen from '../screens/ProductListScreen';
import HistoryScreen from '../screens/HistoryScreen';
import SettingsScreen from '../screens/SettingsScreen';
import MoreScreen from '../screens/MoreScreen';
import SaaSSidebar from '../components/SaaSSidebar';
import { DesktopSidebarContext } from '../components/DesktopLayout';
import { useLanguage } from '../i18n/LanguageContext';
import { colors, fonts } from '../theme/theme';

const Tab = createBottomTabNavigator<MainTabParamList>();

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
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: colors.clayDeep,
        tabBarInactiveTintColor: colors.inkSoft,
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <Tab.Screen
        name="DashboardTab"
        component={DashboardScreen}
        options={{
          tabBarLabel: t('nav.dashboard'),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="OrdersTab"
        component={OrderListScreen}
        options={{
          tabBarLabel: t('nav.orders'),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'receipt' : 'receipt-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="ExpensesTab"
        component={ExpensesScreen}
        options={{
          tabBarLabel: t('nav.expenses'),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'wallet' : 'wallet-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="ReportsTab"
        component={ReportsScreen}
        options={{
          tabBarLabel: t('nav.reports'),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'bar-chart' : 'bar-chart-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="MoreTab"
        component={MoreScreen}
        options={{
          tabBarLabel: t('nav.more'),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'grid' : 'grid-outline'} size={22} color={color} />
          ),
        }}
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
  tabBar: {
    backgroundColor: colors.paperCard,
    borderTopColor: colors.line,
    borderTopWidth: 1,
    height: Platform.select({ ios: 86, web: 56, default: 64 }),
    paddingBottom: Platform.select({ ios: 28, web: 6, default: 10 }),
    paddingTop: 8,
  },
  tabLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
  },
});
