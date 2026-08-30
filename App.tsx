import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, Platform } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { useFonts, Caveat_600SemiBold, Caveat_700Bold } from '@expo-google-fonts/caveat';
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_700Bold,
} from '@expo-google-fonts/dm-sans';

import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootStackParamList } from './src/navigation/types';
import TabNavigator from './src/navigation/TabNavigator';
import OnboardingWizardScreen from './src/screens/OnboardingWizardScreen';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import OrderListScreen from './src/screens/OrderListScreen';
import OrderFormScreen from './src/screens/OrderFormScreen';
import OrderDetailScreen from './src/screens/OrderDetailScreen';
import ExpenseFormScreen from './src/screens/ExpenseFormScreen';
import CustomerListScreen from './src/screens/CustomerListScreen';
import CustomerDetailScreen from './src/screens/CustomerDetailScreen';
import CustomerFormScreen from './src/screens/CustomerFormScreen';
import ProductListScreen from './src/screens/ProductListScreen';
import ProductFormScreen from './src/screens/ProductFormScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import BusinessProfileScreen from './src/screens/BusinessProfileScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import ResetPasswordScreen from './src/screens/ResetPasswordScreen';
import GlassBackButton from './src/components/GlassBackButton';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './src/config/firebase';
import { getAuthState } from './src/storage/authStorage';
import {
  setupRealtimeSync,
  stopRealtimeSync,
  setCurrentUidCache,
  pullAllCloudDataToLocal,
  flushPendingWrites,
  notifyDataListeners,
} from './src/storage/firebaseSync';
import { colors, fonts } from './src/theme/theme';
import { LanguageProvider } from './src/i18n/LanguageContext';

const Stack = createNativeStackNavigator<RootStackParamList>();

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.paper,
    card: colors.paper,
    text: colors.ink,
    border: colors.line,
    primary: colors.clayDeep,
  },
};

export default function App() {
  const [fontsLoaded] = useFonts({
    Caveat_600SemiBold,
    Caveat_700Bold,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
  });

  const [initialRoute, setInitialRoute] = useState<keyof RootStackParamList | null>(null);

  useEffect(() => {
    // On web, check if user arrived via a password reset link (e.g. ?mode=resetPassword&oobCode=XYZ)
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const mode = urlParams.get('mode');
        const oobCode = urlParams.get('oobCode');
        if ((mode === 'resetPassword' || mode === 'reset') && oobCode) {
          setInitialRoute('ResetPassword');
          return;
        }
      } catch {}
    }

    // Check initial local auth state for initial screen routing
    getAuthState().then((state) => {
      if (!state.isOnboarded) {
        setInitialRoute('OnboardingWizard');
      } else if (!state.isLoggedIn) {
        setInitialRoute('Login');
      } else {
        if (state.user?.uid) {
          setCurrentUidCache(state.user.uid);
        }
        setInitialRoute('MainTabs');
      }
    });

    // Listen to Firebase live auth state -> activate real-time sync ONLY when auth is ready
    const unsubscribeAuth = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        setCurrentUidCache(fbUser.uid);
        setupRealtimeSync(fbUser.uid);
        // Flush any writes that happened before auth was ready
        await flushPendingWrites();
        // Pull latest cloud data and notify UI
        await pullAllCloudDataToLocal();
        notifyDataListeners();
      } else {
        stopRealtimeSync();
        notifyDataListeners();
      }
    });

    return () => {
      unsubscribeAuth();
      stopRealtimeSync();
    };
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.title = 'KadaiBook — Smart Business & Order Management | kadaibook.in';

      let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null;
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.getElementsByTagName('head')[0].appendChild(link);
      }
      link.href = '/favicon.png';

      const style = document.createElement('style');
      style.innerHTML = `
        @import url('https://fonts.googleapis.com/css2?family=Caveat:wght@600;700&family=DM+Sans:wght@400;500;700&display=swap');

        html, body, #root {
          height: 100%;
          height: 100dvh;
          min-height: 100dvh;
          background-color: #F6F1E7;
          margin: 0;
          padding: 0;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          user-select: none;
          overflow: hidden;
        }
        ::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        ::-webkit-scrollbar-track {
          background: #F6F1E7;
        }
        ::-webkit-scrollbar-thumb {
          background: #DCD3C0;
          border-radius: 3px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: #B96659;
        }
        [role="button"], button {
          cursor: pointer !important;
        }
        /* Fix: Remove browser focus outline on TextInputs */
        input, textarea {
          outline: none !important;
          -webkit-appearance: none;
        }
        input:focus, textarea:focus {
          outline: none !important;
          box-shadow: none !important;
        }
        /* Fix: Add hover effects for interactive cards and buttons */
        [role="button"]:hover {
          opacity: 0.85;
          transition: opacity 0.15s ease;
        }
        [role="button"]:active {
          opacity: 0.7;
          transition: opacity 0.05s ease;
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  if (!fontsLoaded || !initialRoute) {
    return (
      <SafeAreaProvider style={{ flex: 1, backgroundColor: colors.paper }}>
        <StatusBar style="dark" />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper }}>
          <ActivityIndicator color={colors.clayDeep} size="large" />
        </View>
      </SafeAreaProvider>
    );
  }

  const isWeb = Platform.OS === 'web';

  return (
    <SafeAreaProvider style={{ flex: 1, backgroundColor: colors.paper }}>
      <LanguageProvider>
        <View style={[{ flex: 1, backgroundColor: colors.paper }, isWeb ? styles.webOuterContainer : styles.mobileContainer]}>
          <View style={[{ flex: 1, backgroundColor: colors.paper }, isWeb ? styles.webInnerFrame : styles.mobileContainer]}>
            <NavigationContainer theme={navTheme}>
              <StatusBar style="dark" />
              <Stack.Navigator
                initialRouteName={initialRoute}
                screenOptions={{
                  headerStyle: { backgroundColor: colors.paper },
                  headerTitleStyle: { fontFamily: fonts.bodyBold, color: colors.ink },
                  headerShadowVisible: false,
                  headerTintColor: colors.clayDeep,
                  contentStyle: { backgroundColor: colors.paper },
                  animation: Platform.OS === 'web' ? 'none' : 'slide_from_right',
                  gestureEnabled: true,
                  fullScreenGestureEnabled: true,
                  headerLeft: (props) =>
                    props.canGoBack ? <GlassBackButton label="Back" /> : null,
                }}
              >
                <Stack.Screen
                  name="OnboardingWizard"
                  component={OnboardingWizardScreen}
                  options={{ headerShown: false }}
                />
                <Stack.Screen
                  name="Login"
                  component={LoginScreen}
                  options={{ headerShown: false }}
                />
                <Stack.Screen
                  name="Register"
                  component={RegisterScreen}
                  options={{ title: 'Create Account' }}
                />
                <Stack.Screen
                  name="MainTabs"
                  component={TabNavigator}
                  options={{ headerShown: false }}
                />
                <Stack.Screen
                  name="OrderList"
                  component={OrderListScreen}
                  options={{ title: 'All Orders' }}
                />
                <Stack.Screen
                  name="OrderForm"
                  component={OrderFormScreen}
                  options={{ title: 'New Order' }}
                />
                <Stack.Screen
                  name="OrderDetail"
                  component={OrderDetailScreen}
                  options={{ title: 'Order Details' }}
                />
                <Stack.Screen
                  name="ExpenseForm"
                  component={ExpenseFormScreen}
                  options={{ title: 'Record Outflow' }}
                />
                <Stack.Screen
                  name="CustomerList"
                  component={CustomerListScreen}
                  options={{ title: 'Customers' }}
                />
                <Stack.Screen
                  name="CustomerDetail"
                  component={CustomerDetailScreen}
                  options={{ title: 'Customer Profile' }}
                />
                <Stack.Screen
                  name="CustomerForm"
                  component={CustomerFormScreen}
                  options={{ title: 'Customer' }}
                />
                <Stack.Screen
                  name="ProductList"
                  component={ProductListScreen}
                  options={{ title: 'Product Catalog' }}
                />
                <Stack.Screen
                  name="ProductForm"
                  component={ProductFormScreen}
                  options={{ title: 'Product' }}
                />
                <Stack.Screen
                  name="Settings"
                  component={SettingsScreen}
                  options={{ headerShown: false }}
                />
                <Stack.Screen
                  name="BusinessProfile"
                  component={BusinessProfileScreen}
                  options={{ headerShown: false }}
                />
                <Stack.Screen
                  name="History"
                  component={HistoryScreen}
                  options={{ headerShown: false }}
                />
                <Stack.Screen
                  name="ResetPassword"
                  component={ResetPasswordScreen}
                  options={{ headerShown: false }}
                />
              </Stack.Navigator>
            </NavigationContainer>
          </View>
        </View>
      </LanguageProvider>
    </SafeAreaProvider>
  );
}

const styles = {
  mobileContainer: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  webOuterContainer: {
    flex: 1,
    height: '100dvh' as any,
    maxHeight: '100dvh' as any,
    backgroundColor: colors.paper,
    width: '100%' as any,
  },
  webInnerFrame: {
    flex: 1,
    height: '100%' as any,
    maxHeight: '100dvh' as any,
    width: '100%' as const,
    backgroundColor: colors.paper,
  },
};
