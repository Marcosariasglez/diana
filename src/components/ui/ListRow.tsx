import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { ChevronRight } from 'lucide-react-native';
import { useThemedStyles, useTheme } from '@/theme/ThemeProvider';
import { textStyle } from '@/theme/typography';

export interface ListRowProps {
  /** Título principal 15/600 */
  title: string;
  /** Subtítulo opcional 12.5/500 en mut */
  subtitle?: string;
  /** Valor a la derecha (Manrope 15/700) */
  value?: string;
  /** Icono a la izquierda 42×42 */
  icon?: LucideIcon;
  /** Color del icono (token c1-c6) */
  iconColor?: string;
  /** Muestra chevron a la derecha */
  onPress?: () => void;
  /** Acceso */
  accessibilityLabel?: string;
  /** Sin separador superior */
  first?: boolean;
}

export function ListRow({
  title,
  subtitle,
  value,
  icon: Icon,
  iconColor,
  onPress,
  accessibilityLabel,
  first = false,
}: ListRowProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles((c) =>
    StyleSheet.create({
      row: {
        flexDirection: 'row' as const,
        alignItems: 'center',
        gap: 12,
        paddingVertical: 11,
        minHeight: 44,
        borderTopWidth: first ? 0 : StyleSheet.hairlineWidth,
        borderTopColor: c.line,
      },
      content: {
        flex: 1,
        minWidth: 0,
      },
      title: { color: c.ink },
      subtitle: { color: c.mut, marginTop: 2 },
      value: { color: c.ink },
      chevron: { color: c.mut },
      iconSlot: {
        width: 42,
        height: 42,
        borderRadius: 21,
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
        flexShrink: 0,
        backgroundColor: iconColor ?? c.chip,
      },
    }),
  );

  const iconBg = iconColor ?? colors.chip;
  const iconFg = iconColor ? colors.onAcc : colors.ink;

  const inner = (
    <>
      {Icon ? (
        <View style={[styles.iconSlot, { backgroundColor: iconBg }]}>
          <Icon size={20} color={iconFg} strokeWidth={2} />
        </View>
      ) : null}
      <View style={styles.content}>
        <Text
          numberOfLines={1}
          style={[textStyle('bodyStrong'), styles.title]}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            numberOfLines={1}
            style={[textStyle('bodySmall'), styles.subtitle]}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {value ? (
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[textStyle('value'), styles.value]}>{value}</Text>
        </View>
      ) : null}
      {onPress ? (
        <ChevronRight size={16} color={styles.chevron.color} strokeWidth={2} />
      ) : null}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? title}
        onPress={onPress}
        style={styles.row}
      >
        {inner}
      </Pressable>
    );
  }

  return (
    <View
      accessibilityLabel={accessibilityLabel ?? title}
      style={styles.row}
    >
      {inner}
    </View>
  );
}
