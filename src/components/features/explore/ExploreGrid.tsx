import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { FlashList, type ListRenderItem } from '@shopify/flash-list';
import { Film } from 'lucide-react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { textStyle } from '@/theme/typography';
import { SHADOWS } from '@/theme/shadows';
import { posterColor } from '@/utils/posterColor';
import { mediaTitle, posterUri } from '@/components/features/mediaHelpers';
import { Image } from 'expo-image';
import { Button } from '@/components/ui/Button';
import type { Media } from '@/types/media';

export interface ExploreGridProps {
  items: Media[];
  status: 'loading' | 'ready' | 'error';
  hasMore: boolean;
  loadingMore: boolean;
  pageError: boolean;
  onLoadMore: () => void;
  onPressItem: (item: Media) => void;
  onRetry?: () => void;
  onPageRetry?: () => void;
}

/** Barra inferior (BOTTOM_NAV_HEIGHT = 72) + 24 de aire; no se importa para no arrastrar la barra a los tests. */
const NAV_CLEARANCE = 96;
const keyOf = (m: Media) => `${m.media_type}-${m.id}`;

/** Calcula columnas responsive según el ancho de pantalla (reactivo a redimensionar). */
function useNumColumns(): number {
  const { width } = useWindowDimensions();
  if (width >= 1024) return 6;
  if (width >= 600) return 4;
  return 3;
}

function PosterCell({ media, onPress }: { media: Media; onPress: () => void }) {
  const { colors } = useTheme();
  const uri = posterUri(media.poster_path);
  const title = mediaTitle(media);
  const [failed, setFailed] = useState(false);
  const showImage = uri !== null && !failed;

  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`Abrir ${title}`} style={styles.cell}>
      <View style={[styles.poster, { backgroundColor: posterColor(media.id), ...SHADOWS.poster }]}>
        {showImage ? (
          <Image
            source={{ uri }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            cachePolicy="memory-disk"
            onError={() => setFailed(true)}
            accessible={false}
          />
        ) : null}
      </View>
      <Text numberOfLines={1} style={[textStyle('posterTitle', { color: colors.ink })]}>
        {title}
      </Text>
    </Pressable>
  );
}

export function ExploreGrid({ items, status, hasMore, loadingMore, pageError, onLoadMore, onPressItem, onRetry, onPageRetry }: ExploreGridProps) {
  const { colors } = useTheme();
  const numColumns = useNumColumns();

  const renderItem: ListRenderItem<Media> = useCallback(
    ({ item }: { item: Media }) => (
      <PosterCell
        media={item}
        onPress={() => onPressItem(item)}
      />
    ),
    [onPressItem],
  );

  // Loading spinner para primera carga
  if (status === 'loading' && items.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.acc} accessibilityLabel="Cargando títulos" />
      </View>
    );
  }

  // Error con botón de reintento
  if (status === 'error' && items.length === 0) {
    return (
      <View style={styles.center}>
        <Film size={48} color={colors.mut} />
        <Text style={[textStyle('body'), { color: colors.mut, marginTop: 12 }]}>
          No se pudo cargar el catálogo
        </Text>
        {onRetry && (
          <Button label="Reintentar" variant="secondary" onPress={onRetry} />
        )}
      </View>
    );
  }

  // Sin resultados: solo cuando la búsqueda terminó (no loading), sin items, y sin más páginas
  if (items.length === 0 && status !== 'loading') {
    return (
      <View style={styles.center}>
        <Film size={48} color={colors.mut} />
        <Text style={[textStyle('body'), { color: colors.mut, marginTop: 12 }]}>
          Sin resultados
        </Text>
      </View>
    );
  }

  return (
    <FlashList
      data={items}
      numColumns={numColumns}
      renderItem={renderItem}
      keyExtractor={keyOf}
      onEndReached={hasMore ? onLoadMore : undefined}
      onEndReachedThreshold={0.4}
      contentContainerStyle={styles.list}
      showsVerticalScrollIndicator={false}
      ListFooterComponent={
        <View>
          {pageError ? (
            <View style={styles.errorBanner}>
              <Text style={[textStyle('bodySmall'), { color: colors.mut }]}>
                No se pudo cargar la siguiente página
              </Text>
              <Button label="Reintentar" variant="secondary" onPress={onPageRetry ?? onLoadMore} />
            </View>
          ) : loadingMore ? (
            <View style={styles.footer}>
              <ActivityIndicator color={colors.acc} accessibilityLabel="Cargando más títulos" />
            </View>
          ) : null}
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: 20,
    // La rejilla llega hasta el borde: el espacio para la barra inferior va DENTRO del scroll.
    paddingBottom: NAV_CLEARANCE,
    paddingTop: 4,
  },
  cell: {
    flex: 1,
    marginHorizontal: 2,
    paddingVertical: 8,
    alignItems: 'center',
    gap: 6,
    maxWidth: '100%',
  },
  poster: {
    width: '100%',
    aspectRatio: 2 / 3,
    borderRadius: 12,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  footer: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  errorBanner: {
    paddingVertical: 16,
    alignItems: 'center',
    gap: 8,
  },
});
