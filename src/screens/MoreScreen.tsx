import React from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { RootStackParamList } from '../navigation/types';
import AppLogo from '../components/AppLogo';
import { colors, fonts, radius, shadow } from '../theme/theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function MoreScreen() {
  const navigation = useNavigation<Nav>();

  const menuItems = [
    {
      title: 'Customer Directory',
      subtitle: 'Manage client directory, phone numbers & history',
      icon: 'people-outline' as const,
      color: colors.clayDeep,
      action: () => navigation.navigate('CustomerList'),
    },
    {
      title: 'Product Catalog',
      subtitle: 'Saved items, units, and default selling prices',
      icon: 'pricetags-outline' as const,
      color: colors.duskDeep,
      action: () => navigation.navigate('ProductList'),
    },
    {
      title: 'Business & Backup Settings',
      subtitle: 'Profile, JSON export, restore & data management',
      icon: 'settings-outline' as const,
      color: colors.statusPlaced,
      action: () => navigation.navigate('Settings'),
    },
  ];

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <AppLogo size={42} variant="icon" />
            <View>
              <Text style={styles.title}>More Tools</Text>
              <Text style={styles.subtitle}>Business management & data administration</Text>
            </View>
          </View>
        </View>

        <View style={styles.menuList}>
          {menuItems.map((item) => (
            <Pressable key={item.title} style={styles.menuCard} onPress={item.action}>
              <View style={[styles.iconBox, { backgroundColor: item.color + '20' }]}>
                <Ionicons name={item.icon} size={24} color={item.color} />
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
            <Text style={styles.infoTitle}>About Order Book & Outflow</Text>
          </View>
          <Text style={styles.infoText}>
            All order data, outflow records, customer profiles, and catalog entries are stored on your device and synced to the cloud when signed in. Use the Backup tool in Settings to export a copy of your records.
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
  content: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  header: {
    paddingVertical: 12,
    marginBottom: 8,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 36,
    color: colors.ink,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.inkSoft,
    marginTop: -4,
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
    width: 46,
    height: 46,
    borderRadius: 23,
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
  },
  infoTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.ink,
    marginBottom: 4,
  },
  infoText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.inkSoft,
    lineHeight: 18,
  },
});
