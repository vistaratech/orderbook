import React, { useEffect, useRef } from 'react';
import { Animated, ViewStyle, StyleProp } from 'react-native';

interface FadeInViewProps {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  translateY?: number;
  scale?: boolean;
  style?: StyleProp<ViewStyle>;
}

export default function FadeInView({
  children,
  delay = 0,
  duration = 400,
  translateY = 16,
  scale = false,
  style,
}: FadeInViewProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const transY = useRef(new Animated.Value(translateY)).current;
  const scaleVal = useRef(new Animated.Value(scale ? 0.95 : 1)).current;

  useEffect(() => {
    const animation = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(transY, {
        toValue: 0,
        duration,
        delay,
        useNativeDriver: true,
      }),
      ...(scale
        ? [
            Animated.spring(scaleVal, {
              toValue: 1,
              friction: 8,
              tension: 40,
              delay,
              useNativeDriver: true,
            }),
          ]
        : []),
    ]);

    animation.start();
    return () => animation.stop();
  }, [delay, duration, opacity, scale, scaleVal, transY]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity,
          transform: [
            { translateY: transY },
            ...(scale ? [{ scale: scaleVal }] : []),
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
