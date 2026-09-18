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
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, radius, shadow } from '../theme/theme';

const ordersImg = require('../../assets/onboarding-3d-orders.jpg');
const expensesImg = require('../../assets/onboarding-3d-expenses.jpg');
const analyticsImg = require('../../assets/onboarding-3d-analytics.jpg');

const DIORAMA_IMAGES = [ordersImg, expensesImg, analyticsImg];

interface Props {
  step: number; // 0, 1, 2
  onInteractiveTrigger?: (step: number) => void;
}

export default function Onboarding3DStage({ step, onInteractiveTrigger }: Props) {
  const currentStep = Math.max(0, Math.min(2, step));

  // ── Animations ──
  const floatAnim = useRef(new Animated.Value(0)).current;
  const rotateXAnim = useRef(new Animated.Value(0)).current;
  const rotateYAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const pulseScaleAnim = useRef(new Animated.Value(1)).current;

  // ── Slide 0 Interactive States (WhatsApp Simulator) ──
  const [waSent, setWaSent] = useState(false);
  const [activeStage, setActiveStage] = useState<'Placed' | 'Packed' | 'Dispatched' | 'Delivered'>('Dispatched');
  const waBeamAnim = useRef(new Animated.Value(0)).current;

  // ── Slide 1 Interactive States (Live Profit Radar) ──
  const [includeFabric, setIncludeFabric] = useState(true);
  const [includeCourier, setIncludeCourier] = useState(true);
  const [includePackaging, setIncludePackaging] = useState(true);
  const profitBounceAnim = useRef(new Animated.Value(1)).current;

  // ── Slide 2 Interactive States (Growth Trophy & Counter) ──
  const [trophyUnlocked, setTrophyUnlocked] = useState(false);
  const [counterNum, setCounterNum] = useState(32800);
  const trophyPulseAnim = useRef(new Animated.Value(1)).current;

  // WebGL Three.js canvas ref for web
  const canvasRef = useRef<any>(null);

  // Reset states when step changes
  useEffect(() => {
    scaleAnim.setValue(0.92);
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 7,
      tension: 60,
      useNativeDriver: true,
    }).start();
  }, [currentStep]);

  // Gentle continuous 3D floating and breathing ambient glow
  useEffect(() => {
    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -8,
          duration: 2200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 6,
          duration: 2200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0.25,
          duration: 2000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    floatLoop.start();
    glowLoop.start();

    return () => {
      floatLoop.stop();
      glowLoop.stop();
    };
  }, []);

  // WebGL Three.js Ambient Golden Dust Motes (on Web)
  useEffect(() => {
    if (Platform.OS !== 'web' || !canvasRef.current) return;

    let renderer: any;
    let scene: any;
    let camera: any;
    let particles: any;
    let animFrameId: number;

    const initThree = async () => {
      try {
        const THREE = await import('three');
        const canvas = canvasRef.current;
        if (!canvas) return;

        const width = canvas.clientWidth || 360;
        const height = canvas.clientHeight || 270;

        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
        camera.position.z = 250;

        renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
        renderer.setSize(width, height, false);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        // Golden dust motes
        const count = 48;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(count * 3);

        for (let i = 0; i < count; i++) {
          positions[i * 3] = (Math.random() - 0.5) * 300;
          positions[i * 3 + 1] = (Math.random() - 0.5) * 220;
          positions[i * 3 + 2] = (Math.random() - 0.5) * 140;
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const particleColor =
          currentStep === 0 ? 0x25D366 : currentStep === 1 ? 0xE6A15C : 0xD4A745;

        const material = new THREE.PointsMaterial({
          color: particleColor,
          size: 3.8,
          transparent: true,
          opacity: 0.7,
          blending: THREE.AdditiveBlending,
        });

        particles = new THREE.Points(geometry, material);
        scene.add(particles);

        const clock = new THREE.Clock();

        const renderLoop = () => {
          animFrameId = requestAnimationFrame(renderLoop);
          const elapsed = clock.getElapsedTime();
          particles.rotation.y = elapsed * 0.08;
          particles.rotation.x = Math.sin(elapsed * 0.05) * 0.05;
          renderer.render(scene, camera);
        };

        renderLoop();
      } catch (e) {}
    };

    initThree();

    return () => {
      if (animFrameId) cancelAnimationFrame(animFrameId);
      if (renderer) renderer.dispose();
    };
  }, [currentStep]);

  // Pointer move / tilt tracking on desktop/web
  const handlePointerMove = (e: any) => {
    if (Platform.OS !== 'web') return;
    const { nativeEvent } = e;
    const rect = e.currentTarget?.getBoundingClientRect?.();
    if (!rect) return;

    const x = (nativeEvent.clientX - rect.left) / rect.width - 0.5;
    const y = (nativeEvent.clientY - rect.top) / rect.height - 0.5;

    Animated.spring(rotateYAnim, {
      toValue: x * 14,
      friction: 8,
      tension: 60,
      useNativeDriver: true,
    }).start();

    Animated.spring(rotateXAnim, {
      toValue: -y * 14,
      friction: 8,
      tension: 60,
      useNativeDriver: true,
    }).start();
  };

  const handlePointerLeave = () => {
    Animated.spring(rotateYAnim, { toValue: 0, friction: 6, useNativeDriver: true }).start();
    Animated.spring(rotateXAnim, { toValue: 0, friction: 6, useNativeDriver: true }).start();
  };

  // ── Handlers for Micro-Playgrounds ──

  // Slide 0: WhatsApp Send Simulator
  const handleSimulateWhatsApp = () => {
    waBeamAnim.setValue(0);
    Animated.sequence([
      Animated.timing(waBeamAnim, {
        toValue: 1,
        duration: 350,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(pulseScaleAnim, {
        toValue: 1.06,
        friction: 4,
        tension: 80,
        useNativeDriver: true,
      }),
      Animated.spring(pulseScaleAnim, {
        toValue: 1,
        friction: 5,
        tension: 70,
        useNativeDriver: true,
      }),
    ]).start();

    setWaSent(true);
    onInteractiveTrigger?.(0);
  };

  // Slide 1: Live Profit Calculation
  const totalRevenue = 3600;
  const fabricCost = includeFabric ? 900 : 0;
  const courierCost = includeCourier ? 250 : 0;
  const packagingCost = includePackaging ? 150 : 0;
  const totalOutflow = fabricCost + courierCost + packagingCost;
  const netProfit = totalRevenue - totalOutflow;
  const netMarginPct = Math.round((netProfit / totalRevenue) * 100);

  const toggleCost = (type: 'fabric' | 'courier' | 'packaging') => {
    if (type === 'fabric') setIncludeFabric(!includeFabric);
    if (type === 'courier') setIncludeCourier(!includeCourier);
    if (type === 'packaging') setIncludePackaging(!includePackaging);

    profitBounceAnim.setValue(0.88);
    Animated.spring(profitBounceAnim, {
      toValue: 1,
      friction: 4,
      tension: 90,
      useNativeDriver: true,
    }).start();

    onInteractiveTrigger?.(1);
  };

  // Slide 2: Trophy & Counter Unlock
  const handleTrophyTap = () => {
    setTrophyUnlocked(true);
    trophyPulseAnim.setValue(0.8);
    Animated.spring(trophyPulseAnim, {
      toValue: 1,
      friction: 3,
      tension: 80,
      useNativeDriver: true,
    }).start();

    // Quick count up animation
    setCounterNum(48500);
    onInteractiveTrigger?.(2);
  };

  // Interpolations
  const rotateXStr = rotateXAnim.interpolate({
    inputRange: [-15, 15],
    outputRange: ['-15deg', '15deg'],
  });
  const rotateYStr = rotateYAnim.interpolate({
    inputRange: [-15, 15],
    outputRange: ['-15deg', '15deg'],
  });

  const themeColor =
    currentStep === 0
      ? colors.clayDeep
      : currentStep === 1
      ? colors.duskDeep
      : colors.statusPlaced;

  return (
    <View style={styles.container}>
      {/* ── Ambient Radial Halo Glow ── */}
      <Animated.View
        style={[
          styles.ambientHalo,
          {
            backgroundColor: themeColor,
            opacity: glowAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0.18, 0.45],
            }),
          },
        ]}
      />

      {/* ── Interactive 3D Stage Card ── */}
      <Pressable
        onHoverOut={handlePointerLeave}
        // @ts-ignore Web pointer movement
        onPointerMove={handlePointerMove}
        style={styles.stagePressable}
      >
        <Animated.View
          style={[
            styles.stageCard3D,
            {
              transform: [
                { perspective: 900 },
                { translateY: floatAnim },
                { rotateX: rotateXStr },
                { rotateY: rotateYStr },
                { scale: scaleAnim },
              ],
            },
          ]}
        >
          {/* 3D Clay Diorama Image */}
          <View style={styles.imageWrap}>
            <Image
              source={DIORAMA_IMAGES[currentStep]}
              style={styles.dioramaImage}
              resizeMode="cover"
            />
          </View>

          {/* Three.js WebGL Particle Sparkle Canvas Layer (Web) */}
          {Platform.OS === 'web' && (
            // @ts-ignore
            <canvas ref={canvasRef} style={styles.threeCanvas} />
          )}

          {/* Pedestal Shadow Floor */}
          <View style={styles.pedestalShadow} />
        </Animated.View>
      </Pressable>

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* ── "VERA MAARI" INTERACTIVE LIVE MICRO-PLAYGROUNDS ── */}
      {/* ══════════════════════════════════════════════════════════════ */}

      {/* ── SLIDE 0: Interactive 1-Tap WhatsApp Receipt Simulator ── */}
      {currentStep === 0 && (
        <Animated.View
          style={[
            styles.playgroundCard,
            { transform: [{ scale: pulseScaleAnim }] },
          ]}
        >
          {/* Header */}
          <View style={styles.playgroundHeader}>
            <View style={styles.playgroundBadgeGreen}>
              <Ionicons name="logo-whatsapp" size={13} color="#25D366" />
              <Text style={styles.playgroundBadgeTextGreen}>WHATSAPP RECEIPT ENGINE</Text>
            </View>
            <Text style={styles.playgroundOrderCode}>Order #1048 • Priya S.</Text>
          </View>

          {/* Status Pipeline Chips */}
          <View style={styles.pipelineRow}>
            {(['Placed', 'Packed', 'Dispatched', 'Delivered'] as const).map((stage) => {
              const isSelected = activeStage === stage;
              return (
                <Pressable
                  key={stage}
                  style={[
                    styles.pipelineChip,
                    isSelected && styles.pipelineChipActive,
                  ]}
                  onPress={() => setActiveStage(stage)}
                >
                  <Text
                    style={[
                      styles.pipelineChipText,
                      isSelected && styles.pipelineChipTextActive,
                    ]}
                  >
                    {stage}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Receipt Confirmation / Simulator Trigger */}
          {waSent ? (
            <View style={styles.waConfirmedBanner}>
              <Ionicons name="checkmark-done-circle" size={18} color="#25D366" />
              <View style={{ flex: 1 }}>
                <Text style={styles.waConfirmedTitle}>Delivered to Priya's WhatsApp ✓✓</Text>
                <Text style={styles.waConfirmedSub}>
                  ₹1,850 itemized bill with UPI QR generated in 1.2s
                </Text>
              </View>
              <Pressable
                onPress={() => setWaSent(false)}
                style={styles.resendBtn}
              >
                <Text style={styles.resendBtnText}>Reset</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              style={({ pressed }) => [
                styles.waActionBtn,
                pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
              ]}
              onPress={handleSimulateWhatsApp}
            >
              <Ionicons name="paper-plane" size={14} color={colors.white} />
              <Text style={styles.waActionBtnText}>
                🚀 Tap to Send Live WhatsApp Bill
              </Text>
            </Pressable>
          )}
        </Animated.View>
      )}

      {/* ── SLIDE 1: Live Net Profit Radar & Margin Calculator ── */}
      {currentStep === 1 && (
        <View style={styles.playgroundCard}>
          {/* Header */}
          <View style={styles.playgroundHeader}>
            <View style={styles.playgroundBadgeDusk}>
              <Ionicons name="pulse" size={13} color={colors.duskDeep} />
              <Text style={styles.playgroundBadgeTextDusk}>LIVE PROFIT RADAR</Text>
            </View>
            <Text style={styles.playgroundHint}>Tap costs to toggle</Text>
          </View>

          {/* Interactive Cost Pills */}
          <View style={styles.costsRow}>
            <Pressable
              style={[
                styles.costPill,
                includeFabric && styles.costPillActive,
              ]}
              onPress={() => toggleCost('fabric')}
            >
              <Ionicons
                name={includeFabric ? 'checkbox' : 'square-outline'}
                size={14}
                color={includeFabric ? colors.clayDeep : colors.inkSoft}
              />
              <Text style={styles.costPillText}>Fabric ₹900</Text>
            </Pressable>

            <Pressable
              style={[
                styles.costPill,
                includeCourier && styles.costPillActive,
              ]}
              onPress={() => toggleCost('courier')}
            >
              <Ionicons
                name={includeCourier ? 'checkbox' : 'square-outline'}
                size={14}
                color={includeCourier ? colors.duskDeep : colors.inkSoft}
              />
              <Text style={styles.costPillText}>Courier ₹250</Text>
            </Pressable>

            <Pressable
              style={[
                styles.costPill,
                includePackaging && styles.costPillActive,
              ]}
              onPress={() => toggleCost('packaging')}
            >
              <Ionicons
                name={includePackaging ? 'checkbox' : 'square-outline'}
                size={14}
                color={includePackaging ? colors.statusPlaced : colors.inkSoft}
              />
              <Text style={styles.costPillText}>Pack ₹150</Text>
            </Pressable>
          </View>

          {/* Dynamic Live Net Margin Calculation */}
          <Animated.View
            style={[
              styles.marginCalculationBar,
              { transform: [{ scale: profitBounceAnim }] },
            ]}
          >
            <View>
              <Text style={styles.marginSub}>Revenue</Text>
              <Text style={styles.marginVal}>₹{totalRevenue}</Text>
            </View>
            <Text style={styles.marginOperator}>−</Text>
            <View>
              <Text style={styles.marginSub}>Costs</Text>
              <Text style={styles.marginValOutflow}>₹{totalOutflow}</Text>
            </View>
            <Text style={styles.marginOperator}>=</Text>
            <View style={styles.profitHeroPill}>
              <Text style={styles.profitHeroSub}>Your Take-Home Profit</Text>
              <Text style={styles.profitHeroVal}>
                ₹{netProfit} ({netMarginPct}%)
              </Text>
            </View>
          </Animated.View>
        </View>
      )}

      {/* ── SLIDE 2: Interactive Growth & Best-Seller Spotlight ── */}
      {currentStep === 2 && (
        <View style={styles.playgroundCard}>
          {/* Header */}
          <View style={styles.playgroundHeader}>
            <View style={styles.playgroundBadgeGold}>
              <Ionicons name="trophy" size={13} color="#B06000" />
              <Text style={styles.playgroundBadgeTextGold}>STORE GROWTH RADAR</Text>
            </View>
            <Text style={styles.growthMoMBadge}>+34% MoM</Text>
          </View>

          {/* Interactive Best Seller Tap Trigger */}
          <Pressable
            style={({ pressed }) => [
              styles.trophyActionRow,
              pressed && { opacity: 0.9 },
            ]}
            onPress={handleTrophyTap}
          >
            <Animated.View
              style={[
                styles.trophyIconWrap,
                { transform: [{ scale: trophyPulseAnim }] },
              ]}
            >
              <Ionicons
                name="star"
                size={18}
                color={trophyUnlocked ? '#D4A745' : colors.inkSoft}
              />
            </Animated.View>
            <View style={{ flex: 1 }}>
              <Text style={styles.trophyTitle}>
                {trophyUnlocked
                  ? '🏆 #1 Best Seller: Festive Silk Box'
                  : 'Tap Star Trophy to Spotlight Top Seller'}
              </Text>
              <Text style={styles.trophySub}>
                {trophyUnlocked
                  ? '72 units sold • Highest grossing item this month'
                  : 'Automatic analytics detect your high-profit products'}
              </Text>
            </View>
            <View style={styles.counterBox}>
              <Text style={styles.counterLabel}>Month Sales</Text>
              <Text style={styles.counterVal}>₹{counterNum.toLocaleString()}</Text>
            </View>
          </Pressable>

          {/* Customer Khata Insight Pill */}
          <View style={styles.khataInsightRow}>
            <View style={styles.vipDot} />
            <Text style={styles.khataInsightText}>
              <Text style={{ fontFamily: fonts.bodyBold }}>Top Buyer:</Text> Ananya Sen (8 orders • ₹19,400 LTV • ₹0 credit balance)
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
    position: 'relative',
  },
  ambientHalo: {
    position: 'absolute',
    width: 280,
    height: 220,
    borderRadius: 110,
    filter: 'blur(40px)' as any,
    zIndex: 0,
  },
  stagePressable: {
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  stageCard3D: {
    width: '100%',
    aspectRatio: 4 / 3,
    maxHeight: 250,
    borderRadius: radius.lg,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  imageWrap: {
    width: '100%',
    height: '100%',
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: '#FAF5EE',
    borderWidth: 1.5,
    borderColor: '#EFE5D5',
    ...shadow.card,
  },
  dioramaImage: {
    width: '100%',
    height: '100%',
  },
  threeCanvas: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    zIndex: 2,
    borderRadius: radius.lg,
  },
  pedestalShadow: {
    position: 'absolute',
    bottom: -8,
    width: '78%',
    height: 14,
    borderRadius: 10,
    backgroundColor: 'rgba(46, 42, 36, 0.08)',
    filter: 'blur(6px)' as any,
    zIndex: -1,
  },

  // ════════════════════════════════════════════════════════════════
  // ── "VERA MAARI" PLAYGROUND CARD STYLES ──
  // ════════════════════════════════════════════════════════════════
  playgroundCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.paperCard,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: '#EBE2D3',
    padding: 14,
    marginTop: 10,
    gap: 10,
    ...shadow.card,
    zIndex: 3,
  },
  playgroundHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  playgroundBadgeGreen: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  playgroundBadgeTextGreen: {
    fontFamily: fonts.bodyBold,
    fontSize: 9.5,
    color: '#2E7D32',
    letterSpacing: 0.5,
  },
  playgroundBadgeDusk: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#E8EFF2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  playgroundBadgeTextDusk: {
    fontFamily: fonts.bodyBold,
    fontSize: 9.5,
    color: colors.duskDeep,
    letterSpacing: 0.5,
  },
  playgroundBadgeGold: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FDF5E6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  playgroundBadgeTextGold: {
    fontFamily: fonts.bodyBold,
    fontSize: 9.5,
    color: '#B06000',
    letterSpacing: 0.5,
  },
  playgroundOrderCode: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: colors.inkSoft,
  },
  playgroundHint: {
    fontFamily: fonts.body,
    fontSize: 10.5,
    color: colors.inkSoft,
  },

  // Slide 0: WhatsApp Simulator
  pipelineRow: {
    flexDirection: 'row',
    gap: 6,
  },
  pipelineChip: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
  },
  pipelineChipActive: {
    backgroundColor: colors.clayDeep,
    borderColor: colors.clayDeep,
  },
  pipelineChipText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 10.5,
    color: colors.inkSoft,
  },
  pipelineChipTextActive: {
    color: colors.white,
    fontFamily: fonts.bodyBold,
  },
  waActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#25D366',
    paddingVertical: 10,
    borderRadius: radius.md,
    ...shadow.card,
  },
  waActionBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 12.5,
    color: colors.white,
  },
  waConfirmedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F0FAF3',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#C7EBD2',
  },
  waConfirmedTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 11.5,
    color: '#1B5E20',
  },
  waConfirmedSub: {
    fontFamily: fonts.body,
    fontSize: 10.5,
    color: colors.inkSoft,
  },
  resendBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    backgroundColor: '#D6EFE0',
  },
  resendBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    color: '#2E7D32',
  },

  // Slide 1: Live Margin Calculator
  costsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  costPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 7,
    borderRadius: radius.sm,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
  },
  costPillActive: {
    backgroundColor: colors.white,
    borderColor: colors.clayDeep,
    borderWidth: 1.5,
  },
  costPillText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    color: colors.ink,
  },
  marginCalculationBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F7FAF7',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#D4EAD6',
  },
  marginSub: {
    fontFamily: fonts.body,
    fontSize: 9.5,
    color: colors.inkSoft,
  },
  marginVal: {
    fontFamily: fonts.bodyBold,
    fontSize: 12.5,
    color: colors.ink,
  },
  marginValOutflow: {
    fontFamily: fonts.bodyBold,
    fontSize: 12.5,
    color: colors.outflow,
  },
  marginOperator: {
    fontFamily: fonts.display,
    fontSize: 14,
    color: colors.inkSoft,
  },
  profitHeroPill: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    alignItems: 'flex-end',
  },
  profitHeroSub: {
    fontFamily: fonts.body,
    fontSize: 9,
    color: '#2E7D32',
  },
  profitHeroVal: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: '#1B5E20',
  },

  // Slide 2: Growth Spotlight
  growthMoMBadge: {
    fontFamily: fonts.bodyBold,
    fontSize: 10.5,
    color: colors.inflow,
  },
  trophyActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FCFAF5',
    padding: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#F2E8D3',
  },
  trophyIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFF4D6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trophyTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 11.5,
    color: colors.ink,
  },
  trophySub: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.inkSoft,
  },
  counterBox: {
    alignItems: 'flex-end',
  },
  counterLabel: {
    fontFamily: fonts.body,
    fontSize: 9,
    color: colors.inkSoft,
  },
  counterVal: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.statusPlaced,
  },
  khataInsightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 4,
  },
  vipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.statusPlaced,
  },
  khataInsightText: {
    fontFamily: fonts.body,
    fontSize: 10.5,
    color: colors.inkSoft,
  },
});
