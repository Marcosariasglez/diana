import Svg, { Text as SvgText } from 'react-native-svg';
import { useTheme } from '@/theme/ThemeProvider';

export interface RankNumberProps {
  rank: number;
  /** Alto del número en px. */
  size?: number;
}

/** Número grande con solo contorno (estilo Top 10). Decorativo: el padre lo describe. */
export function RankNumber({ rank, size = 110 }: RankNumberProps) {
  const { colors } = useTheme();
  const label = String(rank);
  // Manrope ExtraBold: ≈0,62 em por dígito.
  const width = Math.round(size * 0.62 * label.length);
  return (
    <Svg
      width={width}
      height={size}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID="rank-number"
    >
      <SvgText
        x={width / 2}
        y={size * 0.84}
        textAnchor="middle"
        fontFamily="Manrope-ExtraBold"
        fontSize={size}
        fill="none"
        stroke={colors.lineStrong}
        strokeWidth={3}
      >
        {label}
      </SvgText>
    </Svg>
  );
}
