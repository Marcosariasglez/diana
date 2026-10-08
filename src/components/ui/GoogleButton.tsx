import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useThemedStyles } from '@/theme/ThemeProvider';
import { textStyle } from '@/theme/typography';

/**
 * Botón de Google según A3.4:
 * - Píldora, fondo `card`, borde `lineStrong` 1px
 * - Logotipo "G" oficial a color + "Continuar con Google" `ink` 16/600
 * - Alto 52
 */
export interface GoogleButtonProps {
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  accessibilityLabel?: string;
}

// SVG path del logo "G" de Google (oficial, a color)
const GOOGLE_LOGO_COLORS = ['#4285F4', '#EA4335', '#FBBC05', '#34A853'];

export function GoogleButton({
  onPress,
  disabled = false,
  loading = false,
  accessibilityLabel,
}: GoogleButtonProps) {
  const styles = useThemedStyles((c) =>
    StyleSheet.create({
      button: {
        minHeight: 52,
        minWidth: 44,
        borderRadius: 99,
        backgroundColor: c.card,
        borderWidth: 1,
        borderColor: c.lineStrong,
        flexDirection: 'row' as const,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        opacity: disabled || loading ? 0.5 : 1,
      },
      text: { color: c.ink },
    }),
  );

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? 'Continuar con Google'}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        pressed && !disabled && { opacity: 0.7 },
      ]}
    >
      <View style={{ width: 20, height: 20, borderRadius: 10 }}>
        <View style={{
          width: 20,
          height: 20,
          borderRadius: 10,
          backgroundColor: '#fff',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Text style={{ fontSize: 14, fontWeight: 'bold', color: GOOGLE_LOGO_COLORS[0] }}>
            G
          </Text>
        </View>
      </View>
      <Text style={[textStyle('button'), styles.text]}>
        Continuar con Google
      </Text>
    </Pressable>
  );
}
