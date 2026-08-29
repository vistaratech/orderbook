import React from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import LoginScreen from './LoginScreen';

type Props = NativeStackScreenProps<RootStackParamList, 'Register'>;

export default function RegisterScreen({ navigation, route }: Props) {
  return (
    <LoginScreen
      navigation={navigation as any}
      route={{
        key: route.key,
        name: 'Login',
        params: { initialTab: 'register' },
      }}
    />
  );
}
