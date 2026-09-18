import React, { createContext, useContext, useState, useCallback } from 'react';
import SubscriptionLimitModal, { SubscriptionLimitModalProps } from '../components/SubscriptionLimitModal';

type ShowModalOptions = Omit<SubscriptionLimitModalProps, 'visible' | 'onClose'>;

interface SubscriptionModalContextType {
  showSubscriptionModal: (options: ShowModalOptions) => void;
  hideSubscriptionModal: () => void;
}

const SubscriptionModalContext = createContext<SubscriptionModalContextType | undefined>(undefined);

// Standalone global trigger listener for non-React / outside-tree invocation
let globalModalTrigger: ((options: ShowModalOptions) => void) | null = null;

export function triggerGlobalSubscriptionModal(options: ShowModalOptions) {
  if (globalModalTrigger) {
    globalModalTrigger(options);
  }
}

export function SubscriptionModalProvider({ children }: { children: React.ReactNode }) {
  const [modalState, setModalState] = useState<{
    visible: boolean;
    options: ShowModalOptions;
  }>({
    visible: false,
    options: {},
  });

  const showSubscriptionModal = useCallback((options: ShowModalOptions) => {
    setModalState({
      visible: true,
      options,
    });
  }, []);

  const hideSubscriptionModal = useCallback(() => {
    setModalState((prev) => ({ ...prev, visible: false }));
  }, []);

  // Register global trigger
  React.useEffect(() => {
    globalModalTrigger = showSubscriptionModal;
    return () => {
      globalModalTrigger = null;
    };
  }, [showSubscriptionModal]);

  return (
    <SubscriptionModalContext.Provider value={{ showSubscriptionModal, hideSubscriptionModal }}>
      {children}
      <SubscriptionLimitModal
        visible={modalState.visible}
        onClose={hideSubscriptionModal}
        {...modalState.options}
      />
    </SubscriptionModalContext.Provider>
  );
}

export function useSubscriptionModal() {
  const context = useContext(SubscriptionModalContext);
  if (!context) {
    throw new Error('useSubscriptionModal must be used within a SubscriptionModalProvider');
  }
  return context;
}
