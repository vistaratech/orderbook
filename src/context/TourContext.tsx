import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  ReactNode,
} from 'react';
import { Platform, Dimensions } from 'react-native';
import { hasCompletedTour, setTourCompleted, resetTour } from '../storage/tourStorage';

export interface TourRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TourStep {
  id: string;
  targetKey?: string;
  tab: 'DashboardTab' | 'OrdersTab' | 'ExpensesTab' | 'MoreTab' | string;
  stepNumber?: number;
  totalSteps?: number;
  title: string;
  description: string;
  badgeText?: string;
  iconName: string;
  accentColor?: string;
  position?: 'top' | 'bottom' | 'auto';
  isWelcome?: boolean;
  isCompletion?: boolean;
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    tab: 'DashboardTab',
    isWelcome: true,
    title: 'Welcome to KadaiBook! 👋',
    description:
      'Take a quick 1-minute interactive tour to explore your digital storefront, order fulfillment tracker, and store financial analytics.',
    iconName: 'sparkles',
    accentColor: '#B96659',
  },
  {
    id: 'dashboard-metrics',
    targetKey: 'dashboard-metrics',
    tab: 'DashboardTab',
    stepNumber: 1,
    totalSteps: 7,
    badgeText: 'Step 1 of 7',
    title: 'Daily Metrics & Cash Flow',
    description:
      'Monitor your business at a glance. See live Total Sales, Recorded Expenses, Collected Cash, and Pending Dues with instant profit margin calculation.',
    iconName: 'stats-chart',
    accentColor: '#B96659',
  },
  {
    id: 'dashboard-pipeline',
    targetKey: 'dashboard-pipeline',
    tab: 'DashboardTab',
    stepNumber: 2,
    totalSteps: 7,
    badgeText: 'Step 2 of 7',
    title: 'Live Order Pipeline',
    description:
      'Track customer orders across Placed ➔ Packed ➔ Dispatched ➔ Delivered milestones. Tap any stage to quick-filter orders in that status.',
    iconName: 'git-network-outline',
    accentColor: '#C99A3F',
  },
  {
    id: 'new-order-action',
    targetKey: 'new-order-action',
    tab: 'DashboardTab',
    stepNumber: 3,
    totalSteps: 7,
    badgeText: 'Step 3 of 7',
    title: 'Instant Order Creation',
    description:
      'The quickest way to book customer orders! Add items from your catalog, record payment advances, apply discounts, and generate WhatsApp receipts with one tap.',
    iconName: 'add-circle',
    accentColor: '#B96659',
  },
  {
    id: 'orders-search-filter',
    targetKey: 'orders-search-filter',
    tab: 'OrdersTab',
    stepNumber: 4,
    totalSteps: 7,
    badgeText: 'Step 4 of 7',
    title: 'Search & Payment Tracking',
    description:
      'Filter orders by "Pending" to follow up on outstanding credit balances, or search by customer name, phone number, and order ID to locate any past bill.',
    iconName: 'search-outline',
    accentColor: '#4F7C90',
  },
  {
    id: 'orders-list-area',
    targetKey: 'orders-list-area',
    tab: 'OrdersTab',
    stepNumber: 5,
    totalSteps: 7,
    badgeText: 'Step 5 of 7',
    title: 'Fulfillment & Invoices',
    description:
      'Manage order status, log partial payments, and share professional digital bills (GST & non-GST with UPI QR code) directly with customers on WhatsApp.',
    iconName: 'receipt-outline',
    accentColor: '#6E9E71',
  },
  {
    id: 'expenses-overview',
    targetKey: 'expenses-overview',
    tab: 'ExpensesTab',
    stepNumber: 6,
    totalSteps: 7,
    badgeText: 'Step 6 of 7',
    title: 'Track Store Expenses',
    description:
      'Record outflows for raw materials, courier, packaging, rent, and overheads. KadaiBook automatically calculates your real net business profit.',
    iconName: 'wallet-outline',
    accentColor: '#B9483D',
  },
  {
    id: 'more-menu-hub',
    targetKey: 'more-menu-hub',
    tab: 'MoreTab',
    stepNumber: 7,
    totalSteps: 7,
    badgeText: 'Step 7 of 7',
    title: 'Customers, Catalog & Tools',
    description:
      'Maintain customer credit khata, monitor low-stock inventory, generate price estimates/quotations, and customize 8 bill template styles.',
    iconName: 'grid-outline',
    accentColor: '#9B84B0',
  },
  {
    id: 'tour-completion',
    tab: 'DashboardTab',
    isCompletion: true,
    title: "You're All Set! 🎉",
    description:
      'You are now ready to streamline your store orders and finances with KadaiBook. Need a refresher later? You can restart this tour anytime from Settings.',
    iconName: 'checkmark-done-circle',
    accentColor: '#4E8A54',
  },
];

interface TourContextType {
  isTourActive: boolean;
  currentStepIndex: number;
  currentStep: TourStep;
  targetRect: TourRect | null;
  startTour: (stepIndex?: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  skipTour: () => void;
  finishTour: () => void;
  registerTarget: (key: string, ref: any) => void;
  unregisterTarget: (key: string) => void;
  measureCurrentTarget: () => void;
  setTabSwitcher: (switcher: (tabName: string) => void) => void;
}

const TourContext = createContext<TourContextType | null>(null);

export function TourProvider({ children }: { children: ReactNode }) {
  const [isTourActive, setIsTourActive] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<TourRect | null>(null);
  const targetRegistry = useRef<Map<string, any>>(new Map());
  const tabSwitcherRef = useRef<((tabName: string) => void) | null>(null);

  const setTabSwitcher = useCallback((switcher: (tabName: string) => void) => {
    tabSwitcherRef.current = switcher;
  }, []);

  const registerTarget = useCallback((key: string, ref: any) => {
    if (key && ref) {
      targetRegistry.current.set(key, ref);
    }
  }, []);

  const unregisterTarget = useCallback((key: string) => {
    if (key) {
      targetRegistry.current.delete(key);
    }
  }, []);

  const currentStep = TOUR_STEPS[currentStepIndex] || TOUR_STEPS[0];

  // Measures target element in window coordinates
  const measureCurrentTarget = useCallback(() => {
    const step = TOUR_STEPS[currentStepIndex];
    if (!step || !step.targetKey || step.isWelcome || step.isCompletion) {
      setTargetRect(null);
      return;
    }

    // Resolve target key or aliases
    let targetKey = step.targetKey;
    const isDesktop = Platform.OS === 'web' && Dimensions.get('window').width >= 768;

    let targetRef = targetRegistry.current.get(targetKey);

    // Fallbacks for desktop / mobile responsive keys
    if (!targetRef && targetKey === 'new-order-action') {
      targetRef = isDesktop
        ? targetRegistry.current.get('desktop-new-order')
        : targetRegistry.current.get('new-order-fab');
    }
    if (!targetRef && targetKey === 'more-menu-hub' && isDesktop) {
      targetRef = targetRegistry.current.get('desktop-management-group');
    }

    if (!targetRef) {
      setTargetRect(null);
      return;
    }

    // Measurement for Web
    if (Platform.OS === 'web') {
      try {
        let el: any = null;
        if (targetRef && typeof targetRef.getBoundingClientRect === 'function') {
          el = targetRef;
        } else if (targetRef && targetRef.current && typeof targetRef.current.getBoundingClientRect === 'function') {
          el = targetRef.current;
        }

        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect && (rect.width > 0 || rect.height > 0)) {
            setTargetRect({
              x: rect.left,
              y: rect.top,
              width: rect.width,
              height: rect.height,
            });
            return;
          }
        }
      } catch (e) {
        console.warn('Error measuring web tour target:', e);
      }
    }

    // Measurement for Native
    try {
      const node = targetRef.current || targetRef;
      if (node && typeof node.measureInWindow === 'function') {
        node.measureInWindow((x: number, y: number, width: number, height: number) => {
          if (width > 0 && height > 0) {
            setTargetRect({ x, y, width, height });
          } else {
            setTargetRect(null);
          }
        });
        return;
      }
    } catch (e) {
      console.warn('Error measuring native tour target:', e);
    }

    setTargetRect(null);
  }, [currentStepIndex]);

  // Handle step activation and tab transitions
  const activateStep = useCallback(
    (stepIdx: number) => {
      const safeIdx = Math.max(0, Math.min(stepIdx, TOUR_STEPS.length - 1));
      const nextStepObj = TOUR_STEPS[safeIdx];
      setCurrentStepIndex(safeIdx);
      setTargetRect(null);

      // Switch tab if step belongs to another tab
      if (nextStepObj?.tab && tabSwitcherRef.current) {
        tabSwitcherRef.current(nextStepObj.tab);
      }

      // Staggered measurements to ensure DOM/native layout is fully mounted and rendered
      const t1 = setTimeout(() => { measureCurrentTarget(); }, 120);
      const t2 = setTimeout(() => { measureCurrentTarget(); }, 280);
      const t3 = setTimeout(() => { measureCurrentTarget(); }, 550);

      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
      };
    },
    [measureCurrentTarget]
  );

  const startTour = useCallback(
    (stepIndex = 0) => {
      setIsTourActive(true);
      activateStep(stepIndex);
    },
    [activateStep]
  );

  const nextStep = useCallback(() => {
    if (currentStepIndex < TOUR_STEPS.length - 1) {
      activateStep(currentStepIndex + 1);
    } else {
      finishTour();
    }
  }, [currentStepIndex, activateStep]);

  const prevStep = useCallback(() => {
    if (currentStepIndex > 0) {
      activateStep(currentStepIndex - 1);
    }
  }, [currentStepIndex, activateStep]);

  const skipTour = useCallback(async () => {
    try {
      setIsTourActive(false);
      setTargetRect(null);
      setCurrentStepIndex(0);
      await setTourCompleted(true);
    } catch (e) {
      console.warn('Error skipping tour:', e);
    } finally {
      setIsTourActive(false);
      setTargetRect(null);
      setCurrentStepIndex(0);
    }
  }, []);

  const finishTour = useCallback(async () => {
    try {
      setIsTourActive(false);
      setTargetRect(null);
      setCurrentStepIndex(0);
      await setTourCompleted(true);
      if (tabSwitcherRef.current) {
        tabSwitcherRef.current('DashboardTab');
      }
    } catch (e) {
      console.warn('Error finishing tour:', e);
    } finally {
      setIsTourActive(false);
      setTargetRect(null);
      setCurrentStepIndex(0);
    }
  }, []);

  // Window resize handler for web
  useEffect(() => {
    if (!isTourActive) return;
    const subscription = Dimensions.addEventListener('change', () => {
      setTimeout(measureCurrentTarget, 100);
    });
    return () => subscription.remove();
  }, [isTourActive, measureCurrentTarget]);

  return (
    <TourContext.Provider
      value={{
        isTourActive,
        currentStepIndex,
        currentStep,
        targetRect,
        startTour,
        nextStep,
        prevStep,
        skipTour,
        finishTour,
        registerTarget,
        unregisterTarget,
        measureCurrentTarget,
        setTabSwitcher,
      }}
    >
      {children}
    </TourContext.Provider>
  );
}

export function useTour() {
  const ctx = useContext(TourContext);
  if (!ctx) {
    throw new Error('useTour must be used within a TourProvider');
  }
  return ctx;
}
