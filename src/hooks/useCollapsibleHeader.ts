import { useRef, useCallback, useState } from 'react';
import {
  Animated,
  Easing,
  Platform,
  NativeSyntheticEvent,
  NativeScrollEvent,
  LayoutChangeEvent,
} from 'react-native';

interface UseCollapsibleHeaderOptions {
  initialHeight?: number;
  threshold?: number;
}

/**
 * Hook for creating a modern, smooth collapsible header that disappears
 * with a slight animation when scrolling down, and reappears when scrolling back up.
 */
export function useCollapsibleHeader(options?: UseCollapsibleHeaderOptions) {
  const initialHeight = options?.initialHeight ?? 75;
  const threshold = options?.threshold ?? 10;

  const [measuredHeight, setMeasuredHeight] = useState(initialHeight);
  const heightRef = useRef(initialHeight);
  const scrollY = useRef(0);
  const isHidden = useRef(false);
  const animValue = useRef(new Animated.Value(0)).current; // 0 = visible, 1 = hidden

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const currentY = event.nativeEvent.contentOffset.y;
      const diff = currentY - scrollY.current;

      // Always restore header when user is at the top of the page
      if (currentY <= 15) {
        if (isHidden.current) {
          isHidden.current = false;
          Animated.timing(animValue, {
            toValue: 0,
            duration: 200,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: Platform.OS !== 'web',
          }).start();
        }
      } else if (diff > threshold && currentY > 35 && !isHidden.current) {
        // Scrolling down -> hide header with slight smooth animation
        isHidden.current = true;
        Animated.timing(animValue, {
          toValue: 1,
          duration: 230,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: Platform.OS !== 'web',
        }).start();
      } else if (diff < -8 && isHidden.current) {
        // Scrolling back up -> reveal header with slight smooth animation
        isHidden.current = false;
        Animated.timing(animValue, {
          toValue: 0,
          duration: 200,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: Platform.OS !== 'web',
        }).start();
      }

      scrollY.current = currentY;
    },
    [animValue, threshold]
  );

  const onHeaderLayout = useCallback((e: LayoutChangeEvent) => {
    const h = Math.round(e.nativeEvent.layout.height);
    if (h > 0 && Math.abs(h - heightRef.current) > 2) {
      heightRef.current = h;
      setMeasuredHeight(h);
    }
  }, []);

  const translateY = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -measuredHeight],
  });

  const opacity = animValue.interpolate({
    inputRange: [0, 0.7, 1],
    outputRange: [1, 0.35, 0],
  });

  return {
    onScroll,
    scrollEventThrottle: 16,
    headerAnimatedStyle: {
      transform: [{ translateY }],
      opacity,
    },
    onHeaderLayout,
    headerHeight: measuredHeight,
    isHeaderHidden: isHidden.current,
  };
}

export default useCollapsibleHeader;
