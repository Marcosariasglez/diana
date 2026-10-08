import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { DoorOpen, KeyRound, Plus, type LucideIcon } from 'lucide-react-native';
import { Card, Screen, useToast } from '@/components/ui';
import { useRoomState } from '@/features/room/useRoomState';
import { useRoomStore } from '@/store/useRoomStore';
import { useTheme, useThemedStyles } from '@/theme/ThemeProvider';
import { textStyle } from '@/theme/typography';

interface ActionCardProps {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  onPress: () => void;
  busy?: boolean;
  styles: ReturnType<typeof useThemedStyles<any>>;
  colors: { acc: string; ink: string; textSecondary: string };
}

function ActionCard({ icon: Icon, title, subtitle, onPress, busy = false, styles: s, colors: c }: ActionCardProps) {
  return (
    <Card
      onPress={busy ? undefined : onPress}
      accessibilityLabel={`${title}. ${subtitle}`}
      style={s.card}
    >
      <View style={s.iconCircle}>
        <Icon size={24} color={c.acc} strokeWidth={2} />
      </View>
      <View style={s.texts}>
        <Text style={textStyle('body', { fontFamily: 'Manrope-ExtraBold', fontSize: 18, color: c.ink })}>
          {title}
        </Text>
        <Text style={textStyle('bodySmall', { color: c.textSecondary })}>{subtitle}</Text>
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

  const { colors } = useTheme();
  const styles = useThemedStyles((c) => StyleSheet.create({
    scroll: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 40 },
    title: { color: c.ink, marginBottom: 24 },
    list: { gap: 14 },
    card: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 16, minHeight: 88, borderRadius: 20 },
    iconCircle: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: c.accSoft,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    },
    texts: { flex: 1, gap: 2 },
  }));

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text accessibilityRole="header" style={[textStyle('screenTitle'), styles.title]}>
          Match
        </Text>
        <View style={styles.list}>
          {hasRoom ? (
            <ActionCard
              icon={DoorOpen}
              title="Volver a tu sala"
              subtitle={`Código ${code}`}
              onPress={() => router.push(`/room/${code}` as never)}
              styles={styles}
              colors={colors}
            />
          ) : null}
          <ActionCard
            icon={Plus}
            title="Crear sala"
            subtitle="Genera un código y compártelo con tus amigos"
            onPress={createRoom}
            busy={creating}
            styles={styles}
            colors={colors}
          />
          <ActionCard
            icon={KeyRound}
            title="Unirme con código"
            subtitle="Escribe el código de 4 caracteres"
            onPress={() => router.push('/room/join')}
            styles={styles}
            colors={colors}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}
