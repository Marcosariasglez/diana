import { StyleSheet, Text, View } from 'react-native';
import { Lock } from 'lucide-react-native';
import { COLORS } from '@/theme/colors';
import { textStyle } from '@/theme/typography';

export interface LockedAffinityChipProps {
  bucket: 'alto' | 'medio';
  locked?: boolean;
}

export function LockedAffinityChip({ bucket, locked = true }: LockedAffinityChipProps) {
  const text = bucket === 'alto' ? 'Match alto' : 'Match medio';
  const fg = bucket === 'alto' ? COLORS.accentSoftText : COLORS.textPrimary;
  const bg = bucket === 'alto' ? COLORS.accentSoft : COLORS.surfaceNeutral;
  return (
    <View
      accessible
      accessibilityLabel={locked ? `${text}, bloqueada` : text}
      style={[styles.chip, { backgroundColor: bg }]}
    >
      {locked ? <Lock testID="affinity-lock" size={12} color={fg} strokeWidth={2.5} /> : null}
      <Text style={[textStyle('label', { letterSpacing: 0 }), { color: fg }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    height: 24,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
});
