import { fireEvent, render, screen } from '@testing-library/react-native';
import { ActiveFilterChips } from './ActiveFilterChips';
import { INITIAL_FILTERS, toggleGenre, togglePlatform, type ExploreFilters } from '@/features/explore/exploreFilters';

describe('ActiveFilterChips', () => {
  const filtersWithGenre: ExploreFilters = toggleGenre(INITIAL_FILTERS, 28);
  const filtersMulti: ExploreFilters = togglePlatform(filtersWithGenre, 'netflix');

  it('oculta componente sin filtros activos', async () => {
    await render(
      <ActiveFilterChips
        filters={INITIAL_FILTERS}
        onRemove={jest.fn()}
        onClear={jest.fn()}
      />,
    );
    expect(screen.queryByText('Acción')).toBeNull();
    expect(screen.queryByText('Limpiar')).toBeNull();
  });

  it('muestra chips con filtros activos', async () => {
    await render(
      <ActiveFilterChips
        filters={filtersMulti}
        onRemove={jest.fn()}
        onClear={jest.fn()}
      />,
    );
    expect(screen.getByText('Acción')).toBeTruthy();
    expect(screen.getByText('Netflix')).toBeTruthy();
    expect(screen.getByText('Limpiar')).toBeTruthy();
  });

  it('llama onRemove al quitar chip individual', async () => {
    const onRemove = jest.fn();
    await render(
      <ActiveFilterChips
        filters={filtersWithGenre}
        onRemove={onRemove}
        onClear={jest.fn()}
      />,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Quitar filtro Acción' }));
    expect(onRemove).toHaveBeenCalledWith('genre', 28);
  });

  it('llama onClear al tocar Limpiar', async () => {
    const onClear = jest.fn();
    await render(
      <ActiveFilterChips
        filters={filtersMulti}
        onRemove={jest.fn()}
        onClear={onClear}
      />,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Limpiar todos los filtros' }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });
});
