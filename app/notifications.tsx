import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Bell } from 'lucide-react-native';
import { EmptyState, Screen } from '@/components/ui';
import { useTheme, useThemedStyles } from '@/theme/ThemeProvider';
import { SHADOWS } from '@/theme/shadows';
import { textStyle } from '@/theme/typography';

export default function NotificationsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useThemedStyles((c) => StyleSheet.create({
    header: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 12,
      paddingHorizontal: 20,
      paddingTop: 16,
    },
    back: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: c.card,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    },
    center: { flex: 1, justifyContent: 'center' as const },
    inkText: { color: c.ink },
  }));

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Volver"
          style={[styles.back, SHADOWS.card]}
        >
          <ArrowLeft size={20} color={colors.ink} strokeWidth={2} />
        </Pressable>
        <Text accessibilityRole="header" style={[textStyle('screenTitle'), styles.inkText]}>
          Notificaciones
        </Text>
      </View>
      <View style={styles.center}>
        <EmptyState icon={Bell} title="Aún no tienes notificaciones" />
      </View>
    </Screen>
  );
}
