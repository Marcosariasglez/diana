import { fireEvent, render, screen } from '@testing-library/react-native';
import { CodeInput, sanitizeRoomCode } from './CodeInput';

describe('CodeInput', () => {
  it('sanitiza: mayusculas, alfabeto y longitud', async () => {
    expect(sanitizeRoomCode('x4i0o9b1z')).toBe('X49B');
    expect(sanitizeRoomCode('ab')).toBe('AB');
  });
  it('renderiza 4 casillas y emite valor normalizado', async () => {
    const onChange = jest.fn();
    await render(<CodeInput value="X4" onChange={onChange} />);
    expect(screen.getAllByTestId('code-tile')).toHaveLength(4);
    await fireEvent.changeText(screen.getByTestId('code-input'), 'x49b');
    expect(onChange).toHaveBeenCalledWith('X49B');
  });
  it('estado de error', async () => {
    await render(<CodeInput value="ABCD" onChange={jest.fn()} error />);
    expect(screen.getByTestId('code-input').props.accessibilityHint).toBeTruthy();
  });
});
