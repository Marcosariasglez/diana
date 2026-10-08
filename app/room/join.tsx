import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { Button, CodeInput, Screen } from '@/components/ui';
import { ROOM_CODE_LENGTH } from '@/constants/room';
import { useRoomStore } from '@/store/useRoomStore';
import { useTheme, useThemedStyles } from '@/theme/ThemeProvider';
import { SHADOWS } from '@/theme/shadows';
import { textStyle } from '@/theme/typography';

const ERROR_MESSAGES = {
  'not-found': 'No encontramos esa sala',
  full: 'La sala está llena',
} as const;

export default function JoinRoomScreen() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState<keyof typeof ERROR_MESSAGES | null>(null);
  const [loading, setLoading] = useState(false);
  const ready = code.length === ROOM_CODE_LENGTH;
  const { colors } = useTheme();
  const styles = useThemedStyles((c) => StyleSheet.create({
    header: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 16, paddingHorizontal: 20, paddingTop: 12 },
    back: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: c.card,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    },
    title: { color: c.ink },
    body: { flex: 1, paddingHorizontal: 20, paddingTop: 48, gap: 24 },
    hint: { textAlign: 'center' as const },
    errorBox: { minHeight: 24, justifyContent: 'center' as const },
    footer: { paddingHorizontal: 20, paddingBottom: 24 },
  }));

  const onChange = (v: string) => {
    setCode(v);
    if (error) setError(null);
  };

  const join = async () => {
    if (!ready || loading) return;
    setLoading(true);
    setError(null);
    const ok = await useRoomStore.getState().joinRoom(code);
    setLoading(false);
    if (ok) {
      router.replace(`/room/${code}` as never);
    } else {
      setError(useRoomStore.getState().error === 'full' ? 'full' : 'not-found');
    }
  };

  const back = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/match');
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable
          onPress={back}
          accessibilityRole="button"
          accessibilityLabel="Volver"
          style={[styles.back, SHADOWS.card]}
        >
          <ChevronLeft size={20} color={colors.ink} strokeWidth={2} />
        </Pressable>
        <Text accessibilityRole="header" style={[textStyle('screenTitle'), styles.title]}>
          Unirme a la sala
        </Text>
      </View>
      <View style={styles.body}>
        <Text style={[textStyle('body', { color: colors.textSecondary }), styles.hint]}>
          Escribe el código de 4 caracteres
        </Text>
        <CodeInput value={code} onChange={onChange} error={error !== null} />
        <View style={styles.errorBox} accessibilityLiveRegion="polite">
          {error ? (
            <Text
              accessibilityRole="alert"
              style={textStyle('bodySmall', { fontFamily: 'Inter-SemiBold', color: colors.neg, textAlign: 'center' })}
            >
              {ERROR_MESSAGES[error]}
            </Text>
          ) : null}
        </View>
      </View>
      <View style={styles.footer}>
        <Button label="Unirme" onPress={join} disabled={!ready} loading={loading} />
      </View>
    </Screen>
  );
}

