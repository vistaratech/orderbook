import { Alert, Platform } from 'react-native';

interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
}

/**
 * Cross-platform confirmation dialog that works on iOS, Android, and Web browsers.
 * - On Web: uses window.confirm (standard browser modal)
 * - On Mobile: uses native Alert.alert with action buttons
 */
export function confirmAction({
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmOptions) {
  if (Platform.OS === 'web') {
    const confirmed = typeof window !== 'undefined' ? window.confirm(`${title}\n\n${message}`) : true;
    if (confirmed) {
      onConfirm();
    } else {
      onCancel?.();
    }
    return;
  }

  Alert.alert(title, message, [
    {
      text: cancelText,
      style: 'cancel',
      onPress: onCancel,
    },
    {
      text: confirmText,
      style: destructive ? 'destructive' : 'default',
      onPress: onConfirm,
    },
  ]);
}

/**
 * Cross-platform alert dialog that displays standard alerts on Web and Native.
 */
export function showAppAlert(title: string, message: string, onOk?: () => void) {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      window.alert(`${title}\n\n${message}`);
    }
    onOk?.();
    return;
  }
  Alert.alert(title, message, [{ text: 'OK', onPress: onOk }]);
}
