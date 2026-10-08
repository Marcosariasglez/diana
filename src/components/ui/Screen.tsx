import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';

export interface ScreenProps {
  children: ReactNode;
  safe?: boolean;
  bg?: string;
  style?: StyleProp<ViewStyle>;
}

export function Screen({ children, safe = true, bg, style }: ScreenProps) {
  const { colors } = useTheme();
  const Container = safe ? SafeAreaView : View;
  return (
    <Container testID="screen" style={[{ flex: 1, backgroundColor: bg ?? colors.bg }, style]}>
      {children}
    </Container>
  );
}
