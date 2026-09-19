import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, Platform, Text, Image } from 'react-native';
import { NavigationContainer, DefaultTheme, getStateFromPath } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { 
  useFonts,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold
} from '@expo-google-fonts/plus-jakarta-sans';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync().catch(() => {});

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
import PurchaseListScreen from './src/screens/PurchaseListScreen';
import PurchaseFormScreen from './src/screens/PurchaseFormScreen';
import EstimateListScreen from './src/screens/EstimateListScreen';
import EstimateFormScreen from './src/screens/EstimateFormScreen';
import EstimateDetailScreen from './src/screens/EstimateDetailScreen';
import InvoiceTemplateCustomizerScreen from './src/screens/InvoiceTemplateCustomizerScreen';
import PaywallScreen from './src/screens/PaywallScreen';
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
import { initRevenueCat } from './src/storage/subscriptionStorage';
import { colors, fonts } from './src/theme/theme';
import { LanguageProvider } from './src/i18n/LanguageContext';
import { TourProvider } from './src/context/TourContext';
import { SubscriptionModalProvider } from './src/context/SubscriptionModalContext';
import { navigationRef } from './src/navigation/navigationRef';

const Stack = createNativeStackNavigator<RootStackParamList>();

let activeAuthRoute: keyof RootStackParamList = 'Login';

const linking = {
  prefixes: [
    'https://www.kadaibook.in',
    'https://kadaibook.in',
    'http://localhost:8081',
    'kadaibook://',
    Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : '',
  ].filter(Boolean),
  config: {
    screens: {
      OnboardingWizard: 'onboarding',
      Login: 'login',
      Register: 'register',
      ResetPassword: 'reset-password',
      MainTabs: {
        path: 'app',
        screens: {
          DashboardTab: 'dashboard',
          OrdersTab: 'orders',
          ExpensesTab: 'expenses',
          ReportsTab: 'reports',
          MoreTab: 'more',
        },
      },
      OrderList: 'orders-all',
      OrderForm: 'order/form/:orderId?',
      OrderDetail: 'order/:orderId',
      ExpenseForm: 'expense/form/:expenseId?',
      CustomerList: 'customers',
      CustomerDetail: 'customer/:customerId',
      CustomerForm: 'customer/form/:customerId?',
      ProductList: 'products',
      ProductForm: 'product/form/:productId?',
      Settings: 'settings',
      BusinessProfile: 'profile',
      History: 'history',
      PurchaseList: 'purchases',
      PurchaseForm: 'purchase/form/:purchaseId?',
      EstimateList: 'estimates',
      EstimateForm: 'estimate/form/:estimateId?',
      EstimateDetail: 'estimate/:estimateId',
      InvoiceTemplateCustomizer: 'invoice-customizer',
      PaywallScreen: 'upgrade',
    },
  },
  getStateFromPath: (path: string, options: any) => {
    const cleanPath = path.split('?')[0].replace(/^\/+|\/+$/g, '');

    // Root URL (e.g. kadaibook.in from WhatsApp, Instagram, or browser)
    if (!cleanPath) {
      if (activeAuthRoute === 'MainTabs') {
        return {
          routes: [
            {
              name: 'MainTabs',
              state: {
                routes: [{ name: 'DashboardTab' }],
              },
            },
          ],
        };
      }
      return {
        routes: [{ name: activeAuthRoute }],
      };
    }

    // Protected route safety guard: unauthenticated users are routed to Login
    if (activeAuthRoute !== 'MainTabs') {
      const publicRoutes = ['login', 'register', 'reset-password', 'onboarding'];
      if (!publicRoutes.includes(cleanPath)) {
        return {
          routes: [{ name: activeAuthRoute }],
        };
      }
    }

    return getStateFromPath(path, options);
  },
};

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
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  const [initialRoute, setInitialRoute] = useState<keyof RootStackParamList | null>(null);
  const [fontTimeout, setFontTimeout] = useState(false);

  // Safety fallback for font loading (max 1.5s) to avoid blank screens on iOS offline
  useEffect(() => {
    const timer = setTimeout(() => {
      setFontTimeout(true);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    let isMounted = true;

    // Safety fallback for routing resolution (max 2s)
    const routeTimer = setTimeout(() => {
      if (isMounted) {
        setInitialRoute((prev) => prev || 'OnboardingWizard');
      }
    }, 2000);

    // Initialize RevenueCat safely
    initRevenueCat().catch(console.warn);

    // On web, check if user arrived via a password reset link (e.g. ?mode=resetPassword&oobCode=XYZ)
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const mode = urlParams.get('mode');
        const oobCode = urlParams.get('oobCode');
        if ((mode === 'resetPassword' || mode === 'reset') && oobCode) {
          if (isMounted) setInitialRoute('ResetPassword');
          return;
        }
      } catch {}
    }

    // Check initial local auth state for initial screen routing
    getAuthState()
      .then((state) => {
        if (!isMounted) return;
        let route: keyof RootStackParamList = 'Login';
        if (!state.isOnboarded) {
          route = 'OnboardingWizard';
        } else if (!state.isLoggedIn) {
          route = 'Login';
        } else {
          if (state.user?.uid) {
            setCurrentUidCache(state.user.uid);
            initRevenueCat(state.user.uid).catch(console.warn);
          }
          route = 'MainTabs';
        }
        activeAuthRoute = route;
        setInitialRoute(route);
      })
      .catch((err) => {
        console.warn('[App] getAuthState error, defaulting to OnboardingWizard:', err);
        if (isMounted) {
          activeAuthRoute = 'OnboardingWizard';
          setInitialRoute('OnboardingWizard');
        }
      });

    // Listen to Firebase live auth state -> activate real-time sync ONLY when auth is ready
    const unsubscribeAuth = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        setCurrentUidCache(fbUser.uid);
        setupRealtimeSync(fbUser.uid);
        await initRevenueCat(fbUser.uid);
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
      isMounted = false;
      clearTimeout(routeTimer);
      unsubscribeAuth();
      stopRealtimeSync();
    };
  }, []);

  const isReady = (fontsLoaded || fontError || fontTimeout) && !!initialRoute;

  useEffect(() => {
    if (isReady) {
      SplashScreen.hideAsync().catch(console.warn);
    }
  }, [isReady]);

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
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap');

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
        /* Micro-animations and Rich Aesthetics */
        @keyframes pulse-radar {
          0% { transform: scale(1); opacity: 0.8; }
          70% { transform: scale(2.2); opacity: 0; }
          100% { transform: scale(2.2); opacity: 0; }
        }

        @keyframes float-subtle {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-4px); }
        }

        @keyframes glow-pulse {
          0%, 100% { box-shadow: 0 0 15px rgba(202, 138, 4, 0.25); }
          50% { box-shadow: 0 0 25px rgba(202, 138, 4, 0.45); }
        }

        @keyframes shimmer-sweep {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }

        /* Card Hover Lift & Micro-Transitions */
        [role="button"], button {
          cursor: pointer !important;
          transition: transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.18s ease, opacity 0.15s ease !important;
        }

        [role="button"]:hover {
          transform: translateY(-1.5px);
        }

        [role="button"]:active {
          transform: scale(0.97) translateY(0);
          opacity: 0.82;
        }

        /* Fix: Remove browser focus outline on TextInputs */
        input, textarea {
          outline: none !important;
          -webkit-appearance: none;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }
        input:focus, textarea:focus {
          outline: none !important;
          box-shadow: 0 0 0 3px rgba(185, 102, 89, 0.15) !important;
        }

        /* Smooth scroll behavior */
        * {
          scroll-behavior: smooth;
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  if (!isReady || !initialRoute) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={colors.clayDeep} />
      </View>
    );
  }

  const isWeb = Platform.OS === 'web';

  return (
    <SafeAreaProvider style={{ flex: 1, backgroundColor: colors.paper }}>
      <LanguageProvider>
        <TourProvider>
          <SubscriptionModalProvider>
            <View style={[{ flex: 1, backgroundColor: colors.paper }, isWeb ? styles.webOuterContainer : styles.mobileContainer]}>
            <View style={[{ flex: 1, backgroundColor: colors.paper }, isWeb ? styles.webInnerFrame : styles.mobileContainer]}>
              <NavigationContainer ref={navigationRef} theme={navTheme} linking={linking}>
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
                    options={{ headerShown: false }}
                  />
                  <Stack.Screen
                    name="OrderDetail"
                    component={OrderDetailScreen}
                    options={{ headerShown: false }}
                  />
                  <Stack.Screen
                    name="ExpenseForm"
                    component={ExpenseFormScreen}
                    options={{ headerShown: false }}
                  />
                  <Stack.Screen
                    name="CustomerList"
                    component={CustomerListScreen}
                    options={{ title: 'Customers' }}
                  />
                  <Stack.Screen
                    name="CustomerDetail"
                    component={CustomerDetailScreen}
                    options={{ headerShown: false }}
                  />
                  <Stack.Screen
                    name="CustomerForm"
                    component={CustomerFormScreen}
                    options={{ headerShown: false }}
                  />
                  <Stack.Screen
                    name="ProductList"
                    component={ProductListScreen}
                    options={{ title: 'Product Catalog' }}
                  />
                  <Stack.Screen
                    name="ProductForm"
                    component={ProductFormScreen}
                    options={{ headerShown: false }}
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
                  <Stack.Screen
                    name="PurchaseList"
                    component={PurchaseListScreen}
                    options={{ title: 'Purchases' }}
                  />
                  <Stack.Screen
                    name="PurchaseForm"
                    component={PurchaseFormScreen}
                    options={{ headerShown: false }}
                  />
                  <Stack.Screen
                    name="EstimateList"
                    component={EstimateListScreen}
                    options={{ title: 'Estimates' }}
                  />
                  <Stack.Screen
                    name="EstimateForm"
                    component={EstimateFormScreen}
                    options={{ headerShown: false }}
                  />
                  <Stack.Screen
                    name="EstimateDetail"
                    component={EstimateDetailScreen}
                    options={{ headerShown: false }}
                  />
                  <Stack.Screen
                    name="InvoiceTemplateCustomizer"
                    component={InvoiceTemplateCustomizerScreen}
                    options={{ headerShown: false }}
                  />
                  <Stack.Screen
                    name="PaywallScreen"
                    component={PaywallScreen}
                    options={{ headerShown: false, presentation: 'modal' }}
                  />
                </Stack.Navigator>
              </NavigationContainer>
            </View>
          </View>
          </SubscriptionModalProvider>
        </TourProvider>
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
