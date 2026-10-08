/**
 * ThemeProvider + useTheme + useThemedStyles
 *
 * Provee tokens de color VERTICE (A3.1) en modo claro/oscuro.
 * appearance vive en useSettingsStore (persistido).
 *
 * Cuando no hay ThemeProvider, useTheme() devuelve el tema claro
 * (comportamiento seguro para pruebas de componentes aislados).
 */

import {
  createContext,
  createElement,
  useMemo,
  useContext,
  useEffect,
} from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';
import type { ThemeColors, ThemeName } from './tokens';
import { light, dark } from './tokens';
import { useSettingsStore } from '@/store/useSettingsStore';

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

interface ThemeContextValue {
  colors: ThemeColors;
  scheme: ThemeName;
  appearance: 'light' | 'dark' | 'auto';
  setAppearance: (v: 'light' | 'dark' | 'auto') => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

// ------------------------------------------------------------------
// Hook useTheme (el que usa cada componente)
// ------------------------------------------------------------------

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  // Sin ThemeProvider → devolver tema claro por defecto (seguro para tests).
  if (!ctx) {
    return {
      colors: light,
      scheme: 'light',
      appearance: 'auto',
      setAppearance: () => {
        // no-op
      },
    };
  }
  return ctx;
}

// ------------------------------------------------------------------
// Hook useThemedStyles — StyleSheet.create memoizado por tema
// ------------------------------------------------------------------

export function useThemedStyles<T extends Record<string, unknown>>(
  createStyles: (colors: ThemeColors) => T,
): T {
  const { colors } = useTheme();
  return useMemo(() => createStyles(colors), [colors]);
}

// ------------------------------------------------------------------
// Provider
// ------------------------------------------------------------------

interface ThemeProviderProps {
  children: React.ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const systemScheme = useRNColorScheme() ?? 'light';
  const appearance = useSettingsStore((s) => s.appearance);
  const setAppearance = useSettingsStore((s) => s.setAppearance);

  const resolved: string = appearance === 'auto' ? (systemScheme ?? 'light') : appearance;
  const scheme: ThemeName = resolved === 'dark' ? 'dark' : 'light';
  const colors = scheme === 'dark' ? dark : light;

  // Aplicar atributo data-theme en web para CSS
  useEffect(() => {
    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.setAttribute('data-theme', scheme);
    }
  }, [scheme]);

  const value = useMemo<ThemeContextValue>(
    () => ({ colors, scheme, appearance, setAppearance }),
    [colors, scheme, appearance, setAppearance],
  );

  return createElement(ThemeContext.Provider, { value }, children);
}
