import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithCredential,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  updateProfile,
  User as FirebaseUser,
  AuthCredential,
} from 'firebase/auth';
import { ref, set, get } from 'firebase/database';
import { auth, rtdb } from '../config/firebase';
import { generateId } from '../utils/id';
import { todayIso } from '../utils/format';
import { readCollectionFromCloud, readValueFromCloud } from './firebaseSync';

export interface UserAccount {
  id: string;
  uid?: string;
  name: string;
  email: string;
  businessName: string;
  phone: string;
  role: 'owner' | 'guest';
  createdAt: string;
}

export interface AuthState {
  isOnboarded: boolean;
  isLoggedIn: boolean;
  user: UserAccount | null;
  hasPin: boolean;
}

const AUTH_USER_KEY = 'order_book:auth_user';
const AUTH_SESSION_KEY = 'order_book:auth_session';
const AUTH_PIN_KEY = 'order_book:auth_pin';
const ONBOARDED_KEY = 'order_book:is_onboarded';

// All local data keys that are user-specific
const USER_DATA_KEYS = [
  'order_book:orders',
  'order_book:order_seq',
  'order_book:expenses',
  'order_book:customers',
  'order_book:products',
  'order_book:payments',
  'order_book:business_profile',
];

export async function getAuthState(): Promise<AuthState> {
  const [onboardedRaw, sessionRaw, userRaw, pinRaw] = await AsyncStorage.multiGet([
    ONBOARDED_KEY,
    AUTH_SESSION_KEY,
    AUTH_USER_KEY,
    AUTH_PIN_KEY,
  ]);

  const isOnboarded = onboardedRaw[1] === 'true';
  const isLoggedIn = sessionRaw[1] === 'true';
  let user: UserAccount | null = null;
  if (userRaw[1]) {
    try {
      user = JSON.parse(userRaw[1]);
    } catch {}
  }
  const hasPin = !!pinRaw[1];

  return {
    isOnboarded,
    isLoggedIn,
    user,
    hasPin,
  };
}

/**
 * Setup user profile from Firebase User object (Email or Google Sign In)
 */
export async function setupUserFromFirebase(fbUser: FirebaseUser): Promise<UserAccount> {
  const cleanEmail = fbUser.email?.toLowerCase().trim() || 'user@orderbook.com';
  let businessName = 'My Business';
  let phone = fbUser.phoneNumber || '';
  let name = fbUser.displayName || 'Store Owner';

  try {
    const userRef = ref(rtdb, `users/${fbUser.uid}/profile`);
    const snapshot = await get(userRef);
    if (snapshot.exists()) {
      const data = snapshot.val();
      businessName = data.businessName || businessName;
      phone = data.phone || phone;
      name = data.name || name;
    } else {
      // First-time Google / Firebase user -> create profile in RTDB
      await set(userRef, {
        uid: fbUser.uid,
        name,
        email: cleanEmail,
        businessName,
        phone,
        role: 'owner',
        createdAt: todayIso(),
      });
      const settingsRef = ref(rtdb, `users/${fbUser.uid}/settings`);
      await set(settingsRef, {
        businessProfile: {
          businessName,
          phone,
          address: '',
          currency: '₹ INR',
        },
        orderSeq: 0,
      });
    }
  } catch (err) {
    console.warn('Realtime database profile sync skipped:', err);
  }

  const user: UserAccount = {
    id: fbUser.uid,
    uid: fbUser.uid,
    name,
    email: cleanEmail,
    businessName,
    phone,
    role: 'owner',
    createdAt: todayIso(),
  };

  // Clear previous user's local cache
  await AsyncStorage.multiRemove(USER_DATA_KEYS);

  await AsyncStorage.multiSet([
    [AUTH_USER_KEY, JSON.stringify(user)],
    [AUTH_SESSION_KEY, 'true'],
    [ONBOARDED_KEY, 'true'],
    [
      'order_book:business_profile',
      JSON.stringify({
        businessName,
        phone,
        address: '',
        currency: '₹ INR',
      }),
    ],
  ]);

  // Pull cloud data into local cache
  await pullCloudDataToLocal();

  return user;
}

export async function loginWithGoogle(): Promise<{ success: boolean; error?: string }> {
  // Web platform: use Firebase signInWithPopup directly
  if (Platform.OS === 'web') {
    try {
      const provider = new GoogleAuthProvider();
      provider.addScope('profile');
      provider.addScope('email');
      const result = await signInWithPopup(auth, provider);
      await setupUserFromFirebase(result.user);
      return { success: true };
    } catch (firebaseErr: any) {
      console.warn('Google sign-in error:', JSON.stringify(firebaseErr, null, 2));
      const code = firebaseErr?.code;
      const msg = firebaseErr?.message || '';
      let friendlyError = `Google Sign-In failed. Error: ${code || msg}`;
      if (code === 'auth/popup-closed-by-user') {
        friendlyError = 'You closed the Google popup before completing sign-in. Please try again.';
      } else if (code === 'auth/cancelled-popup-request') {
        friendlyError = 'Another popup was already open. Please close it and try again.';
      } else if (code === 'auth/operation-not-allowed') {
        friendlyError = 'Google Sign-In is not enabled yet.\n\nGo to Firebase Console → Authentication → Sign-in method → Google → Enable';
      } else if (code === 'auth/unauthorized-domain') {
        friendlyError = 'This domain is not authorized for Google Sign-In.\n\nGo to Firebase Console → Authentication → Settings → Authorized domains → Add your domain';
      } else if (code === 'auth/network-request-failed') {
        friendlyError = 'Network error. Please check your internet connection.';
      } else if (code === 'auth/internal-error') {
        friendlyError = 'Firebase internal error. Make sure Google Sign-In is enabled in Firebase Console → Authentication → Sign-in method.';
      }
      return { success: false, error: friendlyError };
    }
  }

  // Mobile platform: use expo-auth-session
  // Mobile platform: Google Sign-In needs Web Client ID setup
  return {
    success: false,
    error:
      'Google Sign-In on mobile requires setup:\n\n' +
      '1. Go to Firebase Console → Authentication → Sign-in method\n' +
      '2. Enable Google provider\n' +
      '3. Copy the "Web Client ID" shown\n' +
      '4. Share it here and I\'ll configure the app\n\n' +
      'For now, use Email & Password to sign in.',
  };
}

export async function loginWithGoogleCredential(credential: AuthCredential): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await signInWithCredential(auth, credential);
    await setupUserFromFirebase(result.user);
    return { success: true };
  } catch (firebaseErr: any) {
    console.warn('Google credential error:', firebaseErr);
    return { success: false, error: firebaseErr?.message || 'Google sign-in failed.' };
  }
}

export async function registerUser(params: {
  name: string;
  email: string;
  password: string;
  pin?: string;
  businessName: string;
  phone: string;
}): Promise<UserAccount> {
  // Always create real Firebase account
  const userCredential = await createUserWithEmailAndPassword(
    auth,
    params.email.toLowerCase().trim(),
    params.password
  );
  const uid = userCredential.user.uid;

  // Update Firebase Auth Display Name
  await updateProfile(userCredential.user, {
    displayName: params.name,
  });

  // Save profile in Firebase Realtime Database
  try {
    const userRef = ref(rtdb, `users/${uid}/profile`);
    await set(userRef, {
      uid,
      name: params.name,
      email: params.email.toLowerCase().trim(),
      businessName: params.businessName,
      phone: params.phone,
      role: 'owner',
      createdAt: todayIso(),
    });

    // Also save business profile & initial settings in cloud
    const settingsRef = ref(rtdb, `users/${uid}/settings`);
    await set(settingsRef, {
      businessProfile: {
        businessName: params.businessName,
        phone: params.phone,
        address: '',
        currency: '₹ INR',
      },
      orderSeq: 0,
    });
  } catch (dbErr) {
    console.warn('Realtime database profile sync skipped:', dbErr);
  }

  const user: UserAccount = {
    id: uid,
    uid,
    name: params.name,
    email: params.email.toLowerCase().trim(),
    businessName: params.businessName,
    phone: params.phone,
    role: 'owner',
    createdAt: todayIso(),
  };

  // Clear any old user's local data before saving new user
  await AsyncStorage.multiRemove(USER_DATA_KEYS);

  const updates: [string, string][] = [
    [AUTH_USER_KEY, JSON.stringify(user)],
    [AUTH_SESSION_KEY, 'true'],
    [ONBOARDED_KEY, 'true'],
    [
      'order_book:business_profile',
      JSON.stringify({
        businessName: params.businessName,
        phone: params.phone,
        address: '',
        currency: '₹ INR',
      }),
    ],
  ];

  if (params.pin) {
    updates.push([AUTH_PIN_KEY, params.pin]);
  }

  await AsyncStorage.multiSet(updates);
  return user;
}

export async function loginWithPassword(
  email: string,
  password: string
): Promise<{ success: boolean; error?: string }> {
  const cleanEmail = email.toLowerCase().trim();

  try {
    const userCredential = await signInWithEmailAndPassword(auth, cleanEmail, password);
    const fbUser = userCredential.user;
    await setupUserFromFirebase(fbUser);
    return { success: true };
  } catch (firebaseErr: any) {
    const code = firebaseErr?.code;
    console.warn('Firebase login attempt:', code || firebaseErr?.message);

    // Format human-friendly error messages
    let friendlyError = 'Invalid email or password. Please check your credentials.';
    if (code === 'auth/operation-not-allowed') {
      friendlyError = 'Email/Password sign-in is not enabled in Firebase Console yet.\n\nGo to Firebase Console → Authentication → Sign-in method → Email/Password and turn on Enable.';
    } else if (code === 'auth/user-not-found' || code === 'auth/invalid-credential') {
      friendlyError = 'No account found with this email, or password was incorrect.\n\nIf you haven\'t created an account yet, click "Create Account" below!';
    } else if (code === 'auth/wrong-password') {
      friendlyError = 'Incorrect password. Please try again.';
    } else if (code === 'auth/invalid-email') {
      friendlyError = 'Please enter a valid email address.';
    } else if (code === 'auth/network-request-failed') {
      friendlyError = 'Network error. Please check your internet connection.';
    } else if (code === 'auth/too-many-requests') {
      friendlyError = 'Too many attempts. Please wait a moment and try again.';
    }

    return { success: false, error: friendlyError };
  }
}

/**
 * Pull all cloud data into local AsyncStorage cache.
 * Called on login to sync data from Firebase to the device.
 */
async function pullCloudDataToLocal(): Promise<void> {
  const collectionMap: Record<string, string> = {
    orders: 'order_book:orders',
    customers: 'order_book:customers',
    expenses: 'order_book:expenses',
    products: 'order_book:products',
    payments: 'order_book:payments',
  };

  for (const [cloudCol, localKey] of Object.entries(collectionMap)) {
    try {
      const items = await readCollectionFromCloud(cloudCol);
      if (items.length > 0) {
        await AsyncStorage.setItem(localKey, JSON.stringify(items));
      }
    } catch (err) {
      console.warn(`pullCloudDataToLocal(${cloudCol}) failed:`, err);
    }
  }

  // Also pull order sequence and business profile
  try {
    const cloudSeq = await readValueFromCloud<number>('settings/orderSeq');
    if (cloudSeq) {
      await AsyncStorage.setItem('order_book:order_seq', String(cloudSeq));
    }
    const cloudProfile = await readValueFromCloud<any>('settings/businessProfile');
    if (cloudProfile) {
      await AsyncStorage.setItem('order_book:business_profile', JSON.stringify(cloudProfile));
    }
  } catch {}
}

export async function loginWithPin(pin: string): Promise<boolean> {
  const storedPin = await AsyncStorage.getItem(AUTH_PIN_KEY);
  if (!storedPin) {
    return false;
  }
  if (storedPin === pin) {
    await AsyncStorage.setItem(AUTH_SESSION_KEY, 'true');
    return true;
  }
  return false;
}

export async function resetPassword(email: string): Promise<boolean> {
  try {
    await sendPasswordResetEmail(auth, email.toLowerCase().trim());
    return true;
  } catch (e) {
    console.warn('Password reset error:', e);
    return false;
  }
}

export async function loginAsGuest(): Promise<UserAccount> {
  // Guest gets isolated local-only data (no cloud sync)
  const guestUser: UserAccount = {
    id: 'guest_user',
    name: 'Public Visitor',
    email: 'guest@orderbook.com',
    businessName: 'Public Demo Book',
    phone: '',
    role: 'guest',
    createdAt: todayIso(),
  };
  // Clear any previous user data for clean guest session
  await AsyncStorage.multiRemove(USER_DATA_KEYS);
  await AsyncStorage.multiSet([
    [AUTH_USER_KEY, JSON.stringify(guestUser)],
    [AUTH_SESSION_KEY, 'true'],
  ]);
  return guestUser;
}

export async function logout(): Promise<void> {
  try {
    await firebaseSignOut(auth);
  } catch {}
  // Clear session and all local user data
  await AsyncStorage.multiRemove([
    AUTH_SESSION_KEY,
    AUTH_USER_KEY,
    AUTH_PIN_KEY,
    ...USER_DATA_KEYS,
  ]);
  await AsyncStorage.setItem(AUTH_SESSION_KEY, 'false');
}

export async function setPinCode(pin: string): Promise<void> {
  await AsyncStorage.setItem(AUTH_PIN_KEY, pin);
}

export async function setOnboardingComplete(complete = true): Promise<void> {
  await AsyncStorage.setItem(ONBOARDED_KEY, complete ? 'true' : 'false');
}
