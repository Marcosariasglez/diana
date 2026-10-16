import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { SearchBar } from './SearchBar';

describe('SearchBar', () => {
  it('renderiza campo de búsqueda con placeholder', async () => {
    const onChangeText = jest.fn();
    await render(<SearchBar value="" onChangeText={onChangeText} placeholder="Buscar..." />);
    expect(screen.getByLabelText('Buscar')).toBeTruthy();
  });

  it('llama onChangeText al escribir', async () => {
    const onChangeText = jest.fn();
    await render(<SearchBar value="" onChangeText={onChangeText} />);
    await fireEvent.changeText(screen.getByLabelText('Buscar'), 'pelicula');
    expect(onChangeText).toHaveBeenCalledWith('pelicula');
  });

  it('muestra botón borrar cuando hay texto', async () => {
    const onChangeText = jest.fn();
    await render(<SearchBar value="test" onChangeText={onChangeText} />);
    expect(screen.getByRole('button', { name: 'Borrar búsqueda' })).toBeTruthy();
  });

  it('no muestra botón borrar sin texto', async () => {
    const onChangeText = jest.fn();
    await render(<SearchBar value="" onChangeText={onChangeText} />);
    expect(screen.queryByRole('button', { name: 'Borrar búsqueda' })).toBeNull();
  });

  it('renderiza accessory sin romper funcionalidad', async () => {
    const onChangeText = jest.fn();
    await render(
      <SearchBar
        value=""
        onChangeText={onChangeText}
        accessory={<Text>Accessory</Text>}
      />,
    );
    expect(screen.getByLabelText('Buscar')).toBeTruthy();
    expect(screen.getByText('Accessory')).toBeTruthy();
  });

  it('accessory es opcional (backward-compatible)', async () => {
    const onChangeText = jest.fn();
    await render(<SearchBar value="" onChangeText={onChangeText} />);
    expect(screen.getByLabelText('Buscar')).toBeTruthy();
  });
});
