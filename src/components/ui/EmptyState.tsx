import { StyleSheet, Text, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { textStyle } from '@/theme/typography';
import { Button } from './Button';

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  message?: string;
  action?: { label: string; onPress: () => void };
}

export function EmptyState({ icon: Icon, title, message, action }: EmptyStateProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.wrap}>
      <View style={[styles.iconBox, { backgroundColor: colors.accSoft }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Icon size={32} color={colors.acc} />
      </View>
      <Text accessibilityRole="header" style={[textStyle('body', { fontFamily: 'Manrope-ExtraBold' }), { color: colors.ink, textAlign: 'center', fontSize: 18 }]}>
        {title}
      </Text>
      {message ? <Text style={[textStyle('bodySmall'), { color: colors.textSecondary, textAlign: 'center' }]}>{message}</Text> : null}
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
    alignItems: 'center',
    justifyContent: 'center',
  },
});
