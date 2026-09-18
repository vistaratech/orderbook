import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  Animated,
  Platform,
  Modal,
} from 'react-native';
import Svg, { Defs, Mask, Rect } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useTour, TOUR_STEPS } from '../../context/TourContext';
import { colors, fonts, radius, shadow } from '../../theme/theme';

export default function AppTourOverlay() {
  const {
    isTourActive,
    currentStepIndex,
    currentStep,
    targetRect,
    nextStep,
    prevStep,
    skipTour,
    finishTour,
  } = useTour();

  const { width, height } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= 768;

  // Pulse animation for the glowing spotlight ring
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isTourActive) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }).start();

      const pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.04,
            duration: 900,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 900,
            useNativeDriver: true,
          }),
        ])
      );
      pulseLoop.start();
      return () => pulseLoop.stop();
    } else {
      fadeAnim.setValue(0);
    }
  }, [isTourActive, pulseAnim, fadeAnim]);

  if (!isTourActive) {
    return null;
  }

  const isWelcome = currentStep.isWelcome;
  const isCompletion = currentStep.isCompletion;
  const hasTarget = !!targetRect && !isWelcome && !isCompletion;

  // Dimensions for the cutout
  const padding = 8;
  const cutoutX = targetRect ? Math.max(0, targetRect.x - padding) : 0;
  const cutoutY = targetRect ? Math.max(0, targetRect.y - padding) : 0;
  const cutoutW = targetRect ? targetRect.width + padding * 2 : 0;
  const cutoutH = targetRect ? targetRect.height + padding * 2 : 0;

  // Compute Tooltip Card Position
  const cardWidth = Math.min(width - 32, isDesktop ? 400 : 360);
  let cardLeft = (width - cardWidth) / 2;
  let cardTop = (height - 240) / 2; // Default centered for welcome / completion

  if (hasTarget && targetRect) {
    // If desktop and target is in left sidebar
    if (isDesktop && targetRect.x < 300) {
      cardLeft = Math.min(width - cardWidth - 20, targetRect.x + targetRect.width + 24);
      cardTop = Math.max(20, Math.min(height - 260, targetRect.y - 10));
    } else {
      // Mobile or central desktop target
      cardLeft = Math.max(16, Math.min(width - cardWidth - 16, (width - cardWidth) / 2));

      // Check whether to place below or above target
      const spaceBelow = height - (cutoutY + cutoutH);
      const spaceAbove = cutoutY;

      if (spaceBelow >= 240 || spaceBelow >= spaceAbove) {
        cardTop = cutoutY + cutoutH + 16;
      } else {
        cardTop = Math.max(16, cutoutY - 220);
      }
    }
  }

  const accent = currentStep.accentColor || colors.clayDeep;

  return (
    <Animated.View style={[styles.overlayContainer, { opacity: fadeAnim }]} pointerEvents="box-none">
      {/* ─── Dimmed Backdrop & Spotlight Cutout ─── */}
      <View style={StyleSheet.absoluteFill} pointerEvents="auto">
        {hasTarget ? (
          <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
            <Defs>
              <Mask id="spotlightMask" x="0" y="0" width="100%" height="100%">
                {/* White background: shows the dimmed overlay */}
                <Rect x="0" y="0" width="100%" height="100%" fill="#ffffff" />
                {/* Black cutout: punches through to illuminate target */}
                <Rect
                  x={cutoutX}
                  y={cutoutY}
                  width={cutoutW}
                  height={cutoutH}
                  rx={14}
                  ry={14}
                  fill="#000000"
                />
              </Mask>
            </Defs>
            <Rect
              x="0"
              y="0"
              width="100%"
              height="100%"
              fill="rgba(18, 16, 14, 0.78)"
              mask="url(#spotlightMask)"
            />
          </Svg>
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(18, 16, 14, 0.82)' }]} />
        )}
      </View>

      {/* ─── Glowing Highlight Ring around Cutout ─── */}
      {hasTarget && (
        <Animated.View
          style={[
            styles.spotlightRing,
            {
              left: cutoutX,
              top: cutoutY,
              width: cutoutW,
              height: cutoutH,
              borderColor: accent,
              transform: [{ scale: pulseAnim }],
              ...(Platform.OS === 'web'
                ? ({
                    boxShadow: `0 0 16px ${accent}80, inset 0 0 8px ${accent}40`,
                  } as any)
                : {
                    shadowColor: accent,
                    shadowOpacity: 0.8,
                    shadowRadius: 10,
                    elevation: 6,
                  }),
            },
          ]}
          pointerEvents="none"
        />
      )}

      {/* ─── Intuitive Tooltip Card ─── */}
      <View
        style={[
          styles.tooltipCard,
          (isWelcome || isCompletion) && styles.centeredCard,
          {
            width: cardWidth,
            left: cardLeft,
            top: cardTop,
          },
        ]}
        pointerEvents="auto"
      >
        {/* Top Header Bar with Step Badge & Close */}
        <View style={styles.cardHeader}>
          {isWelcome ? (
            <View style={[styles.stepBadge, { backgroundColor: '#F3D9D5' }]}>
              <Text style={[styles.stepBadgeText, { color: colors.clayDeep }]}>QUICK TOUR</Text>
            </View>
          ) : isCompletion ? (
            <View style={[styles.stepBadge, { backgroundColor: '#EAF5EC' }]}>
              <Text style={[styles.stepBadgeText, { color: '#2E7D32' }]}>ALL DONE</Text>
            </View>
          ) : (
            <View style={[styles.stepBadge, { backgroundColor: `${accent}20` }]}>
              <Text style={[styles.stepBadgeText, { color: accent }]}>
                {currentStep.badgeText || `STEP ${currentStep.stepNumber || 1} OF 7`}
              </Text>
            </View>
          )}

          <Pressable
            style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.7 }]}
            onPress={skipTour}
            hitSlop={12}
          >
            <Ionicons name="close" size={18} color={colors.inkSoft} />
          </Pressable>
        </View>

        {/* Content Section: Icon, Title & Description */}
        <View style={styles.cardBody}>
          <View style={styles.titleRow}>
            <View style={[styles.iconWrap, { backgroundColor: `${accent}18` }]}>
              <Ionicons name={currentStep.iconName as any} size={22} color={accent} />
            </View>
            <Text style={styles.cardTitle}>{currentStep.title}</Text>
          </View>

          <Text style={styles.cardDescription}>{currentStep.description}</Text>
        </View>

        {/* Action Controls Row */}
        <View style={styles.cardFooter}>
          {isWelcome ? (
            <View style={styles.welcomeFooterRow}>
              <Pressable
                style={({ pressed }) => [styles.skipTextBtn, pressed && { opacity: 0.6 }]}
                onPress={skipTour}
              >
                <Text style={styles.skipText}>Maybe Later</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.primaryBtn,
                  { backgroundColor: colors.clayDeep },
                  pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
                ]}
                onPress={nextStep}
              >
                <Text style={styles.primaryBtnText}>Start Tour 🚀</Text>
              </Pressable>
            </View>
          ) : isCompletion ? (
            <View style={styles.welcomeFooterRow}>
              <Pressable
                style={({ pressed }) => [
                  styles.primaryBtn,
                  { backgroundColor: '#2E7D32', flex: 1 },
                  pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
                ]}
                onPress={finishTour}
              >
                <Text style={styles.primaryBtnText}>Go to Dashboard 🚀</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.normalFooterRow}>
              <Pressable
                style={({ pressed }) => [styles.skipTextBtn, pressed && { opacity: 0.6 }]}
                onPress={skipTour}
              >
                <Text style={styles.skipText}>Skip Tour</Text>
              </Pressable>

              <View style={styles.navBtnsGroup}>
                {currentStepIndex > 1 && (
                  <Pressable
                    style={({ pressed }) => [
                      styles.backBtn,
                      pressed && { opacity: 0.75, backgroundColor: colors.paper },
                    ]}
                    onPress={prevStep}
                  >
                    <Ionicons name="chevron-back" size={15} color={colors.ink} />
                    <Text style={styles.backBtnText}>Back</Text>
                  </Pressable>
                )}

                <Pressable
                  style={({ pressed }) => [
                    styles.primaryBtn,
                    { backgroundColor: accent },
                    pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
                  ]}
                  onPress={nextStep}
                >
                  <Text style={styles.primaryBtnText}>
                    {currentStepIndex === TOUR_STEPS.length - 2 ? 'Finish ✓' : 'Next'}
                  </Text>
                  <Ionicons name="chevron-forward" size={15} color={colors.white} />
                </Pressable>
              </View>
            </View>
          )}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlayContainer: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    zIndex: 99999,
    elevation: 99999,
  },
  spotlightRing: {
    position: 'absolute',
    borderRadius: 14,
    borderWidth: 2.5,
  },
  tooltipCard: {
    position: 'absolute',
    backgroundColor: '#FFFDF8',
    borderRadius: radius.lg,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.line,
    ...shadow.card,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
  },
  centeredCard: {
    // Center card within parent
    alignSelf: 'center',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  stepBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  stepBadgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 10.5,
    letterSpacing: 0.5,
  },
  closeBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.paper,
  },
  cardBody: {
    marginBottom: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    color: colors.ink,
    flex: 1,
  },
  cardDescription: {
    fontFamily: fonts.body,
    fontSize: 13.5,
    color: colors.inkSoft,
    lineHeight: 20,
  },
  cardFooter: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: 14,
  },
  welcomeFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  normalFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navBtnsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  skipTextBtn: {
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  skipText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.inkSoft,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    gap: 4,
    backgroundColor: colors.paperCard,
  },
  backBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 12.5,
    color: colors.ink,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    gap: 4,
    ...shadow.card,
    elevation: 2,
  },
  primaryBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.white,
  },
});
