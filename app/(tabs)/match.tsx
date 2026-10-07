import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { DoorOpen, KeyRound, Plus, type LucideIcon } from 'lucide-react-native';
import { Card, Screen, useToast } from '@/components/ui';
import { useRoomState } from '@/features/room/useRoomState';
import { useRoomStore } from '@/store/useRoomStore';
import { COLORS } from '@/theme/colors';
import { textStyle } from '@/theme/typography';

interface ActionCardProps {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  onPress: () => void;
  busy?: boolean;
}

function ActionCard({ icon: Icon, title, subtitle, onPress, busy = false }: ActionCardProps) {
  return (
    <Card
      onPress={busy ? undefined : onPress}
      accessibilityLabel={`${title}. ${subtitle}`}
      style={styles.card}
    >
      <View style={styles.iconCircle}>
        <Icon size={24} color={COLORS.accent} strokeWidth={2} />
      </View>
      <View style={styles.texts}>
        <Text style={textStyle('body', { fontWeight: '800', fontSize: 18, color: COLORS.textPrimary })}>
          {title}
        </Text>
        <Text style={textStyle('bodySmall', { color: COLORS.textSecondary })}>{subtitle}</Text>
      </View>
    </Card>
  );
}

export default function MatchScreen() {
  const router = useRouter();
  const toast = useToast();
  const { code, status } = useRoomState({ navigate: false });
  const [creating, setCreating] = useState(false);
  const hasRoom = status === 'active' && !!code;

  const createRoom = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const newCode = await useRoomStore.getState().createRoom();
      router.push(`/room/${newCode}` as never);
    } catch {
      toast.show('No pudimos crear la sala');
    } finally {
      setCreating(false);
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text accessibilityRole="header" style={[textStyle('screenTitle', { fontSize: 36 }), styles.title]}>
          Match
        </Text>
        <View style={styles.list}>
          {hasRoom ? (
            <ActionCard
              icon={DoorOpen}
              title="Volver a tu sala"
              subtitle={`Código ${code}`}
              onPress={() => router.push(`/room/${code}` as never)}
            />
          ) : null}
          <ActionCard
            icon={Plus}
            title="Crear sala"
            subtitle="Genera un código y compártelo con tus amigos"
            onPress={createRoom}
            busy={creating}
          />
          <ActionCard
            icon={KeyRound}
            title="Unirme con código"
            subtitle="Escribe el código de 4 caracteres"
            onPress={() => router.push('/room/join')}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 40 },
  title: { color: COLORS.textPrimary, marginBottom: 24 },
  list: { gap: 14 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 16, minHeight: 88, borderRadius: 20 },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: { flex: 1, gap: 2 },
});
