import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Order, orderTotal, orderBalance } from '../types/order';
import { colors, fonts, radius, shadow, statusColor } from '../theme/theme';
import { formatCurrency, formatDate } from '../utils/format';

interface Props {
  order: Order;
  onPress: () => void;
  onTogglePin?: (orderId: string) => void;
}

export default function OrderCard({ order, onPress, onTogglePin }: Props) {
  const total = orderTotal(order);
  const balance = orderBalance(order);
  const isPinned = !!order.isPinned;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        isPinned && styles.pinnedCard,
        pressed && styles.pressed,
      ]}
      onPress={onPress}
    >
      <View style={styles.topRow}>
        <View style={styles.orderNoRow}>
          <Text style={styles.orderNumber}>{order.orderNumber}</Text>
          {isPinned && (
            <View style={styles.pinnedTag}>
              <Ionicons name="pin" size={10} color={colors.clayDeep} />
              <Text style={styles.pinnedTagText}>PINNED</Text>
            </View>
          )}
        </View>

        <View style={styles.topRightActions}>
          <View style={[styles.badge, { backgroundColor: statusColor[order.status] }]}>
            <Text style={styles.badgeText}>{order.status}</Text>
          </View>

          {onTogglePin && (
            <Pressable
              style={styles.pinBtn}
              hitSlop={10}
              onPress={(e) => {
                e.stopPropagation?.();
                onTogglePin(order.id);
              }}
            >
              <Ionicons
                name={isPinned ? 'pin' : 'pin-outline'}
                size={16}
                color={isPinned ? colors.clayDeep : colors.inkSoft}
              />
            </Pressable>
          )}
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
  pinnedCard: {
    backgroundColor: '#FFFDF6',
    borderColor: colors.clayDeep,
    borderLeftWidth: 4,
    borderLeftColor: colors.clayDeep,
  },
  pressed: {
    opacity: 0.85,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderNoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  orderNumber: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.clayDeep,
  },
  pinnedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.clayLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  pinnedTagText: {
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    color: colors.clayDeep,
    letterSpacing: 0.5,
  },
  topRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pinBtn: {
    padding: 4,
    borderRadius: radius.sm,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
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
