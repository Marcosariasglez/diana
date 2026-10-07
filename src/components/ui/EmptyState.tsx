import { StyleSheet, Text, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { COLORS } from '@/theme/colors';
import { textStyle } from '@/theme/typography';
import { Button } from './Button';

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  message?: string;
  action?: { label: string; onPress: () => void };
}

export function EmptyState({ icon: Icon, title, message, action }: EmptyStateProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.iconBox} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Icon size={32} color={COLORS.accent} />
      </View>
      <Text accessibilityRole="header" style={[textStyle('body', { fontWeight: '800' }), styles.title]}>
        {title}
      </Text>
      {message ? <Text style={[textStyle('bodySmall'), styles.message]}>{message}</Text> : null}
      {action ? <Button label={action.label} variant="primary" onPress={action.onPress} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 12, paddingHorizontal: 32, paddingVertical: 32 },
  iconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: COLORS.textPrimary, textAlign: 'center', fontSize: 18 },
  message: { color: COLORS.textSecondary, textAlign: 'center' },
});
