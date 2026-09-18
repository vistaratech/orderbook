import React from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  StyleSheet,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, radius, shadow } from '../theme/theme';
import { navigate } from '../navigation/navigationRef';

export interface SubscriptionLimitModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
  type?: 'order' | 'customer' | 'product';
  currentCount?: number;
  limit?: number;
  planName?: string;
  actionName?: string;
  onUpgrade?: () => void;
}

export default function SubscriptionLimitModal({
  visible,
  onClose,
  title,
  message,
  type = 'order',
  currentCount,
  limit = 10,
  planName = 'Free',
  actionName,
  onUpgrade,
}: SubscriptionLimitModalProps) {
  if (!visible) return null;

  const handleUpgradePress = () => {
    onClose();
    if (onUpgrade) {
      onUpgrade();
    } else {
      navigate('PaywallScreen');
    }
  };

  const getHeading = () => {
    if (title) return title;
    if (type === 'order') return 'Order Limit Reached';
    if (type === 'customer') return 'Customer Limit Reached';
    if (type === 'product') return 'Product Limit Reached';
    return 'Upgrade to Pro Required';
  };

  const getSubMessage = () => {
    if (message) return message;
    if (actionName) {
      return `You have reached your ${planName} plan limit (${currentCount !== undefined ? currentCount : limit}/${limit} ${type}s). Upgrade to Pro to ${actionName} and unlock unlimited access!`;
    }
    return `You have reached your ${planName} plan limit (${currentCount !== undefined ? currentCount : limit}/${limit} ${type}s). Upgrade to Pro for unlimited business growth!`;
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />

        <View style={styles.card}>
          {/* Close X Button */}
          <Pressable
            style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.7 }]}
            onPress={onClose}
            hitSlop={8}
          >
            <Ionicons name="close" size={20} color={colors.inkSoft} />
          </Pressable>

          {/* Crown Icon with glowing ring */}
          <View style={styles.iconCircle}>
            <Ionicons name="sparkles" size={28} color="#D97706" />
          </View>

          {/* Pro Badge */}
          <View style={styles.badgeRow}>
            <View style={styles.proPill}>
              <Ionicons name="star" size={12} color="#854D0E" />
              <Text style={styles.proPillText}>KADAIBOOK PRO</Text>
            </View>
            {currentCount !== undefined && (
              <View style={styles.quotaPill}>
                <Text style={styles.quotaPillText}>
                  {currentCount}/{limit} {type === 'order' ? 'Orders' : type === 'customer' ? 'Customers' : 'Products'}
                </Text>
              </View>
            )}
          </View>

          {/* Title & Description */}
          <Text style={styles.title}>{getHeading()}</Text>
          <Text style={styles.description}>{getSubMessage()}</Text>

          {/* Feature List */}
          <View style={styles.featureBox}>
            <View style={styles.featureItem}>
              <View style={styles.featureCheck}>
                <Ionicons name="checkmark" size={14} color="#15803D" />
              </View>
              <Text style={styles.featureText}>
                <Text style={styles.featureBold}>Unlimited Orders & Invoices</Text> — no monthly limits
              </Text>
            </View>

            <View style={styles.featureItem}>
              <View style={styles.featureCheck}>
                <Ionicons name="checkmark" size={14} color="#15803D" />
              </View>
              <Text style={styles.featureText}>
                <Text style={styles.featureBold}>Instant Payment Recording</Text> & WhatsApp reminders
              </Text>
            </View>

            <View style={styles.featureItem}>
              <View style={styles.featureCheck}>
                <Ionicons name="checkmark" size={14} color="#15803D" />
              </View>
              <Text style={styles.featureText}>
                <Text style={styles.featureBold}>Cloud Backup & Sync</Text> across mobile and desktop
              </Text>
            </View>
          </View>

          {/* Best Deal Badge */}
          <View style={styles.dealBadgeRow}>
            <Ionicons name="sparkles" size={12} color="#854D0E" />
            <Text style={styles.dealBadgeText}>
              Best Deal: <Text style={styles.dealBadgeBold}>₹1,499/year</Text> (Just ₹125/mo • Save 50%)
            </Text>
          </View>

          {/* Action Buttons */}
          <View style={styles.buttonGroup}>
            <Pressable
              style={({ pressed }) => [
                styles.upgradeBtn,
                pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
              ]}
              onPress={handleUpgradePress}
            >
              <Ionicons name="sparkles" size={18} color={colors.white} />
              <Text style={styles.upgradeBtnText}>Upgrade to Pro</Text>
              <Ionicons name="arrow-forward" size={16} color={colors.white} />
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.cancelBtn,
                pressed && { opacity: 0.7 },
              ]}
              onPress={onClose}
            >
              <Text style={styles.cancelBtnText}>Maybe Later</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    zIndex: 9999,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  dealBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginBottom: 16,
    width: '100%',
    justifyContent: 'center',
  },
  dealBadgeText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: '#854D0E',
  },
  dealBadgeBold: {
    fontFamily: fonts.bodyBold,
    color: '#713F12',
  },
  card: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: colors.paperCard,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 24,
    alignItems: 'center',
    ...shadow.card,
    elevation: 12,
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.line,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FEF3C7',
    borderWidth: 2,
    borderColor: '#FDE68A',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  proPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF08A',
    borderWidth: 1,
    borderColor: '#FACC15',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  proPillText: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    color: '#854D0E',
    letterSpacing: 0.5,
  },
  quotaPill: {
    backgroundColor: '#FCEBE9',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  quotaPillText: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    color: colors.danger,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.ink,
    textAlign: 'center',
    marginBottom: 6,
  },
  description: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.inkSoft,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  featureBox: {
    width: '100%',
    backgroundColor: colors.paper,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 14,
    gap: 10,
    marginBottom: 20,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  featureCheck: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.ink,
    lineHeight: 16,
  },
  featureBold: {
    fontFamily: fonts.bodyBold,
    color: colors.ink,
  },
  buttonGroup: {
    width: '100%',
    gap: 10,
  },
  upgradeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.clayDeep,
    paddingVertical: 14,
    borderRadius: radius.md,
    ...shadow.card,
  },
  upgradeBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    color: colors.white,
  },
  cancelBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  cancelBtnText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.inkSoft,
  },
});
