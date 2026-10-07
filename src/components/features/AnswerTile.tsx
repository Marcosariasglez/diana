import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { COLORS } from '@/theme/colors';
import { SHADOWS } from '@/theme/shadows';
import { textStyle } from '@/theme/typography';

export interface AnswerTileProps {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  selected?: boolean;
  onPress: () => void;
  /** Seleccion multiple: el rol accesible pasa a checkbox. */
  multiple?: boolean;
}

export function AnswerTile({
  icon: Icon,
  title,
  subtitle,
  selected = false,
  onPress,
  multiple = false,
}: AnswerTileProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={multiple ? 'checkbox' : 'button'}
      accessibilityLabel={`${title}. ${subtitle}`}
      accessibilityState={multiple ? { checked: selected } : { selected }}
      style={[styles.tile, SHADOWS.card, selected && styles.selected]}
    >
      <View style={styles.iconCircle}>
        <Icon size={24} color={COLORS.accent} strokeWidth={2} />
      </View>
      <View style={styles.texts}>
        <Text style={textStyle('body', { fontWeight: '700', color: COLORS.textPrimary })}>
          {title}
        </Text>
        <Text style={textStyle('bodySmall', { color: COLORS.textSecondary })}>{subtitle}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    minHeight: 150,
    minWidth: 44,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    justifyContent: 'space-between',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selected: {
    borderColor: COLORS.accent,
    backgroundColor: COLORS.accentSoft,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: {
    gap: 2,
  },
});
