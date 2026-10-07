import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { COLORS } from '@/theme/colors';
import { SHADOWS } from '@/theme/shadows';
import { textStyle } from '@/theme/typography';

export interface ToastProps {
  message: string;
  visible: boolean;
}

export function Toast({ message, visible }: ToastProps) {
  if (!visible) return null;
  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      accessibilityLabel={message}
      pointerEvents="none"
      style={styles.toast}
    >
      <Text style={[textStyle('bodySmall', { fontWeight: '600' }), styles.text]}>{message}</Text>
    </View>
  );
}

interface ToastContextValue {
  show: (message: string, durationMs?: number) => void;
}

const NOOP: ToastContextValue = { show: () => undefined };
const ToastContext = createContext<ToastContextValue>(NOOP);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState('');
  const [visible, setVisible] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((msg: string, durationMs = 2500) => {
    if (timer.current) clearTimeout(timer.current);
    setMessage(msg);
    setVisible(true);
    timer.current = setTimeout(() => setVisible(false), durationMs);
  }, []);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const value = useMemo(() => ({ show }), [show]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <View pointerEvents="none" style={styles.host}>
        <Toast message={message} visible={visible} />
      </View>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  return useContext(ToastContext);
}

const styles = StyleSheet.create({
  host: { position: 'absolute', left: 16, right: 16, bottom: 110, alignItems: 'center', zIndex: 100 },
  toast: {
    minHeight: 44,
    maxWidth: 480,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 22,
    backgroundColor: COLORS.textPrimary,
    justifyContent: 'center',
    ...SHADOWS.card,
  },
  text: { color: '#FFFFFF', textAlign: 'center' },
});
