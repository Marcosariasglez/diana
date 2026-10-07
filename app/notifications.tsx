import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Bell } from 'lucide-react-native';
import { EmptyState, Screen } from '@/components/ui';
import { COLORS } from '@/theme/colors';
import { SHADOWS } from '@/theme/shadows';
import { textStyle } from '@/theme/typography';

export default function NotificationsScreen() {
  const router = useRouter();
  return (
    <Screen>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Volver"
          style={[styles.back, SHADOWS.card]}
        >
          <ArrowLeft size={22} color={COLORS.textPrimary} />
        </Pressable>
        <Text accessibilityRole="header" style={textStyle('screenTitle', { color: COLORS.textPrimary })}>
          Notificaciones
        </Text>
      </View>
      <View style={styles.center}>
        <EmptyState icon={Bell} title="Aún no tienes notificaciones" />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  back: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { flex: 1, justifyContent: 'center' },
});
