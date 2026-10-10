import { Tabs } from 'expo-router';
import { BottomNav } from '@/components/ui/BottomNav';
import { useAvailabilityNotifications } from '@/features/notifications/useAvailabilityNotifications';

export default function TabsLayout() {
  // D2-4: detección de «Ya está en tu plataforma» (bandeja de avisos).
  // Se monta una vez para todas las tabs; rellena useNotificationTrayStore.
  useAvailabilityNotifications();
  return (
    <Tabs
      tabBar={(props) => <BottomNav {...props} />}
      backBehavior="history"
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="mood" />
      <Tabs.Screen name="match" />
      <Tabs.Screen name="profile" />
      <Tabs.Screen name="detail/[id]" options={{ href: null }} />
    </Tabs>
  );
}
