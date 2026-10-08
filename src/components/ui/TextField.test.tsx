import { fireEvent, render, screen } from '@testing-library/react-native';
import { TextField } from './TextField';

describe('TextField', () => {
  it('renderiza con placeholder y propaga el texto', async () => {
    const onChange = jest.fn();
    await render(<TextField label="Nombre" placeholder="Escribe tu nombre" onChangeText={onChange} />);
    const input = screen.getByLabelText('Nombre');
    await fireEvent.changeText(input, 'Marcos');
    expect(onChange).toHaveBeenCalledWith('Marcos');
  });

  it('muestra el mensaje de error cuando hay error', async () => {
    await render(<TextField label="Nombre" error="El nombre es obligatorio" />);
    expect(screen.getByText('El nombre es obligatorio')).toBeTruthy();
  });

  it('sin error no pinta mensaje', async () => {
    await render(<TextField label="Nombre" />);
    expect(screen.queryByLabelText('Nombre')).toBeTruthy();
  });
});
