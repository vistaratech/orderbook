import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from '../theme/theme';

interface Props {
  icon?: keyof typeof Ionicons.glyphMap;
  title?: string;
  message?: string;
}

export default function EmptyState({
  icon = 'receipt-outline',
  title = 'No orders yet',
  message = 'Tap the + button below to write your first order, just like a fresh page in the book.',
}: Props) {
  return (
    <View style={styles.wrap}>
      <Ionicons name={icon} size={48} color={colors.line} style={styles.icon} />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 60,
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  icon: {
    marginBottom: 12,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 28,
    color: colors.ink,
    marginBottom: 8,
    textAlign: 'center',
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.inkSoft,
    textAlign: 'center',
    lineHeight: 20,
  },
});
