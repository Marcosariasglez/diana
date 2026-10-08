import {
  ActivityIndicator,
  Pressable,
  Text,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useThemedStyles, useTheme } from '@/theme/ThemeProvider';
import { textStyle } from '@/theme/typography';

export type ButtonVariant = 'primary' | 'secondary' | 'google' | 'destructive';

export interface ButtonProps {
  label: string;
  variant?: ButtonVariant;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

export function Button({
  label,
  variant = 'primary',
  onPress,
  disabled = false,
  loading = false,
  accessibilityLabel,
  style,
}: ButtonProps) {
  const { colors: c } = useTheme();
  const styles = useThemedStyles((c) => ({
    primary: {
      bg: c.ink,
      fg: c.onInk,
      disabledBg: c.chip,
      disabledFg: c.mut,
    },
    secondary: {
      bg: c.chip,
      fg: c.ink,
      disabledBg: c.chip,
      disabledFg: c.mut,
    },
    google: {
      bg: c.card,
      fg: c.ink,
      disabledBg: c.chip,
      disabledFg: c.mut,
    },
    destructive: {
      bg: 'transparent',
      fg: c.neg,
      disabledBg: 'transparent',
      disabledFg: c.mut,
    },
  }));

  const v = styles[variant];
  const inactive = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        {
          minHeight: 52,
          minWidth: 44,
          borderRadius: 99,
          paddingHorizontal: variant === 'secondary' ? 12 : 16,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          backgroundColor: disabled ? v.disabledBg : v.bg,
          opacity: pressed && !disabled ? 0.88 : 1,
          borderWidth: variant === 'google' ? 1 : 0,
          borderColor: variant === 'google' ? c.lineStrong : 'transparent',
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator testID="button-spinner" color={v.fg} />
      ) : (
        <Text
          style={[
            textStyle('button'),
            { color: disabled ? v.disabledFg : v.fg },
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}
