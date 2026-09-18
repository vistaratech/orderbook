import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Svg, {
  Defs,
  LinearGradient,
  Stop,
  Path,
  Rect,
  Circle,
  G,
  Text as SvgText,
  Polygon,
} from 'react-native-svg';

interface Props {
  width?: number;
  height?: number;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function AuthBackgroundIllustration({
  width = SCREEN_WIDTH,
  height = 360,
}: Props) {
  return (
    <View style={[styles.container, { width, height }]} pointerEvents="none">
      <Svg
        width="100%"
        height="100%"
        viewBox="0 0 420 360"
        preserveAspectRatio="xMidYBottom meet"
      >
        <Defs>
          {/* Upper Dune Curve Gradient */}
          <LinearGradient id="duneUpper" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#F5ECE0" stopOpacity="0.6" />
            <Stop offset="50%" stopColor="#EBDECFA0" />
            <Stop offset="100%" stopColor="#E4D5C2" />
          </LinearGradient>

          {/* Lower Dune Ground Gradient */}
          <LinearGradient id="duneLower" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#E8DAC8" />
            <Stop offset="60%" stopColor="#DFCDBA" />
            <Stop offset="100%" stopColor="#D5BFAB" />
          </LinearGradient>

          {/* Storefront Wall Gradient */}
          <LinearGradient id="shopWall" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="#9C8576" />
            <Stop offset="100%" stopColor="#876F61" />
          </LinearGradient>

          {/* Awning Red Gradient */}
          <LinearGradient id="awningRed" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="#B35845" />
            <Stop offset="100%" stopColor="#913D2D" />
          </LinearGradient>

          {/* Awning Cream Gradient */}
          <LinearGradient id="awningCream" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="#FAF5EC" />
            <Stop offset="100%" stopColor="#EDE2CF" />
          </LinearGradient>

          {/* Leaf Left Sage Gradient */}
          <LinearGradient id="leafLeft" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#B6BDA5" />
            <Stop offset="100%" stopColor="#98A085" />
          </LinearGradient>

          {/* Leaf Right Olive Gradient */}
          <LinearGradient id="leafRight" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#8C997C" />
            <Stop offset="100%" stopColor="#6E7B5E" />
          </LinearGradient>
        </Defs>

        {/* ── 1. Background Rolling Sand Dunes ────────────────────────── */}
        {/* Layer 1: Upper organic curve sweeping across */}
        <Path
          d="M 420 190 Q 350 215 260 250 Q 140 295 0 245 L 0 360 L 420 360 Z"
          fill="url(#duneUpper)"
        />

        {/* Layer 2: Lower ground dune curve */}
        <Path
          d="M 420 265 Q 320 260 210 295 Q 100 330 0 320 L 0 360 L 420 360 Z"
          fill="url(#duneLower)"
        />

        {/* ── 2. Botanical Sprigs ────────────────────────────────────── */}
        {/* Left Botanical Leaves */}
        <G transform="translate(-14, 150)">
          {/* Main Stem */}
          <Path
            d="M 12 120 Q 28 65 18 0"
            fill="none"
            stroke="#8E977C"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          {/* Leaf 1 Top */}
          <Path
            d="M 18 0 C 28 14, 40 24, 44 38 C 34 40, 22 30, 18 10 Z"
            fill="url(#leafLeft)"
          />
          {/* Leaf 2 Mid */}
          <Path
            d="M 20 38 C 30 46, 48 56, 50 72 C 38 74, 26 62, 19 50 Z"
            fill="url(#leafLeft)"
          />
          {/* Leaf 3 Low */}
          <Path
            d="M 16 75 C 27 84, 40 96, 42 112 C 30 112, 19 100, 15 86 Z"
            fill="url(#leafLeft)"
          />
        </G>

        {/* Right Botanical Leaves */}
        <G transform="translate(365, 230)">
          {/* Stem */}
          <Path
            d="M 45 130 Q 28 75 34 10"
            fill="none"
            stroke="#687557"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          {/* Leaf 1 Top */}
          <Path
            d="M 34 10 C 22 20, 10 32, 4 48 C 16 52, 28 42, 33 24 Z"
            fill="url(#leafRight)"
          />
          {/* Leaf 2 Mid */}
          <Path
            d="M 36 48 C 20 58, 8 74, 4 90 C 18 92, 30 80, 37 62 Z"
            fill="url(#leafRight)"
          />
          {/* Leaf 3 Low */}
          <Path
            d="M 40 85 C 26 95, 14 112, 12 126 C 26 128, 36 116, 41 98 Z"
            fill="url(#leafRight)"
          />
        </G>

        {/* ── 3. Bottom Left Storefront ──────────────────────────────── */}
        <G transform="translate(-5, 205)">
          {/* Angled Roof Sign Board with "KadaiBook" */}
          <Polygon
            points="0,32 84,45 82,67 0,54"
            fill="#A34C38"
          />
          {/* White text "KadaiBook" on roof sign */}
          <G transform="translate(10, 50) rotate(9)">
            <SvgText
              x="0"
              y="0"
              fill="#FFFFFF"
              fontSize="13"
              fontFamily="PlusJakartaSans_800ExtraBold, sans-serif"
              fontWeight="900"
              letterSpacing="0.4"
            >
              KadaiBook
            </SvgText>
          </G>

          {/* Striped Awning Structure */}
          <Polygon points="0,54 88,68 98,100 0,89" fill="url(#awningRed)" />
          {/* Awning Alternating Cream Stripes */}
          <Polygon points="12,56 25,58 28,91 14,89" fill="url(#awningCream)" />
          <Polygon points="39,60 53,62 57,95 43,93" fill="url(#awningCream)" />
          <Polygon points="67,65 81,67 87,99 73,97" fill="url(#awningCream)" />

          {/* Awning Scallops Shadow & Shape */}
          <Path
            d="M 0 89 Q 7 96 14 90 Q 21 97 28 91 Q 35 99 43 93 Q 50 101 57 95 Q 65 102 73 97 Q 80 104 87 99 Q 93 105 98 100 L 98 95 L 0 85 Z"
            fill="#75291B"
            opacity="0.35"
          />

          {/* Storefront Wall Facade */}
          <Rect x="10" y="98" width="76" height="56" rx="2" fill="url(#shopWall)" />

          {/* Left: Wooden Door */}
          <Rect x="14" y="104" width="30" height="50" rx="2" fill="#583E2F" />
          <Rect x="16" y="106" width="26" height="23" rx="1" fill="#715240" />
          {/* Door Panes */}
          <Rect x="18" y="108" width="10" height="9" fill="#886955" />
          <Rect x="30" y="108" width="10" height="9" fill="#886955" />
          <Rect x="18" y="118.5" width="10" height="9" fill="#886955" />
          <Rect x="30" y="118.5" width="10" height="9" fill="#886955" />
          {/* Lower Door Panels */}
          <Rect x="16.5" y="132" width="12" height="19" fill="#463023" />
          <Rect x="29.5" y="132" width="12" height="19" fill="#463023" />
          {/* Brass Door Knob */}
          <Circle cx="39" cy="130" r="1.6" fill="#E2BD68" />

          {/* Right: Window with OPEN sign */}
          <Rect x="49" y="106" width="32" height="32" rx="2" fill="#463327" />
          <Rect x="51" y="108" width="28" height="28" fill="#85929B" opacity="0.85" />
          {/* Window Glass Reflection */}
          <Path d="M 55 108 L 51 112 L 51 121 L 68 108 Z" fill="#FFFFFF" opacity="0.25" />
          {/* Window Frame Panes */}
          <Path d="M 65 108 L 65 136 M 51 122 L 79 122" stroke="#463327" strokeWidth="1.2" />

          {/* Hanging "OPEN" Sign */}
          <G transform="translate(57.5, 118)">
            <Path d="M 2 -3 L 7 2 M 13 -3 L 8 2" stroke="#423024" strokeWidth="0.8" />
            <Rect x="1" y="2" width="14" height="8" rx="1" fill="#C46654" stroke="#423024" strokeWidth="0.6" />
            <SvgText
              x="8"
              y="8"
              fill="#FFFFFF"
              fontSize="4.5"
              fontFamily="sans-serif"
              fontWeight="bold"
              textAnchor="middle"
            >
              OPEN
            </SvgText>
          </G>

          {/* Storefront Curb Step */}
          <Rect x="8" y="152" width="82" height="5" rx="1" fill="#A35442" />

          {/* Potted Plant */}
          <G transform="translate(77, 131)">
            {/* Green Foliage */}
            <Circle cx="8" cy="8" r="7" fill="#5F834D" />
            <Circle cx="5" cy="4" r="5.5" fill="#759960" />
            <Circle cx="11" cy="4" r="5.5" fill="#698E55" />
            <Circle cx="8" cy="0" r="5" fill="#82A66C" />
            {/* Terracotta Flower Pot */}
            <Polygon points="3,11 13,11 11.5,22 4.5,22" fill="#BA6552" />
            <Rect x="2" y="9.5" width="12" height="2.5" rx="0.8" fill="#D37E6B" />
          </G>
        </G>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'hidden',
    zIndex: 0,
  },
});
