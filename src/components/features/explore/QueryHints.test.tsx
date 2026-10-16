import { fireEvent, render, screen } from '@testing-library/react-native';
import { QueryHints } from './QueryHints';
import { INITIAL_FILTERS, type ExploreFilters } from '@/features/explore/exploreFilters';

describe('QueryHints', () => {
  it('oculta sin texto en query', async () => {
    await render(
      <QueryHints
        query=""
        filters={INITIAL_FILTERS}
        onApply={jest.fn()}
      />,
    );
    expect(screen.queryByText(/\+/)).toBeNull();
  });

  it('muestra hints cuando hay texto detectable', async () => {
    const onApply = jest.fn();
    await render(
      <QueryHints
        query="thriller"
        filters={INITIAL_FILTERS}
        onApply={onApply}
      />,
    );
    // "thriller" se detecta como género (Suspense)
    const buttons = screen.queryAllByRole('button');
    expect(buttons.some(b => b.props.accessibilityLabel?.startsWith('Añadir filtro'))).toBe(true);
  });

  it('llama onApply con el hint al tocar', async () => {
    const onApply = jest.fn();
    await render(
      <QueryHints
        query="thriller"
        filters={INITIAL_FILTERS}
        onApply={onApply}
      />,
    );
    const buttons = screen.queryAllByRole('button');
    const btn = buttons.find(b => b.props.accessibilityLabel?.startsWith('Añadir filtro'));
    expect(btn).toBeTruthy();
    await fireEvent.press(btn!);
    expect(onApply).toHaveBeenCalled();
  });

  it('no muestra hints ya aplicados', async () => {
    const filtersWithGenre: ExploreFilters = { ...INITIAL_FILTERS, genres: [53] };
    await render(
      <QueryHints
        query="thriller"
        filters={filtersWithGenre}
        onApply={jest.fn()}
      />,
    );
    // Thriller (genre 53) ya está aplicado, no debería aparecer
    expect(screen.queryByText('Género: Suspense')).toBeNull();
  });
});
