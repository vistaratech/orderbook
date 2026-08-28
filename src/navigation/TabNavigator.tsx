import React, { useState } from 'react';
import { StyleSheet, Platform, View, useWindowDimensions } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import { MainTabParamList } from './types';
import DashboardScreen from '../screens/DashboardScreen';
import OrderListScreen from '../screens/OrderListScreen';
import ExpensesScreen from '../screens/ExpensesScreen';
import ReportsScreen from '../screens/ReportsScreen';
import MoreScreen from '../screens/MoreScreen';
import SaaSSidebar from '../components/SaaSSidebar';
import { colors, fonts } from '../theme/theme';

const Tab = createBottomTabNavigator<MainTabParamList>();

export default function TabNavigator() {
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= 768;
  const [activeTab, setActiveTab] = useState<string>('DashboardTab');

  if (isDesktop) {
    return (
      <View style={styles.desktopLayout}>
        <SaaSSidebar
          currentTabName={activeTab}
          onSelectTab={(tab) => {
            if (tab) setActiveTab(tab);
          }}
        />
        <View style={styles.desktopMainContent}>
          {activeTab === 'DashboardTab' && <DashboardScreen />}
          {activeTab === 'OrdersTab' && <OrderListScreen />}
          {activeTab === 'ExpensesTab' && <ExpensesScreen />}
          {activeTab === 'ReportsTab' && <ReportsScreen />}
          {activeTab === 'MoreTab' && <MoreScreen />}
        </View>
      </View>
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
          tabBarLabel: 'Dashboard',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="OrdersTab"
        component={OrderListScreen}
        options={{
          tabBarLabel: 'Orders',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'receipt' : 'receipt-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="ExpensesTab"
        component={ExpensesScreen}
        options={{
          tabBarLabel: 'Outflow',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'wallet' : 'wallet-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="ReportsTab"
        component={ReportsScreen}
        options={{
          tabBarLabel: 'Reports',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'bar-chart' : 'bar-chart-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="MoreTab"
        component={MoreScreen}
        options={{
          tabBarLabel: 'More',
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
