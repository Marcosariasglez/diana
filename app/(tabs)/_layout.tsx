import { Tabs } from 'expo-router';
import { BottomNav } from '@/components/ui/BottomNav';

export default function TabsLayout() {
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
