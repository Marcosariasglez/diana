import { Alert, Platform } from 'react-native';

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
}

/** Confirmacion: Alert en nativo, window.confirm en web (Alert.alert no funciona en web). */
export function confirmDialog({
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancelar',
  onConfirm,
}: ConfirmOptions): void {
  if (Platform.OS === 'web') {
    const text = message ? `${title}\n${message}` : title;
    const ok = typeof window !== 'undefined' && typeof window.confirm === 'function' ? window.confirm(text) : true;
    if (ok) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: cancelLabel, style: 'cancel' },
    { text: confirmLabel, style: 'destructive', onPress: onConfirm },
  ]);
}
