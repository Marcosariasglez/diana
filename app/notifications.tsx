import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Bell, Clapperboard, Trash2 } from 'lucide-react-native';
import { EmptyState, Screen } from '@/components/ui';
import { Poster } from '@/components/features/Poster';
import { mediaTitle, mediaYear } from '@/components/features/mediaHelpers';
import { platformName } from '@/constants/platforms';
import { activeCatalogSource } from '@/services/supabase/catalog/select';
import { useNotificationTrayStore, keyOf, type TrayNotice } from '@/store/useNotificationTrayStore';
import { useTheme, useThemedStyles } from '@/theme/ThemeProvider';
import { SHADOWS } from '@/theme/shadows';
import { textStyle } from '@/theme/typography';
import type { Media } from '@/types/media';

/**
 * VERTICE-PLAN-2, D2-4: bandeja de avisos «Ya está en tu plataforma».
 *
 * Lista los avisos de useNotificationTrayStore (generados por
 * useAvailabilityNotifications al detectar que un título de «Quiero ver»
 * pasa a estar en una plataforma del usuario). Al abrir la bandeja se marcan
 * todos como leídos; el tap en una fila abre la ficha.
 */
export default function NotificationsScreen() {
  const router = useRouter();
  const notices = useNotificationTrayStore((s) => s.notices);
  const markAllRead = useNotificationTrayStore((s) => s.markAllRead);
  const clear = useNotificationTrayStore((s) => s.clear);
  const [resolved, setResolved] = useState<Map<string, Media>>(new Map());
  const { colors } = useTheme();
  const styles = useThemedStyles((c) => StyleSheet.create({
    header: {
      flexDirection: 'row' as const,
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 20,
      paddingTop: 16,
    },
    back: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: c.card,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    },
    clearBtn: {
      minWidth: 44,
      minHeight: 40,
      borderRadius: 20,
      backgroundColor: c.chip,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    },
    content: { paddingHorizontal: 20, paddingBottom: 40, gap: 10 },
    row: {
      flexDirection: 'row' as const,
      alignItems: 'center',
      gap: 12,
      padding: 12,
      borderRadius: 14,
      backgroundColor: c.card,
    },
    rowUnread: { borderColor: c.acc, borderWidth: 1 },
    thumb: {
      width: 44,
      height: 66,
      borderRadius: 8,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      overflow: 'hidden',
    },
    contentCol: { flex: 1, minWidth: 0 },
    name: { color: c.ink },
    sub: { color: c.mut, marginTop: 2 },
    unreadDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: c.acc,
    },
    center: { flex: 1, justifyContent: 'center' },
    inkText: { color: c.ink },
  }));

  // Al abrir la bandeja: todo pasa a leído (el badge de la campana se apaga).
  useEffect(() => {
    markAllRead();
  }, [markAllRead]);

  // Resolución perezosa de título/año/plataformas contra el catálogo (una vez
  // por aviso cuyo id no esté resuelto).
  const missing = useMemo(
    () => notices.filter((n) => !resolved.has(keyOf(n.mediaType, n.mediaId))).map((n) => keyOf(n.mediaType, n.mediaId)),
    [notices, resolved],
  );
  useEffect(() => {
    if (missing.length === 0) return;
    let alive = true;
    const movies = missing.filter((k) => k.startsWith('movie:')).map((k) => Number(k.split(':')[1]));
    const tvs = missing.filter((k) => k.startsWith('tv:')).map((k) => Number(k.split(':')[1]));
    void (async () => {
      try {
        const [m, t] = await Promise.all([
          movies.length ? activeCatalogSource.byIds('movie', movies) : [],
          tvs.length ? activeCatalogSource.byIds('tv', tvs) : [],
        ]);
        if (!alive) return;
        const next = new Map<string, Media>();
        for (const media of [...m, ...t]) next.set(keyOf(media.media_type, media.id), media);
        if (next.size > 0) setResolved((prev) => new Map([...prev, ...next]));
      } catch {
        // catálogo no disponible: la fila se pinta con el nombre de las plataformas
      }
    })();
    return () => {
      alive = false;
    };
  }, [missing]);

  const platformText = (n: TrayNotice): string => {
    const names = n.newPlatforms.map(platformName);
    const conj = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`;
    return `Ahora en ${conj}`;
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Volver"
          style={[styles.back, SHADOWS.card]}
        >
          <ArrowLeft size={20} color={colors.ink} strokeWidth={2} />
        </Pressable>
        <Text accessibilityRole="header" style={[textStyle('screenTitle'), styles.inkText]}>
          Notificaciones
        </Text>
        {notices.length > 0 ? (
          <Pressable
            onPress={clear}
            accessibilityRole="button"
            accessibilityLabel="Borrar todas las notificaciones"
            style={styles.clearBtn}
            hitSlop={8}
          >
            <Trash2 size={18} color={colors.ink} strokeWidth={2} />
          </Pressable>
        ) : null}
      </View>

      {notices.length === 0 ? (
        <View style={styles.center}>
          <EmptyState icon={Bell} title="Aún no tienes notificaciones" message="Te avisaremos aquí cuando algo de «Quiero ver» esté en tus plataformas." />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {notices.map((n) => {
            const media = resolved.get(keyOf(n.mediaType, n.mediaId));
            return (
              <Pressable
                key={n.id}
                accessibilityRole="button"
                accessibilityLabel={`${media ? mediaTitle(media) : 'Título ' + n.mediaId}: ${platformText(n)}`}
                onPress={() =>
                  router.push({
                    pathname: '/(tabs)/detail/[id]',
                    params: { id: String(n.mediaId), type: n.mediaType },
                  })
                }
                style={[styles.row, SHADOWS.card, !n.read ? styles.rowUnread : null]}
              >
                <View style={[styles.thumb, { backgroundColor: colors.chip }]}>
                  {media ? <Poster media={media} size="small" /> : <Clapperboard size={18} color={colors.mut} />}
                </View>
                <View style={styles.contentCol}>
                  <Text numberOfLines={1} style={[textStyle('bodyStrong'), styles.name]}>
                    {media ? mediaTitle(media) : `Título ${n.mediaId}`}
                  </Text>
                  <Text numberOfLines={1} style={[textStyle('bodySmall'), styles.sub]}>
                    {media ? `${mediaYear(media)} · ` : ''}
                    {platformText(n)}
                  </Text>
                </View>
                {!n.read ? <View style={styles.unreadDot} accessibilityLabel="No leída" /> : null}
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </Screen>
  );
}
