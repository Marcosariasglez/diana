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
import { useThemedStyles, useTheme } from '@/theme/ThemeProvider';
import { SHADOWS } from '@/theme/shadows';
import { textStyle } from '@/theme/typography';

export interface ToastProps {
  message: string;
  visible: boolean;
  /** Muestra icono neg a la izquierda (error). */
  error?: boolean;
}

/** Toast A3.4: píldora ink/onInk sobre la barra; error con icono neg. aria-live=polite. */
export function Toast({ message, visible, error = false }: ToastProps) {
  const { scheme } = useTheme();
  const isDark = scheme === 'dark';
  const styles = useThemedStyles((c) =>
    StyleSheet.create({
      toast: {
        minHeight: 44,
        maxWidth: 480,
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 99,
        backgroundColor: c.ink,
        flexDirection: 'row' as const,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
      },
      text: { color: c.onInk, textAlign: 'center' as const },
      dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.neg, flexShrink: 0 },
    }),
  );

  if (!visible) return null;
  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      accessibilityLabel={message}
      pointerEvents="none"
      style={[styles.toast, !isDark && SHADOWS.card]}
    >
      {error ? <View style={styles.dot} importantForAccessibility="no" /> : null}
      <Text style={[textStyle('bodySmall'), styles.text]}>{message}</Text>
    </View>
  );
}

interface ToastContextValue {
  show: (message: string, durationMs?: number, error?: boolean) => void;
}

const NOOP: ToastContextValue = { show: () => undefined };
const ToastContext = createContext<ToastContextValue>(NOOP);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState('');
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((msg: string, durationMs = 2500, isError = false) => {
    if (timer.current) clearTimeout(timer.current);
    setMessage(msg);
    setError(isError);
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
      <View pointerEvents="none" style={stylesHost.host}>
        <Toast message={message} visible={visible} error={error} />
      </View>
    </ToastContext.Provider>
  );
}

const stylesHost = StyleSheet.create({
  host: { position: 'absolute', left: 16, right: 16, bottom: 110, alignItems: 'center', zIndex: 100 },
});

export function useToast(): ToastContextValue {
  return useContext(ToastContext);
}
