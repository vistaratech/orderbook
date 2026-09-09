/**
 * Google Auth Hook — Native Implementation
 *
 * Uses @react-native-google-signin/google-signin which reads SHA-1 fingerprints
 * directly from google-services.json, fixing the 401 Unauthorized error in
 * signed production builds.
 *
 * - Web: Firebase signInWithPopup (unchanged)
 * - Mobile: GoogleSignin.signIn() native flow
 */

import { useCallback, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { GoogleAuthProvider } from 'firebase/auth';
import { loginWithGoogle, loginWithGoogleCredential } from '../storage/authStorage';
import { GOOGLE_WEB_CLIENT_ID } from '../config/google';

// Configure once at module load — safe to call multiple times
GoogleSignin.configure({
  webClientId: GOOGLE_WEB_CLIENT_ID,
  offlineAccess: false,
});

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

    // Web: use Firebase popup directly
    if (Platform.OS === 'web') {
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
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const userInfo = await GoogleSignin.signIn();
      const idToken = userInfo?.data?.idToken;

      if (!idToken) {
        setLoading(false);
        setError('Could not get ID token from Google.');
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
      const msg = err?.code === '10'
        ? 'Google Sign-In configuration error. Check SHA-1 fingerprints in Firebase Console.'
        : err?.message || 'Google Sign-In failed.';
      setError(msg);
      return { success: false };
    }
  }, []);

  return {
    signInWithGoogle,
    loading,
    error,
    isReady: true, // Always ready — native module needs no request object
  };
}
