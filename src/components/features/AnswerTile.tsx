import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useTheme } from '@/theme/ThemeProvider';
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
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={multiple ? 'checkbox' : 'button'}
      accessibilityLabel={`${title}. ${subtitle}`}
      accessibilityState={multiple ? { checked: selected } : { selected }}
      style={[
        styles.tile,
        { backgroundColor: colors.card },
        selected && { backgroundColor: colors.ink },
      ]}
    >
      <View style={[styles.iconCircle, { backgroundColor: selected ? 'transparent' : colors.accSoft }]}>
        <Icon size={24} color={selected ? colors.onInk : colors.acc} strokeWidth={2} />
      </View>
      <View style={styles.texts}>
        <Text style={textStyle('body', { fontFamily: 'Manrope-Bold', color: selected ? colors.onInk : colors.ink })}>
          {title}
        </Text>
        <Text style={textStyle('bodySmall', { color: selected ? colors.onInk : colors.textSecondary })}>{subtitle}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    minHeight: 150,
    minWidth: 44,
    borderRadius: 24,
    padding: 16,
    justifyContent: 'space-between',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: { gap: 2 },
});
