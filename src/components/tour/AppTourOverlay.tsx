import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  Animated,
  Platform,
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

  // Animations
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const cardScaleAnim = useRef(new Animated.Value(0.94)).current;

  useEffect(() => {
    if (isTourActive) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.spring(cardScaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 60,
          useNativeDriver: true,
        }),
      ]).start();

      const pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
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
      cardScaleAnim.setValue(0.94);
    }
  }, [isTourActive, pulseAnim, fadeAnim, cardScaleAnim]);

  if (!isTourActive) {
    return null;
  }

  const isWelcome = currentStep.isWelcome;
  const isCompletion = currentStep.isCompletion;
  const isCenteredModal = isWelcome || isCompletion;
  const hasTarget = !!targetRect && !isCenteredModal;

  // Dimensions for spotlight cutout
  const padding = 8;
  const cutoutX = targetRect ? Math.max(0, targetRect.x - padding) : 0;
  const cutoutY = targetRect ? Math.max(0, targetRect.y - padding) : 0;
  const cutoutW = targetRect ? targetRect.width + padding * 2 : 0;
  const cutoutH = targetRect ? targetRect.height + padding * 2 : 0;

  // Compute Tooltip Card Position for targeted steps
  const cardWidth = Math.min(width - 32, isDesktop ? 390 : 350);
  let cardLeft = (width - cardWidth) / 2;
  let cardTop = (height - 240) / 2;

  if (hasTarget && targetRect) {
    if (isDesktop && targetRect.x < 320) {
      cardLeft = Math.min(width - cardWidth - 24, targetRect.x + targetRect.width + 20);
      cardTop = Math.max(20, Math.min(height - 280, targetRect.y - 10));
    } else {
      cardLeft = Math.max(16, Math.min(width - cardWidth - 16, (width - cardWidth) / 2));
      const spaceBelow = height - (cutoutY + cutoutH);
      const spaceAbove = cutoutY;

      if (spaceBelow >= 250 || spaceBelow >= spaceAbove) {
        cardTop = cutoutY + cutoutH + 16;
      } else {
        cardTop = Math.max(16, cutoutY - 240);
      }
    }
  }

  const accent = currentStep.accentColor || colors.clayDeep;

  return (
    <Animated.View style={[styles.overlayContainer, { opacity: fadeAnim }]} pointerEvents="box-none">
      {/* ─── Backdrop / Dimmed Mask ─── */}
      <View style={StyleSheet.absoluteFill} pointerEvents="auto">
        {hasTarget ? (
          <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
            <Defs>
              <Mask id="spotlightMask" x="0" y="0" width="100%" height="100%">
                <Rect x="0" y="0" width="100%" height="100%" fill="#ffffff" />
                <Rect
                  x={cutoutX}
                  y={cutoutY}
                  width={cutoutW}
                  height={cutoutH}
                  rx={16}
                  ry={16}
                  fill="#000000"
                />
              </Mask>
            </Defs>
            <Rect
              x="0"
              y="0"
              width="100%"
              height="100%"
              fill="rgba(18, 16, 14, 0.76)"
              mask="url(#spotlightMask)"
            />
          </Svg>
        ) : (
          <View
            style={[
              StyleSheet.absoluteFill,
              styles.modalBackdrop,
              Platform.OS === 'web'
                ? ({
                    backdropFilter: 'blur(10px)',
                    WebkitBackdropFilter: 'blur(10px)',
                  } as any)
                : {},
            ]}
          />
        )}
      </View>

      {/* ─── Glowing Highlight Ring around Target (Steps 1 to 7) ─── */}
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
                    boxShadow: `0 0 20px ${accent}90, inset 0 0 10px ${accent}40`,
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

      {/* ─── Welcome & Completion Modals (Centered & Deluxe) ─── */}
      {isCenteredModal ? (
        <View style={styles.modalCenterWrapper} pointerEvents="box-none">
          <Animated.View
            style={[
              styles.welcomeCard,
              {
                width: Math.min(width - 32, isDesktop ? 470 : 360),
                transform: [{ scale: cardScaleAnim }],
              },
            ]}
            pointerEvents="auto"
          >
            {/* Floating Top Right Close Button */}
            <Pressable
              style={({ pressed }) => [styles.closeBtnFloating, pressed && { opacity: 0.7 }]}
              onPress={isCompletion ? finishTour : skipTour}
              hitSlop={12}
            >
              <Ionicons name="close" size={20} color={colors.inkSoft} />
            </Pressable>

            {isWelcome ? (
              /* ── Welcome Screen Content ── */
              <View>
                {/* Header Icon & Tag */}
                <View style={styles.heroHeaderSection}>
                  <View style={[styles.heroIconBadge, { backgroundColor: colors.clayDeep }]}>
                    <Ionicons name="sparkles" size={26} color={colors.white} />
                  </View>
                  <View style={styles.badgePill}>
                    <Text style={styles.badgePillText}>✨ 1-MINUTE INTERACTIVE TOUR</Text>
                  </View>
                </View>

                {/* Title & Subtitle */}
                <Text style={styles.welcomeTitle}>Welcome to KadaiBook! 👋</Text>
                <Text style={styles.welcomeSubtitle}>
                  Tamil Nadu's smart digital order book, retail billing & customer credit ledger.
                </Text>

                {/* 3 Core Value Highlights */}
                <View style={styles.highlightsContainer}>
                  <View style={styles.highlightItem}>
                    <View style={[styles.highlightIcon, { backgroundColor: 'rgba(185, 102, 89, 0.14)' }]}>
                      <Ionicons name="receipt" size={18} color={colors.clayDeep} />
                    </View>
                    <View style={styles.highlightTextWrap}>
                      <Text style={styles.highlightHeading}>Lightning Billing & GST</Text>
                      <Text style={styles.highlightDesc}>Generate printed or WhatsApp invoices in 10 seconds.</Text>
                    </View>
                  </View>

                  <View style={styles.highlightItem}>
                    <View style={[styles.highlightIcon, { backgroundColor: 'rgba(201, 154, 63, 0.14)' }]}>
                      <Ionicons name="book" size={18} color="#C99A3F" />
                    </View>
                    <View style={styles.highlightTextWrap}>
                      <Text style={styles.highlightHeading}>Customer Udhar Khata (கடன்)</Text>
                      <Text style={styles.highlightDesc}>Track credit dues with automated WhatsApp payment reminders.</Text>
                    </View>
                  </View>

                  <View style={styles.highlightItem}>
                    <View style={[styles.highlightIcon, { backgroundColor: 'rgba(78, 138, 84, 0.14)' }]}>
                      <Ionicons name="trending-up" size={18} color="#4E8A54" />
                    </View>
                    <View style={styles.highlightTextWrap}>
                      <Text style={styles.highlightHeading}>Live Profit Analytics</Text>
                      <Text style={styles.highlightDesc}>Real-time sales, store expenses, and order pipeline.</Text>
                    </View>
                  </View>
                </View>

                {/* Time Indicator */}
                <View style={styles.timeEstimateRow}>
                  <Ionicons name="time-outline" size={14} color={colors.inkSoft} />
                  <Text style={styles.timeEstimateText}>Takes ~45 seconds • 7 interactive highlights</Text>
                </View>

                {/* Action Controls */}
                <View style={styles.welcomeActionsCol}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.startTourBtn,
                      pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] },
                    ]}
                    onPress={nextStep}
                  >
                    <Text style={styles.startTourBtnText}>Start Quick Tour</Text>
                    <Ionicons name="arrow-forward" size={18} color={colors.white} />
                  </Pressable>

                  <Pressable
                    style={({ pressed }) => [styles.exploreLaterBtn, pressed && { opacity: 0.6 }]}
                    onPress={skipTour}
                  >
                    <Text style={styles.exploreLaterText}>Maybe Later, Explore on My Own</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              /* ── Completion Screen Content ── */
              <View>
                <View style={styles.heroHeaderSection}>
                  <View style={[styles.heroIconBadge, { backgroundColor: '#4E8A54' }]}>
                    <Ionicons name="checkmark-done" size={28} color={colors.white} />
                  </View>
                  <View style={[styles.badgePill, { backgroundColor: '#EAF5EC' }]}>
                    <Text style={[styles.badgePillText, { color: '#2E7D32' }]}>ALL DONE 🎉</Text>
                  </View>
                </View>

                <Text style={styles.welcomeTitle}>You're All Set! 🚀</Text>
                <Text style={styles.welcomeSubtitle}>
                  Your digital storefront and ledger are ready. Start creating bills or recording customer orders right away.
                </Text>

                <View style={styles.completionTipBox}>
                  <Ionicons name="bulb-outline" size={18} color="#C99A3F" />
                  <Text style={styles.completionTipText}>
                    Need a refresher? You can restart this interactive tour anytime from Settings or the sidebar.
                  </Text>
                </View>

                <View style={styles.welcomeActionsCol}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.startTourBtn,
                      { backgroundColor: '#4E8A54' },
                      pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] },
                    ]}
                    onPress={finishTour}
                  >
                    <Text style={styles.startTourBtnText}>Go to My Dashboard</Text>
                    <Ionicons name="arrow-forward" size={18} color={colors.white} />
                  </Pressable>
                </View>
              </View>
            )}
          </Animated.View>
        </View>
      ) : (
        /* ─── Targeted Step Tooltip (Steps 1 to 7) ─── */
        <View
          style={[
            styles.tooltipCard,
            {
              width: cardWidth,
              left: cardLeft,
              top: cardTop,
            },
          ]}
          pointerEvents="auto"
        >
          {/* Header: Step Pill, Progress Dots, Close */}
          <View style={styles.stepCardHeader}>
            <View style={styles.stepBadgeGroup}>
              <View style={[styles.stepBadge, { backgroundColor: `${accent}20` }]}>
                <Text style={[styles.stepBadgeText, { color: accent }]}>
                  {currentStep.badgeText || `STEP ${currentStep.stepNumber || 1} OF 7`}
                </Text>
              </View>

              {/* Sleek Step Progress Indicator */}
              <View style={styles.progressDotsRow}>
                {[1, 2, 3, 4, 5, 6, 7].map((num) => {
                  const isCurrent = num === (currentStep.stepNumber || 1);
                  const isPassed = num < (currentStep.stepNumber || 1);
                  return (
                    <View
                      key={num}
                      style={[
                        styles.progressDot,
                        isCurrent && [styles.progressDotActive, { backgroundColor: accent }],
                        isPassed && { backgroundColor: `${accent}80` },
                      ]}
                    />
                  );
                })}
              </View>
            </View>

            <Pressable
              style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.7 }]}
              onPress={skipTour}
              hitSlop={12}
            >
              <Ionicons name="close" size={18} color={colors.inkSoft} />
            </Pressable>
          </View>

          {/* Body: Icon + Title + Description */}
          <View style={styles.stepBody}>
            <View style={styles.stepTitleRow}>
              <View style={[styles.stepIconWrap, { backgroundColor: `${accent}18` }]}>
                <Ionicons name={currentStep.iconName as any} size={20} color={accent} />
              </View>
              <Text style={styles.stepTitle}>{currentStep.title}</Text>
            </View>
            <Text style={styles.stepDescription}>{currentStep.description}</Text>
          </View>

          {/* Footer Controls: Skip, Back, Next */}
          <View style={styles.stepFooter}>
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
                  <Ionicons name="chevron-back" size={16} color={colors.ink} />
                  <Text style={styles.backBtnText}>Back</Text>
                </Pressable>
              )}

              <Pressable
                style={({ pressed }) => [
                  styles.nextBtn,
                  { backgroundColor: accent },
                  pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
                ]}
                onPress={nextStep}
              >
                <Text style={styles.nextBtnText}>
                  {currentStepIndex === TOUR_STEPS.length - 2 ? 'Finish Tour ✓' : 'Next Step'}
                </Text>
                {currentStepIndex < TOUR_STEPS.length - 2 && (
                  <Ionicons name="arrow-forward" size={15} color={colors.white} />
                )}
              </Pressable>
            </View>
          </View>
        </View>
      )}
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
  modalBackdrop: {
    backgroundColor: 'rgba(18, 16, 14, 0.68)',
  },
  modalCenterWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    zIndex: 100000,
  },
  welcomeCard: {
    backgroundColor: '#FFFDF9',
    borderRadius: 24,
    padding: 26,
    borderWidth: 1,
    borderColor: 'rgba(220, 211, 192, 0.8)',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 24px 60px rgba(46, 42, 36, 0.28), 0 4px 16px rgba(46, 42, 36, 0.08)',
        } as any)
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.3,
          shadowRadius: 20,
          elevation: 16,
        }),
  },
  closeBtnFloating: {
    position: 'absolute',
    top: 18,
    right: 18,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(246, 241, 231, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(220, 211, 192, 0.6)',
    zIndex: 10,
  },
  heroHeaderSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  heroIconBadge: {
    width: 48,
    height: 48,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 6px 18px rgba(185, 102, 89, 0.32)',
        } as any)
      : {
          shadowColor: '#B96659',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 4,
        }),
  },
  badgePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(185, 102, 89, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(185, 102, 89, 0.25)',
  },
  badgePillText: {
    fontFamily: fonts.bodyBold,
    fontSize: 10.5,
    color: colors.clayDeep,
    letterSpacing: 0.6,
  },
  welcomeTitle: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.ink,
    letterSpacing: -0.4,
    marginBottom: 6,
  },
  welcomeSubtitle: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13.5,
    color: colors.inkSoft,
    lineHeight: 20,
    marginBottom: 18,
  },
  highlightsContainer: {
    gap: 10,
    marginBottom: 18,
  },
  highlightItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(246, 241, 231, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(220, 211, 192, 0.45)',
  },
  highlightIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  highlightTextWrap: {
    flex: 1,
  },
  highlightHeading: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.ink,
    marginBottom: 2,
  },
  highlightDesc: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.inkSoft,
    lineHeight: 16,
  },
  timeEstimateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 18,
  },
  timeEstimateText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.inkSoft,
  },
  welcomeActionsCol: {
    gap: 10,
  },
  startTourBtn: {
    backgroundColor: colors.clayDeep,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    paddingHorizontal: 20,
    borderRadius: radius.md,
    gap: 8,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 6px 20px rgba(185, 102, 89, 0.38)',
        } as any)
      : {
          shadowColor: colors.clayDeep,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 4,
        }),
  },
  startTourBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 14.5,
    color: colors.white,
    letterSpacing: -0.2,
  },
  exploreLaterBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  exploreLaterText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.inkSoft,
  },
  completionTipBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#FEF9EE',
    borderWidth: 1,
    borderColor: '#F3E5C8',
    marginBottom: 20,
  },
  completionTipText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 12.5,
    color: '#8C6824',
    lineHeight: 18,
  },

  /* ─── Targeted Step Styles ─── */
  spotlightRing: {
    position: 'absolute',
    borderRadius: 16,
    borderWidth: 2.5,
  },
  tooltipCard: {
    position: 'absolute',
    backgroundColor: '#FFFDF9',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.line,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 16px 40px rgba(46, 42, 36, 0.22), 0 2px 8px rgba(46, 42, 36, 0.06)',
        } as any)
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.22,
          shadowRadius: 16,
          elevation: 12,
        }),
  },
  stepCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  stepBadgeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
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
  progressDotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  progressDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.line,
  },
  progressDotActive: {
    width: 14,
    borderRadius: 3,
  },
  closeBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.paper,
  },
  stepBody: {
    marginBottom: 16,
  },
  stepTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  stepIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 15.5,
    color: colors.ink,
    flex: 1,
    letterSpacing: -0.3,
  },
  stepDescription: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.inkSoft,
    lineHeight: 19.5,
  },
  stepFooter: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: 14,
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
    fontSize: 12.5,
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
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    gap: 5,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 4px 12px rgba(185, 102, 89, 0.32)',
        } as any)
      : {
          shadowColor: colors.clayDeep,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 6,
          elevation: 2,
        }),
  },
  nextBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.white,
  },
});
