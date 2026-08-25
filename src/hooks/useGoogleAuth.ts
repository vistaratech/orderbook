/**
 * Google Auth Hook for Expo & Web
 *
 * - Web: Direct Firebase signInWithPopup (works out of the box in browser)
 * - Mobile (Expo Go): Uses expo-auth-session with Google OAuth
 *
 * Exposes an `onSuccess` callback pattern so screens can navigate after sign-in.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import { GoogleAuthProvider } from 'firebase/auth';
import { loginWithGoogle, loginWithGoogleCredential } from '../storage/authStorage';
import { GOOGLE_WEB_CLIENT_ID } from '../config/google';

WebBrowser.maybeCompleteAuthSession();

interface UseGoogleAuthOptions {
  onSuccess?: () => void;
}

export function useGoogleAuth(options?: UseGoogleAuthOptions) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onSuccessRef = useRef(options?.onSuccess);
  onSuccessRef.current = options?.onSuccess;

  const redirectUri = makeRedirectUri();

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: GOOGLE_WEB_CLIENT_ID,
    redirectUri,
  });

  useEffect(() => {
    if (response?.type === 'success') {
      const { id_token } = response.params;
      if (id_token) {
        handleGoogleIdToken(id_token);
      } else {
        setLoading(false);
        setError('Could not get authentication token from Google.');
      }
    } else if (response?.type === 'error') {
      setLoading(false);
      setError(response.error?.message || 'Google Sign-In failed.');
    } else if (response?.type === 'dismiss') {
      setLoading(false);
      setError(null);
    }
  }, [response]);

  const handleGoogleIdToken = async (idToken: string) => {
    try {
      const credential = GoogleAuthProvider.credential(idToken);
      const result = await loginWithGoogleCredential(credential);
      setLoading(false);
      if (result.success) {
        onSuccessRef.current?.();
      } else {
        setError(result.error || 'Firebase sign-in failed.');
      }
    } catch (err: any) {
      setLoading(false);
      setError(err?.message || 'Failed to sign in with Google.');
    }
  };

  const signInWithGoogle = useCallback(async () => {
    setError(null);
    setLoading(true);

    // Web: use Firebase native popup directly
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

    // Mobile (Expo Go): use expo-auth-session
    try {
      await promptAsync();
    } catch (err: any) {
      setLoading(false);
      setError(
        'Google Sign-In requires a production build for mobile.\n\n' +
        'Use Email & Password to sign in during development.'
      );
    }

    return { success: false };
  }, [promptAsync]);

  return {
    signInWithGoogle,
    loading,
    error,
    isReady: !!request,
  };
}
