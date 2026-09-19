/**
 * Google Auth Hook — Native Implementation with Expo Go Fallback
 *
 * Uses @react-native-google-signin/google-signin which reads SHA-1 fingerprints
 * directly from google-services.json, fixing the 401 Unauthorized error in
 * signed production builds.
 *
 * - Web: Firebase signInWithPopup (unchanged)
 * - Mobile (dev build): GoogleSignin.signIn() native flow
 * - Mobile (Expo Go): Falls back to Firebase signInWithPopup since native
 *   modules are not available in Expo Go
 */

import { useCallback, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { GoogleAuthProvider } from 'firebase/auth';
import { loginWithGoogle, loginWithGoogleCredential } from '../storage/authStorage';
import { GOOGLE_WEB_CLIENT_ID } from '../config/google';

// Try to import and configure native Google Sign-In.
// This will fail gracefully in Expo Go where the native module isn't available.
let GoogleSignin: any = null;
let isNativeGoogleAvailable = false;

if (Platform.OS !== 'web') {
  try {
    const nativeModule = require('@react-native-google-signin/google-signin');
    GoogleSignin = nativeModule.GoogleSignin;
    GoogleSignin.configure({
      webClientId: GOOGLE_WEB_CLIENT_ID,
      offlineAccess: false,
    });
    isNativeGoogleAvailable = true;
  } catch (e) {
    console.log('[GoogleAuth] Native module not available (Expo Go). Using Firebase web auth fallback.');
  }
}

interface UseGoogleAuthOptions {
  onSuccess?: () => void;
}

export function useGoogleAuth(options?: UseGoogleAuthOptions) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onSuccessRef = useRef(options?.onSuccess);
  onSuccessRef.current = options?.onSuccess;

  const signInWithGoogle = useCallback(async () => {
    setError(null);
    setLoading(true);

    // Web or Expo Go fallback: use Firebase popup directly
    if (Platform.OS === 'web' || !isNativeGoogleAvailable) {
      try {
        const result = await loginWithGoogle();
        setLoading(false);
        if (result.success) {
          onSuccessRef.current?.();
        } else {
          setError(result.error || 'Google Sign-In failed.');
        }
        return result;
      } catch (e: any) {
        setLoading(false);
        setError(e?.message || 'Google Sign-In failed.');
        return { success: false };
      }
    }

    // Native Android / iOS: use the native GoogleSignin module
    try {
      if (GoogleSignin) {
        GoogleSignin.configure({
          webClientId: GOOGLE_WEB_CLIENT_ID,
          offlineAccess: false,
        });
        await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      }

      const userInfo = await GoogleSignin.signIn();

      // Handle user cancellation in @react-native-google-signin v16+
      if (userInfo?.type === 'cancelled') {
        setLoading(false);
        return { success: false };
      }

      const idToken = userInfo?.data?.idToken ?? (userInfo as any)?.idToken;

      if (!idToken) {
        setLoading(false);
        setError('Could not get ID token from Google. Please try again.');
        return { success: false };
      }

      const credential = GoogleAuthProvider.credential(idToken);
      const result = await loginWithGoogleCredential(credential);
      setLoading(false);
      if (result.success) {
        onSuccessRef.current?.();
      } else {
        setError(result.error || 'Firebase sign-in failed.');
      }
      return result;
    } catch (err: any) {
      setLoading(false);
      const errorCode = String(err?.code || '');
      const errorMsg = String(err?.message || '');

      // User cancelled sign-in (back button or closed dialog)
      if (errorCode === '12501' || errorCode === 'SIGN_IN_CANCELLED' || errorMsg.includes('cancelled')) {
        return { success: false };
      }

      // Developer Error (Code 10 / 12500) — SHA-1 missing in Firebase
      let msg = 'Google Sign-In failed.';
      if (errorCode === '10' || errorCode === '12500' || errorMsg.includes('DEVELOPER_ERROR') || errorMsg.includes('10')) {
        msg = 'Google Sign-In Error (Code 10: DEVELOPER_ERROR). The app SHA-1 fingerprint is not registered in Firebase Console.';
      } else if (errorCode === 'PLAY_SERVICES_NOT_AVAILABLE') {
        msg = 'Google Play Services is not available or outdated on this device.';
      } else if (errorMsg) {
        msg = errorMsg;
      }

      console.warn('[GoogleAuth] Native sign-in error:', err);
      setError(msg);
      return { success: false, error: msg };
    }
  }, []);

  return {
    signInWithGoogle,
    loading,
    error,
    isReady: true, // Always ready — native module needs no request object
  };
}
