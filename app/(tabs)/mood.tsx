import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { DoorOpen, KeyRound, type LucideIcon } from 'lucide-react-native';
import { Button, Card, Screen, SegmentedControl, useToast } from '@/components/ui';
import { useRoomState } from '@/features/room/useRoomState';
import type { Complexity } from '@/types/mood';
import { useMoodStore } from '@/store/useMoodStore';
import { useRoomStore } from '@/store/useRoomStore';
import { useTheme, useThemedStyles } from '@/theme/ThemeProvider';
import { SHADOWS } from '@/theme/shadows';
import { textStyle } from '@/theme/typography';

const COMPLEXITY_DESCRIPTIONS: Record<Complexity, string> = {
  express: 'Exprés · 2 preguntas · unos 10 s',
  intermedio: 'Intermedio · 4 preguntas · unos 30 s',
  cinefilo: 'Cinéfilo · 6 preguntas · unos 60 s',
};

const COMPLEXITIES: ReadonlyArray<{ id: Complexity; title: string; subtitle: string }> = [
  { id: 'express', title: 'Exprés', subtitle: 'Rápido' },
  { id: 'intermedio', title: 'Intermedio', subtitle: 'Equilibrado' },
  { id: 'cinefilo', title: 'Cinéfilo', subtitle: 'A fondo' },
];

const MODES = [
  { label: 'Para mí', value: 'solo' },
  { label: 'Con amigos', value: 'group' },
];

interface ActionCardProps {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  onPress: () => void;
  busy?: boolean;
  styles: ReturnType<typeof useThemedStyles<any>>;
  colors: { acc: string; ink: string; textSecondary: string };
}

/** Accion secundaria de sala (mismo lenguaje visual que el antiguo hub Match). */
function ActionCard({ icon: Icon, title, subtitle, onPress, busy = false, styles: s, colors: c }: ActionCardProps) {
  return (
    <Card
      onPress={busy ? undefined : onPress}
      accessibilityLabel={`${title}. ${subtitle}`}
      style={s.actionCard}
    >
      <View style={s.iconCircle}>
        <Icon size={24} color={c.acc} strokeWidth={2} />
      </View>
      <View style={[s.actionTexts, { gap: 16 }]}>
        <Text style={textStyle('body', { fontFamily: 'Manrope-ExtraBold', fontSize: 18, color: c.ink })}>
          {title}
        </Text>
        <Text style={textStyle('bodySmall', { color: c.textSecondary })}>{subtitle}</Text>
      </View>
    </Card>
  );
}

export default function MoodScreen() {
  const router = useRouter();
  const toast = useToast();
  const mode = useMoodStore((s) => s.mode);
  const complexity = useMoodStore((s) => s.complexity);
  const [creating, setCreating] = useState(false);
  const { code, status } = useRoomState({ navigate: false });
  const group = mode === 'group';
  const hasRoom = status === 'active' && !!code;

  const start = () => {
    useMoodStore.getState().startWizard();
    router.push('/mood-wizard');
  };

  const generateCode = async () => {
    if (creating) return;
    setCreating(true);
    try {
      // La afinidad elegida viaja con la sala (0012: el mood de grupo usa su banco).
      const newComplexity = useMoodStore.getState().complexity;
      const code = await useRoomStore.getState().createRoom(newComplexity);
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
    scroll: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 8, gap: 24 },
    title: { color: c.ink, marginBottom: 20 },
    eyebrow: { marginTop: 28, marginBottom: 14, letterSpacing: 0.5 },
    cards: { flexDirection: 'row' as const, gap: 10 },
    card: {
      flex: 1,
      minHeight: 112,
      backgroundColor: c.card,
      borderRadius: 20,
      paddingHorizontal: 12,
      paddingBottom: 18,
      justifyContent: 'flex-end' as const,
      gap: 4,
    },
    levelInfo: { color: c.textSecondary, marginTop: 12, marginBottom: 4 },
    cardSelected: { backgroundColor: c.ink },
    actions: { gap: 14 },
    actionCard: { flexDirection: 'row' as const, alignItems: 'center' as const, minHeight: 88, borderRadius: 20 },
    iconCircle: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: c.accSoft,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    },
    actionTexts: { flex: 1, gap: 2 },
    // E3: gap entre icono y textos en ActionCard (modo "Con amigos")
    iconTextGap: { gap: 16 },
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
          <View>
            <Text style={[textStyle('label'), { color: colors.textSecondary }, styles.eyebrow]}>
              {group ? '¿CÓMO DE AFINADO QUIERES EL MOOD DE LA SALA?' : '¿CUÁNTO QUIERES AFINAR?'}
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
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.65}
                      style={textStyle('body', {
                        fontFamily: 'Manrope-ExtraBold',
                        fontSize: 14,
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
            {/* E3: línea del nivel elegido bajo las tarjetas */}
            {!group ? (
              <Text style={[textStyle('bodySmall'), styles.levelInfo]}>
                {COMPLEXITY_DESCRIPTIONS[complexity]}
              </Text>
            ) : null}
          </View>
          {group ? (
            <View style={styles.actions}>
              {hasRoom ? (
                <ActionCard
                  icon={DoorOpen}
                  title="Volver a mi sala"
                  subtitle={`Código ${code}`}
                  onPress={() => router.push(`/room/${code}` as never)}
                  styles={styles}
                  colors={colors}
                />
              ) : null}
              <ActionCard
                icon={KeyRound}
                title="Unirme con código"
                subtitle="Escribe el código de 4 caracteres"
                onPress={() => router.push('/room/join')}
                styles={styles}
                colors={colors}
              />
            </View>
          ) : null}
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
