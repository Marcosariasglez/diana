import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme, useThemedStyles } from '@/theme/ThemeProvider';
import { SHADOWS } from '@/theme/shadows';
import { textStyle } from '@/theme/typography';

export interface MetricCardProps {
  title: string;
  value: string;
  /** Sufijo pequeno junto al valor, p. ej. "/ 5". */
  unit?: string;
  /** Borde superior de 2 px (Ficha). Sin valor, la tarjeta no lleva borde (Perfil). */
  topBorderColor?: string;
  /** Color del valor; por defecto ink. */
  valueColor?: string;
  children?: ReactNode;
  testID?: string;
}

/** Mini-tarjeta X2: fondo card, radio 20, padding 14, gap 3; label 12.5 mut; valor Manrope 20 (−0.02em). */
export function MetricCard({
  title,
  value,
  unit,
  topBorderColor,
  valueColor,
  children,
  testID,
}: MetricCardProps) {
  const { colors, scheme } = useTheme();
  const isDark = scheme === 'dark';
  const vc = valueColor ?? colors.ink;
  const styles = useThemedStyles((c) =>
    StyleSheet.create({
      card: {
        flex: 1,
        backgroundColor: c.card,
        borderRadius: 20,
        padding: 14,
        gap: 3,
      },
      valueRow: {
        flexDirection: 'row' as const,
        alignItems: 'baseline',
        gap: 6,
        marginBottom: 8,
      },
      value: { color: vc, fontFamily: 'Manrope-ExtraBold' as const, fontSize: 20, letterSpacing: -0.4, fontVariant: ['tabular-nums'] as const },
      unit: { color: c.mut },
    }),
  );
  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={`${title}: ${value}${unit ? ` ${unit}` : ''}`}
      style={[
        styles.card,
        !isDark && SHADOWS.card,
        topBorderColor ? { borderTopWidth: 2, borderTopColor: topBorderColor } : null,
      ]}
    >
      <Text style={[textStyle('bodySmall'), { color: colors.mut }]}>{title.toUpperCase()}</Text>
      <View style={styles.valueRow}>
        <Text
          maxFontSizeMultiplier={1.3}
          style={[styles.value, { color: vc }]}
        >
          {value}
        </Text>
        {unit ? (
          <Text style={[textStyle('bodySmall', { fontSize: 10, fontFamily: 'Inter-Bold' }), styles.unit]}>
            {unit}
          </Text>
        ) : null}
      </View>
      {children}
    </View>
  );
}
