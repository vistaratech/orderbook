import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, ViewStyle, StyleProp } from 'react-native';
import { fonts, radius } from '../theme/theme';

interface LivePulseBadgeProps {
  label?: string;
  color?: string;
  dotColor?: string;
  bgColor?: string;
  borderColor?: string;
  style?: StyleProp<ViewStyle>;
}

export default function LivePulseBadge({
  label = 'Live Sync Active',
  color = '#15803D',
  dotColor = '#16A34A',
  bgColor = '#DCFCE7',
  borderColor = '#86EFAC',
  style,
}: LivePulseBadgeProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(pulseAnim, {
            toValue: 2.2,
            duration: 1200,
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 0,
            duration: 1200,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 0,
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 0.6,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      ])
    );

    pulseLoop.start();
    return () => pulseLoop.stop();
  }, [opacityAnim, pulseAnim]);

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: bgColor, borderColor },
        style,
      ]}
    >
      <View style={styles.dotContainer}>
        <Animated.View
          style={[
            styles.pulseRing,
            {
              backgroundColor: dotColor,
              opacity: opacityAnim,
              transform: [{ scale: pulseAnim }],
            },
          ]}
        />
        <View style={[styles.solidDot, { backgroundColor: dotColor }]} />
      </View>
      <Text style={[styles.label, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    gap: 6,
  },
  dotContainer: {
    width: 8,
    height: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  solidDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  pulseRing: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  label: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    letterSpacing: 0.2,
  },
});
