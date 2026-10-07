import { useContext, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Home, SlidersHorizontal, User, Users, type LucideIcon } from 'lucide-react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from 'expo-router/build/react-navigation/bottom-tabs/types';
import { COLORS } from '@/theme/colors';
import { textStyle } from '@/theme/typography';
import { FabButton } from './FabButton';

interface TabDef {
  name: string;
  label: string;
  Icon: LucideIcon;
}

export const NAV_TABS: readonly TabDef[] = [
  { name: 'index', label: 'Inicio', Icon: Home },
  { name: 'mood', label: 'Mood', Icon: SlidersHorizontal },
  { name: 'match', label: 'Match', Icon: Users },
  { name: 'profile', label: 'Perfil', Icon: User },
];

export const BOTTOM_NAV_HEIGHT = 84;
export const FAB_OVERHANG = 24;

export type BottomNavProps = Pick<BottomTabBarProps, 'state' | 'navigation'> &
  Partial<Pick<BottomTabBarProps, 'descriptors' | 'insets'>> & {
    onFabPress?: () => void;
  };

export function BottomNav({ state, navigation, onFabPress }: BottomNavProps) {
  const insets = useContext(SafeAreaInsetsContext);
  const lastTab = useRef<string>(NAV_TABS[0].name);
  const focusedName = state.routes[state.index]?.name;
  if (focusedName && NAV_TABS.some((t) => t.name === focusedName)) {
    lastTab.current = focusedName;
  }
  const highlighted = lastTab.current;

  const onTabPress = (name: string) => {
    const route = state.routes.find((r) => r.name === name);
    const event = navigation.emit({
      type: 'tabPress',
      target: route?.key,
      canPreventDefault: true,
    });
    if (!event.defaultPrevented) {
      navigation.navigate(name as never);
    }
  };

  const renderTab = (tab: TabDef) => {
    const active = tab.name === highlighted;
    const color = active ? COLORS.accent : COLORS.textSecondary;
    return (
      <Pressable
        key={tab.name}
        accessibilityRole="tab"
        accessibilityLabel={tab.label}
        accessibilityState={{ selected: active }}
        onPress={() => onTabPress(tab.name)}
        style={styles.tab}
      >
        <tab.Icon size={24} color={color} strokeWidth={active ? 2.5 : 2} />
        <Text
          style={[textStyle('navLabel', { fontWeight: active ? '700' : '500' }), { color }]}
        >
          {tab.label}
        </Text>
      </Pressable>
    );
  };

  return (
    <View
      testID="bottom-nav"
      style={[styles.bar, { height: BOTTOM_NAV_HEIGHT + (insets?.bottom ?? 0), paddingBottom: insets?.bottom ?? 0 }]}
    >
      {renderTab(NAV_TABS[0])}
      {renderTab(NAV_TABS[1])}
      <View style={styles.fabSlot}>
        <View style={styles.fabWrap}>
          <FabButton
            accessibilityLabel="Registrar en el diario"
            onPress={onFabPress ?? (() => router.push('/daily-log' as never))}
          />
        </View>
      </View>
      {renderTab(NAV_TABS[2])}
      {renderTab(NAV_TABS[3])}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.divider,
  },
  tab: {
    flex: 1,
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  fabSlot: { flex: 1, alignItems: 'center', alignSelf: 'stretch' },
  fabWrap: { position: 'absolute', top: -FAB_OVERHANG },
});
