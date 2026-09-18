import React, { useRef } from 'react';
import {
  Pressable,
  Animated,
  StyleSheet,
  ViewStyle,
  StyleProp,
  Platform,
  GestureResponderEvent,
} from 'react-native';
import { colors, radius, shadow } from '../theme/theme';

interface AnimatedCardProps {
  children: React.ReactNode;
  onPress?: (event: GestureResponderEvent) => void;
  style?: StyleProp<ViewStyle>;
  scaleOnPress?: boolean;
  activeOpacity?: number;
  glowOnHover?: boolean;
}

export default function AnimatedCard({
  children,
  onPress,
  style,
  scaleOnPress = true,
  activeOpacity = 0.94,
}: AnimatedCardProps) {
  const scaleVal = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    if (scaleOnPress) {
      Animated.spring(scaleVal, {
        toValue: 0.98,
        friction: 6,
        tension: 100,
        useNativeDriver: true,
      }).start();
    }
  };

  const handlePressOut = () => {
    if (scaleOnPress) {
      Animated.spring(scaleVal, {
        toValue: 1,
        friction: 6,
        tension: 100,
        useNativeDriver: true,
      }).start();
    }
  };

  if (!onPress) {
    return (
      <Animated.View
        style={[
          styles.card,
          style,
        ]}
      >
        {children}
      </Animated.View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={({ pressed }) => [
        pressed && { opacity: activeOpacity },
      ]}
    >
      <Animated.View
        style={[
          styles.card,
          { transform: [{ scale: scaleVal }] },
          style,
        ]}
      >
        {children}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.paperCard,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    ...shadow.card,
    ...(Platform.OS === 'web'
      ? ({
          cursor: 'pointer',
          transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s ease',
        } as any)
      : {}),
  },
});
