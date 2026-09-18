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
  Text as SvgText,
  G,
} from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import AppLogo from './AppLogo';

const storefrontBase = require('../../assets/storefront-seamless-open.png');
const doorImg = require('../../assets/storefront-door-clean.png');

/**
 * Premium Desktop Left Panel with crisp native UI/UX typography & interactive cards,
 * seamlessly merged with the animated 3D storefront model at the bottom.
 */
export default function LoginDesktopLeftPanel() {
  // ── Door Animation State ──
  const doorAnim = useRef(new Animated.Value(0)).current;
  const [isOpen, setIsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const isTransitioning = useRef(false);

  // ── Light Spill Pulse & Sparkles ──
  const lightPulse = useRef(new Animated.Value(0)).current;
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

  // 2. Sparkle Float Loop
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

  // 3. Open/Close Controller
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

  const handleToggleDoor = () => {
    if (isTransitioning.current) return;
    animateToState(!isOpen);
  };

  // 4. Automatic Welcome Loop (Boutique Cadence)
  useEffect(() => {
    let timeoutId: any;
    let isSubscribed = true;

    const runAutoCycle = () => {
      timeoutId = setTimeout(() => {
        if (!isSubscribed) return;
        animateToState(true, () => {
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
  }, []);

  // ── Interpolations ──
  const doorRotateY = doorAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '68deg'],
  });

  const doorInnerShadow = doorAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.88],
  });

  const floorLightOpacity = doorAnim.interpolate({
    inputRange: [0.15, 0.6, 1],
    outputRange: [0, 0.5, 0.85],
    extrapolate: 'clamp',
  });

  const sparkleTranslateY = sparkleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -28],
  });
  const sparkleOpacity = sparkleAnim.interpolate({
    inputRange: [0, 0.3, 0.8, 1],
    outputRange: [0, 1, 0.8, 0],
  });

  return (
    <View style={styles.container}>
      {/* ── Vector Background Organic Curves ── */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg width="100%" height="100%" viewBox="0 0 500 900" preserveAspectRatio="none">
          <Defs>
            <LinearGradient id="bgTopCurve" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#EFE3D3" stopOpacity="0.6" />
              <Stop offset="100%" stopColor="#E6D7C2" stopOpacity="0.3" />
            </LinearGradient>
            <LinearGradient id="bgMidCurve" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#F2E6D7" stopOpacity="0.5" />
              <Stop offset="100%" stopColor="#E8D9C6" stopOpacity="0.25" />
            </LinearGradient>
          </Defs>
          <Path
            d="M 320 0 Q 500 60, 500 230 Q 480 400, 320 330 Q 220 290, 270 160 Q 300 80, 320 0 Z"
            fill="url(#bgTopCurve)"
          />
          <Path
            d="M 0 280 Q 90 230, 160 300 Q 210 360, 130 400 Q 40 420, 0 360 Z"
            fill="url(#bgMidCurve)"
          />
        </Svg>
      </View>

      {/* ── TOP SECTION: Crisp Native UI Content ── */}
      <View style={styles.topContentWrap}>
        {/* 1. Logo Row */}
        <View style={styles.logoRow}>
          <AppLogo size={46} variant="icon" />
          <View style={styles.logoTextWrap}>
            <Text style={styles.logoTitle}>
              <Text style={styles.logoTitleKadai}>Kadai</Text>
              <Text style={styles.logoTitleBook}>Book</Text>
            </Text>
            {/* Cursive Tagline with double underline sketch */}
            <View style={{ marginTop: -1 }}>
              <Svg width={140} height={24} viewBox="0 0 140 24">
                <SvgText
                  x="2"
                  y="15"
                  fill="#BA8D7B"
                  fontSize="14"
                  fontFamily="Caveat, cursive, serif"
                  fontWeight="bold"
                  fontStyle="italic"
                >
                  Simple  Smart  Reliable
                </SvgText>
                <Path
                  d="M 68 18 C 88 17, 108 18, 126 19 M 74 21 C 92 20, 108 21, 122 22"
                  stroke="#BA8D7B"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  opacity={0.8}
                  fill="none"
                />
              </Svg>
            </View>
          </View>
        </View>

        {/* 2. Hero Headline (Crisp native typography) */}
        <View style={styles.heroSection}>
          <Text style={styles.heroLine1}>Manage your</Text>
          <View style={styles.heroLine2}>
            <Text style={styles.heroLine2Text}>business, </Text>
            <Svg width={180} height={46} viewBox="0 0 180 46" style={{ marginTop: 2 }}>
              <SvgText
                x="2"
                y="36"
                fill="#A5513E"
                fontSize="42"
                fontFamily="Caveat, cursive, serif"
                fontWeight="bold"
                fontStyle="italic"
              >
                anywhere
              </SvgText>
            </Svg>
          </View>

          <Text style={styles.heroSubtext}>
            Orders, invoices, expenses, inventory and more{'\n'}— all in one simple app.
          </Text>
        </View>

        {/* 3. 4 Interactive Feature Badges */}
        <View style={styles.featuresGrid}>
          <FeatureCard icon="bar-chart-outline" label="Track Sales" />
          <FeatureCard icon="cube-outline" label={'Manage\nInventory'} />
          <FeatureCard icon="document-text-outline" label={'Create\nInvoices'} />
          <FeatureCard icon="trending-up-outline" label={'Grow Your\nBusiness'} />
        </View>
      </View>

      {/* ── BOTTOM SECTION: Seamless 3D Storefront with Animated Door ── */}
      <View style={styles.storefrontSection}>
        <Pressable
          onPress={handleToggleDoor}
          onHoverIn={() => setIsHovered(true)}
          onHoverOut={() => setIsHovered(false)}
          style={styles.storefrontPressable}
          accessibilityRole="button"
          accessibilityLabel={isOpen ? 'Click to close shop door' : 'Click to open shop door'}
        >
          <View style={styles.storefrontRatioWrap}>
            {/* ── Base 3D Storefront Image with Alpha-Feathered Top Edge ── */}
            <Image
              source={storefrontBase}
              style={styles.storefrontImage}
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
                    <Stop offset="0%" stopColor="#FFF4B8" stopOpacity="0.88" />
                    <Stop offset="35%" stopColor="#FFD54F" stopOpacity="0.65" />
                    <Stop offset="70%" stopColor="#FFA000" stopOpacity="0.25" />
                    <Stop offset="100%" stopColor="#FF8F00" stopOpacity="0" />
                  </RadialGradient>
                </Defs>
                <Path
                  d="M 153 232 L 201 232 L 260 277 L 130 277 Z"
                  fill="url(#doorFloorLight)"
                />
              </Svg>
            </Animated.View>

            {/* ── 3D Animated Door ── */}
            {/* Doorway in 490x277: x=153 (31.22%), y=142 (51.26%), w=48 (9.80%), h=90 (32.49%) */}
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

            {/* ── Floating Sparkle Motes (when open) ── */}
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
    </View>
  );
}

/** Crisp, interactive feature card */
function FeatureCard({ icon, label }: { icon: string; label: string }) {
  const [hovered, setHovered] = useState(false);

  return (
    <Pressable
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={[
        styles.featureCard,
        hovered && styles.featureCardHovered,
      ]}
    >
      <View style={[styles.featureCircle, hovered && styles.featureCircleHovered]}>
        <Ionicons name={icon as any} size={21} color="#A5513E" />
      </View>
      <Text style={styles.featureLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#F6F1E7',
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'space-between',
  },

  // ── Top Native UI Content ──
  topContentWrap: {
    paddingHorizontal: 40,
    paddingTop: 36,
    zIndex: 2,
  },

  // Logo
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoTextWrap: {
    justifyContent: 'center',
  },
  logoTitle: {
    fontSize: 23,
    lineHeight: 27,
  },
  logoTitleKadai: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#1B1917',
  },
  logoTitleBook: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#A5513E',
  },

  // Headline
  heroSection: {
    marginTop: 26,
  },
  heroLine1: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 37,
    lineHeight: 44,
    color: '#1B1917',
    letterSpacing: -0.6,
  },
  heroLine2: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroLine2Text: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 37,
    lineHeight: 44,
    color: '#1B1917',
    letterSpacing: -0.6,
  },
  heroSubtext: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 14.5,
    lineHeight: 21,
    color: '#554D44',
    marginTop: 10,
    maxWidth: 380,
  },

  // Feature Badges
  featuresGrid: {
    flexDirection: 'row',
    gap: 14,
    marginTop: 24,
  },
  featureCard: {
    width: 82,
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(230, 220, 208, 0.7)',
    shadowColor: '#3A2E2B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
    cursor: 'pointer' as any,
  },
  featureCardHovered: {
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(165, 81, 62, 0.3)',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    transform: [{ translateY: -2 }],
  },
  featureCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F3E5DC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureCircleHovered: {
    backgroundColor: '#EED9CE',
  },
  featureLabel: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 10.5,
    color: '#3E3730',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 13.5,
  },

  // ── Bottom Storefront Section ──
  storefrontSection: {
    width: '100%',
    zIndex: 1,
  },
  storefrontPressable: {
    width: '100%',
    cursor: 'pointer' as any,
  },
  storefrontRatioWrap: {
    width: '100%',
    aspectRatio: 490 / 277,
    position: 'relative',
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  storefrontImage: {
    width: '100%',
    height: '100%',
  },

  // Light Spill
  lightBeamOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 2,
  },

  // 3D Doorway
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

  // Sparkles
  sparklesWrap: {
    position: 'absolute',
    left: '32%' as any,
    top: '53%' as any,
    zIndex: 4,
  },

  // Hover Tooltip
  hoverTooltip: {
    position: 'absolute',
    top: 18,
    left: '28%' as any,
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
