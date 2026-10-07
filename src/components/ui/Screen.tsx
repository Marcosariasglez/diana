import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '@/theme/colors';

export interface ScreenProps {
  children: ReactNode;
  safe?: boolean;
  bg?: string;
  style?: StyleProp<ViewStyle>;
}

export function Screen({ children, safe = true, bg = COLORS.screenBg, style }: ScreenProps) {
  const Container = safe ? SafeAreaView : View;
  return (
    <Container testID="screen" style={[styles.root, { backgroundColor: bg }, style]}>
      {children}
    </Container>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
