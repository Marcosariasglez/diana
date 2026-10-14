import { ScrollView, StyleSheet, View } from 'react-native';
import { Pill } from './Pill';

export interface PillGroupItem {
  label: string;
  value: string;
}

export interface PillGroupProps {
  items: PillGroupItem[];
  selected: string[];
  onChange: (selected: string[]) => void;
  multiple?: boolean;
  /** Fondo de las pildoras activas; por defecto COLORS.accent. */
  activeColor?: string;
  /** Si true, una sola fila desplazable horizontalmente sin wrap. */
  scrollable?: boolean;
  /** Padding horizontal interno cuando scrollable (por defecto 0). */
  edgePadding?: number;
}

export function PillGroup({
  items,
  selected,
  onChange,
  multiple = false,
  activeColor,
  scrollable = false,
  edgePadding = 0,
}: PillGroupProps) {
  const toggle = (value: string) => {
    const isSelected = selected.includes(value);
    if (multiple) {
      onChange(isSelected ? selected.filter((v) => v !== value) : [...selected, value]);
    } else {
      onChange(isSelected ? [] : [value]);
    }
  };

  const pills = items.map((item) => (
    <Pill
      key={item.value}
      label={item.label}
      active={selected.includes(item.value)}
      activeColor={activeColor}
      onPress={() => toggle(item.value)}
    />
  ));

  if (scrollable) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingHorizontal: edgePadding }]}
      >
        {pills}
      </ScrollView>
    );
  }

  return <View style={styles.row}>{pills}</View>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  scrollContent: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
});
