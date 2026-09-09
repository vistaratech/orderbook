import { Platform } from 'react-native';

// RevenueCat Public SDK API Keys
const API_KEYS = {
  apple: process.env.EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY || "appl_YOUR_APPLE_API_KEY",
  google: process.env.EXPO_PUBLIC_REVENUECAT_GOOGLE_API_KEY || "goog_joSKOsnztEoqDPlWQSlPvMBGwZn",
};

export const REVENUECAT_API_KEY = Platform.OS === 'ios' ? API_KEYS.apple : API_KEYS.google;
