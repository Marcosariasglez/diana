import { Pressable, StyleSheet, Text, View } from 'react-native';
import { COLORS } from '@/theme/colors';
import { SHADOWS } from '@/theme/shadows';
import { textStyle } from '@/theme/typography';

export interface SegmentedOption {
  label: string;
  value: string;
}

export interface SegmentedControlProps {
  options: SegmentedOption[];
  selected: string;
  onChange: (value: string) => void;
}

export function SegmentedControl({ options, selected, onChange }: SegmentedControlProps) {
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
                textStyle('bodySmall', { fontWeight: '600' }),
                { color: active ? COLORS.textPrimary : COLORS.textSecondary },
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

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    backgroundColor: COLORS.surfaceNeutral,
    borderRadius: 24,
    padding: 3,
  },
  segment: {
    flex: 1,
    minHeight: 44,
    minWidth: 44,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  active: { backgroundColor: COLORS.card, ...SHADOWS.card },
});
