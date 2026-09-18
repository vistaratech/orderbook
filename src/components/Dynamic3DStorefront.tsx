import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Easing,
  Platform,
  Image,
} from 'react-native';
import Svg, {
  Defs,
  LinearGradient,
  RadialGradient,
  Stop,
  Path,
  G,
} from 'react-native-svg';

const openBaseImg = require('../../assets/storefront-clean-open.png');
const doorImg = require('../../assets/storefront-door.png');

interface Props {
  height?: number;
  autoPlay?: boolean;
}

/**
 * Dynamic 3D Storefront Model
 * 
 * - Seamlessly integrated full-bleed 3D storefront matching reference design
 * - 3D wooden entrance door that swings open and closed on its hinge in 3D perspective
 * - Warm illuminated boutique shop interior revealed upon opening
 * - Warm golden light beam spill that pours out across the floor
 * - Authentic "OPEN" sign naturally swings with the door in 3D
 * - Floating golden sparkle motes when open
 * - Auto welcome loop + interactive click & hover controls
 */
export default function Dynamic3DStorefront({
  height = 360,
  autoPlay = true,
}: Props) {
  // ── 0 (closed) to 1 (wide open) ──
  const doorAnim = useRef(new Animated.Value(0)).current;
  const [isOpen, setIsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const isTransitioning = useRef(false);

  // ── Golden Light Spill Beam Pulse ──
  const lightPulse = useRef(new Animated.Value(0)).current;
  // ── Sparkle Motes Float ──
  const sparkleAnim = useRef(new Animated.Value(0)).current;

  // 1. Light Pulse when door is open
  useEffect(() => {
    const lightLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(lightPulse, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(lightPulse, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    lightLoop.start();
    return () => lightLoop.stop();
  }, [lightPulse]);

  // 2. Sparkle Floating Loop
  useEffect(() => {
    const sparkleLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(sparkleAnim, {
          toValue: 1,
          duration: 2400,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(sparkleAnim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );
    sparkleLoop.start();
    return () => sparkleLoop.stop();
  }, [sparkleAnim]);

  // 3. Open/Close Animation Controller
  const animateToState = (open: boolean, onDone?: () => void) => {
    isTransitioning.current = true;
    Animated.timing(doorAnim, {
      toValue: open ? 1 : 0,
      duration: open ? 1100 : 900,
      easing: open ? Easing.out(Easing.cubic) : Easing.inOut(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    }).start(() => {
      setIsOpen(open);
      isTransitioning.current = false;
      onDone?.();
    });
  };

  // Toggle open / close on user press
  const handleToggleDoor = () => {
    if (isTransitioning.current) return;
    animateToState(!isOpen);
  };

  // 4. Automatic Welcome Loop (Boutique Shop Cadence)
  useEffect(() => {
    if (!autoPlay) return;

    let timeoutId: any;
    let isSubscribed = true;

    const runAutoCycle = () => {
      // Stay closed for 3.5 seconds
      timeoutId = setTimeout(() => {
        if (!isSubscribed) return;
        animateToState(true, () => {
          // Stay wide open with golden light for 4.5 seconds
          timeoutId = setTimeout(() => {
            if (!isSubscribed) return;
            animateToState(false, () => {
              if (isSubscribed) runAutoCycle();
            });
          }, 4500);
        });
      }, 3500);
    };

    runAutoCycle();

    return () => {
      isSubscribed = false;
      clearTimeout(timeoutId);
    };
  }, [autoPlay]);

  // ── Interpolations ──
  // Door 3D rotateY: 0deg (closed) to 68deg (open inward)
  const doorRotateY = doorAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '68deg'],
  });

  // Door shadow / darkness inside as it swings in
  const doorInnerShadow = doorAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.88],
  });

  // Floor light beam glow opacity (expands as door opens)
  const floorLightOpacity = doorAnim.interpolate({
    inputRange: [0.15, 0.6, 1],
    outputRange: [0, 0.5, 0.85],
    extrapolate: 'clamp',
  });

  // Sparkle floating transforms
  const sparkleTranslateY = sparkleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -28],
  });
  const sparkleOpacity = sparkleAnim.interpolate({
    inputRange: [0, 0.3, 0.8, 1],
    outputRange: [0, 1, 0.8, 0],
  });

  return (
    <View style={[styles.container, { height }]}>
      <Pressable
        onPress={handleToggleDoor}
        onHoverIn={() => setIsHovered(true)}
        onHoverOut={() => setIsHovered(false)}
        style={styles.pressableArea}
        accessibilityRole="button"
        accessibilityLabel={isOpen ? 'Click to close shop door' : 'Click to open shop door'}
      >
        {/* Aspect Ratio Container for 490x277 scene */}
        <View style={styles.sceneContainer}>
          {/* ── Base Storefront Image with Open Interior ── */}
          <Image
            source={openBaseImg}
            style={styles.baseImage}
            resizeMode="cover"
          />

          {/* ── Dynamic Warm Light Spill Beam onto Ground ── */}
          <Animated.View
            style={[
              styles.lightBeamOverlay,
              { opacity: floorLightOpacity },
            ]}
            pointerEvents="none"
          >
            <Svg width="100%" height="100%" viewBox="0 0 490 277">
              <Defs>
                <RadialGradient id="doorFloorLight" cx="37%" cy="80%" r="35%">
                  <Stop offset="0%" stopColor="#FFF4B8" stopOpacity="0.85" />
                  <Stop offset="35%" stopColor="#FFD54F" stopOpacity="0.65" />
                  <Stop offset="70%" stopColor="#FFA000" stopOpacity="0.25" />
                  <Stop offset="100%" stopColor="#FF8F00" stopOpacity="0" />
                </RadialGradient>
              </Defs>
              {/* Expanding light spill trapezoid extending out of doorway */}
              <Path
                d="M 153 232 L 201 232 L 260 277 L 130 277 Z"
                fill="url(#doorFloorLight)"
              />
            </Svg>
          </Animated.View>

          {/* ── 3D Animated Door Container ── */}
          {/*
            Exact doorway in 490x277:
            x = 153 (31.22%) to 201 (41.02%), width = 48 (9.80%)
            y = 142 (51.26%) to 232 (83.75%), height = 90 (32.49%)
            Hinge is on the RIGHT edge (door knob on left, swings inward to right)
          */}
          <View style={styles.doorwayFrame} pointerEvents="none">
            <Animated.View
              style={[
                styles.door3D,
                {
                  opacity: doorInnerShadow,
                  transform: [
                    { perspective: 800 },
                    { rotateY: doorRotateY },
                  ],
                },
              ]}
            >
              <Image
                source={doorImg}
                style={styles.doorImage}
                resizeMode="stretch"
              />
            </Animated.View>
          </View>

          {/* ── Floating Sparkle Motes (when door is open) ── */}
          <Animated.View
            style={[
              styles.sparklesWrap,
              {
                opacity: Animated.multiply(floorLightOpacity, sparkleOpacity),
                transform: [{ translateY: sparkleTranslateY }],
              },
            ]}
            pointerEvents="none"
          >
            <Svg width={40} height={35} viewBox="0 0 40 35">
              <G fill="#FFE082">
                <Path d="M 12 16 Q 12 12, 16 12 Q 12 12, 12 8 Q 12 12, 8 12 Q 12 12, 12 16 Z" />
                <Path d="M 28 10 Q 28 8, 30 8 Q 28 8, 28 6 Q 28 8, 26 8 Q 28 8, 28 10 Z" opacity={0.85} />
                <Path d="M 22 24 Q 22 22, 24 22 Q 22 22, 22 20 Q 22 22, 20 22 Q 22 22, 22 24 Z" opacity={0.7} />
              </G>
            </Svg>
          </Animated.View>

          {/* ── Soft Top Edge Blend into Panel ── */}
          <View style={styles.topEdgeBlend} pointerEvents="none">
            <Svg width="100%" height={32} viewBox="0 0 100 32" preserveAspectRatio="none">
              <Defs>
                <LinearGradient id="topFade" x1="0%" y1="0%" x2="0%" y2="100%">
                  <Stop offset="0%" stopColor="#F6F1E7" stopOpacity="1" />
                  <Stop offset="40%" stopColor="#F6F1E7" stopOpacity="0.7" />
                  <Stop offset="100%" stopColor="#F6F1E7" stopOpacity="0" />
                </LinearGradient>
              </Defs>
              <Path d="M 0 0 L 100 0 L 100 32 L 0 32 Z" fill="url(#topFade)" />
            </Svg>
          </View>

          {/* ── Interactive Hover Tooltip ── */}
          {isHovered ? (
            <View style={styles.hoverTooltip}>
              <Text style={styles.hoverTooltipText}>
                {isOpen ? '🚪 Click to close shop' : '✨ Click to open shop'}
              </Text>
            </View>
          ) : null}
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'flex-start',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  pressableArea: {
    width: '100%',
    height: '100%',
    justifyContent: 'flex-end',
    alignItems: 'flex-start',
    cursor: 'pointer' as any,
  },
  sceneContainer: {
    width: '100%',
    aspectRatio: 490 / 277,
    position: 'relative',
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  baseImage: {
    width: '100%',
    height: '100%',
  },

  // ── Light Spill ──
  lightBeamOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 2,
  },

  // ── Doorway Frame & 3D Door ──
  doorwayFrame: {
    position: 'absolute',
    left: '31.22%' as any,
    top: '51.26%' as any,
    width: '9.80%' as any,
    height: '32.49%' as any,
    zIndex: 3,
  },
  door3D: {
    width: '100%',
    height: '100%',
    transformOrigin: 'right center' as any,
    backfaceVisibility: 'hidden',
  },
  doorImage: {
    width: '100%',
    height: '100%',
  },

  // ── Sparkles ──
  sparklesWrap: {
    position: 'absolute',
    left: '32%' as any,
    top: '53%' as any,
    zIndex: 4,
  },

  // ── Top Gradient Blend ──
  topEdgeBlend: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 32,
    zIndex: 5,
  },

  // ── Interactive Hover Tooltip ──
  hoverTooltip: {
    position: 'absolute',
    top: 16,
    left: '25%' as any,
    backgroundColor: 'rgba(30, 27, 24, 0.88)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    zIndex: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 4,
  },
  hoverTooltipText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 11.5,
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
});
