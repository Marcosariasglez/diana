import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { COLORS } from '@/theme/colors';
import { SHADOWS } from '@/theme/shadows';
import { textStyle } from '@/theme/typography';

export interface MetricCardProps {
  title: string;
  value: string;
  /** Sufijo pequeno junto al valor, p. ej. "/ 5". */
  unit?: string;
  /** Borde superior de 2 px (Ficha). Sin valor, la tarjeta no lleva borde (Perfil). */
  topBorderColor?: string;
  /** Color del valor; por defecto textPrimary. */
  valueColor?: string;
  children?: ReactNode;
  testID?: string;
}

export function MetricCard({
  title,
  value,
  unit,
  topBorderColor,
  valueColor = COLORS.textPrimary,
  children,
  testID,
}: MetricCardProps) {
  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={`${title}: ${value}${unit ? ` ${unit}` : ''}`}
      style={[
        styles.card,
        SHADOWS.card,
        topBorderColor ? { borderTopWidth: 2, borderTopColor: topBorderColor } : null,
      ]}
    >
      <Text style={[textStyle('label'), styles.title]}>{title.toUpperCase()}</Text>
      <View style={styles.valueRow}>
        <Text
          maxFontSizeMultiplier={1.3}
          style={[textStyle('predictionRevealed', { color: valueColor })]}
        >
          {value}
        </Text>
        {unit ? <Text style={[textStyle('bodySmall'), styles.unit]}>{unit}</Text> : null}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minHeight: 148,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
  },
  title: {
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginBottom: 8,
  },
  unit: {
    color: COLORS.textSecondary,
  },
});
