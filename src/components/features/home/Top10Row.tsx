import { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FlashList, type ListRenderItem } from '@shopify/flash-list';
import { useTheme } from '@/theme/ThemeProvider';
import { textStyle } from '@/theme/typography';
import type { FeedItem, Media } from '@/types/media';
import { mediaTitle } from '../mediaHelpers';
import { Poster, POSTER_DIMENSIONS } from '../Poster';
import { RankNumber } from './RankNumber';

export interface Top10RowProps {
  items: FeedItem[];
  onPress: (media: Media) => void;
  title?: string;
}

const MAX = 10;
const SIDE = 20;
const GAP = 8;
/** El póster solapa al número por la izquierda. */
const OVERLAP = 16;
const NUMBER_SIZE = 110;
const LIST_HEIGHT = POSTER_DIMENSIONS.medium.height + 8 + 20 + 16;

function Separator() {
  return <View style={{ width: GAP }} />;
}

/** Ranking «Top 10 para ti»: número grande + póster + título. Sin notas. */
export function Top10Row({ items, onPress, title = 'Top 10 para ti' }: Top10RowProps) {
  const { colors } = useTheme();
  const shown = items.slice(0, MAX);
  const renderItem: ListRenderItem<FeedItem> = useCallback(
    ({ item, index }) => {
      const name = mediaTitle(item.media);
      return (
        <Pressable
          onPress={() => onPress(item.media)}
          accessibilityRole="button"
          accessibilityLabel={`Número ${index + 1} de tu Top 10: ${name}`}
          style={styles.item}
        >
          <RankNumber rank={index + 1} size={NUMBER_SIZE} />
          <View style={styles.posterCol}>
            <Poster media={item.media} size="medium" />
            <Text numberOfLines={1} style={[textStyle('posterTitle'), { color: colors.ink }]}>
              {name}
            </Text>
          </View>
        </Pressable>
      );
    },
    [onPress, colors.ink],
  );

  if (shown.length === 0) return null;
  return (
    <View>
      <View style={styles.header}>
        <Text accessibilityRole="header" style={[textStyle('sectionTitle'), { color: colors.ink }]}>
          {title}
        </Text>
      </View>
      <FlashList
        horizontal
        data={shown}
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
  header: { paddingHorizontal: SIDE, marginBottom: 12 },
  item: { flexDirection: 'row', alignItems: 'flex-end' },
  posterCol: { marginLeft: -OVERLAP, width: POSTER_DIMENSIONS.medium.width, gap: 8 },
});
