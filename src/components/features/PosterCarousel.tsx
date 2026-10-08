import { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FlashList, type ListRenderItem } from '@shopify/flash-list';
import { LockedAffinityChip } from '@/components/ui/LockedAffinityChip';
import { useTheme } from '@/theme/ThemeProvider';
import { textStyle } from '@/theme/typography';
import type { Media, MediaWithAffinity } from '@/types/media';
import { mediaTitle } from './mediaHelpers';
import { Poster, POSTER_DIMENSIONS } from './Poster';

export interface PosterCarouselProps {
  items: MediaWithAffinity[];
  onPress: (media: Media) => void;
  onSeeAll?: () => void;
  /** Titulo de la seccion (ej. "Joyas ocultas"); si falta no se pinta cabecera. */
  title?: string;
}

const GAP = 12;
const SIDE = 20;
const ITEM_WIDTH = POSTER_DIMENSIONS.medium.width;
/** poster + titulo (1 linea) + chip, con margen. */
const LIST_HEIGHT = POSTER_DIMENSIONS.medium.height + 8 + 20 + 8 + 28 + 16;

function Separator() {
  return <View style={{ width: GAP }} />;
}

export function PosterCarousel({ items, onPress, onSeeAll, title }: PosterCarouselProps) {
  const { colors } = useTheme();
  const renderItem: ListRenderItem<MediaWithAffinity> = useCallback(
    ({ item }) => (
      <View style={styles.item}>
        <Poster media={item.media} size="medium" onPress={() => onPress(item.media)} />
        <Text numberOfLines={1} style={[textStyle('posterTitle'), { color: colors.ink }]}>
          {mediaTitle(item.media)}
        </Text>
        {item.bucket === 'bajo' ? null : <LockedAffinityChip bucket={item.bucket} locked />}
      </View>
    ),
    [onPress],
  );

  return (
    <View>
      {title || onSeeAll ? (
        <View style={styles.header}>
          {title ? (
            <Text accessibilityRole="header" style={[textStyle('sectionTitle'), { color: colors.ink }]}>
              {title}
            </Text>
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
        style={{ height: LIST_HEIGHT }}
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
