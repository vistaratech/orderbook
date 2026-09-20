import React, { useEffect, useRef, useState } from 'react';
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
import { useTour, TOUR_STEPS, TourStep } from '../../context/TourContext';
import { colors, fonts, radius, shadow } from '../../theme/theme';

// ─── Friendly guide character emojis for each step ───
const STEP_GUIDE: Record<string, string> = {
  'welcome':             '👋',
  'dashboard-metrics':   '📊',
  'dashboard-pipeline':  '📦',
  'new-order-action':    '🧾',
  'orders-search-filter':'🔍',
  'orders-list-area':    '📋',
  'expenses-overview':   '💰',
  'more-menu-hub':       '⚙️',
  'tour-completion':     '🎉',
};

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

  // ─── Animation Values ───
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const cardSlideAnim = useRef(new Animated.Value(0)).current;
  const cardScaleAnim = useRef(new Animated.Value(0.92)).current;
  const spotlightAnim = useRef(new Animated.Value(0)).current;
  const guideAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Track previous step for transition direction
  const prevStepRef = useRef(currentStepIndex);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // ─── Overlay entry animation ───
  useEffect(() => {
    if (isTourActive) {
      fadeAnim.setValue(0);
      cardScaleAnim.setValue(0.92);
      cardSlideAnim.setValue(20);
      guideAnim.setValue(0);

      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(cardScaleAnim, {
          toValue: 1,
          friction: 7,
          tension: 50,
          useNativeDriver: true,
        }),
        Animated.spring(cardSlideAnim, {
          toValue: 0,
          friction: 7,
          tension: 50,
          useNativeDriver: true,
        }),
        Animated.spring(guideAnim, {
          toValue: 1,
          friction: 6,
          tension: 40,
          delay: 150,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      fadeAnim.setValue(0);
      cardScaleAnim.setValue(0.92);
      cardSlideAnim.setValue(20);
    }
  }, [isTourActive]);

  // ─── Smooth step transition animation ───
  useEffect(() => {
    if (!isTourActive) return;
    const goingForward = currentStepIndex > prevStepRef.current;
    prevStepRef.current = currentStepIndex;

    setIsTransitioning(true);

    // Animate card out then in
    const slideOut = goingForward ? -16 : 16;
    const slideIn = goingForward ? 16 : -16;

    cardSlideAnim.setValue(slideIn);
    cardScaleAnim.setValue(0.96);
    spotlightAnim.setValue(0);

    // Animate progress bar
    const stepTotal = TOUR_STEPS.length;
    Animated.timing(progressAnim, {
      toValue: currentStepIndex / (stepTotal - 1),
      duration: 350,
      useNativeDriver: false,
    }).start();

    Animated.parallel([
      Animated.spring(cardSlideAnim, {
        toValue: 0,
        friction: 8,
        tension: 55,
        useNativeDriver: true,
      }),
      Animated.spring(cardScaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 55,
        useNativeDriver: true,
      }),
      Animated.timing(spotlightAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(guideAnim, {
          toValue: 0.6,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.spring(guideAnim, {
          toValue: 1,
          friction: 5,
          tension: 80,
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      setIsTransitioning(false);
    });
  }, [currentStepIndex, isTourActive]);

  if (!isTourActive) return null;

  const isWelcome = currentStep.isWelcome;
  const isCompletion = currentStep.isCompletion;
  const isCenteredModal = isWelcome || isCompletion;
  const hasTarget = !!targetRect && !isCenteredModal;

  // Spotlight cutout with more padding
  const pad = 10;
  const cutX = targetRect ? Math.max(0, targetRect.x - pad) : 0;
  const cutY = targetRect ? Math.max(0, targetRect.y - pad) : 0;
  const cutW = targetRect ? targetRect.width + pad * 2 : 0;
  const cutH = targetRect ? targetRect.height + pad * 2 : 0;

  // ─── Card positioning ───
  const cardWidth = Math.min(width - 32, isDesktop ? 400 : 355);
  let cardLeft = (width - cardWidth) / 2;
  let cardTop = (height - 240) / 2;

  if (hasTarget && targetRect) {
    if (isDesktop && targetRect.x < 320) {
      cardLeft = Math.min(width - cardWidth - 24, targetRect.x + targetRect.width + 24);
      cardTop = Math.max(20, Math.min(height - 300, targetRect.y - 10));
    } else {
      cardLeft = Math.max(16, Math.min(width - cardWidth - 16, (width - cardWidth) / 2));
      const below = height - (cutY + cutH);
      const above = cutY;
      if (below >= 260 || below >= above) {
        cardTop = cutY + cutH + 18;
      } else {
        cardTop = Math.max(16, cutY - 250);
      }
    }
  }

  const accent = currentStep.accentColor || colors.clayDeep;
  const guideEmoji = STEP_GUIDE[currentStep.id] || '✨';
  const stepNum = currentStep.stepNumber || 0;
  const totalSteps = 7;

  // ─── Render ───
  return (
    <Animated.View style={[styles.overlay, { opacity: fadeAnim }]} pointerEvents="box-none">
      {/* ─── Backdrop ─── */}
      <View style={StyleSheet.absoluteFill} pointerEvents="auto">
        {hasTarget ? (
          <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
            <Defs>
              <Mask id="spotMask" x="0" y="0" width="100%" height="100%">
                <Rect x="0" y="0" width="100%" height="100%" fill="#fff" />
                <Rect x={cutX} y={cutY} width={cutW} height={cutH} rx={14} ry={14} fill="#000" />
              </Mask>
            </Defs>
            <Rect
              x="0" y="0" width="100%" height="100%"
              fill="rgba(18, 16, 14, 0.72)"
              mask="url(#spotMask)"
            />
          </Svg>
        ) : (
          <View
            style={[
              StyleSheet.absoluteFill,
              styles.backdrop,
              Platform.OS === 'web'
                ? ({ backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' } as any)
                : {},
            ]}
          />
        )}
      </View>

      {/* ─── Subtle Spotlight Glow (not a chunky ring) ─── */}
      {hasTarget && (
        <Animated.View
          style={[
            styles.spotlightGlow,
            {
              left: cutX - 4,
              top: cutY - 4,
              width: cutW + 8,
              height: cutH + 8,
              opacity: spotlightAnim,
              ...(Platform.OS === 'web'
                ? ({
                    boxShadow: `0 0 0 2px ${accent}50, 0 0 28px ${accent}30, 0 0 56px ${accent}15`,
                  } as any)
                : {
                    borderWidth: 2,
                    borderColor: `${accent}60`,
                    shadowColor: accent,
                    shadowOpacity: 0.5,
                    shadowRadius: 20,
                    elevation: 8,
                  }),
            },
          ]}
          pointerEvents="none"
        />
      )}

      {/* ─── Welcome & Completion Modals ─── */}
      {isCenteredModal ? (
        <View style={styles.modalCenter} pointerEvents="box-none">
          <Animated.View
            style={[
              styles.welcomeCard,
              {
                width: Math.min(width - 32, isDesktop ? 470 : 365),
                transform: [
                  { scale: cardScaleAnim },
                  { translateY: cardSlideAnim },
                ],
              },
            ]}
            pointerEvents="auto"
          >
            {/* Close button */}
            <Pressable
              style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.6 }]}
              onPress={isCompletion ? finishTour : skipTour}
              hitSlop={12}
            >
              <Ionicons name="close" size={18} color={colors.inkSoft} />
            </Pressable>

            {isWelcome ? (
              <View>
                {/* Hero row with guide emoji */}
                <View style={styles.heroRow}>
                  <Animated.View
                    style={[
                      styles.guideCircle,
                      { backgroundColor: colors.clayDeep },
                      { transform: [{ scale: guideAnim }] },
                    ]}
                  >
                    <Ionicons name="sparkles" size={26} color={colors.white} />
                  </Animated.View>
                  <View style={styles.heroBadge}>
                    <Text style={styles.heroBadgeText}>✨ 1-MINUTE INTERACTIVE TOUR</Text>
                  </View>
                </View>

                <Text style={styles.welcomeTitle}>Welcome to KadaiBook! 👋</Text>
                <Text style={styles.welcomeSub}>
                  Tamil Nadu's smart digital order book, retail billing & customer credit ledger.
                </Text>

                {/* Feature highlights */}
                <View style={styles.highlights}>
                  {[
                    { icon: 'receipt', color: colors.clayDeep, bg: 'rgba(185,102,89,0.12)', title: 'Lightning Billing & GST', desc: 'Generate printed or WhatsApp invoices in 10 seconds.' },
                    { icon: 'book', color: '#C99A3F', bg: 'rgba(201,154,63,0.12)', title: 'Customer Udhar Khata (கடன்)', desc: 'Track credit dues with automated WhatsApp payment reminders.' },
                    { icon: 'trending-up', color: '#4E8A54', bg: 'rgba(78,138,84,0.12)', title: 'Live Profit Analytics', desc: 'Real-time sales, store expenses, and order pipeline.' },
                  ].map((f, i) => (
                    <Animated.View
                      key={i}
                      style={[
                        styles.highlightRow,
                        {
                          opacity: fadeAnim,
                          transform: [{ translateY: Animated.multiply(cardSlideAnim, new Animated.Value(1 + i * 0.3)) }],
                        },
                      ]}
                    >
                      <View style={[styles.highlightIconWrap, { backgroundColor: f.bg }]}>
                        <Ionicons name={f.icon as any} size={17} color={f.color} />
                      </View>
                      <View style={styles.highlightText}>
                        <Text style={styles.highlightTitle}>{f.title}</Text>
                        <Text style={styles.highlightDesc}>{f.desc}</Text>
                      </View>
                    </Animated.View>
                  ))}
                </View>

                {/* Time indicator */}
                <View style={styles.timeRow}>
                  <Ionicons name="time-outline" size={13} color={colors.inkSoft} />
                  <Text style={styles.timeText}>Takes ~45 seconds • 7 interactive highlights</Text>
                </View>

                {/* Actions */}
                <Pressable
                  style={({ pressed }) => [
                    styles.primaryBtn,
                    pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
                  ]}
                  onPress={nextStep}
                >
                  <Text style={styles.primaryBtnText}>Start Quick Tour</Text>
                  <Ionicons name="arrow-forward" size={17} color={colors.white} />
                </Pressable>

                <Pressable
                  style={({ pressed }) => [styles.skipLink, pressed && { opacity: 0.5 }]}
                  onPress={skipTour}
                >
                  <Text style={styles.skipLinkText}>Maybe Later, Explore on My Own</Text>
                </Pressable>
              </View>
            ) : (
              /* ── Completion ── */
              <View>
                <View style={styles.heroRow}>
                  <Animated.View
                    style={[
                      styles.guideCircle,
                      { backgroundColor: '#4E8A54' },
                      { transform: [{ scale: guideAnim }] },
                    ]}
                  >
                    <Ionicons name="checkmark-done" size={28} color={colors.white} />
                  </Animated.View>
                  <View style={[styles.heroBadge, { backgroundColor: '#EAF5EC', borderColor: '#C2DFC7' }]}>
                    <Text style={[styles.heroBadgeText, { color: '#2E7D32' }]}>ALL DONE 🎉</Text>
                  </View>
                </View>

                <Text style={styles.welcomeTitle}>You're All Set! 🚀</Text>
                <Text style={styles.welcomeSub}>
                  Your digital storefront and ledger are ready. Start creating bills or recording customer orders right away.
                </Text>

                <View style={styles.tipBox}>
                  <Ionicons name="bulb-outline" size={17} color="#C99A3F" />
                  <Text style={styles.tipText}>
                    Need a refresher? Restart this interactive tour anytime from Settings or the sidebar.
                  </Text>
                </View>

                <Pressable
                  style={({ pressed }) => [
                    styles.primaryBtn,
                    { backgroundColor: '#4E8A54' },
                    pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
                  ]}
                  onPress={finishTour}
                >
                  <Text style={styles.primaryBtnText}>Go to My Dashboard</Text>
                  <Ionicons name="arrow-forward" size={17} color={colors.white} />
                </Pressable>
              </View>
            )}
          </Animated.View>
        </View>
      ) : (
        /* ─── Targeted Step Tooltip (Steps 1–7) ─── */
        <Animated.View
          style={[
            styles.tooltipCard,
            {
              width: cardWidth,
              left: cardLeft,
              top: cardTop,
              transform: [
                { scale: cardScaleAnim },
                { translateY: cardSlideAnim },
              ],
            },
          ]}
          pointerEvents="auto"
        >
          {/* Top section: Guide + Progress */}
          <View style={styles.tooltipTop}>
            {/* Guide character bubble */}
            <Animated.View
              style={[
                styles.guideCharBubble,
                { transform: [{ scale: guideAnim }] },
              ]}
            >
              <Text style={styles.guideCharEmoji}>{guideEmoji}</Text>
            </Animated.View>

            {/* Step info + Progress bar */}
            <View style={styles.progressSection}>
              <View style={styles.stepInfoRow}>
                <Text style={[styles.stepBadgeLabel, { color: accent }]}>
                  Step {stepNum} of {totalSteps}
                </Text>
                <Text style={styles.stepPercent}>
                  {Math.round((stepNum / totalSteps) * 100)}%
                </Text>
              </View>
              <View style={styles.progressTrack}>
                <Animated.View
                  style={[
                    styles.progressFill,
                    {
                      backgroundColor: accent,
                      width: progressAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0%', '100%'],
                      }),
                    },
                  ]}
                />
              </View>
            </View>

            {/* Close */}
            <Pressable
              style={({ pressed }) => [styles.tooltipClose, pressed && { opacity: 0.6 }]}
              onPress={skipTour}
              hitSlop={12}
            >
              <Ionicons name="close" size={16} color={colors.inkSoft} />
            </Pressable>
          </View>

          {/* Body */}
          <View style={styles.tooltipBody}>
            <View style={styles.titleRow}>
              <View style={[styles.stepIconCircle, { backgroundColor: `${accent}15` }]}>
                <Ionicons name={currentStep.iconName as any} size={19} color={accent} />
              </View>
              <Text style={styles.stepTitle} numberOfLines={2}>{currentStep.title}</Text>
            </View>
            <Text style={styles.stepDesc}>{currentStep.description}</Text>
          </View>

          {/* Footer */}
          <View style={styles.tooltipFooter}>
            <Pressable
              style={({ pressed }) => [styles.footerSkip, pressed && { opacity: 0.5 }]}
              onPress={skipTour}
            >
              <Text style={styles.footerSkipText}>Skip Tour</Text>
            </Pressable>

            <View style={styles.navGroup}>
              {currentStepIndex > 1 && (
                <Pressable
                  style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7, backgroundColor: colors.paper }]}
                  onPress={prevStep}
                >
                  <Ionicons name="chevron-back" size={15} color={colors.ink} />
                  <Text style={styles.backBtnText}>Back</Text>
                </Pressable>
              )}

              <Pressable
                style={({ pressed }) => [
                  styles.nextBtn,
                  { backgroundColor: accent },
                  pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] },
                ]}
                onPress={nextStep}
                disabled={isTransitioning}
              >
                <Text style={styles.nextBtnText}>
                  {currentStepIndex === TOUR_STEPS.length - 2 ? 'Finish ✓' : 'Next'}
                </Text>
                {currentStepIndex < TOUR_STEPS.length - 2 && (
                  <Ionicons name="arrow-forward" size={14} color={colors.white} />
                )}
              </Pressable>
            </View>
          </View>
        </Animated.View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    left: 0, top: 0, right: 0, bottom: 0,
    zIndex: 99999,
    elevation: 99999,
  },

  backdrop: {
    backgroundColor: 'rgba(18, 16, 14, 0.65)',
  },

  // ─── Spotlight ───
  spotlightGlow: {
    position: 'absolute',
    borderRadius: 16,
  },

  // ─── Welcome / Completion Modal ───
  modalCenter: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    zIndex: 100000,
  },

  welcomeCard: {
    backgroundColor: '#FFFDF9',
    borderRadius: 22,
    padding: 26,
    borderWidth: 1,
    borderColor: 'rgba(220, 211, 192, 0.7)',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 24px 64px rgba(46, 42, 36, 0.22), 0 4px 16px rgba(46, 42, 36, 0.06)',
        } as any)
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.28,
          shadowRadius: 24,
          elevation: 16,
        }),
  },

  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(246, 241, 231, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(220, 211, 192, 0.5)',
    zIndex: 10,
  },

  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },

  guideCircle: {
    width: 48,
    height: 48,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 6px 18px rgba(185, 102, 89, 0.3)' } as any)
      : { shadowColor: '#B96659', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 }),
  },

  heroBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(185, 102, 89, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(185, 102, 89, 0.2)',
  },

  heroBadgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 10.5,
    color: colors.clayDeep,
    letterSpacing: 0.5,
  },

  welcomeTitle: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.ink,
    letterSpacing: -0.4,
    marginBottom: 6,
  },

  welcomeSub: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13.5,
    color: colors.inkSoft,
    lineHeight: 20,
    marginBottom: 18,
  },

  highlights: {
    gap: 9,
    marginBottom: 16,
  },

  highlightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    padding: 10,
    borderRadius: 13,
    backgroundColor: 'rgba(246, 241, 231, 0.5)',
    borderWidth: 1,
    borderColor: 'rgba(220, 211, 192, 0.4)',
  },

  highlightIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  highlightText: {
    flex: 1,
  },

  highlightTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.ink,
    marginBottom: 1,
  },

  highlightDesc: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.inkSoft,
    lineHeight: 16,
  },

  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 18,
  },

  timeText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.inkSoft,
  },

  primaryBtn: {
    backgroundColor: colors.clayDeep,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    paddingHorizontal: 20,
    borderRadius: radius.md,
    gap: 8,
    marginBottom: 10,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 6px 20px rgba(185, 102, 89, 0.35)' } as any)
      : { shadowColor: colors.clayDeep, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 }),
  },

  primaryBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 14.5,
    color: colors.white,
    letterSpacing: -0.2,
  },

  skipLink: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },

  skipLinkText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.inkSoft,
  },

  tipBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#FEF9EE',
    borderWidth: 1,
    borderColor: '#F3E5C8',
    marginBottom: 18,
  },

  tipText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 12.5,
    color: '#8C6824',
    lineHeight: 18,
  },

  // ─── Step Tooltip Card ───
  tooltipCard: {
    position: 'absolute',
    backgroundColor: '#FFFDF9',
    borderRadius: 18,
    padding: 0,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 16px 48px rgba(46, 42, 36, 0.2), 0 2px 8px rgba(46, 42, 36, 0.05)',
        } as any)
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.2,
          shadowRadius: 20,
          elevation: 12,
        }),
  },

  tooltipTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },

  guideCharBubble: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(246, 241, 231, 0.9)',
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },

  guideCharEmoji: {
    fontSize: 20,
  },

  progressSection: {
    flex: 1,
  },

  stepInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 5,
  },

  stepBadgeLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    letterSpacing: 0.3,
  },

  stepPercent: {
    fontFamily: fonts.bodyMedium,
    fontSize: 10.5,
    color: colors.inkSoft,
  },

  progressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.line,
    overflow: 'hidden',
  },

  progressFill: {
    height: '100%' as any,
    borderRadius: 2,
  },

  tooltipClose: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.paper,
  },

  // Body
  tooltipBody: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },

  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 7,
  },

  stepIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  stepTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    color: colors.ink,
    flex: 1,
    letterSpacing: -0.3,
  },

  stepDesc: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.inkSoft,
    lineHeight: 19,
  },

  // Footer
  tooltipFooter: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(246, 241, 231, 0.3)',
  },

  footerSkip: {
    paddingVertical: 5,
    paddingHorizontal: 2,
  },

  footerSkipText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.inkSoft,
  },

  navGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },

  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 11,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    gap: 3,
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
      ? ({ boxShadow: '0 4px 14px rgba(185, 102, 89, 0.3)' } as any)
      : { shadowColor: colors.clayDeep, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 6, elevation: 2 }),
  },

  nextBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.white,
  },
});
