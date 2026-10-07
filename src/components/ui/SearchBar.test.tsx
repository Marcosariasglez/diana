import { fireEvent, render, screen } from '@testing-library/react-native';
import { SearchBar } from './SearchBar';

describe('SearchBar', () => {
  it('propaga texto y borra', async () => {
    const onChangeText = jest.fn();
    await render(<SearchBar value="dune" onChangeText={onChangeText} />);
    await fireEvent.changeText(screen.getByLabelText('Buscar'), 'matrix');
    expect(onChangeText).toHaveBeenCalledWith('matrix');
    await fireEvent.press(screen.getByLabelText('Borrar búsqueda'));
    expect(onChangeText).toHaveBeenCalledWith('');
  });
});
