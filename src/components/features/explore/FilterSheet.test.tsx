import { fireEvent, render, screen } from '@testing-library/react-native';
import { FilterSheet } from './FilterSheet';
import { INITIAL_FILTERS, type ExploreFilters } from '@/features/explore/exploreFilters';

describe('FilterSheet', () => {
  it('renderiza secciones de tipo, plataformas, género, época y ordenar', async () => {
    const onChange = jest.fn();
    await render(
      <FilterSheet
        filters={INITIAL_FILTERS}
        onChange={onChange}
        onApply={jest.fn()}
      />,
    );
    expect(screen.getByText('Tipo')).toBeTruthy();
    expect(screen.getByText('Plataformas')).toBeTruthy();
    expect(screen.getByText('Género')).toBeTruthy();
    expect(screen.getByText('Época')).toBeTruthy();
    expect(screen.getByText('Ordenar')).toBeTruthy();
  });

  it('CTA muestra "Ver resultados" sin total', async () => {
    await render(
      <FilterSheet
        filters={INITIAL_FILTERS}
        onChange={jest.fn()}
        onApply={jest.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Ver resultados' })).toBeTruthy();
  });

  it('CTA muestra "Ver X títulos" con total', async () => {
    await render(
      <FilterSheet
        filters={INITIAL_FILTERS}
        onChange={jest.fn()}
        onApply={jest.fn()}
        total={42}
      />,
    );
    expect(screen.getByRole('button', { name: 'Ver 42 títulos' })).toBeTruthy();
  });

  it('Restablecer llama onChange con filtros limpios', async () => {
    const filtersWithGenre: ExploreFilters = { ...INITIAL_FILTERS, genres: [28] };
    const onChange = jest.fn();
    await render(
      <FilterSheet
        filters={filtersWithGenre}
        onChange={onChange}
        onApply={jest.fn()}
      />,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Restablecer' }));
    expect(onChange).toHaveBeenCalled();
    const cleared = onChange.mock.calls[0][0];
    expect(cleared.genres).toEqual([]);
  });

  it('cambiar tipo llama onChange', async () => {
    const onChange = jest.fn();
    await render(
      <FilterSheet
        filters={INITIAL_FILTERS}
        onChange={onChange}
        onApply={jest.fn()}
      />,
    );
    // Seleccionar "Películas" (value: movie)
    await fireEvent.press(screen.getByRole('tab', { name: 'Películas' }));
    expect(onChange).toHaveBeenCalled();
    const updated = onChange.mock.calls[0][0];
    expect(updated.type).toBe('movie');
  });
});
