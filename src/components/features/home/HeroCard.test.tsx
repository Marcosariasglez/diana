// Adaptado de FeaturedMatchCard.test: la razón (reason / explanation) y la
// a11y «nota de IA oculta» se mantienen; nunca aparece una nota numérica.
import { fireEvent, render, screen } from '@testing-library/react-native';
import { FIXTURE_MOVIES } from '@/test/fixtures/catalog';
import type { FeedItem } from '@/types/media';
import { HeroCard, heroMeta } from './HeroCard';

const base: FeedItem = { media: FIXTURE_MOVIES[1], bucket: 'alto' };
const props = { index: 0, total: 5, width: 335, height: 430, onPress: jest.fn() };

describe('HeroCard', () => {
  beforeEach(() => jest.clearAllMocks());

  it('pinta la razón calculada (reason)', async () => {
    await render(<HeroCard {...props} item={{ ...base, reason: { kind: 'liked', text: 'Porque te gustó X' } }} />);
    expect(screen.getByText('Porque te gustó X')).toBeTruthy();
  });

  it('sin reason usa la 1ª explicación del RPC', async () => {
    await render(<HeroCard {...props} item={{ ...base, explanation: ['Porque te gustó Y'] }} />);
    expect(screen.getByText('Porque te gustó Y')).toBeTruthy();
  });

  it('sin razón no pinta la línea', async () => {
    await render(<HeroCard {...props} item={base} />);
    expect(screen.queryByTestId('reason-line')).toBeNull();
  });

  it('el label dice posición, bucket y «nota de IA oculta», con la razón', async () => {
    await render(
      <HeroCard {...props} index={1} item={{ ...base, reason: { kind: 'genre', text: 'Porque te gusta el drama' } }} />,
    );
    const tree = JSON.stringify(screen.toJSON());
    expect(tree).toContain('Para ti, 2 de 5');
    expect(tree).toContain('Match alto, nota de IA oculta, Porque te gusta el drama');
  });

  it('muestra el chip bloqueado salvo con bucket bajo', async () => {
    await render(<HeroCard {...props} item={base} />);
    expect(screen.getByTestId('affinity-lock', { includeHiddenElements: true })).toBeTruthy();
  });

  it('con bucket bajo no hay chip', async () => {
    await render(<HeroCard {...props} item={{ ...base, bucket: 'bajo' }} />);
    expect(screen.queryByTestId('affinity-lock', { includeHiddenElements: true })).toBeNull();
  });

  it('«Ver ficha» abre el título', async () => {
    await render(<HeroCard {...props} item={base} />);
    await fireEvent.press(screen.getByLabelText(/^Ver ficha de /));
    expect(props.onPress).toHaveBeenCalledWith(base.media);
  });

  it('heroMeta junta año, género y duración', () => {
    const media = { ...FIXTURE_MOVIES[1], release_date: '2022-05-01', runtime: 102, genres: [{ id: 18, name: 'Drama' }] };
    expect(heroMeta(media as typeof FIXTURE_MOVIES[1])).toBe('2022 · Drama · 1h 42m');
  });
});
