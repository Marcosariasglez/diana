import { useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { EyeOff, Heart, X, type LucideIcon } from 'lucide-react-native';
import type { SwipeDir } from '@/features/swipe/direction';
import { COLORS } from '@/theme/colors';
import { SHADOWS } from '@/theme/shadows';
import { textStyle } from '@/theme/typography';
import type { Media } from '@/types/media';
import { mediaMeta, mediaTitle } from './mediaHelpers';
import { SwipeCard, type SwipeCardHandle } from './SwipeCard';

export interface SwipeDeckProps {
  /** Cartas pendientes; la primera es la de arriba. */
  cards: Media[];
  onDecide: (media: Media, dir: SwipeDir) => void;
  /** Cartas ya decididas (para el anuncio accesible "N de M"). */
  progress: number;
  max: number;
  /** Por defecto true; false en grupo (se oculta el boton central). */
  allowUnseen?: boolean;
}

interface RoundButtonProps {
  icon: LucideIcon;
  label: string;
  caption: string;
  primary?: boolean;
  onPress: () => void;
}

function RoundButton({ icon: Icon, label, caption, primary, onPress }: RoundButtonProps) {
  return (
    <View style={styles.buttonCol}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={[styles.round, SHADOWS.card, primary ? styles.roundPrimary : styles.roundLight]}
      >
        <Icon size={28} color={primary ? '#FFFFFF' : COLORS.textPrimary} strokeWidth={2} />
      </Pressable>
      <Text style={textStyle('bodySmall', { color: COLORS.textSecondary })}>{caption}</Text>
    </View>
  );
}

export function SwipeDeck({ cards, onDecide, progress, max, allowUnseen = true }: SwipeDeckProps) {
  const top = cards[0];
  const next = cards[1];
  // La carta de arriba se remonta por `key`, asi que un unico ref apunta siempre a la activa.
  const topHandle = useRef<SwipeCardHandle>(null);

  if (!top) return null;
  return (
    <View style={styles.root}>
      <View
        style={styles.stack}
        accessible={false}
        accessibilityLabel={`Película ${Math.min(progress + 1, max)} de ${max}`}
      >
        {next ? (
          <View style={styles.behind} pointerEvents="none" key={`behind-${next.id}`}>
            <SwipeCard media={next} isTop={false} onDecide={() => undefined} allowUnseen={allowUnseen} />
          </View>
        ) : null}
        <SwipeCard
          key={top.id}
          ref={topHandle}
          media={top}
          isTop
          allowUnseen={allowUnseen}
          onDecide={(dir) => onDecide(top, dir)}
        />
      </View>

      <Text accessibilityRole="header" style={styles.title} numberOfLines={1}>
        {mediaTitle(top)}
      </Text>
      <Text style={textStyle('bodySmall', { color: COLORS.textSecondary })}>{mediaMeta(top)}</Text>

      <View style={styles.buttons}>
        <RoundButton
          icon={X}
          label="Paso"
          caption="← Paso"
          onPress={() => topHandle.current?.decide('skip')}
        />
        {allowUnseen ? (
          <RoundButton
            icon={EyeOff}
            label="No la he visto"
            caption="↑ No la he visto"
            onPress={() => topHandle.current?.decide('unseen')}
          />
        ) : null}
        <RoundButton
          icon={Heart}
          label="Me gusta"
          caption="Me gusta →"
          primary
          onPress={() => topHandle.current?.decide('like')}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
  },
  stack: {
    width: 270,
    height: 405,
    marginTop: 8,
    marginBottom: 20,
  },
  behind: {
    position: 'absolute',
    top: 12,
    left: 0,
    transform: [{ scale: 0.94 }, { rotate: '2deg' }],
    opacity: 0.9,
  },
  title: textStyle('screenTitle', { fontSize: 24, color: COLORS.textPrimary, textAlign: 'center' }),
  buttons: {
    marginTop: 'auto',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 28,
    paddingBottom: 24,
  },
  buttonCol: {
    alignItems: 'center',
    gap: 8,
  },
  round: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundLight: {
    backgroundColor: COLORS.card,
  },
  roundPrimary: {
    backgroundColor: COLORS.accent,
  },
});
