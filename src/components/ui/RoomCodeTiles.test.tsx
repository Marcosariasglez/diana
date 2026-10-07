import { fireEvent, render, screen } from '@testing-library/react-native';
import { RoomCodeTiles } from './RoomCodeTiles';

describe('RoomCodeTiles', () => {
  it('pinta una casilla por caracter y copia', async () => {
    const onCopy = jest.fn();
    await render(<RoomCodeTiles code="X49B" onCopy={onCopy} />);
    expect(screen.getAllByTestId('room-code-tile')).toHaveLength(4);
    await fireEvent.press(screen.getByLabelText('Copiar código de sala'));
    expect(onCopy).toHaveBeenCalled();
  });
});
