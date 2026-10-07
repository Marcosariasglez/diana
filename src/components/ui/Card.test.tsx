import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { Card } from './Card';

describe('Card', () => {
  it('renderiza contenido y responde a onPress', async () => {
    const onPress = jest.fn();
    await render(
      <Card onPress={onPress} accessibilityLabel="Tarjeta">
        <Text>Contenido</Text>
      </Card>,
    );
    await fireEvent.press(screen.getByLabelText('Tarjeta'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
  it('sin onPress no es boton', async () => {
    await render(
      <Card>
        <Text>Estatica</Text>
      </Card>,
    );
    expect(screen.queryByRole('button')).toBeNull();
  });
});
