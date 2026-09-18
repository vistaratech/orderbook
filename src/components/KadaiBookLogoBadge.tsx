import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import Svg, {
  Defs,
  LinearGradient,
  RadialGradient,
  Stop,
  Rect,
  Path,
  Circle,
  G,
} from 'react-native-svg';

interface KadaiBookLogoBadgeProps {
  size?: number;
  style?: ViewStyle;
}

export default function KadaiBookLogoBadge({
  size = 68,
  style,
}: KadaiBookLogoBadgeProps) {
  const cornerRadius = Math.round(size * 0.28);

  return (
    <View
      style={[
        styles.shadowContainer,
        {
          width: size,
          height: size,
          borderRadius: cornerRadius,
        },
        style,
      ]}
    >
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          {/* Cushion Base Gradient */}
          <LinearGradient id="cushionGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="#FAF2E8" />
            <Stop offset="50%" stopColor="#F1E4D4" />
            <Stop offset="100%" stopColor="#E5D3C0" />
          </LinearGradient>

          {/* Cushion Highlight Rim */}
          <LinearGradient id="cushionRim" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.8" />
            <Stop offset="100%" stopColor="#D5BEA8" stopOpacity="0.4" />
          </LinearGradient>

          {/* Book Shadow */}
          <RadialGradient id="bookShadow" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#4A3428" stopOpacity="0.35" />
            <Stop offset="80%" stopColor="#4A3428" stopOpacity="0.08" />
            <Stop offset="100%" stopColor="#4A3428" stopOpacity="0" />
          </RadialGradient>

          {/* Book Cover Terracotta Gradient */}
          <LinearGradient id="coverGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#BA624F" />
            <Stop offset="40%" stopColor="#A8523F" />
            <Stop offset="100%" stopColor="#8A3828" />
          </LinearGradient>

          {/* Book Spine Gradient */}
          <LinearGradient id="spineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor="#732B1D" />
            <Stop offset="60%" stopColor="#964332" />
            <Stop offset="100%" stopColor="#813222" />
          </LinearGradient>

          {/* Paper Pages Gradient */}
          <LinearGradient id="paperGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#FCF9F2" />
            <Stop offset="100%" stopColor="#EFE5D3" />
          </LinearGradient>
        </Defs>

        {/* 1. Cushion / Squircle Base */}
        <Rect
          x="3"
          y="3"
          width="94"
          height="94"
          rx="26"
          ry="26"
          fill="url(#cushionGrad)"
          stroke="url(#cushionRim)"
          strokeWidth="1.5"
        />

        {/* Soft bottom inner shadow on cushion */}
        <Path
          d="M 16 78 C 30 89, 70 89, 84 78 C 81 88, 68 93, 50 93 C 32 93, 19 88, 16 78 Z"
          fill="#D6BFA9"
          opacity="0.5"
        />

        {/* 2. Book Drop Shadow on Cushion */}
        <G transform="translate(48, 60) scale(1, 0.35)">
          <Circle cx="0" cy="0" r="32" fill="url(#bookShadow)" />
        </G>

        {/* 3. Book Group with 3D Depth */}
        <G transform="translate(1, 0)">
          {/* Layered Paper Edges (Right and Bottom) */}
          {/* Bottom Page Edge */}
          <Path
            d="M 28 66 L 73 66 C 75 66, 76 67, 76 69 L 75 73 C 75 74.5, 73.5 75.5, 71 75.5 L 29 75.5 C 27 75.5, 26 74, 26 72 Z"
            fill="url(#paperGrad)"
            stroke="#D3C3AD"
            strokeWidth="0.8"
          />
          {/* Right Page Edge */}
          <Path
            d="M 72 26 L 76 28 C 77.5 29, 78 30.5, 78 32 L 78 70 C 78 72, 76.5 73.5, 74.5 73 L 71 72 Z"
            fill="url(#paperGrad)"
            stroke="#D3C3AD"
            strokeWidth="0.8"
          />
          {/* Page lines texture */}
          <Path
            d="M 74 34 L 74 68 M 76 36 L 76 66"
            stroke="#DECDB8"
            strokeWidth="0.6"
          />

          {/* Book Spine (Left rounded edge) */}
          <Path
            d="M 24 24 C 21 24, 19 26, 19 30 L 19 66 C 19 70, 21 72, 24 72 L 29 72 L 29 24 Z"
            fill="url(#spineGrad)"
          />
          {/* Spine Stitch Marks */}
          <Path
            d="M 21 34 L 26 34 M 21 48 L 26 48 M 21 62 L 26 62"
            stroke="#BF7161"
            strokeWidth="1.2"
            strokeLinecap="round"
          />

          {/* Main Book Cover Front Face */}
          <Rect
            x="27"
            y="22"
            width="46"
            height="48"
            rx="5"
            ry="5"
            fill="url(#coverGrad)"
          />

          {/* Cover Top & Left Bevel Highlights */}
          <Path
            d="M 28 23 L 71 23 C 72 23, 72.5 23.5, 72.5 24.5 L 28 24.5 Z"
            fill="#FFFFFF"
            opacity="0.25"
          />
          <Path
            d="M 27.5 23 L 29 23 L 29 69 L 27.5 69 Z"
            fill="#000000"
            opacity="0.15"
          />

          {/* 4. White Shopping Cart Icon on Front Cover */}
          <G transform="translate(37, 33)">
            {/* Cart Basket */}
            <Path
              d="M 3 5 L 6.5 5 L 9.5 17 C 9.8 18.2, 10.8 19, 12 19 L 22 19 C 23.2 19, 24.2 18.2, 24.5 17 L 27 8.5 C 27.2 7.8, 26.7 7, 26 7 L 7.5 7"
              fill="none"
              stroke="#FFFFFF"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Cart Horizontal Inner Grid Lines */}
            <Path
              d="M 8.5 11 L 25.5 11 M 9.8 15 L 23.5 15"
              stroke="#FFFFFF"
              strokeWidth="1.2"
              strokeLinecap="round"
              opacity="0.8"
            />
            {/* Left Wheel */}
            <Circle cx="12.5" cy="23.5" r="2.2" fill="#FFFFFF" />
            {/* Right Wheel */}
            <Circle cx="21" cy="23.5" r="2.2" fill="#FFFFFF" />
          </G>
        </G>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  shadowContainer: {
    shadowColor: '#4A3428',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
