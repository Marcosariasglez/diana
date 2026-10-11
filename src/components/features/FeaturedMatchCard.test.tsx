// A.7: la tarjeta destacada muestra la explicación del recomendador «content»
// (RPC recommend: «Porque te gustó X»). Sin explicación no pinta nada nuevo
// (la heurística y el arranque en frío no la llevan).
import { render, screen } from '@testing-library/react-native';
import { FeaturedMatchCard } from './FeaturedMatchCard';
import { MOVIES } from '@/mocks/data/catalog';

const ITEM = { media: MOVIES[1], bucket: 'alto' as const };

describe('FeaturedMatchCard · explicación (A.7)', () => {
  it('con explanation pinta la 1ª línea «Porque te gustó…»', async () => {
    await render(<FeaturedMatchCard item={ITEM} explanation="Porque te gustó X" />);
    expect(screen.getByText('Porque te gustó X')).toBeTruthy();
  });

  it('sin explanation no pinta el bloque (ni con array vacío)', async () => {
    await render(<FeaturedMatchCard item={ITEM} />);
    expect(screen.queryByText('Porque te gustó')).toBeNull();
    expect(screen.queryByTestId('featured-explanation')).toBeNull();
  });

  it('explanation vacía/blancos se trata como sin explicación', async () => {
    await render(<FeaturedMatchCard item={ITEM} explanation="   " />);
    expect(screen.queryByTestId('featured-explanation')).toBeNull();
  });

  it('la explicación se incluye en el label de accesibilidad', async () => {
    await render(<FeaturedMatchCard item={ITEM} explanation="Porque te gustó X" />);
    const tree = JSON.stringify(screen.toJSON());
    expect(tree).toContain('Porque te gustó X');
    expect(tree).toContain('nota de IA oculta, Porque te gustó X');
  });
});
