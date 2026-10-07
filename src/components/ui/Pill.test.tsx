import { fireEvent, render, screen } from '@testing-library/react-native';
import { Pill } from './Pill';

describe('Pill', () => {
  it('muestra estado y dispara onPress', async () => {
    const onPress = jest.fn();
    await render(<Pill label="Drama" active onPress={onPress} />);
    const el = screen.getByRole('button', { name: 'Drama' });
    expect(el.props.accessibilityState.selected).toBe(true);
    await fireEvent.press(el);
    expect(onPress).toHaveBeenCalled();
  });
});
