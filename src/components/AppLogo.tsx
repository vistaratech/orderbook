import React from 'react';
import { View, Text, StyleSheet, Image, ViewStyle, TextStyle } from 'react-native';
import Svg, {
  Path,
  Rect,
  Circle,
  G,
  Defs,
  LinearGradient,
  RadialGradient,
  Stop,
} from 'react-native-svg';
import { colors, fonts, radius } from '../theme/theme';

export type LogoSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type LogoVariant = 'icon' | 'vertical' | 'horizontal' | 'badge';

export interface AppLogoProps {
  size?: LogoSize | number;
  variant?: LogoVariant;
  showTagline?: boolean;
  taglineText?: string;
  style?: ViewStyle;
  imageMode?: boolean; // If true, uses the ultra-detailed 3D rendered asset
}

const SIZE_MAP: Record<LogoSize, number> = {
  xs: 24,
  sm: 36,
  md: 52,
  lg: 72,
  xl: 96,
};

/**
 * Vector SVG Book Icon with Leather Texture, Gold Seal, and Bookmark Ribbon
 */
export function AppLogoIcon({ size = 52 }: { size?: number }) {
  const borderRadius = Math.round(size * 0.22);

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#B96659',
      }}
    >
      <Svg
        width={size}
        height={size}
        viewBox="12 12 76 76"
        fill="none"
        style={{ transform: [{ scale: 1.15 }] }}
      >
        <Defs>
          {/* Background Squircle Gradient */}
          <LinearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#D98C82" />
            <Stop offset="100%" stopColor="#96483C" />
          </LinearGradient>

          {/* Book Cover Terracotta Gradient */}
          <LinearGradient id="bookCover" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#D98C82" />
            <Stop offset="40%" stopColor="#B96659" />
            <Stop offset="100%" stopColor="#96483C" />
          </LinearGradient>

          {/* Gold Seal Gradient */}
          <LinearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#F5DC9A" />
            <Stop offset="50%" stopColor="#D4A745" />
            <Stop offset="100%" stopColor="#A67B22" />
          </LinearGradient>

          {/* Gold Ribbon Gradient */}
          <LinearGradient id="ribbonGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#F7DF9E" />
            <Stop offset="70%" stopColor="#D4A745" />
            <Stop offset="100%" stopColor="#9C731C" />
          </LinearGradient>

          {/* Spine Highlight */}
          <LinearGradient id="spineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor="#7E372D" />
            <Stop offset="50%" stopColor="#C4756A" />
            <Stop offset="100%" stopColor="#96483C" />
          </LinearGradient>
        </Defs>

        {/* Squircle App Base */}
        <Rect
          x="3"
          y="3"
          width="94"
          height="94"
          rx="22"
          fill="url(#bgGrad)"
        />

        {/* Book Drop Shadow */}
        <Rect
          x="21"
          y="18"
          width="58"
          height="66"
          rx="6"
          fill="#2E2A24"
          opacity="0.12"
        />

        {/* Paper Page Edges (Layered bottom/right) */}
        <Rect
          x="24"
          y="19"
          width="54"
          height="63"
          rx="5"
          fill="#FDF9F0"
          stroke="#DCD3C0"
          strokeWidth="1"
        />
        {/* Page Lines */}
        <Path d="M74 24 L74 78" stroke="#E6DDCF" strokeWidth="1" strokeDasharray="2 1.5" />
        <Path d="M76 25 L76 77" stroke="#D5CBB9" strokeWidth="0.8" />
        <Path d="M28 80 L74 80" stroke="#E6DDCF" strokeWidth="1" />

        {/* Hardcover Book Main Body */}
        <Rect
          x="20"
          y="16"
          width="52"
          height="64"
          rx="5"
          fill="url(#bookCover)"
        />

        {/* Stitched Spine on the Left */}
        <Rect
          x="20"
          y="16"
          width="8"
          height="64"
          rx="3"
          fill="url(#spineGrad)"
        />
        <Path d="M22 28 L26 28" stroke="#F5DC9A" strokeWidth="1.2" strokeLinecap="round" />
        <Path d="M22 48 L26 48" stroke="#F5DC9A" strokeWidth="1.2" strokeLinecap="round" />
        <Path d="M22 68 L26 68" stroke="#F5DC9A" strokeWidth="1.2" strokeLinecap="round" />

        {/* Bookmark Ribbon Hanging Down from Top to Bottom */}
        <Path
          d="M58 14 C 58 14, 62 14, 63 17 C 64 20, 60 40, 62 60 C 63 70, 65 84, 65 88 L 60 84 L 55 88 L 57 70 C 58 55, 54 30, 56 16 Z"
          fill="url(#ribbonGrad)"
        />

        {/* Central Embossed Gold Seal */}
        <Circle cx="46" cy="46" r="14" fill="#96483C" stroke="url(#goldGrad)" strokeWidth="1.5" />
        <Circle cx="46" cy="46" r="12" fill="none" stroke="url(#goldGrad)" strokeWidth="0.8" strokeDasharray="1.5 1.5" />

        {/* Monogram "OB" in Gold */}
        <Path
          d="M 40 43 A 3 3 0 0 1 40 49 A 3 3 0 0 1 40 43 Z M 37 42 L 40 42 A 4 4 0 0 1 40 50 L 37 50 Z"
          fill="url(#goldGrad)"
        />
        <Path
          d="M 46 42 L 50 42 C 52 42, 53 43, 53 45 C 53 46, 52 46.5, 51 46.5 C 52.5 46.5, 53.5 47.5, 53.5 49 C 53.5 50, 52 50, 50 50 L 46 50 Z M 48 43.5 L 48 45.5 L 50 45.5 C 50.8 45.5, 51.3 45.1, 51.3 44.5 C 51.3 43.9, 50.8 43.5, 50 43.5 Z M 48 47 L 48 48.5 L 50.2 48.5 C 51 48.5, 51.6 48.2, 51.6 47.7 C 51.6 47.2, 51 47, 50.2 47 Z"
          fill="url(#goldGrad)"
        />
      </Svg>
    </View>
  );
}

/**
 * 3D Ultra-realistic Raster Brand Logo Asset
 */
export function AppLogoImage({ size = 52 }: { size?: number }) {
  const borderRadius = Math.round(size * 0.22);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#B96659',
      }}
    >
      <Image
        source={require('../../assets/icon.png')}
        style={{
          width: size,
          height: size,
          transform: [{ scale: 1.32 }],
        }}
        resizeMode="cover"
      />
    </View>
  );
}

/**
 * Main App Logo with Multi-Variant Support
 */
export default function AppLogo({
  size = 'md',
  variant = 'vertical',
  showTagline = true,
  taglineText = 'Smart Business & Order Management',
  style,
  imageMode = true,
}: AppLogoProps) {
  const pixelSize = typeof size === 'number' ? size : SIZE_MAP[size];
  const borderRadius = Math.round(pixelSize * 0.22);

  const renderIcon = () => {
    return imageMode ? (
      <View style={[styles.iconWrapper, { width: pixelSize, height: pixelSize, borderRadius }]}>
        <AppLogoImage size={pixelSize} />
      </View>
    ) : (
      <AppLogoIcon size={pixelSize} />
    );
  };

  if (variant === 'icon') {
    return <View style={[styles.container, style]}>{renderIcon()}</View>;
  }

  if (variant === 'horizontal') {
    return (
      <View style={[styles.horizontalContainer, style]}>
        {renderIcon()}
        <View style={styles.horizontalTextWrap}>
          <Text style={[styles.brandTitleH, { fontSize: Math.max(18, pixelSize * 0.45) }]}>
            KadaiBook
          </Text>
          {showTagline && (
            <Text
              style={[styles.brandSubtitleH, { fontSize: Math.max(10, pixelSize * 0.22) }]}
              numberOfLines={1}
            >
              {taglineText}
            </Text>
          )}
        </View>
      </View>
    );
  }

  if (variant === 'badge') {
    return (
      <View style={[styles.badgeContainer, style]}>
        <View style={styles.badgeIconWrap}>
          <AppLogoImage size={24} />
        </View>
        <View>
          <Text style={styles.badgeTitle}>KadaiBook</Text>
          <Text style={styles.badgeSubtitle}>Pro Ledger</Text>
        </View>
      </View>
    );
  }

  // Default: vertical
  return (
    <View style={[styles.verticalContainer, style]}>
      {renderIcon()}
      <Text style={[styles.brandTitleV, { fontSize: Math.max(22, pixelSize * 0.38) }]}>
        KadaiBook
      </Text>
      {showTagline && (
        <Text style={[styles.brandSubtitleV, { fontSize: Math.max(12, pixelSize * 0.16) }]}>
          {taglineText}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  verticalContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTitleV: {
    fontFamily: fonts.display,
    color: colors.ink,
    marginTop: 6,
    letterSpacing: 0.5,
  },
  brandSubtitleV: {
    fontFamily: fonts.body,
    color: colors.inkSoft,
    marginTop: -2,
    textAlign: 'center',
  },
  horizontalContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  horizontalTextWrap: {
    justifyContent: 'center',
  },
  brandTitleH: {
    fontFamily: fonts.display,
    color: colors.ink,
    lineHeight: 28,
  },
  brandSubtitleH: {
    fontFamily: fonts.body,
    color: colors.inkSoft,
    marginTop: -2,
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.paperCard,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    gap: 10,
  },
  badgeIconWrap: {
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  badgeTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.ink,
  },
  badgeSubtitle: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.clayDeep,
  },
});
