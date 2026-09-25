import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, statusColor } from '../theme/theme';
import { ORDER_STATUS_STEPS, OrderStatus } from '../types/order';
import { useLanguage } from '../i18n/LanguageContext';

interface Props {
  status: OrderStatus;
  onChange?: (status: OrderStatus) => void;
}

const statusIcons: Record<OrderStatus, string> = {
  Placed: 'receipt-outline',
  Packed: 'cube-outline',
  Dispatched: 'paper-plane-outline',
  Delivered: 'checkmark-done-circle-outline',
};

export default function StatusTracker({ status, onChange }: Props) {
  const { t } = useLanguage();
  const currentIndex = ORDER_STATUS_STEPS.indexOf(status);

  const getStepLabel = (step: OrderStatus) => {
    switch (step) {
      case 'Placed':
        return t('orders.statusPlaced');
      case 'Packed':
        return t('orders.statusPacked');
      case 'Dispatched':
        return t('orders.statusDispatched');
      case 'Delivered':
        return t('orders.statusDelivered');
      default:
        return step;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        {ORDER_STATUS_STEPS.map((step, i) => {
          const isCurrent = i === currentIndex;
          const reached = i <= currentIndex;
          const color = statusColor[step];
          const Wrapper = onChange ? Pressable : View;

          return (
            <React.Fragment key={step}>
              {i > 0 && (
                <View
                  style={[
                    styles.connector,
                    { backgroundColor: reached ? color : colors.line },
                  ]}
                />
              )}
              <Wrapper
                style={styles.stepWrap}
                onPress={onChange ? () => onChange(step) : undefined}
              >
                <View
                  style={[
                    styles.badge,
                    {
                      borderColor: color,
                      backgroundColor: reached ? color : colors.paperCard,
                    },
                    isCurrent && styles.activeBadge,
                  ]}
                >
                  <Ionicons
                    name={statusIcons[step] as any}
                    size={14}
                    color={reached ? colors.white : colors.inkSoft}
                  />
                </View>
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  style={[
                    styles.label,
                    { color: reached ? colors.ink : colors.inkSoft },
                    isCurrent && styles.activeLabel,
                  ]}
                >
                  {getStepLabel(step)}
                </Text>
              </Wrapper>
            </React.Fragment>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepWrap: {
    alignItems: 'center',
    flex: 1,
    paddingHorizontal: 2,
  },
  badge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeBadge: {
    transform: [{ scale: 1.1 }],
  },
  connector: {
    flex: 1,
    height: 2,
    borderRadius: 1,
    marginHorizontal: -4,
    marginBottom: 16,
  },
  label: {
    marginTop: 4,
    fontFamily: fonts.bodyMedium,
    fontSize: 9.5,
    lineHeight: 12,
    textAlign: 'center',
  },
  activeLabel: {
    fontFamily: fonts.bodyBold,
    color: colors.clayDeep,
  },
});
