import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Screen, SegmentedControl, useToast } from '@/components/ui';
import type { Complexity } from '@/types/mood';
import { useMoodStore } from '@/store/useMoodStore';
import { useRoomStore } from '@/store/useRoomStore';
import { useTheme, useThemedStyles } from '@/theme/ThemeProvider';
import { SHADOWS } from '@/theme/shadows';
import { textStyle } from '@/theme/typography';

const COMPLEXITIES: ReadonlyArray<{ id: Complexity; title: string; subtitle: string }> = [
  { id: 'express', title: 'Exprés', subtitle: 'Rápido' },
  { id: 'intermedio', title: 'Intermedio', subtitle: 'Equilibrado' },
  { id: 'cinefilo', title: 'Cinéfilo', subtitle: 'A fondo' },
];

const MODES = [
  { label: 'Para mí', value: 'solo' },
  { label: 'Con amigos · Generar código', value: 'group' },
];

export default function MoodScreen() {
  const router = useRouter();
  const toast = useToast();
  const mode = useMoodStore((s) => s.mode);
  const complexity = useMoodStore((s) => s.complexity);
  const [creating, setCreating] = useState(false);
  const group = mode === 'group';

  const start = () => {
    useMoodStore.getState().startWizard();
    router.push('/mood-wizard');
  };

  const generateCode = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const code = await useRoomStore.getState().createRoom();
      router.push(`/room/${code}` as never);
    } catch {
      toast.show('No pudimos crear la sala');
    } finally {
      setCreating(false);
    }
  };

  const { colors } = useTheme();
  const styles = useThemedStyles((c) => StyleSheet.create({
    root: { flex: 1 },
    scroll: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 16 },
    title: { color: c.ink, marginBottom: 20 },
    eyebrow: { marginTop: 28, marginBottom: 14, letterSpacing: 0.5 },
    cards: { flexDirection: 'row' as const, gap: 10 },
    card: {
      flex: 1,
      minHeight: 112,
      backgroundColor: c.card,
      borderRadius: 20,
      paddingHorizontal: 14,
      paddingBottom: 18,
      justifyContent: 'flex-end' as const,
      gap: 4,
    },
    cardSelected: { backgroundColor: c.ink },
    footer: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 36 },
  }));

  return (
    <Screen>
      <View style={styles.root}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text accessibilityRole="header" style={[textStyle('screenTitle'), styles.title]}>
            Mood
          </Text>
          <SegmentedControl
            options={MODES}
            selected={mode}
            onChange={(v) => useMoodStore.getState().setMode(v as 'solo' | 'group')}
          />
          {group ? null : (
            <>
              <Text style={[textStyle('label'), { color: colors.textSecondary }, styles.eyebrow]}>
                ¿CUÁNTO QUIERES AFINAR?
              </Text>
              <View style={styles.cards} accessibilityRole="radiogroup">
                {COMPLEXITIES.map((c) => {
                  const selected = c.id === complexity;
                  return (
                    <Pressable
                      key={c.id}
                      accessibilityRole="radio"
                      accessibilityLabel={`${c.title}. ${c.subtitle}`}
                      accessibilityState={{ selected }}
                      onPress={() => useMoodStore.getState().setComplexity(c.id)}
                      style={[styles.card, SHADOWS.card, selected && styles.cardSelected]}
                    >
                      <Text
                        style={textStyle('body', {
                          fontFamily: 'Manrope-ExtraBold',
                          fontSize: 18,
                          color: selected ? colors.onInk : colors.ink,
                        })}
                      >
                        {c.title}
                      </Text>
                      <Text
                        style={textStyle('bodySmall', {
                          color: selected ? colors.mut : colors.textSecondary,
                        })}
                      >
                        {c.subtitle}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}
        </ScrollView>
        <View style={styles.footer}>
          {group ? (
            <Button label="Generar código" onPress={generateCode} loading={creating} />
          ) : (
            <Button label="Empezar" onPress={start} />
          )}
        </View>
      </View>
    </Screen>
  );
}
