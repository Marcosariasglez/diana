import { memo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import type { Media } from '@/types/media';
import { SHADOWS } from '@/theme/shadows';
import { textStyle } from '@/theme/typography';
import { posterColor } from '@/utils/posterColor';
import { mediaTitle, posterUri } from './mediaHelpers';

export type PosterSize = 'small' | 'medium' | 'large' | 'giant';

export const POSTER_DIMENSIONS: Record<PosterSize, { width: number; height: number }> = {
  small: { width: 96, height: 144 },
  medium: { width: 120, height: 180 },
  large: { width: 160, height: 240 },
  giant: { width: 270, height: 405 },
};

export interface PosterProps {
  media: Media;
  size: PosterSize;
  onPress?: () => void;
  /** Oculta el título dentro del bloque cuando no hay imagen (el padre ya lo muestra). */
  hideTitle?: boolean;
}

function PosterBase({ media, size, onPress, hideTitle }: PosterProps) {
  const { width, height } = POSTER_DIMENSIONS[size];
  const title = mediaTitle(media);
  const uri = posterUri(media.poster_path);
  const [failed, setFailed] = useState(false);
  const showImage = uri !== null && !failed;
  const big = size === 'large' || size === 'giant';
  const content = (
    <View
      style={[
        styles.poster,
        big ? { borderRadius: 24 } : null,
        SHADOWS.poster,
        { width, height, backgroundColor: posterColor(media.id) },
      ]}
    >
      {showImage ? (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          cachePolicy="memory-disk"
          onError={() => setFailed(true)}
          accessible={false}
        />
      ) : (
        !hideTitle ? (
          <Text
            numberOfLines={3}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
            maxFontSizeMultiplier={1.2}
            style={[
              textStyle('posterTitle', { color: 'white' }),
              styles.title,
              big && styles.titleBig,
              size === 'giant' && styles.titleGiant,
            ]}
          >
            {title}
          </Text>
        ) : null
      )}
    </View>
  );

  if (!onPress) {
    return (
      <View accessible accessibilityRole="image" accessibilityLabel={`Póster de ${title}`}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Abrir ${title}`}
      style={styles.pressable}
    >
      {content}
    </Pressable>
  );
}

export const Poster = memo(
  PosterBase,
  (prev, next) =>
    prev.media.id === next.media.id &&
    prev.size === next.size &&
    prev.onPress === next.onPress &&
    prev.hideTitle === next.hideTitle,
);

const styles = StyleSheet.create({
  poster: {
    borderRadius: 20,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  pressable: {
    minWidth: 44,
    minHeight: 44,
  },
  title: {
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  titleBig: {
    fontSize: 28,
    lineHeight: 30,
    fontFamily: 'Manrope-ExtraBold',
  },
  titleGiant: {
    fontSize: 40,
    lineHeight: 42,
    fontFamily: 'Manrope-ExtraBold',
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
});
