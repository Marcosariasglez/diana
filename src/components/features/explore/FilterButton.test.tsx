import { fireEvent, render, screen } from '@testing-library/react-native';
import { FilterButton } from './FilterButton';

describe('FilterButton', () => {
  it('renderiza sin badge cuando count es 0', async () => {
    const onPress = jest.fn();
    await render(<FilterButton count={0} onPress={onPress} />);
    expect(screen.getByRole('button', { name: 'Filtros, 0 activos' })).toBeTruthy();
    expect(screen.queryByText('0')).toBeNull();
  });

  it('muestra badge con número cuando count > 0', async () => {
    const onPress = jest.fn();
    await render(<FilterButton count={3} onPress={onPress} />);
    expect(screen.getByRole('button', { name: 'Filtros, 3 activos' })).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
  });

  it('llama onPress al tocar', async () => {
    const onPress = jest.fn();
    await render(<FilterButton count={1} onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('a11y label refleja número de activos', async () => {
    const onPress = jest.fn();
    await render(<FilterButton count={5} onPress={onPress} />);
    expect(screen.getByRole('button', { name: 'Filtros, 5 activos' })).toBeTruthy();
  });
});
