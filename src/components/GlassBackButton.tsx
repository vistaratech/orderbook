import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colors, fonts } from '../theme/theme';

interface Props {
  label?: string;
  onPress?: () => void;
}

export default function GlassBackButton({ label = 'Back', onPress }: Props) {
  const navigation = useNavigation();

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      navigation.goBack();
    }
  };

  return (
    <Pressable
      style={({ pressed }) => [
        styles.capsule,
        pressed && styles.pressed,
      ]}
      onPress={handlePress}
    >
      <Ionicons name="chevron-back" size={16} color={colors.ink} style={styles.icon} />
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  capsule: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 13,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 253, 248, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(220, 211, 192, 0.8)',
    shadowColor: '#2E2A24',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 5,
    elevation: 3,
    gap: 3,
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.96 }],
    backgroundColor: colors.clayLight,
  },
  icon: {
    marginLeft: -2,
  },
  label: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.ink,
  },
});
