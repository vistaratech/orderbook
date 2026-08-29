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
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { generateId } from '../utils/id';
import { todayIso } from '../utils/format';
import {
  readCollectionFromCloud,
  readValueFromCloud,
  pullAllCloudDataToLocal,
  stopRealtimeSync,
  clearInMemoryStore,
  setCurrentUidCache,
  notifyDataListeners,
} from './firebaseSync';

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
    const userDoc = doc(db, 'users', fbUser.uid, 'profile', 'info');
    const snapshot = await getDoc(userDoc);
    if (snapshot.exists()) {
      const data = snapshot.data();
      businessName = data.businessName || businessName;
      phone = data.phone || phone;
      name = data.name || name;
    } else {
      // First-time Google / Firebase user -> create profile in Firestore
      await setDoc(userDoc, {
        uid: fbUser.uid,
        name,
        email: cleanEmail,
        businessName,
        phone,
        role: 'owner',
        createdAt: todayIso(),
      });
      const settingsDoc = doc(db, 'users', fbUser.uid, 'settings', 'app');
      await setDoc(settingsDoc, {
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
    console.warn('Firestore profile sync skipped:', err);
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

  // Check if switching user or new session — always clear in-memory cache and wipe previous user data
  clearInMemoryStore();
  const prevUserRaw = await AsyncStorage.getItem(AUTH_USER_KEY);
  let prevUserId: string | null = null;
  if (prevUserRaw) {
    try {
      prevUserId = JSON.parse(prevUserRaw)?.uid || JSON.parse(prevUserRaw)?.id || null;
    } catch {}
  }

  if (prevUserId !== fbUser.uid) {
    await AsyncStorage.multiRemove(USER_DATA_KEYS);
  }

  setCurrentUidCache(fbUser.uid);

  await AsyncStorage.multiSet([
    [AUTH_USER_KEY, JSON.stringify(user)],
    [AUTH_SESSION_KEY, 'true'],
    [ONBOARDED_KEY, 'true'],
  ]);

  // Pull cloud data into local cache
  await pullAllCloudDataToLocal();

  // Only set default business profile if cloud didn't provide one
  const existingProfile = await AsyncStorage.getItem('order_book:business_profile');
  if (!existingProfile) {
    await AsyncStorage.setItem(
      'order_book:business_profile',
      JSON.stringify({
        businessName,
        phone,
        address: '',
        currency: '₹ INR',
      })
    );
  }

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

  // Save profile in Firebase Firestore
  try {
    const userDoc = doc(db, 'users', uid, 'profile', 'info');
    await setDoc(userDoc, {
      uid,
      name: params.name,
      email: params.email.toLowerCase().trim(),
      businessName: params.businessName,
      phone: params.phone,
      role: 'owner',
      createdAt: todayIso(),
    });

    // Also save business profile & initial settings in cloud
    const settingsDoc = doc(db, 'users', uid, 'settings', 'app');
    await setDoc(settingsDoc, {
      businessProfile: {
        businessName: params.businessName,
        phone: params.phone,
        address: '',
        currency: '₹ INR',
      },
      orderSeq: 0,
    });
  } catch (dbErr) {
    console.warn('Firestore profile sync skipped:', dbErr);
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

  clearInMemoryStore();
  await AsyncStorage.multiRemove(USER_DATA_KEYS);
  setCurrentUidCache(uid);

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

    // Try business_profile collection first (holds complete logo photo, GSTIN, bank & address details)
    let cloudProfile: any = null;
    const bpCollection = await readCollectionFromCloud<any>('business_profile');
    if (bpCollection && bpCollection.length > 0) {
      cloudProfile = bpCollection[0];
    }

    // Fallback: try settings/businessProfile if collection was empty
    if (!cloudProfile) {
      cloudProfile = await readValueFromCloud<any>('settings/businessProfile');
    }

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
  stopRealtimeSync();
  clearInMemoryStore();
  setCurrentUidCache('local_guest');
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
  notifyDataListeners();
  return guestUser;
}

export async function logout(): Promise<void> {
  try {
    stopRealtimeSync();
    await firebaseSignOut(auth);
  } catch {}
  clearInMemoryStore();
  setCurrentUidCache(null);
  await AsyncStorage.multiRemove([
    ...USER_DATA_KEYS,
    AUTH_USER_KEY,
    AUTH_SESSION_KEY,
    AUTH_PIN_KEY,
  ]);
  await AsyncStorage.setItem(AUTH_SESSION_KEY, 'false');
  notifyDataListeners();
}

export async function setPinCode(pin: string): Promise<void> {
  await AsyncStorage.setItem(AUTH_PIN_KEY, pin);
}

export async function updateUserBusinessName(newBusinessName: string): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(AUTH_USER_KEY);
    if (raw) {
      const user = JSON.parse(raw);
      user.businessName = newBusinessName;
      await AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
    }
    // Also sync to Firestore users/{uid}/profile/info so re-login fetches latest name
    if (auth.currentUser) {
      const userDoc = doc(db, 'users', auth.currentUser.uid, 'profile', 'info');
      await setDoc(userDoc, { businessName: newBusinessName }, { merge: true });
    }
  } catch (err) {
    console.error('Error updating user businessName:', err);
  }
}

export async function setOnboardingComplete(complete = true): Promise<void> {
  await AsyncStorage.setItem(ONBOARDED_KEY, complete ? 'true' : 'false');
}

export async function sendResetPassword(email: string): Promise<{ success: boolean; error?: string }> {
  try {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { success: false, error: 'Please enter a valid email address.' };
    }
    await sendPasswordResetEmail(auth, cleanEmail);
    return { success: true };
  } catch (err: any) {
    console.warn('Password reset error:', err);
    let msg = 'Failed to send password reset email. Please try again.';
    if (err?.code === 'auth/user-not-found') {
      msg = 'No account found with this email address.';
    } else if (err?.code === 'auth/invalid-email') {
      msg = 'Invalid email address format.';
    } else if (err?.code === 'auth/too-many-requests') {
      msg = 'Too many attempts. Please wait a few moments and try again.';
    } else if (err?.code === 'auth/network-request-failed') {
      msg = 'Network error. Please check your internet connection.';
    }
    return { success: false, error: msg };
  }
}
