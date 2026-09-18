import React, { useRef, useEffect, ReactNode } from 'react';
import { View, StyleProp, ViewStyle } from 'react-native';
import { useTour } from '../../context/TourContext';

interface TourTargetProps {
  targetKey: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export default function TourTarget({ targetKey, children, style }: TourTargetProps) {
  const viewRef = useRef<View | null>(null);
  const { registerTarget, unregisterTarget, isTourActive, currentStep, measureCurrentTarget } = useTour();

  useEffect(() => {
    if (viewRef.current && targetKey) {
      registerTarget(targetKey, viewRef.current);
    }
    return () => {
      unregisterTarget(targetKey);
    };
  }, [targetKey, registerTarget, unregisterTarget]);

  // Re-measure when active step targets this element
  useEffect(() => {
    if (isTourActive && (currentStep.targetKey === targetKey || currentStep.targetKey === 'new-order-action')) {
      const timer = setTimeout(() => {
        measureCurrentTarget();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [isTourActive, currentStep.targetKey, targetKey, measureCurrentTarget]);

  return (
    <View ref={viewRef} style={style} collapsable={false}>
      {children}
    </View>
  );
}
