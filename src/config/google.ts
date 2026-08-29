/**
 * Google OAuth Configuration
 *
 * Web Client ID from Firebase Console → Authentication → Sign-in method → Google
 *
 * TODO: Update this Web Client ID from the new Firebase project (orderbook-0).
 * Go to Firebase Console → Authentication → Sign-in method → Google → Web Client ID
 * and paste the new value below.
 */

export const GOOGLE_WEB_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
  '79850824559-g1qqksec5g2lng63t9sou6t8fmum2se7.apps.googleusercontent.com';

