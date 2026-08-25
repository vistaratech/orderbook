import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, fonts, statusColor } from '../theme/theme';
import { ORDER_STATUS_STEPS, OrderStatus } from '../types/order';

interface Props {
  status: OrderStatus;
  onChange?: (status: OrderStatus) => void;
}

export default function StatusTracker({ status, onChange }: Props) {
  const currentIndex = ORDER_STATUS_STEPS.indexOf(status);

  return (
    <View style={styles.row}>
      {ORDER_STATUS_STEPS.map((step, i) => {
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
                  styles.stamp,
                  {
                    borderColor: color,
                    backgroundColor: reached ? color : 'transparent',
                  },
                ]}
              />
              <Text
                style={[
                  styles.label,
                  { color: reached ? colors.ink : colors.inkSoft },
                ]}
              >
                {step}
              </Text>
            </Wrapper>
          </React.Fragment>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  stepWrap: {
    alignItems: 'center',
    flex: 1,
  },
  stamp: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
  },
  connector: {
    flex: 1,
    height: 2,
    marginBottom: 18,
  },
  label: {
    marginTop: 6,
    fontFamily: fonts.body,
    fontSize: 11,
    textAlign: 'center',
  },
});
