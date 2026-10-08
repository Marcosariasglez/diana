import { useCallback } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { ChevronLeft, Plus } from 'lucide-react-native';
import { AvatarSlot } from '@/components/ui/AvatarSlot';
import { Button } from '@/components/ui/Button';
import { RoomCodeTiles } from '@/components/ui/RoomCodeTiles';
import { useToast } from '@/components/ui/Toast';
import { MAX_ROOM_MEMBERS } from '@/constants/room';
import { useTheme, useThemedStyles } from '@/theme/ThemeProvider';
import { SHADOWS } from '@/theme/shadows';
import { textStyle } from '@/theme/typography';
import type { RoomMember } from '@/types/room';

export const COPY_OK_MESSAGE = 'Código copiado';
export const COPY_FAIL_MESSAGE = 'No se pudo copiar el código';

/** Copia el codigo al portapapeles y avisa con un Toast del resultado. */
export function useCopyCode(code: string) {
  const toast = useToast();
  return useCallback(async () => {
    try {
      await Clipboard.setStringAsync(code);
      toast.show(COPY_OK_MESSAGE);
    } catch {
      toast.show(COPY_FAIL_MESSAGE);
    }
  }, [code, toast]);
}

export interface RoomLobbyProps {
  code: string;
  members: RoomMember[];
  hostId: string | null;
  currentUserId: string;
  allReady: boolean;
  starting?: boolean;
  onStart: () => void;
  onToggleReady: (ready: boolean) => void;
  onBack: () => void;
}

export function RoomLobby({
  code,
  members,
  hostId,
  currentUserId,
  allReady,
  starting = false,
  onStart,
  onToggleReady,
  onBack,
}: RoomLobbyProps) {
  const copy = useCopyCode(code);
  const { colors } = useTheme();
  const styles = useThemedStyles((c) => StyleSheet.create({
    root: { flex: 1 },
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
    scroll: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24, gap: 14 },
    card: { backgroundColor: c.card, borderRadius: 24, padding: 24 },
    eyebrow: { textAlign: 'center' as const, letterSpacing: 0.5, marginBottom: 14 },
    cardHeader: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, marginBottom: 16 },
    slots: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, rowGap: 16 },
    slot: { width: '33.333%', alignItems: 'center' as const, gap: 2 },
    plus: { position: 'absolute' as const, top: 0, left: 0, width: 56, height: 56, alignItems: 'center' as const, justifyContent: 'center' as const },
    footer: { paddingHorizontal: 20, paddingBottom: 24, paddingTop: 8, gap: 12 },
    note: { textAlign: 'center' as const },
  }));
  const isHost = hostId !== null && hostId === currentUserId;
  const me = members.find((m) => m.userId === currentUserId);
  const freeCount = Math.max(0, MAX_ROOM_MEMBERS - members.length);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Volver"
          style={[styles.back, SHADOWS.card]}
        >
          <ChevronLeft size={20} color={colors.ink} strokeWidth={2} />
        </Pressable>
        <Text accessibilityRole="header" style={[textStyle('screenTitle'), styles.title]}>
          Sala de amigos
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={[styles.card, SHADOWS.card]}>
          <Text style={[textStyle('label'), { color: colors.textSecondary }, styles.eyebrow]}>
            CÓDIGO DE SALA
          </Text>
          <RoomCodeTiles code={code} onCopy={copy} tone="neutral" />
        </View>

        <View style={[styles.card, SHADOWS.card]}>
          <View style={styles.cardHeader}>
            <Text style={textStyle('sectionTitle', { color: colors.ink })}>
              En la sala
            </Text>
            <Text
              accessibilityLabel={`En la sala ${members.length} de ${MAX_ROOM_MEMBERS}`}
              style={textStyle('bodySmall', { fontFamily: 'Inter-SemiBold', color: colors.textSecondary })}
            >
              {`${members.length} de ${MAX_ROOM_MEMBERS}`}
            </Text>
          </View>
          <View style={styles.slots}>
            {members.map((m) => {
              const host = m.userId === hostId;
              const status = host ? 'Anfitrión' : m.isReady ? 'Lista' : 'Esperando';
              return (
                <View key={m.userId} style={styles.slot}>
                  <AvatarSlot occupied initial={m.initial} name={m.name} tone={host ? 'accent' : 'dark'} size={56} />
                  <Text
                    style={textStyle('label', {
                      letterSpacing: 0,
                      color: host || m.isReady ? colors.acc : colors.textSecondary,
                    })}
                  >
                    {status}
                  </Text>
                </View>
              );
            })}
            {Array.from({ length: freeCount }, (_, i) => (
              <View key={`free-${i}`} style={styles.slot}>
                <View>
                  <AvatarSlot name="Libre" size={56} />
                  <View style={styles.plus} pointerEvents="none">
                    <Plus size={20} color={colors.textSecondary} strokeWidth={2} />
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        {isHost ? (
          <Button
            label="Comenzar Match (Todos listos)"
            onPress={onStart}
            disabled={!allReady}
            loading={starting}
          />
        ) : me ? (
          <Button
            label={me.isReady ? 'Quitar listo' : 'Estoy listo'}
            variant={me.isReady ? 'secondary' : 'primary'}
            onPress={() => onToggleReady(!me.isReady)}
          />
        ) : null}
        <Text style={[textStyle('bodySmall', { color: colors.textSecondary }), styles.note]}>
          Solo el anfitrión puede comenzar
        </Text>
      </View>
    </View>
  );
}

