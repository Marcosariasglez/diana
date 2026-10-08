import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useThemedStyles } from '@/theme/ThemeProvider';
import { textStyle } from '@/theme/typography';

export interface SegmentedOption {
  label: string;
  value: string;
}

export interface SegmentedControlProps {
  options: SegmentedOption[];
  selected: string;
  onChange: (value: string) => void;
  /** Variante compacta (13/600, ancho automático). */
  sm?: boolean;
}

/** Segmentos X2: pista chip píldora padding 3; opción 14/600 mut; activa fondo ink, texto onInk. */
export function SegmentedControl({ options, selected, onChange, sm = false }: SegmentedControlProps) {
  const styles = useThemedStyles((c) =>
    StyleSheet.create({
      track: {
        flexDirection: 'row',
        backgroundColor: c.chip,
        borderRadius: 99,
        padding: 3,
        gap: 2,
        width: sm ? 'auto' : '100%',
        alignSelf: sm ? 'flex-start' : 'stretch',
      },
      segment: {
        flex: sm ? 0 : 1,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 99,
        paddingVertical: sm ? 6 : 8,
        paddingHorizontal: sm ? 12 : 6,
        minHeight: 44,
      },
      active: {
        backgroundColor: c.ink,
      },
      textActive: { color: c.onInk },
      textInactive: { color: c.mut },
    }),
  );

  return (
    <View accessibilityRole="tablist" style={styles.track}>
      {options.map((o) => {
        const active = o.value === selected;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityLabel={o.label}
            accessibilityState={{ selected: active }}
            onPress={() => onChange(o.value)}
            style={[styles.segment, active && styles.active]}
          >
            <Text
              style={[
                sm
                  ? textStyle('link', { fontSize: 13 })
                  : textStyle('bodySmall', { fontSize: 14 }),
                { fontFamily: 'Inter-SemiBold' },
                active ? styles.textActive : styles.textInactive,
              ]}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
