import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { textStyle } from '@/theme/typography';

export type TypeBadgeLabel = 'Pelicula' | 'Película' | 'Serie' | 'Capitulo' | 'Capítulo';

export interface TypeBadgeProps {
  label: TypeBadgeLabel;
}

const PALETTE: Record<string, { bg: string; fg: string }> = {
  Pelicula: { bg: 'ink', fg: 'onInk' },
  'Película': { bg: 'ink', fg: 'onInk' },
  Serie: { bg: 'acc', fg: 'onAcc' },
  Capitulo: { bg: 'card', fg: 'ink' },
  'Capítulo': { bg: 'card', fg: 'ink' },
};

export function TypeBadge({ label }: TypeBadgeProps) {
  const { colors } = useTheme();
  const { bg, fg } = PALETTE[label] ?? PALETTE['Pelicula'];
  return (
    <View style={styles.badge}>
      <Text style={[
        textStyle('bodySmall', { fontFamily: 'Inter-SemiBold' }),
        { backgroundColor: colors[bg as keyof typeof colors], color: colors[fg as keyof typeof colors] },
      ]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 99,
  },
});
