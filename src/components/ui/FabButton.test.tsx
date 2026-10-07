import { fireEvent, render, screen } from '@testing-library/react-native';
import { FabButton } from './FabButton';

describe('FabButton', () => {
  it('dispara onPress', async () => {
    const onPress = jest.fn();
    await render(<FabButton onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Registrar en el diario' }));
    expect(onPress).toHaveBeenCalled();
  });
});
