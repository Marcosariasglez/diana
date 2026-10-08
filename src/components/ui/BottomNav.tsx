import { useContext, useRef } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Home, SlidersHorizontal, User, Users, type LucideIcon } from 'lucide-react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from 'expo-router/build/react-navigation/bottom-tabs/types';
import { webBlur, withAlpha } from '@/theme/alpha';
import { useTheme, useThemedStyles } from '@/theme/ThemeProvider';
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

export const BOTTOM_NAV_HEIGHT = 88;
export const FAB_OVERHANG = 16;

export type BottomNavProps = Pick<BottomTabBarProps, 'state' | 'navigation'> &
  Partial<Pick<BottomTabBarProps, 'descriptors' | 'insets'>> & {
    onFabPress?: () => void;
  };

/** Barra inferior X2: alto 88 (+ zona segura), fondo card 92 % con desenfoque 16,
 *  borde superior line, pestaña activa ink, etiqueta 10.5/600, FAB con sobresalto 16. */
export function BottomNav({ state, navigation, onFabPress }: BottomNavProps) {
  const { colors, scheme } = useTheme();
  const insets = useContext(SafeAreaInsetsContext);
  const lastTab = useRef<string>(NAV_TABS[0].name);
  const focusedName = state.routes[state.index]?.name;
  if (focusedName && NAV_TABS.some((t) => t.name === focusedName)) {
    lastTab.current = focusedName;
  }
  const highlighted = lastTab.current;
  const isDark = scheme === 'dark';

  const styles = useThemedStyles((c) =>
    StyleSheet.create({
      bar: {
        flexDirection: 'row' as const,
        alignItems: 'center',
        borderTopWidth: 1,
        borderColor: c.line,
        paddingTop: 8,
        paddingHorizontal: 6,
        backgroundColor: withAlpha(c.card, 0.92),
      },
      tab: {
        flex: 1,
        minHeight: 44,
        minWidth: 44,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        paddingTop: 4,
      },
      fabSlot: { flex: 1, alignItems: 'center', alignSelf: 'stretch' },
      fabWrap: { position: 'absolute' as const, top: -FAB_OVERHANG, marginHorizontal: 8 },
    }),
  );

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
    const color = active ? colors.ink : colors.mut;
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
        <Text style={[textStyle('navLabel'), { color }]}>
          {tab.label}
        </Text>
      </Pressable>
    );
  };

  return (
    <View
      testID="bottom-nav"
      style={[
        styles.bar,
        !isDark && Platform.OS === 'web' && webBlur(16),
        { height: BOTTOM_NAV_HEIGHT + (insets?.bottom ?? 0), paddingBottom: insets?.bottom ?? 0 },
      ]}
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
