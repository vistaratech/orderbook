import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, ViewStyle, StyleProp } from 'react-native';
import { radius } from '../theme/theme';

interface AnimatedProgressBarProps {
  progress: number; // 0 to 1
  color?: string;
  trackColor?: string;
  height?: number;
  duration?: number;
  style?: StyleProp<ViewStyle>;
}

export default function AnimatedProgressBar({
  progress,
  color = '#4E8A54',
  trackColor = '#E5E7EB',
  height = 8,
  duration = 800,
  style,
}: AnimatedProgressBarProps) {
  const animatedWidth = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animatedWidth, {
      toValue: Math.min(Math.max(progress, 0), 1),
      duration,
      useNativeDriver: false,
    }).start();
  }, [animatedWidth, duration, progress]);

  const widthInterpolation = animatedWidth.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={[styles.track, { height, backgroundColor: trackColor }, style]}>
      <Animated.View
        style={[
          styles.fill,
          {
            height,
            backgroundColor: color,
            width: widthInterpolation,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: '100%',
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  fill: {
    borderRadius: radius.pill,
  },
});
