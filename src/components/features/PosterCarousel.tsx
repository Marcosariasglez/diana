import { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FlashList, type ListRenderItem } from '@shopify/flash-list';
import { LockedAffinityChip } from '@/components/ui/LockedAffinityChip';
import { useTheme } from '@/theme/ThemeProvider';
import { textStyle } from '@/theme/typography';
import type { Media, MediaWithAffinity } from '@/types/media';
import { mediaTitle, mediaYear } from './mediaHelpers';
import { Poster, POSTER_DIMENSIONS } from './Poster';

export interface PosterCarouselProps {
  items: MediaWithAffinity[];
  onPress: (media: Media) => void;
  onSeeAll?: () => void;
  /** Titulo de la seccion (ej. "Joyas ocultas"); si falta no se pinta cabecera. */
  title?: string;
  /** Razón de la fila («Porque te gustó Sicario»); se lee junto al título. */
  subtitle?: string;
  /** Muestra el año bajo el título de cada póster. */
  showYear?: boolean;
}

const GAP = 12;
const SIDE = 20;
const ITEM_WIDTH = POSTER_DIMENSIONS.medium.width;
/** poster + titulo (1 linea) + chip, con margen. */
const LIST_HEIGHT = POSTER_DIMENSIONS.medium.height + 8 + 20 + 8 + 28 + 16;
/** Línea extra del año bajo el título. */
const YEAR_HEIGHT = 20;

function Separator() {
  return <View style={{ width: GAP }} />;
}

export function PosterCarousel({ items, onPress, onSeeAll, title, subtitle, showYear = false }: PosterCarouselProps) {
  const { colors } = useTheme();
  const renderItem: ListRenderItem<MediaWithAffinity> = useCallback(
    ({ item }) => (
      <View style={styles.item}>
        <Poster media={item.media} size="medium" onPress={() => onPress(item.media)} />
        <Text numberOfLines={1} style={[textStyle('posterTitle'), { color: colors.ink }]}>
          {mediaTitle(item.media)}
        </Text>
        {showYear && mediaYear(item.media) > 0 ? (
          <Text style={[textStyle('bodySmall'), { color: colors.mut }]}>{mediaYear(item.media)}</Text>
        ) : null}
        {item.bucket === 'bajo' ? null : <LockedAffinityChip bucket={item.bucket} locked />}
      </View>
    ),
    [onPress, colors.ink, colors.mut, showYear],
  );

  return (
    <View>
      {title || onSeeAll ? (
        <View style={styles.header}>
          {title ? (
            subtitle ? (
              <View style={styles.titleBlock} accessible accessibilityRole="header" accessibilityLabel={`${title}. ${subtitle}`}>
                <Text style={[textStyle('sectionTitle'), { color: colors.ink }]}>{title}</Text>
                <Text style={[textStyle('bodySmall'), { color: colors.mut }]}>{subtitle}</Text>
              </View>
            ) : (
              <Text accessibilityRole="header" style={[textStyle('sectionTitle'), { color: colors.ink }]}>
                {title}
              </Text>
            )
          ) : (
            <View />
          )}
          {onSeeAll ? (
            <Pressable
              onPress={onSeeAll}
              accessibilityRole="button"
              accessibilityLabel={title ? `Ver todo en ${title}` : 'Ver todo'}
              style={styles.seeAll}
            >
              <Text style={textStyle('link', { color: colors.acc })}>Ver todo</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      <FlashList
        horizontal
        data={items}
        renderItem={renderItem}
        keyExtractor={(it) => `${it.media.media_type}-${it.media.id}`}
        ItemSeparatorComponent={Separator}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: SIDE }}
        style={{ height: LIST_HEIGHT + (showYear ? YEAR_HEIGHT : 0) }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SIDE,
    marginBottom: 12,
  },
  titleBlock: { flex: 1, gap: 2 },
  seeAll: {
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  item: {
    width: ITEM_WIDTH,
    gap: 8,
  },
});
