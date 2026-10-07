import { fireEvent, render, screen } from '@testing-library/react-native';
import { StarRating, stepRating } from './StarRating';

describe('stepRating', () => {
  it('sube y baja de 0,5 en 0,5', () => {
    expect(stepRating(3, 1)).toBe(3.5);
    expect(stepRating(3, -1)).toBe(2.5);
  });
  it('respeta los limites', () => {
    expect(stepRating(5, 1)).toBeNull();
    expect(stepRating(0.5, -1)).toBeNull();
    expect(stepRating(null, -1)).toBeNull();
  });
  it('incrementar sin nota da 0,5', () => {
    expect(stepRating(null, 1)).toBe(0.5);
  });
});

describe('StarRating', () => {
  it('la mitad izquierda da n - 0,5 y la derecha n', async () => {
    const onChange = jest.fn();
    await render(<StarRating value={null} onChange={onChange} />);
    await fireEvent.press(screen.getByTestId('star-3-left'));
    expect(onChange).toHaveBeenLastCalledWith(2.5);
    await fireEvent.press(screen.getByTestId('star-3-right'));
    expect(onChange).toHaveBeenLastCalledWith(3);
    await fireEvent.press(screen.getByTestId('star-1-left'));
    expect(onChange).toHaveBeenLastCalledWith(0.5);
  });

  it('expone rol adjustable y valor accesible formateado', async () => {
    await render(<StarRating value={4} onChange={jest.fn()} />);
    const el = screen.getByRole('adjustable');
    expect(el.props.accessibilityValue).toEqual({ text: '4,0 de 5' });
  });

  it('las acciones increment/decrement mueven 0,5', async () => {
    const onChange = jest.fn();
    await render(<StarRating value={3} onChange={onChange} />);
    const el = screen.getByRole('adjustable');
    await fireEvent(el, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    expect(onChange).toHaveBeenLastCalledWith(3.5);
    await fireEvent(el, 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } });
    expect(onChange).toHaveBeenLastCalledWith(2.5);
  });

  it('en solo lectura no hay mitades tactiles ni rol adjustable', async () => {
    await render(<StarRating value={2.5} readOnly />);
    expect(screen.queryByTestId('star-1-left')).toBeNull();
    expect(screen.queryByRole('adjustable')).toBeNull();
  });
});
