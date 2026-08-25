import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Order, orderTotal, orderBalance } from '../types/order';
import { colors, fonts, radius, shadow, statusColor } from '../theme/theme';
import { formatCurrency, formatDate } from '../utils/format';

interface Props {
  order: Order;
  onPress: () => void;
}

export default function OrderCard({ order, onPress }: Props) {
  const total = orderTotal(order);
  const balance = orderBalance(order);

  return (
    <Pressable style={({ pressed }) => [styles.card, pressed && styles.pressed]} onPress={onPress}>
      <View style={styles.topRow}>
        <Text style={styles.orderNumber}>{order.orderNumber}</Text>
        <View style={[styles.badge, { backgroundColor: statusColor[order.status] }]}>
          <Text style={styles.badgeText}>{order.status}</Text>
        </View>
      </View>

      <Text style={styles.customer}>{order.customerName || 'Unnamed customer'}</Text>
      <Text style={styles.date}>{formatDate(order.orderDate)}</Text>

      <View style={styles.divider} />

      <View style={styles.bottomRow}>
        <Text style={styles.total}>{formatCurrency(total)}</Text>
        <Text style={[styles.balance, balance > 0 && styles.balanceDue]}>
          {balance > 0 ? `Balance ${formatCurrency(balance)}` : 'Paid in full'}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.paperCard,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 14,
    marginBottom: 12,
    ...shadow.card,
  },
  pressed: {
    opacity: 0.85,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderNumber: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.clayDeep,
  },
  badge: {
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    color: colors.white,
  },
  customer: {
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
    color: colors.ink,
    marginTop: 4,
  },
  date: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.inkSoft,
    marginTop: 2,
  },
  divider: {
    height: 0,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    borderStyle: 'dashed',
    marginVertical: 10,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  total: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    color: colors.ink,
  },
  balance: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.statusDelivered,
  },
  balanceDue: {
    color: colors.danger,
  },
});
