import { StyleSheet, View } from 'react-native';
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
}

export function PillGroup({ items, selected, onChange, multiple = false, activeColor }: PillGroupProps) {
  const toggle = (value: string) => {
    const isSelected = selected.includes(value);
    if (multiple) {
      onChange(isSelected ? selected.filter((v) => v !== value) : [...selected, value]);
    } else {
      onChange(isSelected ? [] : [value]);
    }
  };
  return (
    <View style={styles.row}>
      {items.map((item) => (
        <Pill
          key={item.value}
          label={item.label}
          active={selected.includes(item.value)}
          activeColor={activeColor}
          onPress={() => toggle(item.value)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
