import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { COLORS } from '@/theme/colors';
import { SHADOWS } from '@/theme/shadows';
import { textStyle } from '@/theme/typography';

export type ButtonVariant = 'primary' | 'secondary' | 'dark';

export interface ButtonProps {
  label: string;
  variant?: ButtonVariant;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

const VARIANTS = {
  primary: { bg: COLORS.accent, fg: '#FFFFFF', shadow: SHADOWS.buttonPrimary },
  secondary: { bg: COLORS.card, fg: COLORS.textPrimary, shadow: SHADOWS.card },
  dark: { bg: COLORS.textPrimary, fg: '#FFFFFF', shadow: SHADOWS.card },
} as const;

export function Button({
  label,
  variant = 'primary',
  onPress,
  disabled = false,
  loading = false,
  accessibilityLabel,
  style,
}: ButtonProps) {
  const v = VARIANTS[variant];
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        v.shadow,
        { backgroundColor: disabled ? COLORS.disabled : v.bg },
        pressed && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator testID="button-spinner" color={v.fg} />
      ) : (
        <Text
          style={[
            textStyle('body', { fontWeight: '700' }),
            { color: disabled ? COLORS.textSecondary : v.fg },
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 60,
    minWidth: 44,
    borderRadius: 30,
    paddingHorizontal: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.88 },
});
