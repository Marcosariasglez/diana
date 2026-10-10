import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Bookmark, X } from 'lucide-react-native';
import { Card } from '@/components/ui/Card';
import { Poster } from '@/components/features/Poster';
import { mediaTitle, mediaYear } from '@/components/features/mediaHelpers';
import { activeCatalogSource } from '@/services/supabase/catalog/select';
import { watchlistRepository } from '@/services';
import { reportSyncError } from '@/lib/syncError';
import { useProfileStore } from '@/store/useProfileStore';
import { useWatchlistStore, type WatchlistItem } from '@/store/useWatchlistStore';
import { useTheme, useThemedStyles } from '@/theme/ThemeProvider';
import { textStyle } from '@/theme/typography';
import type { Media } from '@/types/media';
import { posterColor } from '@/utils/posterColor';

/**
 * VERTICE-PLAN-2, D2-3.1: sección «Quiero ver» del Perfil.
 * - Lista los títulos de useWatchlistStore (persistencia local + espejo en la
 *   tabla watchlist, migración 0008) y resuelve título/año/plataformas contra
 *   el catálogo (no se duplican en la lista).
 * - Filtro «disponible ahora» = disponibles en las plataformas del perfil.
 * - Tap en la fila → ficha; la X quita de la lista (y del servidor si lo hay).
 */
const keyOf = (i: Pick<WatchlistItem, 'mediaType' | 'mediaId'>) => `${i.mediaType}:${i.mediaId}`;

export function WatchlistSection() {
  const router = useRouter();
  const items = useWatchlistStore((s) => s.items);
  const remove = useWatchlistStore((s) => s.remove);
  const platforms = useProfileStore((s) => s.profile.favoritePlatforms);
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [resolved, setResolved] = useState<Map<string, Media>>(new Map());
  const { colors } = useTheme();
  const styles = useThemedStyles((c) =>
    StyleSheet.create({
      title: { color: c.ink },
      row: {
        flexDirection: 'row' as const,
        alignItems: 'center',
        gap: 12,
        paddingVertical: 10,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: c.line,
      },
      rowFirst: { borderTopWidth: 0 },
      content: { flex: 1, minWidth: 0 },
      name: { color: c.ink },
      sub: { color: c.mut, marginTop: 2 },
      remove: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
        backgroundColor: c.chip,
      },
      empty: { color: c.textSecondary, paddingVertical: 12 },
      filterPill: {
        borderRadius: 99,
        borderWidth: 1,
        paddingHorizontal: 12,
        paddingVertical: 6,
      },
      thumb: {
        width: 44,
        height: 66,
        borderRadius: 8,
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
        overflow: 'hidden',
      },
    }),
  );

  // Resolución perezosa de los títulos contra el catálogo (una vez por id nuevo).
  const missing = useMemo(() => items.filter((i) => !resolved.has(keyOf(i))).map(keyOf), [items, resolved]);
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
        for (const media of [...m, ...t]) next.set(`${media.media_type}:${media.id}`, media);
        if (next.size > 0) setResolved((prev) => new Map([...prev, ...next]));
      } catch {
        // catálogo no disponible (0006 sin desplegar): se muestra con el id
      }
    })();
    return () => {
      alive = false;
    };
  }, [missing]);

  const visible = useMemo(() => {
    const list = items
      .map((i) => ({ ...i, media: resolved.get(keyOf(i)) }))
      .sort((a, b) => b.addedAt.localeCompare(a.addedAt));
    if (!onlyAvailable) return list;
    return list.filter((i) => i.media && i.media.platforms.some((p) => platforms.includes(p)));
  }, [items, resolved, onlyAvailable, platforms]);

  const onRemove = (mediaType: Media['media_type'], mediaId: number) => {
    remove(mediaType, mediaId);
    // Al lograr el borrado en el servidor se retira de la cola de pendientes
    // (coherencia offline); si falla, queda para reintentar en el próximo login.
    void watchlistRepository
      .remove(mediaType, mediaId)
      .then(() => useWatchlistStore.getState().markRemoved(mediaType, mediaId))
      .catch(reportSyncError);
  };

  return (
    <Card style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row' as const, alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row' as const, alignItems: 'center', gap: 8 }}>
          <Bookmark size={18} color={colors.acc} strokeWidth={2} />
          <Text style={[textStyle('body', { fontFamily: 'Manrope-ExtraBold', fontSize: 20 }), styles.title]}>
            Quiero ver
          </Text>
        </View>
        {items.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: onlyAvailable }}
            accessibilityLabel={onlyAvailable ? 'Mostrar todos los títulos' : 'Mostrar solo disponibles en mis plataformas'}
            onPress={() => setOnlyAvailable((v) => !v)}
            style={[
              styles.filterPill,
              {
                backgroundColor: onlyAvailable ? colors.accSoft : 'transparent',
                borderColor: onlyAvailable ? colors.acc : colors.line,
              },
            ]}
          >
            <Text style={[textStyle('bodySmall', { fontSize: 12, fontFamily: 'Inter-SemiBold' }), { color: onlyAvailable ? colors.acc : colors.textSecondary }]}>
              {onlyAvailable ? 'Solo disponibles' : 'Disponible ahora'}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {items.length === 0 ? (
        <Text style={[textStyle('body'), styles.empty]}>
          Aún no has añadido nada. Pulsa «Quiero ver» en una ficha.
        </Text>
      ) : visible.length === 0 ? (
        <Text style={[textStyle('body'), styles.empty]}>Ninguno disponible ahora en tus plataformas.</Text>
      ) : (
        <View>
          {visible.map((i, idx) => (
            <View key={keyOf(i)} style={idx === 0 ? styles.rowFirst : styles.row}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Abrir ficha de ${i.media ? mediaTitle(i.media) : `título ${i.mediaId}`}`}
                onPress={() =>
                  router.push({
                    pathname: '/(tabs)/detail/[id]',
                    params: { id: String(i.mediaId), type: i.mediaType },
                  })
                }
                style={{ flex: 1, flexDirection: 'row' as const, alignItems: 'center', gap: 12 }}
              >
                <View style={[styles.thumb, { backgroundColor: i.media ? posterColor(i.media.id) : colors.chip }]}>
                  {i.media ? <Poster media={i.media} size="small" /> : <Bookmark size={16} color={colors.mut} />}
                </View>
                <View style={styles.content}>
                  <Text numberOfLines={1} style={[textStyle('bodyStrong'), styles.name]}>
                    {i.media ? mediaTitle(i.media) : `Título ${i.mediaId}`}
                  </Text>
                  <Text numberOfLines={1} style={[textStyle('bodySmall'), styles.sub]}>
                    {i.media
                      ? `${mediaYear(i.media)} · ${i.media.platforms.length > 0 ? 'disponible' : 'sin plataforma'}`
                      : '…'}
                  </Text>
                </View>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Quitar de Quiero ver: ${i.media ? mediaTitle(i.media) : `título ${i.mediaId}`}`}
                onPress={() => onRemove(i.mediaType, i.mediaId)}
                hitSlop={8}
                style={styles.remove}
              >
                <X size={16} color={colors.ink} strokeWidth={2} />
              </Pressable>
            </View>
          ))}
        </View>
      )}
    </Card>
  );
}
