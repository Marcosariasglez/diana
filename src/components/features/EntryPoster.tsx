import { memo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { textStyle } from '@/theme/typography';

export interface EntryPosterProps {
  posterPath?: string | null;
  color: string;
  title: string;
  width?: number;
  height?: number;
  radius?: number;
}

const POSTER_BASE_URL = 'https://image.tmdb.org/t/p/w200';

function posterUri(path?: string | null): string | null {
  if (!path) return null;
  return `${POSTER_BASE_URL}${path}`;
}

/** Color de texto sobre el bloque de color del póster. */
const FALLBACK_TEXT_COLOR = 'white';

export const EntryPoster = memo(function EntryPoster({
  posterPath,
  color,
  title,
  width = 40,
  height = 58,
  radius = 10,
}: EntryPosterProps) {
  const uri = posterUri(posterPath);
  const [failed, setFailed] = useState(false);
  const showImage = uri !== null && !failed;
  const initial = title.charAt(0).toUpperCase();

  return (
    <View
      style={[
        styles.poster,
        { width, height, borderRadius: radius, backgroundColor: color },
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
        <Text
          style={[
            textStyle('bodySmall'),
            { color: FALLBACK_TEXT_COLOR, alignSelf: 'center', marginTop: 'auto', marginBottom: 'auto' },
          ]}
        >
          {initial}
        </Text>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  poster: {
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
