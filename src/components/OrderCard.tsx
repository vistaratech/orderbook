import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Order, orderTotal, orderBalance } from '../types/order';
import { colors, fonts, radius, shadow, statusColor } from '../theme/theme';
import { formatCurrency, formatDate } from '../utils/format';
import { useLanguage } from '../i18n/LanguageContext';

interface Props {
  order: Order;
  onPress: () => void;
}

export default function OrderCard({ order, onPress }: Props) {
  const { t } = useLanguage();
  const total = orderTotal(order);
  const balance = orderBalance(order);
  const itemCount = order.items.reduce((sum, i) => sum + i.qty, 0);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        pressed && styles.pressed,
      ]}
      onPress={onPress}
    >
      {/* Top Status Accent Bar */}
      <View
        style={[
          styles.accentDot,
          { backgroundColor: statusColor[order.status] || colors.clay },
        ]}
      />

      <View style={styles.cardInner}>
        <View style={styles.topRow}>
          <View style={styles.orderNoRow}>
            <Text style={styles.orderNumber}>{order.orderNumber}</Text>
          </View>

          <View style={styles.topRightActions}>
            <View style={[styles.badge, { backgroundColor: statusColor[order.status] || colors.clay }]}>
              <Text style={styles.badgeText}>
                {t('status.' + order.status.toLowerCase(), order.status)}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.middleRow}>
          <View style={styles.customerInfo}>
            <Text style={styles.customer}>{order.customerName || t('orders.customerName')}</Text>
            <Text style={styles.metaText}>
              {formatDate(order.orderDate)} • {itemCount} {itemCount === 1 ? t('common.item') : t('common.items')}
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.bottomRow}>
          <View>
            <Text style={styles.totalLabel}>{t('orders.totalAmount')}</Text>
            <Text style={styles.total}>{formatCurrency(total)}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.totalLabel}>{t('orders.paymentStatus')}</Text>
            <Text style={[styles.balance, balance > 0 ? styles.balanceDue : styles.balancePaid]}>
              {balance > 0 ? `${t('common.due')} ${formatCurrency(balance)}` : `${t('common.paid')} ✓`}
            </Text>
          </View>
        </View>
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
    marginBottom: 12,
    overflow: 'hidden',
    flexDirection: 'row',
    ...shadow.card,
  },
  accentDot: {
    width: 5,
  },
  cardInner: {
    flex: 1,
    padding: 14,
  },
  pinnedCard: {
    backgroundColor: '#FFFDF6',
    borderColor: colors.clayDeep,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
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
    paddingRight: 8,
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
    padding: 5,
    borderRadius: radius.sm,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
  },
  badge: {
    borderRadius: 12,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  badgeText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    color: colors.white,
  },
  middleRow: {
    marginTop: 6,
  },
  customerInfo: {
    gap: 1,
  },
  customer: {
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    color: colors.ink,
  },
  metaText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.inkSoft,
  },
  divider: {
    height: 0,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    borderStyle: 'dashed' as any,
    marginVertical: 10,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.inkSoft,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 1,
  },
  total: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    color: colors.ink,
  },
  balance: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
  },
  balancePaid: {
    color: colors.success,
  },
  balanceDue: {
    color: colors.danger,
  },
});
