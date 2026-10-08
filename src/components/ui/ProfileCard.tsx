import { StyleSheet, Text, View } from 'react-native';
import { useThemedStyles } from '@/theme/ThemeProvider';
import { textStyle } from '@/theme/typography';

export interface ProfileCardProps {
  /** Nombre visible (Manrope 18/800) */
  name: string;
  /** Línea secundaria: correo, rol... (Inter 13 mut) */
  subtitle?: string;
  /** Inicial del avatar (1 carácter) */
  initial?: string;
}

export function ProfileCard({ name, subtitle, initial }: ProfileCardProps) {
  const styles = useThemedStyles((c) =>
    StyleSheet.create({
      row: {
        flexDirection: 'row' as const,
        alignItems: 'center',
        gap: 14,
        paddingVertical: 12,
      },
      avatar: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: c.ink,
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
        flexShrink: 0,
        aspectRatio: 1,
      },
      initial: { color: c.onInk },
      name: { color: c.ink },
      subtitle: { color: c.mut, marginTop: 2 },
    }),
  );

  return (
    <View style={styles.row}>
      <View style={styles.avatar}>
        <Text
          style={[
            textStyle('sectionTitle', { fontFamily: 'Manrope-ExtraBold' }),
            { fontSize: 22 },
            styles.initial,
          ]}
        >
          {initial ?? name.charAt(0).toUpperCase()}
        </Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          numberOfLines={1}
          style={[
            textStyle('sectionTitle', { fontFamily: 'Manrope-ExtraBold' }),
            { fontSize: 18 },
            styles.name,
          ]}
        >
          {name}
        </Text>
        {subtitle ? (
          <Text
            numberOfLines={1}
            style={[
              textStyle('bodySmall'),
              { fontSize: 13 },
              styles.subtitle,
            ]}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
