import { useEffect } from 'react';
import { Redirect, Stack, useRootNavigationState, useSegments } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useProfileStore } from '@/store/useProfileStore';
import { useStoresHydrated } from '@/store/useStoresHydrated';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useHistoryStore } from '@/store/useHistoryStore';
import { ToastProvider } from '@/components/ui/Toast';
import { BACKEND } from '@/lib/env';
import { useAuthStore } from '@/store/useAuthStore';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';
import '../global.css';

SplashScreen.preventAutoHideAsync();

function OnboardingGuard() {
  const hasOnboarded = useProfileStore((s) => s.hasOnboarded);
  const authStatus = useAuthStore((s) => s.status);
  const segments = useSegments();
  const navReady = !!useRootNavigationState()?.key;
  if (!navReady) return null;
  const first = segments[0] as string | undefined;
  if (BACKEND === 'supabase') {
    if (authStatus === 'signedOut') return first === 'login' ? null : <Redirect href="/login" />;
    if (authStatus === 'signedIn' && first === 'login') return <Redirect href={hasOnboarded ? '/' : '/welcome'} />;
  }
  const inOnboarding = first === '(onboarding)';
  if (!hasOnboarded && !inOnboarding) return <Redirect href="/welcome" />;
  if (hasOnboarded && inOnboarding) return <Redirect href="/" />;
  return null;
}

function AppContent() {
  const { scheme } = useTheme();
  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="login" options={{ animation: 'fade' }} />
        <Stack.Screen name="(onboarding)" options={{ animation: 'fade' }} />
        <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
        <Stack.Screen
          name="mood-wizard"
          options={{ presentation: 'fullScreenModal', animation: 'fade', gestureEnabled: false }}
        />
        <Stack.Screen name="mood-results" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="daily-log" options={{ presentation: 'modal' }} />
        <Stack.Screen name="notifications" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="see-all/[category]" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="room/join" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="room/[code]/index" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen
          name="room/[code]/mood"
          options={{ animation: 'slide_from_right', gestureEnabled: false }}
        />
        <Stack.Screen
          name="room/[code]/swipe"
          options={{ presentation: 'fullScreenModal', animation: 'fade', gestureEnabled: false }}
        />
      </Stack>
      <OnboardingGuard />
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    'Manrope-SemiBold': require('../assets/fonts/Manrope-SemiBold.ttf'),
    'Manrope-Bold': require('../assets/fonts/Manrope-Bold.ttf'),
    'Manrope-ExtraBold': require('../assets/fonts/Manrope-ExtraBold.ttf'),
    'Inter-Regular': require('../assets/fonts/Inter-Regular.ttf'),
    'Inter-Medium': require('../assets/fonts/Inter-Medium.ttf'),
    'Inter-SemiBold': require('../assets/fonts/Inter-SemiBold.ttf'),
    'Inter-Bold': require('../assets/fonts/Inter-Bold.ttf'),
  });
  const storesReady = useStoresHydrated();
  const authStatus = useAuthStore((s) => s.status);
  const ready = (fontsLoaded || !!fontError) && storesReady && (BACKEND === 'mock' || authStatus !== 'loading');

  useEffect(() => {
    void useAuthStore.getState().init();
  }, []);

  // Temporizador de seguridad: si algo no hidrata en 4 s, se arranca igualmente.
  useEffect(() => {
    const t = setTimeout(() => {
      useProfileStore.setState({ hasHydrated: true });
      useHistoryStore.setState({ hasHydrated: true });
      useSettingsStore.setState({ hasHydrated: true });
      SplashScreen.hideAsync();
    }, 4000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <ToastProvider>
            <AppContent />
          </ToastProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
